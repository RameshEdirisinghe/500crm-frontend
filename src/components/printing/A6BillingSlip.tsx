import React from 'react';
import { Customer, Order, Team, User } from '../../models/domain';
import { BrandPrintConfig, getBrandPrintConfig } from '../../config/branding';
import { formatCurrency } from '../../utils/currency';

export interface A6BillingSlipProps {
  customer: Customer;
  responsibleUser?: User;
  order?: Order;
  team?: Team;
  className?: string;
}

const formatAddress = (address: string): string[] => {
  return address
    .split(/\r?\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const getCodAmount = (order?: Order): string => {
  return formatCurrency(order?.codAmount ?? order?.totalAmount ?? 0);
};

const SlipField: React.FC<{
  label: string;
  value?: string | number | null;
  className?: string;
}> = ({ label, value, className = '' }) => (
  <div className={`min-w-0 ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
    <div 
      className="uppercase text-[#475569] leading-none" 
      style={{ fontSize: '10px', fontWeight: 500, fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {label}
    </div>
    <div 
      className="text-[#000000] leading-snug whitespace-pre-wrap break-words"
      style={{ fontSize: '11.5px', fontWeight: 500, fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {value || <span>&nbsp;</span>}
    </div>
  </div>
);

const SlipHeader: React.FC<{ brand: BrandPrintConfig }> = ({ brand }) => (
  <div className="h-[26mm] border-b-[0.55mm] border-[#000000] flex items-center justify-between px-[5mm] py-[2.5mm] overflow-hidden bg-[#FFFFFF]">
    <div className="flex items-center justify-start max-w-[42mm] h-full pl-[1mm]">
      <div className="text-[18px] font-black leading-tight text-[#000000] uppercase" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {brand.printTitle}
      </div>
    </div>
    {/* Business Info Container */}
    <div className="text-right flex-1 pl-[4mm] pr-[1mm] flex flex-col justify-center h-full">
      <h1 className="text-[18px] font-bold leading-tight text-[#000000] uppercase tracking-wide" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {brand.printTitle}
      </h1>
      <p className="mt-[1mm] text-[10.5px] font-normal leading-tight text-[#475569] whitespace-pre-line" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {brand.address}
      </p>
    </div>
  </div>
);

const UnresolvedBrandSlip: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`billing-slip w-[148mm] h-[105mm] bg-[#FFFFFF] border-[0.6mm] border-[#000000] p-[6mm] text-[#000000] overflow-hidden shrink-0 ${className}`}
    style={{ boxSizing: 'border-box', fontFamily: 'Arial, Helvetica, sans-serif' }}
  >
    <div className="h-full flex flex-col items-center justify-center text-center gap-[3mm]">
      <div className="text-[18px] font-bold uppercase text-[#000000]">Brand Not Resolved</div>
      <div className="text-[13px] font-normal leading-snug max-w-[100mm] text-[#475569]">
        This order cannot be printed until its owning team is mapped to a billing brand.
      </div>
    </div>
  </div>
);

export const A6BillingSlip: React.FC<A6BillingSlipProps> = ({
  customer,
  order,
  team,
  className = '',
}) => {
  const brand = getBrandPrintConfig(team || order?.team || customer.team);

  if (!brand) {
    return <UnresolvedBrandSlip className={className} />;
  }

  return (
    <div
      className={`billing-slip w-[148mm] h-[105mm] bg-[#FFFFFF] border-[0.6mm] border-[#000000] overflow-hidden text-[#000000] shrink-0 ${className}`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* 1. Header */}
      <SlipHeader brand={brand} />

      {/* 2. Body Area */}
      <div className="flex flex-col h-[79mm]">
        
        {/* 2.1 Black Headings Row */}
        <div className="grid grid-cols-[48%_0.55mm_51.45%] bg-[#000000] text-[#ffffff] h-[8mm] items-center">
          <div className="pl-[4mm] uppercase tracking-wider text-[11.5px]" style={{ fontWeight: 600, fontFamily: 'Arial, Helvetica, sans-serif' }}>
            Merchant Details
          </div>
          <div className="h-full w-full bg-[#000000]"></div>
          <div className="pl-[4mm] uppercase tracking-wider text-[11.5px]" style={{ fontWeight: 600, fontFamily: 'Arial, Helvetica, sans-serif' }}>
            Customer Details
          </div>
        </div>

        {/* 2.2 Body Details Columns */}
        <div className="grid grid-cols-[48%_0.55mm_51.45%] h-[53mm] bg-[#FFFFFF]">
          {/* Left Column: Merchant */}
          <div className="flex flex-col pt-[3mm] pb-[3mm] pl-[4mm] pr-[3mm] min-w-0">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              <SlipField label="Name" value={brand.merchantName} />
              <SlipField label="Description" value={brand.description} />
              <SlipField label="Telephone" value={brand.merchantTelephone} />
            </div>
          </div>

          {/* Middle Vertical Separator */}
          <div className="w-[0.55mm] bg-[#000000] h-full"></div>

          {/* Right Column: Customer */}
          <div className="flex flex-col pt-[3mm] pb-[3mm] pl-[4mm] pr-[3mm] min-w-0">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              <SlipField label="Name" value={customer.fullName || 'Customer'} />
              <SlipField label="Address" value={formatAddress(customer.address || 'N/A').join('\n')} />
              <SlipField label="Telephone" value={customer.phone || 'N/A'} />
            </div>
          </div>
        </div>

        {/* 2.3 Total COD Footer */}
        <div className="h-[18mm] border-t-[0.55mm] border-[#000000] flex items-center justify-center bg-[#F8FAFC] gap-[5mm] px-[4mm]">
          <span className="text-[12.5px] uppercase tracking-wider text-[#475569]" style={{ fontWeight: 500, fontFamily: 'Arial, Helvetica, sans-serif' }}>
            Total COD
          </span>
          <span className="text-[21px] text-[#000000] tracking-tight" style={{ fontWeight: 600, fontFamily: 'Arial, Helvetica, sans-serif' }}>
            {getCodAmount(order)}
          </span>
        </div>

      </div>
    </div>
  );
};
