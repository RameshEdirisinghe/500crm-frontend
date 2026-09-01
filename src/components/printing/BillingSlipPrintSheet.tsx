import React from 'react';
import { Customer, Order, Team, User } from '../../models/domain';
import { A6BillingSlip } from './A6BillingSlip';

export interface LeadPrintItem {
  customer: Customer;
  responsibleUser?: User;
  order?: Order;
  team?: Team;
}

export interface BillingSlipPrintSheetProps {
  items: LeadPrintItem[];
}

const chunkIntoSheets = (items: LeadPrintItem[], size = 4): LeadPrintItem[][] => {
  const sheets: LeadPrintItem[][] = [];
  for (let index = 0; index < items.length; index += size) {
    sheets.push(items.slice(index, index + size));
  }
  return sheets;
};

export const BillingSlipPrintSheet: React.FC<BillingSlipPrintSheetProps> = ({ items }) => {
  const sheets = chunkIntoSheets(items);

  return (
    <div className="print-billing-container">
      {sheets.map((sheetItems, sheetIndex) => (
        <div
          key={`billing-slip-sheet-${sheetIndex}`}
          className="billing-slip-sheet grid grid-cols-2 grid-rows-2 gap-[4mm] bg-white"
          style={{
            width: '285mm',
            height: '198mm',
            boxSizing: 'border-box',
            breakAfter: sheetIndex === sheets.length - 1 ? 'auto' : 'page',
            pageBreakAfter: sheetIndex === sheets.length - 1 ? 'auto' : 'always',
            breakInside: 'avoid',
            pageBreakInside: 'avoid',
          }}
        >
          {sheetItems.map((item) => (
            <div
              key={item.order?.id || item.customer.id}
              className="billing-slip-page bg-white overflow-hidden"
              style={{ width: '100%', height: '100%', boxSizing: 'border-box', breakInside: 'avoid' }}
            >
              <A6BillingSlip
                customer={item.customer}
                responsibleUser={item.responsibleUser}
                order={item.order}
                team={item.team}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
