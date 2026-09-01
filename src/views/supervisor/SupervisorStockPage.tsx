import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { Product, StockActivityLog, ApprovalRequest, User } from '../../models/domain';
import { productRepository, stockActivityLogRepository, approvalRequestRepository, emailNotificationRepository, userRepository, orderRepository, customerRepository } from '../../repositories';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import toast from 'react-hot-toast';
import { Package, PlusCircle, DollarSign, AlertTriangle, Clock, CheckCircle2, XCircle, History, Send, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

export const SupervisorStockPage: React.FC = () => {
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [stockLogs, setStockLogs] = useState<StockActivityLog[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Request Stock Addition Modal
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState<number>(50);
  const [stockBatchCost, setStockBatchCost] = useState<number>(0);
  const [stockProposedSellingPrice, setStockProposedSellingPrice] = useState<number>(0);
  const [stockPricingMode, setStockPricingMode] = useState<'GLOBAL' | 'BATCH_SPECIFIC'>('GLOBAL');
  const [stockBatchNumber, setStockBatchNumber] = useState<string>('');
  const [stockSupplier, setStockSupplier] = useState<string>('');
  const [stockReason, setStockReason] = useState<string>('');
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

  // Request Price Change Modal
  const [priceModalProduct, setPriceModalProduct] = useState<Product | null>(null);
  const [newCostPrice, setNewCostPrice] = useState<number>(0);
  const [newSellingPrice, setNewSellingPrice] = useState<number>(0);
  const [priceReason, setPriceReason] = useState<string>('');
  const [isSubmittingPrice, setIsSubmittingPrice] = useState(false);

  // Bulk Multi-Product Stock Addition Modal (Requirement 1)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkQuantities, setBulkQuantities] = useState<Record<string, number>>({});
  const [bulkBatchCosts, setBulkBatchCosts] = useState<Record<string, number>>({});
  const [bulkProposedPrices, setBulkProposedPrices] = useState<Record<string, number>>({});
  const [bulkPricingModes, setBulkPricingModes] = useState<Record<string, 'GLOBAL' | 'BATCH_SPECIFIC'>>({});
  const [bulkReason, setBulkReason] = useState<string>('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Report Damaged Stock Modal State
  const [damageModalProduct, setDamageModalProduct] = useState<Product | null>(null);
  const [damageQty, setDamageQty] = useState<number>(1);
  const [damageReason, setDamageReason] = useState<string>('');
  const [isSubmittingDamage, setIsSubmittingDamage] = useState(false);

  // Critical Action Confirmation States
  const [confirmingStockSubmit, setConfirmingStockSubmit] = useState(false);
  const [confirmingPriceSubmit, setConfirmingPriceSubmit] = useState(false);
  const [confirmingBulkSubmit, setConfirmingBulkSubmit] = useState(false);

  // Stock Filter Tab State
  const [activeTab, setActiveTab] = useState<'ALL' | 'AVAILABLE' | 'ALLOCATED' | 'DISPATCHED' | 'SOLD' | 'DAMAGED'>('ALL');

  const loadData = async () => {
    if (!user || !user.teamId) return;
    setLoading(true);
    try {
      const [teamProducts, logs, requests] = await Promise.all([
        productRepository.getByTeamId(user.teamId),
        stockActivityLogRepository.getByTeamId(user.teamId),
        approvalRequestRepository.getByTeamId(user.teamId),
      ]);

      setProducts(teamProducts);
      setStockLogs(logs);
      setApprovalRequests(requests);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load stock data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const openBulkModal = () => {
    const initialQty: Record<string, number> = {};
    const initialCosts: Record<string, number> = {};
    const initialPrices: Record<string, number> = {};
    const initialModes: Record<string, 'GLOBAL' | 'BATCH_SPECIFIC'> = {};

    products.forEach((p) => {
      initialQty[p.id] = 0;
      initialCosts[p.id] = p.costPrice;
      initialPrices[p.id] = p.sellingPrice;
      initialModes[p.id] = 'GLOBAL';
    });
    setBulkQuantities(initialQty);
    setBulkBatchCosts(initialCosts);
    setBulkProposedPrices(initialPrices);
    setBulkPricingModes(initialModes);
    setBulkReason('');
    setIsBulkModalOpen(true);
  };

  // Open Single Stock Addition Modal with defaults
  const openStockModal = (product: Product) => {
    setStockModalProduct(product);
    setAddQty(50);
    setStockBatchCost(product.costPrice);
    setStockProposedSellingPrice(product.sellingPrice);
    setStockPricingMode('GLOBAL');
    setStockBatchNumber(`BAT-${Date.now().toString().slice(-6)}`);
    setStockSupplier('');
    setStockReason('');
  };

  // Bulk Multi-Product Stock Addition Submit
  const handleRequestBulkStockAddition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.teamId) {
      toast.error('Your account is not assigned to a team.');
      return;
    }

    const itemsToAdd = products
      .filter((p) => (bulkQuantities[p.id] || 0) > 0)
      .map((p) => {
        const rawCost = bulkBatchCosts[p.id] !== undefined && bulkBatchCosts[p.id] !== null ? bulkBatchCosts[p.id] : p.costPrice;
        const rawPrice = bulkProposedPrices[p.id] !== undefined && bulkProposedPrices[p.id] !== null ? bulkProposedPrices[p.id] : p.sellingPrice;

        return {
          productId: p.id,
          productName: p.name,
          quantity: Number(bulkQuantities[p.id]),
          unitCostPrice: Number(parseFloat(String(rawCost)) || 0),
          proposedSellingPrice: Number(parseFloat(String(rawPrice)) || 0),
          pricingMode: bulkPricingModes[p.id] || 'GLOBAL',
          oldStock: Number(p.currentStock),
          newStock: Number(p.currentStock + bulkQuantities[p.id]),
        };
      });

    if (itemsToAdd.length === 0) {
      toast.error('Please enter additional stock quantity for at least one product.');
      return;
    }

    setIsSubmittingBulk(true);
    try {
      const totalQty = itemsToAdd.reduce((sum, item) => sum + item.quantity, 0);

      await approvalRequestRepository.create({
        requestType: 'STOCK_ADDITION',
        requestedById: user.id,
        requestedByName: user.fullName,
        teamId: user.teamId,
        productId: itemsToAdd[0]?.productId || undefined as any,
        productName: `Bulk Stock Addition (${itemsToAdd.length} Products, +${totalQty} Units)`,
        items: itemsToAdd,
        quantity: totalQty,
        reason: bulkReason || `Bulk stock addition request for ${itemsToAdd.length} products (+${totalQty} units total)`,
      });

      toast.success(`Submitted 1 bulk approval request for ${itemsToAdd.length} products to Admin.`);
      setIsBulkModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit bulk stock request.');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Supervisor requests stock addition with batch cost & pricing mode
  const handleRequestStockAddition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalProduct || addQty <= 0) return;
    if (!user?.teamId) {
      toast.error('Your account is not assigned to a team.');
      return;
    }

    setIsSubmittingStock(true);
    try {
      await approvalRequestRepository.create({
        requestType: 'STOCK_ADDITION',
        requestedById: user.id,
        requestedByName: user.fullName,
        teamId: user.teamId,
        productId: stockModalProduct.id,
        productName: stockModalProduct.name,
        oldValue: Number(stockModalProduct.currentStock),
        newValue: Number(stockModalProduct.currentStock + addQty),
        quantity: Number(addQty),
        unitCostPrice: Number(parseFloat(String(stockBatchCost)) || 0),
        proposedSellingPrice: Number(parseFloat(String(stockProposedSellingPrice)) || 0),
        pricingMode: stockPricingMode,
        batchNumber: stockBatchNumber,
        supplierName: stockSupplier,
        reason: stockReason || `Stock addition +${addQty} units @ LKR ${stockBatchCost} (${stockPricingMode} pricing)`,
      });

      toast.success(`Submitted stock addition request (+${addQty} units @ LKR ${stockBatchCost}) for Admin approval.`);
      setStockModalProduct(null);
      setStockReason('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit stock request.');
    } finally {
      setIsSubmittingStock(false);
    }
  };

  // Requirement 2.12: Supervisor requests cost/selling price changes (Creates pending ApprovalRequest & sends email notification)
  const handleRequestPriceChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceModalProduct) return;
    if (!user?.teamId) {
      toast.error('Your account is not assigned to a team.');
      return;
    }

    setIsSubmittingPrice(true);
    try {
      let isCostChanged = newCostPrice !== priceModalProduct.costPrice;
      let isSellingChanged = newSellingPrice !== priceModalProduct.sellingPrice;

      if (!isCostChanged && !isSellingChanged) {
        toast.error('Please modify cost price or selling price.');
        setIsSubmittingPrice(false);
        return;
      }

      if (isCostChanged) {
        await approvalRequestRepository.create({
          requestType: 'PRODUCT_COST_PRICE_CHANGE',
          requestedById: user.id,
          requestedByName: user.fullName,
          teamId: user.teamId,
          productId: priceModalProduct.id,
          productName: priceModalProduct.name,
          oldValue: priceModalProduct.costPrice,
          newValue: newCostPrice,
          reason: priceReason || `Cost price change from LKR ${priceModalProduct.costPrice} to LKR ${newCostPrice}`,
        });
      }

      if (isSellingChanged) {
        await approvalRequestRepository.create({
          requestType: 'PRODUCT_SELLING_PRICE_CHANGE',
          requestedById: user.id,
          requestedByName: user.fullName,
          teamId: user.teamId,
          productId: priceModalProduct.id,
          productName: priceModalProduct.name,
          oldValue: priceModalProduct.sellingPrice,
          newValue: newSellingPrice,
          reason: priceReason || `Selling price change from LKR ${priceModalProduct.sellingPrice} to LKR ${newSellingPrice}`,
        });
      }

      toast.success(`Submitted price change request for Admin approval.`);
      setPriceModalProduct(null);
      setPriceReason('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit price change request.');
    } finally {
      setIsSubmittingPrice(false);
    }
  };

  // Open Damaged Stock Audit Inspection Modal
  // Supervisor reports damaged / broken units
  const handleReportDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!damageModalProduct || damageQty <= 0) return;
    setIsSubmittingDamage(true);
    try {
      await productRepository.reportDamage(damageModalProduct.id, damageQty, damageReason);
      toast.success(`Recorded ${damageQty} damaged units for "${damageModalProduct.name}".`);
      setDamageModalProduct(null);
      setDamageReason('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to report damaged stock.');
    } finally {
      setIsSubmittingDamage(false);
    }
  };

  if (loading) return <LoadingState rows={6} />;

  const lowStockCount = products.filter((p) => p.currentStock <= p.minStockThreshold).length;
  const pendingRequestsCount = approvalRequests.filter((r) => r.status === 'PENDING').length;

  const filteredProducts = products.filter((p) => {
    switch (activeTab) {
      case 'AVAILABLE': return p.currentStock > 0;
      case 'ALLOCATED': return (p.allocatedStock || 0) > 0;
      case 'DISPATCHED': return (p.dispatchedStock || 0) > 0;
      case 'SOLD': return (p.soldStock || 0) > 0;
      case 'DAMAGED': return (p.damagedStock || 0) > 0;
      default: return true;
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock & Inventory Management"
        description="Monitor team-specific product stock, request inventory additions, and request price adjustments"
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<PlusCircle className="w-4 h-4" />}
            onClick={openBulkModal}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 font-bold shadow-xs justify-center"
          >
            Bulk Add Stock Request
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Team Products"
          value={products.length}
          subtitle="Products assigned to your team"
          icon={<Package className="w-4 h-4 text-blue-600" />}
          accentColor="blue"
        />
        <StatCard
          title="Low Stock Alerts"
          value={lowStockCount}
          subtitle="Products below minimum threshold"
          icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
          accentColor="amber"
        />
        <StatCard
          title="Pending Requests"
          value={pendingRequestsCount}
          subtitle="Awaiting Admin approval"
          icon={<Clock className="w-4 h-4 text-purple-600" />}
          accentColor="purple"
        />
      </div>

      {/* Product Stock Table & Mobile Card List */}
      <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-1">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Team Products Inventory</h3>
            <p className="text-xs text-slate-500">
              Only products assigned to your team are visible. Product creation is restricted to Admin only.
            </p>
          </div>
        </div>

        {/* Filter Tabs with touch scrolling */}
        <div className="flex gap-1.5 sm:gap-2 mb-2 overflow-x-auto pb-1.5 scrollbar-none no-scrollbar">
          {['ALL', 'AVAILABLE', 'ALLOCATED', 'DISPATCHED', 'SOLD', 'DAMAGED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                activeTab === tab
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab === 'ALL' ? 'All Products' : tab}
            </button>
          ))}
        </div>

        {/* Desktop Table View (md: and up) */}
        <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-[26%]">Product &amp; SKU</th>
                <th className="py-2.5 px-1.5 text-center text-slate-700 w-[9%]">Available</th>
                <th className="py-2.5 px-1.5 text-center text-amber-600 w-[8%]">Allocated</th>
                <th className="py-2.5 px-1.5 text-center text-blue-600 w-[8%]">Dispatched</th>
                <th className="py-2.5 px-1.5 text-center text-emerald-600 w-[8%]">Sold</th>
                <th className="py-2.5 px-1.5 text-center text-rose-600 w-[8%]">Damaged</th>
                <th className="py-2.5 px-2.5 w-[16%]">Price (LKR)</th>
                <th className="py-2.5 px-3 text-right w-[17%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400 text-xs">
                    No products found for your team.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isLow = product.currentStock <= product.minStockThreshold;
                  return (
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                      {/* Product & Code */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs truncate max-w-[150px] sm:max-w-none" title={product.name}>
                            {product.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 font-medium shrink-0">
                            {product.code}
                          </span>
                        </div>
                      </td>

                      {/* Available */}
                      <td className="py-2.5 px-1.5 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`font-black text-xs font-mono ${product.currentStock === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
                            {product.currentStock}
                          </span>
                          {product.currentStock === 0 ? (
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 rounded">Out</span>
                          ) : isLow ? (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded">Low</span>
                          ) : null}
                        </div>
                      </td>

                      {/* Allocated */}
                      <td className="py-2.5 px-1.5 text-center">
                        <span className={`font-bold text-xs font-mono ${(product.allocatedStock || 0) > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                          {product.allocatedStock || 0}
                        </span>
                      </td>

                      {/* Dispatched */}
                      <td className="py-2.5 px-1.5 text-center">
                        <span className={`font-bold text-xs font-mono ${(product.dispatchedStock || 0) > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                          {product.dispatchedStock || 0}
                        </span>
                      </td>

                      {/* Sold */}
                      <td className="py-2.5 px-1.5 text-center">
                        <span className={`font-bold text-xs font-mono ${(product.soldStock || 0) > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {product.soldStock || 0}
                        </span>
                      </td>

                      {/* Damaged */}
                      <td className="py-2.5 px-1.5 text-center">
                        <span className={`font-bold text-xs font-mono ${(product.damagedStock || 0) > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}`}>
                          {product.damagedStock || 0}
                        </span>
                      </td>

                      {/* Pricing */}
                      <td className="py-2.5 px-2.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-emerald-700 text-xs font-mono">
                            {product.sellingPrice.toLocaleString()}
                          </span>
                          <span className="text-slate-400 text-[10px] font-mono mt-0.5">
                            Cost: {product.costPrice.toLocaleString()}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<DollarSign className="w-3 h-3 text-slate-600" />}
                            onClick={() => {
                              setPriceModalProduct(product);
                              setNewCostPrice(product.costPrice);
                              setNewSellingPrice(product.sellingPrice);
                              setPriceReason('');
                            }}
                            className="text-xs px-1.5 py-0.5 h-6.5"
                            title="Request Price Change"
                          >
                            Price
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<AlertTriangle className="w-3 h-3 text-rose-500" />}
                            onClick={() => {
                              setDamageModalProduct(product);
                              setDamageQty(1);
                              setDamageReason('');
                            }}
                            className="text-xs px-1.5 py-0.5 h-6.5 text-slate-700 hover:text-rose-600 hover:bg-rose-50"
                            title="Report Damaged / Broken Units"
                          >
                            Damage
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Product Card List View (< md) */}
        <div className="block md:hidden space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
              No products found for your team.
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isLow = product.currentStock <= product.minStockThreshold;
              return (
                <div
                  key={product.id}
                  className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3"
                >
                  {/* Top: Name, SKU, Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-snug">
                        {product.name}
                      </h4>
                      <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-medium inline-block mt-1">
                        {product.code}
                      </span>
                    </div>

                    <div className="shrink-0 text-right">
                      {product.currentStock === 0 ? (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          Out of Stock
                        </span>
                      ) : isLow ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Low Stock ({product.currentStock})
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {product.currentStock} Available
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock Breakdown Metric Pills */}
                  <div className="grid grid-cols-5 gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase">Avail</div>
                      <div className="font-black font-mono text-xs text-slate-900">{product.currentStock}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-amber-600 uppercase">Alloc</div>
                      <div className="font-bold font-mono text-xs text-amber-700">{product.allocatedStock || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-blue-600 uppercase">Disp</div>
                      <div className="font-bold font-mono text-xs text-blue-700">{product.dispatchedStock || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-emerald-600 uppercase">Sold</div>
                      <div className="font-bold font-mono text-xs text-emerald-700">{product.soldStock || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-rose-600 uppercase">Dmg</div>
                      <div className="font-bold font-mono text-xs text-rose-700">{product.damagedStock || 0}</div>
                    </div>
                  </div>

                  {/* Pricing Info */}
                  <div className="flex items-center justify-between text-xs px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-[11px]">Selling:</span>
                      <span className="font-bold font-mono text-emerald-700">LKR {product.sellingPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">Cost:</span>
                      <span className="font-mono text-slate-500 text-[11px]">LKR {product.costPrice.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<DollarSign className="w-3.5 h-3.5 text-slate-600" />}
                      onClick={() => {
                        setPriceModalProduct(product);
                        setNewCostPrice(product.costPrice);
                        setNewSellingPrice(product.sellingPrice);
                        setPriceReason('');
                      }}
                      className="w-full text-xs font-semibold py-1.5 h-8 justify-center"
                    >
                      Price
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                      onClick={() => {
                        setDamageModalProduct(product);
                        setDamageQty(1);
                        setDamageReason('');
                      }}
                      className="w-full text-xs font-semibold py-1.5 h-8 text-rose-700 hover:bg-rose-50 border-rose-200 justify-center"
                    >
                      Damage
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Stock Activity History & Approval Trail (Requirement 2.13) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending & Historical Approval Requests */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Approval Requests Sent to Admin</span>
            </h3>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {approvalRequests.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">No approval requests logged yet.</div>
            ) : (
              approvalRequests.map((req) => (
                <div key={req.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span className="truncate">{req.productName} ({req.requestType.replace(/_/g, ' ')})</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : req.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    {req.requestType === 'STOCK_ADDITION' ? `Requesting +${req.quantity} units (Current: ${req.oldValue})` : `New Price Proposal: LKR ${req.newValue} (Old: LKR ${req.oldValue})`}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                    <span>Reason: {req.reason}</span>
                    <span>{format(new Date(req.createdAt), 'MMM dd, HH:mm')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stock Activity History Audit Feed */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Stock Activity & Movement Log</span>
            </h3>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {stockLogs.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">No stock activity recorded.</div>
            ) : (
              stockLogs.map((log) => (
                <div key={log.id} className="p-2.5 rounded-lg border border-slate-100 bg-white text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>{log.productName}</span>
                    <span className="font-mono text-blue-600 font-bold">{log.action}</span>
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    Stock: {log.previousStock} → <strong>{log.newStock}</strong> (Performed by: {log.performedByName})
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">
                    {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Stock Addition Request Modal (Requirement 2.10) */}
      <Dialog
        isOpen={!!stockModalProduct}
        onClose={() => setStockModalProduct(null)}
        title="Request Stock Batch Addition"
        description="Submit incoming stock shipment with batch acquisition cost & pricing strategy for Admin approval"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmingStockSubmit(true);
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
            <div className="font-bold text-blue-900">{stockModalProduct?.name}</div>
            <div className="text-blue-700">
              Current Stock: <strong>{stockModalProduct?.currentStock} units</strong> | Reference Cost: <strong>LKR {stockModalProduct?.costPrice.toLocaleString()}</strong> | Catalog Price: <strong>LKR {stockModalProduct?.sellingPrice.toLocaleString()}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Shipment Quantity (+) *"
              type="number"
              min="1"
              value={addQty}
              onChange={(e) => setAddQty(parseInt(e.target.value) || 0)}
              required
            />
            <Input
              label="Batch Acquisition Cost (LKR) *"
              type="number"
              min="0"
              step="0.01"
              value={stockBatchCost}
              onChange={(e) => setStockBatchCost(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Proposed Selling Price (LKR) *"
              type="number"
              min="0"
              step="0.01"
              value={stockProposedSellingPrice}
              onChange={(e) => setStockProposedSellingPrice(parseFloat(e.target.value) || 0)}
              required
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pricing Strategy
              </label>
              <select
                value={stockPricingMode}
                onChange={(e) => setStockPricingMode(e.target.value as any)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="GLOBAL">Global Price Change (Update entire catalog)</option>
                <option value="BATCH_SPECIFIC">Batch-Specific (Apply only to this shipment)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Batch / Lot Number (Optional)"
              placeholder="e.g. BAT-2026-001"
              value={stockBatchNumber}
              onChange={(e) => setStockBatchNumber(e.target.value)}
            />
            <Input
              label="Supplier / Invoice Ref (Optional)"
              placeholder="e.g. INV-9842"
              value={stockSupplier}
              onChange={(e) => setStockSupplier(e.target.value)}
            />
          </div>

          <Input
            label="Supervisor Reason / Justification *"
            placeholder="e.g. Received new shipment from supplier with updated wholesale cost"
            value={stockReason}
            onChange={(e) => setStockReason(e.target.value)}
            required
          />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setStockModalProduct(null)} className="w-full sm:w-auto justify-center">
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingStock} leftIcon={<Send className="w-3.5 h-3.5" />} className="w-full sm:w-auto justify-center">
              Submit for Admin Approval
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Product Price Change Request Modal (Requirement 2.12) */}
      <Dialog
        isOpen={!!priceModalProduct}
        onClose={() => setPriceModalProduct(null)}
        title="Request Product Price Change"
        description="Submit proposed cost price or selling price adjustments for Admin approval"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmingPriceSubmit(true);
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <div className="font-bold text-slate-900">{priceModalProduct?.name}</div>
            <div className="text-slate-600">
              Current Cost: LKR {priceModalProduct?.costPrice.toLocaleString()} | Current Selling: LKR {priceModalProduct?.sellingPrice.toLocaleString()}
            </div>
          </div>

          <Input
            label="New Cost Price (LKR)"
            type="number"
            min="0"
            value={newCostPrice}
            onChange={(e) => setNewCostPrice(parseFloat(e.target.value) || 0)}
            required
          />

          <Input
            label="New Selling Price (LKR)"
            type="number"
            min="0"
            value={newSellingPrice}
            onChange={(e) => setNewSellingPrice(parseFloat(e.target.value) || 0)}
            required
          />

          <Input
            label="Reason for Price Adjustment *"
            placeholder="e.g. Cost inflation adjustment"
            value={priceReason}
            onChange={(e) => setPriceReason(e.target.value)}
            required
          />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setPriceModalProduct(null)} className="w-full sm:w-auto justify-center">
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingPrice} leftIcon={<Send className="w-3.5 h-3.5" />} className="w-full sm:w-auto justify-center">
              Submit Price Request & Notify Admin
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirmation for Stock Addition Request */}
      <ConfirmDialog
        isOpen={confirmingStockSubmit}
        onClose={() => setConfirmingStockSubmit(false)}
        onConfirm={() => {
          setConfirmingStockSubmit(false);
          const fakeEvent = { preventDefault: () => {} } as any;
          handleRequestStockAddition(fakeEvent);
        }}
        title="Submit Stock Addition Request"
        message={`Are you sure you want to submit a stock addition request (+${addQty} units) for product "${stockModalProduct?.name}" to Admin for approval?`}
        confirmText="Submit Request"
      />

      {/* Confirmation for Price Change Request */}
      <ConfirmDialog
        isOpen={confirmingPriceSubmit}
        onClose={() => setConfirmingPriceSubmit(false)}
        onConfirm={() => {
          setConfirmingPriceSubmit(false);
          const fakeEvent = { preventDefault: () => {} } as any;
          handleRequestPriceChange(fakeEvent);
        }}
        title="Submit Price Change Request"
        message={`Are you sure you want to submit price adjustment proposals for product "${priceModalProduct?.name}" and send an email alert to the Administrator?`}
        confirmText="Submit & Notify Admin"
      />

      {/* Multi-Product Bulk Stock Addition Modal (Requirement 1) */}
      <Dialog
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Bulk Add Stock Request"
        description="Enter incoming shipment quantities and acquisition costs across team products. Admin will approve all items in a single action."
        maxWidth="3xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmingBulkSubmit(true);
          }}
          className="space-y-4"
        >
          {/* Top Live Stats Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-slate-500">Items to Replenish:</span>{' '}
                <strong className="text-slate-900 font-mono">
                  {Object.values(bulkQuantities).filter((q) => q > 0).length} of {products.length}
                </strong>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-500">Total Units:</span>{' '}
                <strong className="text-emerald-700 font-mono text-sm">
                  +{Object.values(bulkQuantities).reduce((sum, q) => sum + (q || 0), 0)} units
                </strong>
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              Leave quantity empty or 0 to skip products.
            </div>
          </div>

          {/* Desktop Table View (md: and up) */}
          <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-[35%]">Product</th>
                  <th className="py-3 px-3 w-[20%]">Add Qty (+)</th>
                  <th className="py-3 px-3 w-[22%]">Batch Cost (LKR)</th>
                  <th className="py-3 px-3 w-[23%]">Proposed Price (LKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const qty = bulkQuantities[p.id] || 0;
                  const cost = bulkBatchCosts[p.id] ?? p.costPrice;
                  const price = bulkProposedPrices[p.id] ?? p.sellingPrice;
                  const isAdding = qty > 0;

                  return (
                    <tr key={p.id} className={`transition-colors ${isAdding ? 'bg-blue-50/50' : 'hover:bg-slate-50/70'}`}>
                      {/* Product Name & On-Hand Badge */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs">{p.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-400">{p.code}</span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                            {p.currentStock} in stock
                          </span>
                          {isAdding && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">
                              → {p.currentStock + qty} projected
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Add Qty Input */}
                      <td className="py-3 px-3">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={qty === 0 ? '' : qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setBulkQuantities((prev) => ({ ...prev, [p.id]: val }));
                            }}
                            placeholder="0"
                            className="w-full text-xs font-bold font-mono px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </td>

                      {/* Batch Unit Cost */}
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cost}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setBulkBatchCosts((prev) => ({ ...prev, [p.id]: val }));
                          }}
                          className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </td>

                      {/* Proposed Selling Price */}
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={price}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setBulkProposedPrices((prev) => ({ ...prev, [p.id]: val }));
                          }}
                          className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (< md) */}
          <div className="block md:hidden space-y-3">
            {products.map((p) => {
              const qty = bulkQuantities[p.id] || 0;
              const cost = bulkBatchCosts[p.id] ?? p.costPrice;
              const price = bulkProposedPrices[p.id] ?? p.sellingPrice;
              const isAdding = qty > 0;

              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border transition-colors space-y-2.5 ${
                    isAdding ? 'border-blue-300 bg-blue-50/40 shadow-xs' : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Top info */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{p.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{p.code}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                        {p.currentStock} in stock
                      </span>
                      {isAdding && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-mono">
                          → {p.currentStock + qty}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Input Grid */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Add Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={qty === 0 ? '' : qty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setBulkQuantities((prev) => ({ ...prev, [p.id]: val }));
                        }}
                        placeholder="0"
                        className="w-full text-xs font-bold font-mono px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Cost (LKR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cost}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setBulkBatchCosts((prev) => ({ ...prev, [p.id]: val }));
                        }}
                        className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Price (LKR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setBulkProposedPrices((prev) => ({ ...prev, [p.id]: val }));
                        }}
                        className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Input
            label="Reason / Remarks for Bulk Addition *"
            placeholder="e.g. Monthly stock inventory replenishment with updated vendor shipment invoices"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            required
          />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsBulkModalOpen(false)} className="w-full sm:w-auto justify-center">
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingBulk} leftIcon={<Send className="w-3.5 h-3.5" />} className="w-full sm:w-auto justify-center">
              Submit 1 Approval Request for All Products
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirmation for Bulk Stock Request */}
      <ConfirmDialog
        isOpen={confirmingBulkSubmit}
        onClose={() => setConfirmingBulkSubmit(false)}
        onConfirm={() => {
          setConfirmingBulkSubmit(false);
          const fakeEvent = { preventDefault: () => {} } as any;
          handleRequestBulkStockAddition(fakeEvent);
        }}
        title="Submit Multi-Product Bulk Stock Request"
        message="Are you sure you want to submit a single multi-product stock addition request to Admin for 1-click approval?"
        confirmText="Submit Bulk Request"
      />

      {/* Report Damaged Stock Modal */}
      <Dialog
        isOpen={!!damageModalProduct}
        onClose={() => setDamageModalProduct(null)}
        title="Report Damaged Stock Units"
        description="Segregate damaged or broken units from sellable inventory. Damaged items are tracked separately."
        maxWidth="md"
      >
        {damageModalProduct && (
          <form onSubmit={handleReportDamage} className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-rose-900">{damageModalProduct.name} ({damageModalProduct.code})</div>
              <div className="text-rose-800">
                Available Sellable Stock: <strong>{damageModalProduct.currentStock} units</strong>
                {damageModalProduct.damagedStock ? ` | Existing Damaged: ${damageModalProduct.damagedStock} units` : ''}
              </div>
            </div>

            <Input
              label="Damaged Quantity to Quarantine *"
              type="number"
              min="1"
              max={damageModalProduct.currentStock}
              value={damageQty}
              onChange={(e) => setDamageQty(parseInt(e.target.value) || 1)}
              required
            />

            <Input
              label="Damage Reason / Inspection Notes *"
              placeholder="e.g. Broken packaging / expired seal / transport damage"
              value={damageReason}
              onChange={(e) => setDamageReason(e.target.value)}
              required
            />

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setDamageModalProduct(null)} className="w-full sm:w-auto justify-center">
                Cancel
              </Button>
              <Button type="submit" variant="danger" isLoading={isSubmittingDamage} leftIcon={<AlertTriangle className="w-3.5 h-3.5" />} className="w-full sm:w-auto justify-center">
                Quarantine Damaged Stock
              </Button>
            </div>
          </form>
        )}
      </Dialog>

    </div>
  );
};
