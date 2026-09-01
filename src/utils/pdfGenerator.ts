import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { LeadPrintItem } from '../components/printing/BillingSlipPrintSheet';
import { A6BillingSlip } from '../components/printing/A6BillingSlip';
import { BrandPrintConfig, getBrandPrintConfig } from '../config/branding';

const A4_LANDSCAPE_WIDTH_MM = 297;
const A4_LANDSCAPE_HEIGHT_MM = 210;
const PDF_MARGIN_MM = 6;
const PDF_GAP_MM = 4;
const SLIP_WIDTH_MM = (A4_LANDSCAPE_WIDTH_MM - PDF_MARGIN_MM * 2 - PDF_GAP_MM) / 2;
const SLIP_HEIGHT_MM = (A4_LANDSCAPE_HEIGHT_MM - PDF_MARGIN_MM * 2 - PDF_GAP_MM) / 2;
const CAPTURE_SCALE = 3;

type PrintReadyItem = LeadPrintItem & {
  brand: BrandPrintConfig;
};

export interface BillingPdfResult {
  pdf: jsPDF;
  pageCount: number;
}

const chunkIntoSheets = <T,>(items: T[], size = 4): T[][] => {
  const sheets: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    sheets.push(items.slice(index, index + size));
  }
  return sheets;
};

const nextPaint = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

const waitForFonts = async () => {
  if ('fonts' in document && document.fonts?.ready) {
    await document.fonts.ready;
  }
};

const waitForImages = async (container: HTMLElement) => {
  const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'));

  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) {
        if (typeof image.decode === 'function') {
          try {
            await image.decode();
          } catch {
            // The image is already loaded; a decode quirk should not block capture.
          }
        }
        return;
      }

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Logo failed to load: ${image.currentSrc || image.src}`));
      });
    })
  );
};

const getOrderLabel = (item: LeadPrintItem, index: number) =>
  item.order?.orderNumber || item.order?.id || item.customer?.fullName || `item ${index + 1}`;

const resolvePrintItems = (items: LeadPrintItem[]): PrintReadyItem[] => {
  if (items.length === 0) {
    throw new Error('Select at least one billing slip to generate.');
  }

  return items.map((item, index) => {
    const orderLabel = getOrderLabel(item, index);
    if (!item.customer) {
      throw new Error(`Customer print details are missing for order ${orderLabel}.`);
    }

    const orderTeam = item.order?.team;
    const brandIdentity = item.team || orderTeam || item.customer.team;
    const brand = getBrandPrintConfig(brandIdentity);

    if (!brand) {
      throw new Error(`Brand could not be resolved for order ${orderLabel}.`);
    }

    if (!item.customer.fullName || !item.customer.address || !item.customer.phone) {
      throw new Error(`Customer print details are incomplete for order ${orderLabel}.`);
    }

    const amount = item.order?.codAmount ?? item.order?.totalAmount;
    if (amount === undefined || amount === null) {
      throw new Error(`COD amount is missing for order ${orderLabel}.`);
    }

    return {
      ...item,
      team: item.team || orderTeam,
      brand,
    };
  });
};

const createCaptureContainer = () => {
  const container = document.createElement('div');
  container.className = 'billing-slip-raster-capture-root';
  Object.assign(container.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${SLIP_WIDTH_MM}mm`,
    height: `${SLIP_HEIGHT_MM}mm`,
    background: '#ffffff',
    pointerEvents: 'none',
    overflow: 'hidden',
  });
  document.body.appendChild(container);
  return container;
};

const convertOklchToRgb = (colorStr: string): string => {
  if (!colorStr || !colorStr.includes('oklch')) return colorStr;

  return colorStr.replace(/oklch\([^)]+\)/g, (match) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = match;
        const resolved = ctx.fillStyle;
        if (resolved && !resolved.includes('oklch')) {
          return resolved;
        }
      }
    } catch (e) {
      // ignore
    }

    const parts = match
      .replace(/oklch\(/, '')
      .replace(/\)/, '')
      .split(/[\s/]+/);
    if (parts.length >= 3) {
      const L = parseFloat(parts[0]);
      const alpha = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
      
      if (L <= 0.1) return `rgba(0, 0, 0, ${alpha})`;
      if (L >= 0.95) return `rgba(255, 255, 255, ${alpha})`;
      
      const grayVal = Math.round(L * 255);
      return `rgba(${grayVal}, ${grayVal}, ${grayVal}, ${alpha})`;
    }
    return match;
  });
};

const replaceOklchStyles = (element: HTMLElement) => {
  const elements = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))];
  
  const stylesToApply = elements.map((el) => {
    const computed = window.getComputedStyle(el);
    return {
      color: convertOklchToRgb(computed.color),
      backgroundColor: convertOklchToRgb(computed.backgroundColor),
      borderTopColor: convertOklchToRgb(computed.borderTopColor),
      borderBottomColor: convertOklchToRgb(computed.borderBottomColor),
      borderLeftColor: convertOklchToRgb(computed.borderLeftColor),
      borderRightColor: convertOklchToRgb(computed.borderRightColor),
      fill: convertOklchToRgb(computed.fill),
      stroke: convertOklchToRgb(computed.stroke),
      boxShadow: convertOklchToRgb(computed.boxShadow),
      outlineColor: convertOklchToRgb(computed.outlineColor),
    };
  });

  elements.forEach((el, index) => {
    const styles = stylesToApply[index];
    if (styles.color) el.style.color = styles.color;
    if (styles.backgroundColor) el.style.backgroundColor = styles.backgroundColor;
    if (styles.borderTopColor) el.style.borderTopColor = styles.borderTopColor;
    if (styles.borderBottomColor) el.style.borderBottomColor = styles.borderBottomColor;
    if (styles.borderLeftColor) el.style.borderLeftColor = styles.borderLeftColor;
    if (styles.borderRightColor) el.style.borderRightColor = styles.borderRightColor;
    if (styles.fill) el.style.fill = styles.fill;
    if (styles.stroke) el.style.stroke = styles.stroke;
    if (styles.boxShadow) el.style.boxShadow = styles.boxShadow;
    if (styles.outlineColor) el.style.outlineColor = styles.outlineColor;
  });
};

