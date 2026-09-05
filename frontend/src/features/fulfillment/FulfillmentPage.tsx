/**
 * Fulfillment & Warehouse Split Page — Multi-warehouse auto-split & inventory governance.
 * Styled in the exact visual design system of VendorBridge:
 * - Outfit bold headers and metrics
 * - shadow-premium KPI cards with colored icon chips
 * - Clean tables with bg-slate-50 headers
 * - Interactive manual override and auto-split controls
 */
import { useState, useEffect } from 'react';
import { quotationsApi, QuotationListItem } from '../../api/quotations';
import {
  suggestSplit,
  acceptSplit,
  overrideSplit,
  SplitItem,
  SplitSuggestionResponse,
  ManualAllocation,
} from '../../api/fulfillment';
import { formatCurrency } from '../../lib/utils';
import {
  Truck,
  Warehouse,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  ShieldAlert,
  Edit3,
  Check,
  PackageCheck,
} from 'lucide-react';

export function FulfillmentPage() {
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
  const [splitData, setSplitData] = useState<SplitSuggestionResponse | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [loadingSplit, setLoadingSplit] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [overrideAllocations, setOverrideAllocations] = useState<ManualAllocation[]>([]);

  useEffect(() => {
    loadQuotations();
  }, []);

  const loadQuotations = async () => {
    setLoadingQuotes(true);
    try {
      const data = await quotationsApi.list();
      setQuotations(data || []);
      if (data && data.length > 0) {
        setSelectedQuoteId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setLoadingQuotes(false);
    }
  };

  useEffect(() => {
    if (selectedQuoteId) {
      loadSplit(selectedQuoteId);
    }
  }, [selectedQuoteId]);

  const loadSplit = async (quoteId: number) => {
    setLoadingSplit(true);
    setActionSuccess(null);
    setErrorMessage(null);
    setIsOverrideMode(false);
    try {
      const res = await suggestSplit(quoteId);
      setSplitData(res);
      if (res.splits) {
        setOverrideAllocations(
          res.splits.map((s) => ({
            product_id: s.product_id,
            warehouse_id: s.warehouse_id,
            quantity: s.quantity,
            is_backorder: s.is_backorder,
          }))
        );
      }
    } catch (err: any) {
      console.error('Failed to suggest split:', err);
      setErrorMessage(err?.message || 'Unable to calculate warehouse split. Ensure quote contains line items.');
      setSplitData(null);
    } finally {
      setLoadingSplit(false);
    }
  };

  const handleAcceptSplit = async () => {
    if (!selectedQuoteId) return;
    setLoadingSplit(true);
    try {
      const res = await acceptSplit(selectedQuoteId);
      setActionSuccess(`Split confirmed: ${res.splits_created} allocation(s) saved and inventory reserved.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to accept split');
    } finally {
      setLoadingSplit(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!selectedQuoteId) return;
    setLoadingSplit(true);
    try {
      const res = await overrideSplit(selectedQuoteId, overrideAllocations);
      setActionSuccess(`Manual override saved: ${res.splits_created} allocation(s) committed.`);
      setIsOverrideMode(false);
      loadSplit(selectedQuoteId);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save manual override');
    } finally {
      setLoadingSplit(false);
    }
  };

  const selectedQuotation = quotations.find((q) => q.id === selectedQuoteId);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h2 className="font-outfit text-xl md:text-2xl font-extrabold text-slate-900">
            Fulfillment & Multi-Warehouse Auto-Split
          </h2>
          <p className="text-xs text-slate-500">
            Greedy cost-weighted allocation balancing order fulfillment across regional distribution hubs
          </p>
        </div>

        {/* Quotation Selector & Refresh */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500">Select Quote:</span>
            <select
              value={selectedQuoteId || ''}
              onChange={(e) => setSelectedQuoteId(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              disabled={loadingQuotes || quotations.length === 0}
            >
              {quotations.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quote_number} — {q.customer_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => selectedQuoteId && loadSplit(selectedQuoteId)}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
            disabled={loadingSplit || !selectedQuoteId}
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loadingSplit ? 'animate-spin' : ''}`} />
            <span>Re-calculate</span>
          </button>
        </div>
      </div>

      {/* Action Banners */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-success-light border border-success/30 flex items-center justify-between text-success shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="text-xs font-bold">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-danger-light border border-danger/30 flex items-center justify-between text-danger shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="text-xs font-bold">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Metrics (VendorBridge style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Shipments</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <Truck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {splitData ? splitData.total_shipments : '—'}
            </span>
            <span className="text-xs font-semibold text-slate-500">Consolidated Nodes</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Est. Freight Cost</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-2xl font-extrabold text-slate-900 truncate">
              {splitData ? formatCurrency(splitData.total_estimated_cost) : '—'}
            </span>
            <span className="text-xs font-semibold text-slate-500">Weighted Transit Rate</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Backorder Status</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-warning">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-2xl font-extrabold text-slate-900">
              {splitData?.has_backorders ? (
                <span className="text-warning">Backordered</span>
              ) : (
                <span className="text-success">100% In-Stock</span>
              )}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {splitData?.has_backorders ? 'Replenishment Needed' : 'Immediate Release'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Routing Policy</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-success">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-xl font-extrabold text-slate-900">
              {isOverrideMode ? 'Manual' : 'Cost-Optimal'}
            </span>
            <span className="text-xs font-semibold text-slate-500">Greedy Algorithm</span>
          </div>
        </div>
      </div>

      {/* Backorder Consolidation Prompt Banner */}
      {splitData?.backorder_consolidation_available && (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 shadow-premium flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-light text-warning">
              <ShieldAlert className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 font-outfit uppercase tracking-wider">
                Backorder Consolidation Opportunity Detected
              </h4>
              <p className="text-xs text-slate-600 mt-1 font-semibold">
                Fresh inventory restocked in the primary hub. You can consolidate backordered lines into single deliveries.
              </p>
            </div>
          </div>
          <button
            onClick={() => selectedQuoteId && loadSplit(selectedQuoteId)}
            className="flex items-center space-x-1.5 rounded-lg bg-primary hover:bg-primary-hover px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Consolidate Backorders</span>
          </button>
        </div>
      )}

      {/* Main Splits Table Card (VendorBridge style) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-premium overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-outfit text-base font-bold text-slate-900">
              Optimal Fulfillment Allocations — {selectedQuotation?.quote_number || 'Quotation'}
            </h3>
            <p className="text-xs text-slate-500">
              Line-item routing calculated to minimize freight cost and shipment count
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {!isOverrideMode ? (
              <>
                <button
                  onClick={() => setIsOverrideMode(true)}
                  className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                  disabled={loadingSplit || !splitData}
                >
                  <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                  <span>Manual Override</span>
                </button>
                <button
                  onClick={handleAcceptSplit}
                  className="flex items-center space-x-1.5 rounded-lg bg-primary hover:bg-primary-hover px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                  disabled={loadingSplit || !splitData}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Accept Suggested Split</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsOverrideMode(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                  disabled={loadingSplit}
                >
                  Cancel Override
                </button>
                <button
                  onClick={handleSaveOverride}
                  className="flex items-center space-x-1.5 rounded-lg bg-primary hover:bg-primary-hover px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                  disabled={loadingSplit}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Override Allocations</span>
                </button>
              </>
            )}
          </div>
        </div>

        {loadingSplit ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Computing optimal inventory allocation matrix...</span>
          </div>
        ) : !splitData || !splitData.splits || splitData.splits.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Warehouse className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No fulfillment allocations found</p>
            <p className="text-xs text-slate-400 mt-1">
              Select an active quotation with configured products to evaluate fulfillment splits.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">Fulfillment Node</th>
                  <th className="px-6 py-3 text-right">Quantity Allocated</th>
                  <th className="px-6 py-3 text-right">Est. Logistics Cost</th>
                  <th className="px-6 py-3 text-center">Fulfillment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {splitData.splits.map((split: SplitItem, idx: number) => (
                  <tr key={`${split.product_id}-${split.warehouse_id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {split.product_name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Warehouse className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-800">{split.warehouse_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      {isOverrideMode ? (
                        <input
                          type="number"
                          min="0"
                          value={overrideAllocations[idx]?.quantity ?? split.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const updated = [...overrideAllocations];
                            if (updated[idx]) {
                              updated[idx].quantity = val;
                              setOverrideAllocations(updated);
                            }
                          }}
                          className="w-20 text-right font-mono border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
                        />
                      ) : (
                        <span className="font-bold text-slate-900">{split.quantity} units</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-800">
                      {split.is_backorder ? '—' : formatCurrency(split.estimated_cost)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {split.is_backorder ? (
                        <span className="badge badge-warning">
                          ⚠️ Backorder Split
                        </span>
                      ) : (
                        <span className="badge badge-success">
                          ✓ In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Operational Rules Info Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-outfit">
          Warehouse Split Operational Strategy
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div>
            <div className="font-bold text-slate-900 mb-1">1. Cost-Weighted Greedy Selection</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Warehouses with lowest freight cost weights are prioritized, filling full lot sizes first before spilling to secondary regional depots.
            </p>
          </div>
          <div>
            <div className="font-bold text-slate-900 mb-1">2. Shipment Count Minimization</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              When items span multiple categories, depots already chosen for line 1 receive allocation priority for subsequent lines to avoid parcel fragmentation.
            </p>
          </div>
          <div>
            <div className="font-bold text-slate-900 mb-1">3. Automated Backorder Isolation</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Unfulfilled quantities are segregated into backorder records without blocking immediate release of available primary inventory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
