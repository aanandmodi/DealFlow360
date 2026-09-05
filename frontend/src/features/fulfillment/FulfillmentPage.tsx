/**
 * Fulfillment & Warehouse Split Page — B6: Multi-warehouse auto-split & inventory governance.
 * Matches DealFlow360 enterprise design system.
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
  ArrowRight,
  ShieldAlert,
  Edit3,
  Check,
  PackageCheck,
  ChevronDown,
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
      // Initialize override allocations in case user toggles override mode
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
    <div className="p-6 max-w-[1400px] mx-auto animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: 'var(--color-text-caption)' }}
            >
              OPERATIONS &rsaquo; <span style={{ color: '#2563EB' }}>WAREHOUSE FULFILLMENT</span>
            </span>
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
          >
            Fulfillment & Multi-Warehouse Auto-Split
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Greedy cost-weighted allocation balancing order fulfillment across regional nodes.
          </p>
        </div>

        {/* Quotation Selector & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Select Quotation:</label>
            <div className="relative">
              <select
                value={selectedQuoteId || ''}
                onChange={(e) => setSelectedQuoteId(Number(e.target.value))}
                className="input pr-8 text-xs font-mono font-medium"
                style={{ width: 220, height: 34 }}
                disabled={loadingQuotes || quotations.length === 0}
              >
                {quotations.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quote_number} — {q.customer_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => selectedQuoteId && loadSplit(selectedQuoteId)}
            className="btn btn-secondary btn-sm gap-1.5"
            disabled={loadingSplit || !selectedQuoteId}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSplit ? 'animate-spin' : ''}`} />
            Re-calculate
          </button>
        </div>
      </div>

      {/* Action Banners */}
      {actionSuccess && (
        <div className="mb-6 p-4 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-900">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span className="text-xs font-semibold text-rose-900">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-medium text-rose-700 hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="metric-tile">
          <div className="metric-label flex items-center justify-between">
            <span>TOTAL SHIPMENTS</span>
            <Truck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="metric-value">
            {splitData ? splitData.total_shipments : '—'}
          </div>
          <div className="metric-sub">Consolidated shipment nodes</div>
        </div>

        <div className="metric-tile">
          <div className="metric-label flex items-center justify-between">
            <span>ESTIMATED FREIGHT COST</span>
            <Boxes className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="metric-value">
            {splitData ? formatCurrency(splitData.total_estimated_cost) : '—'}
          </div>
          <div className="metric-sub">Weighted transit logistics rate</div>
        </div>

        <div className="metric-tile">
          <div className="metric-label flex items-center justify-between">
            <span>BACKORDER STATUS</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="metric-value">
            {splitData?.has_backorders ? (
              <span className="text-amber-600">Backorder</span>
            ) : (
              <span className="text-emerald-600">100% In-Stock</span>
            )}
          </div>
          <div className="metric-sub">
            {splitData?.has_backorders ? 'Requires vendor replenishment' : 'Full immediate fulfillment'}
          </div>
        </div>

        <div className="metric-tile">
          <div className="metric-label flex items-center justify-between">
            <span>GOVERNANCE STATUS</span>
            <PackageCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="metric-value text-base">
            {isOverrideMode ? (
              <span className="badge badge-warning text-xs">Manual Override Active</span>
            ) : (
              <span className="badge badge-success text-xs">Greedy Cost-Optimal</span>
            )}
          </div>
          <div className="metric-sub">Automated inventory logic</div>
        </div>
      </div>

      {/* Backorder Consolidation Prompt Banner */}
      {splitData?.backorder_consolidation_available && (
        <div className="mb-6 card bg-amber-50/80 border-amber-200 p-4 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-amber-100 flex items-center justify-center text-amber-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                Backorder Consolidation Opportunity Detected
              </h4>
              <p className="text-xs text-amber-800">
                Fresh inventory has been restocked in the primary depot. You can consolidate backordered lines to eliminate extra shipments.
              </p>
            </div>
          </div>
          <button
            onClick={() => selectedQuoteId && loadSplit(selectedQuoteId)}
            className="btn btn-sm btn-primary gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Consolidate Backorders
          </button>
        </div>
      )}

      {/* Main Splits Table Card */}
      <div className="card p-0 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Optimal Fulfillment Allocations — {selectedQuotation?.quote_number || 'Quotation'}
            </h3>
            <p className="text-xs text-slate-500">
              Line-item routing calculated to minimize freight cost and shipment count.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isOverrideMode ? (
              <>
                <button
                  onClick={() => setIsOverrideMode(true)}
                  className="btn btn-secondary btn-sm gap-1.5"
                  disabled={loadingSplit || !splitData}
                >
                  <Edit3 className="w-3.5 h-3.5" /> Manual Override
                </button>
                <button
                  onClick={handleAcceptSplit}
                  className="btn btn-primary btn-sm gap-1.5"
                  disabled={loadingSplit || !splitData}
                >
                  <Check className="w-3.5 h-3.5" /> Accept Suggested Split
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsOverrideMode(false)}
                  className="btn btn-secondary btn-sm"
                  disabled={loadingSplit}
                >
                  Cancel Override
                </button>
                <button
                  onClick={handleSaveOverride}
                  className="btn btn-primary btn-sm gap-1.5"
                  disabled={loadingSplit}
                >
                  <Check className="w-3.5 h-3.5" /> Save Override Allocations
                </button>
              </>
            )}
          </div>
        </div>

        {loadingSplit ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">Computing optimal inventory allocation matrix...</span>
          </div>
        ) : !splitData || !splitData.splits || splitData.splits.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Warehouse className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No fulfillment allocations found</p>
            <p className="text-xs text-slate-400 mt-1">
              Select an active quotation with configured products to evaluate fulfillment splits.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5">Fulfillment Node</th>
                  <th className="px-4 py-2.5 text-right">Quantity Allocated</th>
                  <th className="px-4 py-2.5 text-right">Est. Logistics Cost</th>
                  <th className="px-4 py-2.5 text-center">Fulfillment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {splitData.splits.map((split: SplitItem, idx: number) => {
                  return (
                    <tr key={`${split.product_id}-${split.warehouse_id}-${idx}`} className="table-row">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {split.product_name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700">
                            {split.warehouse_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
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
                            className="input text-right font-mono"
                            style={{ width: 80, height: 28 }}
                          />
                        ) : (
                          <span className="font-bold text-slate-900">{split.quantity} units</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {split.is_backorder ? '—' : formatCurrency(split.estimated_cost)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {split.is_backorder ? (
                          <span className="badge badge-warning text-[10px]">
                            ⚠️ Backorder Split
                          </span>
                        ) : (
                          <span className="badge badge-success text-[10px]">
                            ✓ Available In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multi-Warehouse Operational Rules Info Card */}
      <div className="card bg-slate-50 border-slate-200/80 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          Warehouse Split Operational Strategy
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div>
            <div className="font-semibold text-slate-800 mb-0.5">1. Cost-Weighted Greedy Selection</div>
            <p className="text-[11px] text-slate-500">
              Warehouses with lowest freight cost weights are prioritized, filling full lot sizes first before spilling to secondary regional depots.
            </p>
          </div>
          <div>
            <div className="font-semibold text-slate-800 mb-0.5">2. Shipment Count Minimization</div>
            <p className="text-[11px] text-slate-500">
              When items span multiple categories, depots already chosen for line 1 receive allocation priority for subsequent lines to avoid parcel fragmentation.
            </p>
          </div>
          <div>
            <div className="font-semibold text-slate-800 mb-0.5">3. Automated Backorder Isolation</div>
            <p className="text-[11px] text-slate-500">
              Unfulfilled quantities are segregated into backorder records without blocking immediate release of available primary inventory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