const captureSlipImage = async (item: PrintReadyItem): Promise<string> => {
  const container = createCaptureContainer();
  const root = createRoot(container);

  try {
    flushSync(() => {
      root.render(
        React.createElement(A6BillingSlip, {
          customer: item.customer,
          responsibleUser: item.responsibleUser,
          order: item.order,
          team: item.team,
          className: 'billing-slip-capture',
        })
      );
    });

    await nextPaint();
    await waitForFonts();
    await waitForImages(container);
    await nextPaint();

    const slipNode = container.querySelector<HTMLElement>('.billing-slip-capture');
    if (!slipNode) {
      throw new Error('Billing slip capture node was not rendered.');
    }

    replaceOklchStyles(slipNode);

    const canvas = await html2canvas(slipNode, {
      backgroundColor: '#ffffff',
      scale: CAPTURE_SCALE,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: slipNode.offsetWidth,
      height: slipNode.offsetHeight,
      windowWidth: slipNode.scrollWidth,
      windowHeight: slipNode.scrollHeight,
    });

    const dataUrl = canvas.toDataURL('image/png');
    canvas.width = 1;
    canvas.height = 1;
    return dataUrl;
  } finally {
    root.unmount();
    container.remove();
  }
};

export type PdfProgressCallback = (current: number, total: number, percentage: number) => void;

export const generateBillingPdf = async (
  items: LeadPrintItem[],
  onProgress?: PdfProgressCallback
): Promise<BillingPdfResult> => {
  const printItems = resolvePrintItems(items);
  const slipImages: string[] = [];

  onProgress?.(0, printItems.length, 0);

  for (let i = 0; i < printItems.length; i++) {
    const item = printItems[i];
    slipImages.push(await captureSlipImage(item));
    onProgress?.(i + 1, printItems.length, Math.round(((i + 1) / printItems.length) * 100));
  }

  const pages = chunkIntoSheets(slipImages, 4);
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pages.forEach((pageImages, pageIndex) => {
    if (pageIndex > 0) {
      pdf.addPage('a4', 'landscape');
    }

    pageImages.forEach((image, imageIndex) => {
      const column = imageIndex % 2;
      const row = Math.floor(imageIndex / 2);
      const x = PDF_MARGIN_MM + column * (SLIP_WIDTH_MM + PDF_GAP_MM);
      const y = PDF_MARGIN_MM + row * (SLIP_HEIGHT_MM + PDF_GAP_MM);

      pdf.addImage(image, 'PNG', x, y, SLIP_WIDTH_MM, SLIP_HEIGHT_MM, undefined, 'FAST');
    });
  });

  slipImages.length = 0;
  return { pdf, pageCount: pages.length };
};

export const downloadBillingPDF = async (
  items: LeadPrintItem[],
  onProgress?: PdfProgressCallback
): Promise<boolean> => {
  const { pdf } = await generateBillingPdf(items, onProgress);
  pdf.save(`billing_cod_slips_${items.length}.pdf`);
  return true;
};

export const printBillingPDF = async (
  items: LeadPrintItem[],
  onProgress?: PdfProgressCallback
): Promise<boolean> => {
  const { pdf } = await generateBillingPdf(items, onProgress);

  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  });

  return new Promise<boolean>((resolve, reject) => {
    iframe.onload = () => {
      try {
        const printWindow = iframe.contentWindow;
        if (!printWindow) {
          reject(new Error('Unable to open generated PDF for printing.'));
          return;
        }

        printWindow.focus();
        printWindow.print();
        resolve(true);
      } catch (err) {
        reject(err);
      } finally {
        // Clean up the iframe and object URL after a delay of 1 minute to ensure printing works
        setTimeout(() => {
          URL.revokeObjectURL(url);
          iframe.remove();
        }, 60000);
      }
    };

    iframe.onerror = () => {
      URL.revokeObjectURL(url);
      iframe.remove();
      reject(new Error('Unable to load generated PDF for printing.'));
    };

    iframe.src = url;
    document.body.appendChild(iframe);
  });
};

export const billingPdfLayout = {
  pageWidthMm: A4_LANDSCAPE_WIDTH_MM,
  pageHeightMm: A4_LANDSCAPE_HEIGHT_MM,
  marginMm: PDF_MARGIN_MM,
  gapMm: PDF_GAP_MM,
  slipWidthMm: SLIP_WIDTH_MM,
  slipHeightMm: SLIP_HEIGHT_MM,
  captureScale: CAPTURE_SCALE,
};
