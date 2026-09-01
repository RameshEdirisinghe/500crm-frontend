import React, { useState, useEffect, useMemo } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { StatusBadge } from '../shared/StatusBadge';
import { Contact, ContactStatus, CallLog, Product, DeliveryMethod } from '../../models/domain';
import { CallLogService } from '../../services/callLogService';
import { callLogRepository, productRepository } from '../../repositories';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { 
  Phone, 
  CheckCircle2, 
  History, 
  AlertCircle, 
  ChevronRight, 
  Star, 
  MapPin, 
  Package, 
  Plus, 
  Minus, 
  DollarSign, 
  ShoppingBag,
  Mail,
  Truck,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/currency';

export interface PostCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  onSuccess: () => void;
  initialDirection?: 'OUTBOUND' | 'INBOUND';
}

export const PostCallModal: React.FC<PostCallModalProps> = ({
  isOpen,
  onClose,
  contact,
  onSuccess,
  initialDirection = 'OUTBOUND',
}) => {
  const { user } = useAuth();

  const [direction, setDirection] = useState<'OUTBOUND' | 'INBOUND'>(initialDirection);
  const [hasDialed, setHasDialed] = useState(false);
  const [history, setHistory] = useState<CallLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [dupIntelligence, setDupIntelligence] = useState<any>(null);

  const [status, setStatus] = useState<ContactStatus>('ANSWERED');
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [city, setCity] = useState('');
  const [secondaryMobile, setSecondaryMobile] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('POST');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [remarks, setRemarks] = useState('');

  // Dynamic Team Products
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  // Cash on Delivery (COD)
  const [codAmount, setCodAmount] = useState<string>('0');
  const [customCodManual, setCustomCodManual] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // Filter products strictly for the logged-in team member's team
  const teamProducts = useMemo(() => {
    if (!user?.teamId) return products;
    return products.filter((p) => p.teamId === user.teamId && p.isActive !== false);
  }, [products, user?.teamId]);

  // Calculate items and total order value dynamically
  const selectedItems = useMemo(() => {
    return teamProducts
      .filter((p) => (selectedQuantities[p.id] || 0) > 0)
      .map((p) => {
        const qty = Number(selectedQuantities[p.id]) || 0;
        const price = Number(p.sellingPrice) || 0;
        const subtotal = qty * price;
        return {
          productId: p.id,
          productName: p.name,
          unitPrice: price,
          quantity: qty,
          subtotal,
          availableStock: Number(p.currentStock) || 0,
        };
      });
  }, [teamProducts, selectedQuantities]);

  const totalOrderValue = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + item.subtotal, 0);
  }, [selectedItems]);

  const totalSelectedQty = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [selectedItems]);

  // Auto-sync COD amount with dynamic order total unless user manually overrides it
  useEffect(() => {
    if (!customCodManual) {
      setCodAmount(totalOrderValue > 0 ? totalOrderValue.toString() : '');
    }
  }, [totalOrderValue, customCodManual]);

  const triggerNativeDialer = () => {
    if (!contact) return;
    window.location.href = `tel:${contact.phone.replace(/[^0-9+]/g, '')}`;
    setHasDialed(true);
    toast.success('Dialer launched! Fill outcome details below.');
  };

  // Reset state and fetch history, duplicate check, and team products when contact changes or modal opens
  useEffect(() => {
    if (!contact || !isOpen || !user) return;

    setDirection(initialDirection);

    // If inbound callback, auto-activate form without launching native dialer
    if (initialDirection === 'INBOUND') {
      setHasDialed(true);
    } else {
      window.location.href = `tel:${contact.phone.replace(/[^0-9+]/g, '')}`;
      setHasDialed(true);
    }

    setStatus(contact.status === 'NEW' ? 'ANSWERED' : contact.status);
    setIsFollowUp(Boolean(contact.isFollowUp));
    setCustomerName('');
    setCustomerAddress('');
    setCity(contact.city || '');
    setSecondaryMobile(contact.secondaryMobile || '');
    setCustomerEmail('');
    setDeliveryMethod('POST');
    setDeliveryNote('');
    setRemarks('');
    setSelectedQuantities({});
    setCodAmount('0');
    setCustomCodManual(false);
    setDeliveryMethod('POST');
    setDeliveryNote('');
    setRemarks('');
    setSelectedQuantities({});
    setCodAmount('0');
    setCustomCodManual(false);

    const loadData = async () => {
      setLoadingHistory(true);
      setLoadingProducts(true);
      try {
        const [logs, allProds] = await Promise.all([
          callLogRepository.getByContactId(contact.id),
          user.teamId ? productRepository.getByTeamId(user.teamId) : productRepository.getAll(),
        ]);

        const contactLogs = logs.filter((l) => l.contactId === contact.id);
        contactLogs.sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime());
        setHistory(contactLogs);

        const activeTeamProds = allProds.filter(
          (p) => (!user.teamId || p.teamId === user.teamId) && p.isActive !== false
        );
        setProducts(activeTeamProds);

        // Pre-select 1 unit of first in-stock product by default if available
        if (activeTeamProds.length > 0) {
          const firstInStock = activeTeamProds.find((p) => p.currentStock > 0);
          if (firstInStock) {
            setSelectedQuantities({ [firstInStock.id]: 1 });
          }
        }

        // Fetch duplicate intelligence
        try {
          const { ContactService } = await import('../../services/contactService');
          const dup = await ContactService.checkPhoneDuplicate(contact.phone, user);
          if (dup.exists && dup.intelligence) {
            setDupIntelligence(dup.intelligence);
          } else {
            setDupIntelligence(null);
          }
        } catch {
          setDupIntelligence(null);
        }
      } catch (err) {
        console.error('Failed to load call history & products:', err);
      } finally {
        setLoadingHistory(false);
        setLoadingProducts(false);
      }
    };

    loadData();
  }, [contact, isOpen, user]);

  if (!contact || !user) return null;

  const isNew = contact.status === 'NEW';
  const isInterested = status === 'INTERESTED';
  const isAnswered = status === 'ANSWERED';

  const handleQtyChange = (productId: string, newQty: number, maxStock: number) => {
    const clamped = Math.max(0, Math.min(newQty, maxStock));
    setSelectedQuantities((prev) => ({
      ...prev,
      [productId]: clamped,
    }));
  };

  const handleCodChange = (val: string) => {
    setCodAmount(val);
    setCustomCodManual(true);
  };

  const handleResetCodToTotal = () => {
    setCodAmount(totalOrderValue.toString());
    setCustomCodManual(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (isInterested) {
      if (!customerName.trim()) {
        toast.error('Customer Full Name is required for INTERESTED status.');
        return;
      }
      if (!customerAddress.trim()) {
        toast.error('Delivery Address is required for INTERESTED status.');
        return;
      }
      if (!city.trim()) {
        toast.error('City / Town is required for INTERESTED status.');
        return;
      }
      if (secondaryMobile.trim() && secondaryMobile.trim().length < 7) {
        toast.error('Secondary mobile number must be at least 7 digits.');
        return;
      }
      if (selectedItems.length === 0 || totalSelectedQty === 0) {
        toast.error('Please select at least 1 product with quantity > 0.');
        return;
      }
      // Check stock safety
      for (const item of selectedItems) {
        if (item.quantity > item.availableStock) {
          toast.error(`Cannot order ${item.quantity} of "${item.productName}". Only ${item.availableStock} available.`);
          return;
        }
      }
      const parsedCod = parseFloat(codAmount);
      if (isNaN(parsedCod) || parsedCod < 0) {
        toast.error('Please enter a valid Cash on Delivery (COD) amount.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const itemsPayload = selectedItems.map((i) => ({
        productId: String(i.productId),
        productName: String(i.productName),
        unitPrice: Number(i.unitPrice),
        quantity: Math.floor(Number(i.quantity)),
        subtotal: Number(i.subtotal),
      }));

      await CallLogService.submitCallResult(
        {
          contactId: contact.id,
          status,
          direction,
          isFollowUp,
          customerName: customerName.trim() || undefined,
          customerAddress: isInterested ? customerAddress.trim() : undefined,
          city: isInterested ? city.trim() : undefined,
          secondaryMobile: isInterested && secondaryMobile.trim() ? secondaryMobile.trim() : undefined,
          customerEmail: customerEmail.trim() || undefined,
          deliveryMethod: isInterested ? deliveryMethod : undefined,
          deliveryNote: isInterested && deliveryNote.trim() ? deliveryNote.trim() : undefined,
          items: isInterested ? itemsPayload : undefined,
          totalPackageValue: isInterested ? totalOrderValue : undefined,
          codAmount: isInterested ? parseFloat(codAmount) || totalOrderValue : undefined,
          remarks: remarks.trim() || undefined,
          callDurationSeconds: Math.floor(Math.random() * 120) + 30,
        },
        user
      );

      toast.success(
        isInterested
          ? `Lead recorded for ${customerName} (COD: ${formatCurrency(parseFloat(codAmount) || totalOrderValue)})!`
          : `Call outcome saved as ${status}`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record call result.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Complete Call"
      description={`Contact Phone: ${contact.phone}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Launch Dialer Bar (Only relevant for Outbound) */}
        {direction === 'OUTBOUND' && (
          <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-xs">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Phone Number</div>
                <div className="text-base font-bold text-slate-900 font-mono">{contact.phone}</div>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<Phone className="w-3.5 h-3.5" />}
              onClick={triggerNativeDialer}
              className="w-full sm:w-auto"
            >
              Launch Dialer
            </Button>
          </div>
        )}

        {/* Call History Section */}
        {!isNew && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <History className="w-4 h-4 text-blue-600" />
                <span>Call History ({history.length} Previous Calls)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-normal">Most recent first</span>
            </div>

            {loadingHistory ? (
              <div className="text-xs text-slate-400 p-2 italic text-center">Loading call logs...</div>
            ) : history.length === 0 ? (
              <div className="text-xs text-slate-400 p-2 italic text-center bg-white rounded-lg border border-slate-100">
                No prior call history recorded for this contact.
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                {history.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-xs text-slate-700 space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge type="contact" status={log.status} />
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                            log.direction === 'INBOUND'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {log.direction === 'INBOUND' ? 'Inbound' : 'Outbound'}
                        </span>
                        <span className="font-mono text-slate-400 text-[11px]">
                          {format(new Date(log.calledAt), 'MMM dd, yyyy • hh:mm a')}
                        </span>
                      </div>
                      <span className="font-mono text-slate-500 text-[11px]">
                        {Math.floor((log.callDurationSeconds || 0) / 60)}m {(log.callDurationSeconds || 0) % 60}s
                      </span>
                    </div>

                    {log.customerName && (
                      <div className="text-slate-900 font-semibold">
                        {log.customerName} {log.city && <span className="text-slate-500 font-normal">&bull; {log.city}</span>}
                      </div>
                    )}

                    {log.codAmount && log.codAmount > 0 && (
                      <div className="text-emerald-700 font-semibold text-[11px]">
                        COD: {formatCurrency(log.codAmount)}
                      </div>
                    )}

                    {log.remarks && (
                      <div className="text-slate-600 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                        &quot;{log.remarks}&quot;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skip button shown ONLY for non-NEW contacts before dialing */}
        {!hasDialed && !isNew && (
          <div className="text-center pt-1 pb-2">
            <button
              type="button"
              onClick={() => setHasDialed(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Or click here to fill call outcome directly</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Form Fields */}
        {hasDialed && (
          <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-150">
            <Select
              label="Call Outcome / Status *"
              value={status}
              onChange={(e) => setStatus(e.target.value as ContactStatus)}
              options={[
                { value: 'ANSWERED', label: 'Answered' },
                { value: 'NOT_ANSWERED', label: 'Not Answered' },
                { value: 'PHONE_OFF', label: 'Phone Switched Off' },
                { value: 'INTERESTED', label: 'Interested (Creates Customer & Order Record)' },
                { value: 'NOT_INTERESTED', label: 'Not Interested' },
              ]}
            />

            {/* Follow-Up Star Option */}
            <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Star className={`w-4 h-4 ${isFollowUp ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
                <div>
                  <div className="text-xs font-bold text-slate-800">Add to Follow-Up List</div>
                  <div className="text-[11px] text-slate-500">Priority callback tracking</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFollowUp(!isFollowUp)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isFollowUp
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-amber-50'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${isFollowUp ? 'fill-white text-white' : 'text-amber-500'}`} />
                <span>{isFollowUp ? 'Starred' : 'Star for Follow-Up'}</span>
              </button>
            </div>

            {/* ANSWERED ONLY: Optional Customer Name */}
            {isAnswered && (
              <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">
                <div className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Call Details (Optional)</span>
                </div>
                <Input
                  label="Customer Name (Optional)"
                  placeholder="e.g. Roshan Mahanama"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            )}

            {/* INTERESTED STATUS: Comprehensive Customer, Location & Dynamic Products */}
            {isInterested && (
              <div className="p-4 rounded-xl space-y-4 bg-emerald-50/50 border border-emerald-200">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 border-b border-emerald-200 pb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Customer &amp; Delivery Information *</span>
                </div>

                {/* Duplicate Phone & Existing Orders Intelligence Alert */}
                {dupIntelligence && (dupIntelligence.previousOrders?.length > 0 || (dupIntelligence.assignedMemberName && dupIntelligence.assignedMemberName !== user.fullName)) && (
                  <div className="p-3.5 bg-amber-50/90 border-2 border-amber-300 rounded-xl space-y-2 text-xs text-amber-950 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-bold text-amber-900 text-xs sm:text-sm flex items-center justify-between flex-wrap gap-1">
                          <span>⚠️ Notice: Existing Activity / Order History Found</span>
                          <span className="font-mono text-[11px] bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{contact.phone}</span>
                        </div>
                        <p className="text-[11px] text-amber-800 mt-1">
                          This phone number is already recorded in the CRM. Please review existing orders and notes below before proceeding. You can still submit this interested lead/order.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-amber-200/70 text-[11px]">
                      {dupIntelligence.assignedMemberName && (
                        <div>
                          <span className="text-amber-700 font-semibold">Associated Rep:</span>{' '}
                          <span className="font-bold text-amber-950">{dupIntelligence.assignedMemberName}</span>{' '}
                          {dupIntelligence.teamName && <span className="text-amber-700">({dupIntelligence.teamName})</span>}
                        </div>
                      )}
                      {dupIntelligence.lastCustomerName && (
                        <div>
                          <span className="text-amber-700 font-semibold">Previous Customer:</span>{' '}
                          <span className="font-bold text-amber-950">{dupIntelligence.lastCustomerName}</span>
                        </div>
                      )}
                    </div>

                    {dupIntelligence.previousOrders && dupIntelligence.previousOrders.length > 0 && (
                      <div className="mt-2 space-y-1.5 pt-2 border-t border-amber-200/70">
                        <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                          Existing Order History ({dupIntelligence.previousOrders.length} order(s)):
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {dupIntelligence.previousOrders.map((ord: any) => (
                            <div key={ord.id} className="bg-white/90 border border-amber-200 rounded-lg p-2 flex items-center justify-between gap-2 text-[11px]">
                              <div>
                                <span className="font-mono font-bold text-blue-700">#{ord.orderNumber}</span>
                                <span className="text-slate-500 ml-1.5">
                                  by <strong className="text-slate-700">{ord.teamMemberName || 'Rep'}</strong> on {format(new Date(ord.createdAt), 'yyyy-MM-dd')}
                                </span>
                                <div className="text-slate-600 truncate">{ord.itemsDescription}</div>
                              </div>
                              <div className="text-right shrink-0">
                                <StatusBadge type="order" status={ord.status} />
                                <div className="font-mono font-bold text-slate-900 mt-0.5">{formatCurrency(ord.totalAmount)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Customer Full Name *"
                    placeholder="e.g. Roshan Mahanama"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />

                  <Input
                    label="City / Town *"
                    placeholder="e.g. Colombo 03, Kandy, Galle"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    leftIcon={<MapPin className="w-4 h-4 text-slate-400" />}
                    required
                  />
                </div>

                <Input
                  label="Delivery Address *"
                  placeholder="e.g. No. 45, Galle Road, Colombo 03"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Another Mobile Number (Optional)"
                    placeholder="e.g. +94 71 234 5678"
                    value={secondaryMobile}
                    onChange={(e) => setSecondaryMobile(e.target.value)}
                    leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
                  />

                  <Input
                    label="Email Address (Optional)"
                    type="email"
                    placeholder="e.g. roshan@gmail.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>

                {/* Delivery Method Selection */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Delivery Method *</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('POST')}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
                        deliveryMethod === 'POST'
                          ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 font-bold shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        deliveryMethod === 'POST' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">Post</div>
                        <div className="text-[10px] text-slate-500 font-normal">Standard Post Delivery &amp; Billing Slip</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('ROYAL_COURIER')}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
                        deliveryMethod === 'ROYAL_COURIER'
                          ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-bold shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        deliveryMethod === 'ROYAL_COURIER' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">Royal Courier</div>
                        <div className="text-[10px] text-slate-500 font-normal">Royal Courier Dispatch (Excel Batch Export)</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Delivery Note */}
                <Input
                  label="Delivery Note / Special Instructions (Optional)"
                  placeholder="e.g. Call before delivery, deliver after 2 PM, near landmark..."
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  leftIcon={<FileText className="w-4 h-4 text-slate-400" />}
                />

                {/* Dynamic Product Selection & Pricing Breakdown */}
                <div className="pt-3 border-t border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                      <Package className="w-4 h-4 text-emerald-700" />
                      <span>Product Selection &amp; Quantities *</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Team Products ({teamProducts.length} available)
                    </span>
                  </div>

                  {loadingProducts ? (
                    <div className="p-4 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                      Loading team product catalog...
                    </div>
                  ) : teamProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200">
                      No active products found for your team. Please request your Supervisor to add products first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {teamProducts.map((prod) => {
                        const qty = selectedQuantities[prod.id] || 0;
                        const isOutOfStock = prod.currentStock <= 0;
                        const subtotal = qty * prod.sellingPrice;

                        return (
                          <div
                            key={prod.id}
                            className={`bg-white border rounded-xl p-3 space-y-2 shadow-2xs transition-all ${
                              qty > 0 ? 'border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs font-bold text-slate-900">{prod.name}</div>
                                <div className="text-[11px] text-emerald-600 font-semibold">
                                  {formatCurrency(prod.sellingPrice)} / unit
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {isOutOfStock ? (
                                    <span className="text-rose-600 font-semibold">Out of Stock</span>
                                  ) : (
                                    <span>Stock: {prod.currentStock} units</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                                <button
                                  type="button"
                                  disabled={qty <= 0}
                                  onClick={() => handleQtyChange(prod.id, qty - 1, prod.currentStock)}
                                  className="w-6 h-6 rounded flex items-center justify-center bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 shadow-2xs cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center font-bold text-xs text-slate-900">{qty}</span>
                                <button
                                  type="button"
                                  disabled={isOutOfStock || qty >= prod.currentStock}
                                  onClick={() => handleQtyChange(prod.id, qty + 1, prod.currentStock)}
                                  className="w-6 h-6 rounded flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-2xs cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
                              <span>Subtotal:</span>
                              <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Cash on Delivery (COD) Amount Entry */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cash on Delivery (COD) Amount *</span>
                      </label>
                      {customCodManual && (
                        <button
                          type="button"
                          onClick={handleResetCodToTotal}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                        >
                          Auto-fill Order Total ({formatCurrency(totalOrderValue)})
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="Enter COD amount to collect"
                        value={codAmount}
                        onChange={(e) => handleCodChange(e.target.value)}
                        required
                      />
                    </div>

                    {/* Transparent Price Summary Box */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs space-y-1.5">
                      <div className="font-bold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">Pricing Breakdown</div>
                      {selectedItems.map((item) => (
                        <div key={item.productId} className="flex justify-between text-slate-600">
                          <span>{item.productName} ({formatCurrency(item.unitPrice)} × {item.quantity}):</span>
                          <span className="font-mono font-medium">{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                      {selectedItems.length === 0 && (
                        <div className="text-slate-400 italic text-[11px]">No products selected yet.</div>
                      )}
                      <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1">
                        <span>Total Order Value:</span>
                        <span className="font-mono text-emerald-700">{formatCurrency(totalOrderValue)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-blue-900 border-t border-slate-200 pt-1">
                        <span>COD Collection Amount:</span>
                        <span className="font-mono text-blue-700">{formatCurrency(parseFloat(codAmount) || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Call Remarks / Notes
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add key notes, customer queries, preferred callback times..."
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-colors"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Cancel leaves status unchanged</span>
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isLoading}>
                  Save Call
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
};
