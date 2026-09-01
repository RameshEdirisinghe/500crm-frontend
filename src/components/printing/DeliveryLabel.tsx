import React from 'react';
import { Order, Customer } from '../../models/domain';
import { getTeamBranding } from '../../config/branding';
import { formatCurrency } from '../../utils/currency';

export interface DeliveryLabelProps {
  order: Order;
  customer?: Customer;
  className?: string;
}

export const DeliveryLabel: React.FC<DeliveryLabelProps> = ({ order, customer, className = '' }) => {
  const teamBrand = getTeamBranding(order.team);

  return (
    <div
      className={`w-[148mm] h-[105mm] p-4 bg-white border border-slate-900 flex flex-col justify-between overflow-hidden text-slate-900 font-sans print:border-slate-800 shrink-0 ${className}`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Label Header / Brand Banner */}
      <div className="flex items-center justify-between pb-2.5 border-b-2 border-slate-900">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded text-white font-extrabold text-xs flex items-center justify-center print:bg-slate-900"
            style={{ backgroundColor: teamBrand.brandColor }}
          >
            {teamBrand.code}
          </div>
          <div>
            <div className="font-black text-xs uppercase tracking-tight">{teamBrand.name}</div>
            <div className="text-[9px] text-slate-600">DIRECT EXPRESS FULFILLMENT</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Order Ref</div>
          <div className="text-xs font-black tracking-wider">{order.orderNumber}</div>
        </div>
      </div>

      {/* Customer Receiver Info */}
      <div className="py-2 flex-1 flex flex-col justify-center space-y-1">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600">SHIP TO (RECIPIENT):</div>
        <div className="text-sm font-black uppercase text-slate-900 tracking-tight">
          {customer ? customer.fullName : 'Customer'}
        </div>
        <div className="text-xs font-bold text-slate-800 leading-snug">
          {customer ? customer.address : 'Address N/A'}
        </div>
        <div className="text-xs font-black tracking-wider text-slate-900 mt-0.5">
          TEL: {customer ? customer.phone : 'N/A'}
        </div>
      </div>

      {/* Order Item Description & Cod info */}
      <div className="p-2 bg-slate-100 border border-slate-300 rounded text-slate-900 my-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase border-b border-slate-300 pb-1">
          <span>Items: {order.itemsDescription}</span>
          <span>COD: {formatCurrency(order.totalAmount)}</span>
        </div>
        <div className="text-[9px] font-medium text-slate-600 mt-1 truncate">
          Sender: {teamBrand.name} • {teamBrand.contactPhone}
        </div>
      </div>

      {/* Barcode & Routing Footer */}
      <div className="pt-2 border-t-2 border-slate-900 flex items-center justify-between">
        {/* Simulated Barcode */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5 items-center h-8">
            <span className="w-1.5 h-full bg-slate-900" />
            <span className="w-0.5 h-full bg-slate-900" />
            <span className="w-2 h-full bg-slate-900" />
            <span className="w-1 h-full bg-slate-900" />
            <span className="w-2.5 h-full bg-slate-900" />
            <span className="w-0.5 h-full bg-slate-900" />
            <span className="w-1.5 h-full bg-slate-900" />
          </div>
          <span className="text-[9px] font-mono font-bold tracking-widest text-slate-700">
            *{order.orderNumber}*
          </span>
        </div>

        <div className="text-right">
          <div className="text-[9px] font-extrabold uppercase bg-slate-900 text-white px-2 py-0.5 rounded">
            PRIORITY PARCEL
          </div>
          <div className="text-[8px] font-semibold text-slate-500 mt-0.5">A6 LABEL (148mm x 105mm)</div>
        </div>
      </div>
    </div>
  );
};
