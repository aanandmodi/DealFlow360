/**
 * Subscription & Hybrid Billing Page — Unified One-Time + Recurring billing with mid-cycle proration.
 * Styled in the exact visual design system of VendorBridge:
 * - Outfit bold headers and figures
 * - shadow-premium KPI cards with colored icon chips
 * - Clean tables with bg-slate-50 headers
 * - Interactive mid-cycle proration calculator and cancellation modal
 */
import { useState, useEffect } from 'react';
import { quotationsApi, QuotationListItem } from '../../api/quotations';
import {
  getBillingSchedule,
  prorateSubscription,
  cancelSubscription,
  BillingScheduleResponse,
  RecurringLine,
  ProrationResponse,
} from '../../api/billing';
import { formatCurrency } from '../../lib/utils';
import {
  CreditCard,
  Receipt,
  Calendar,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sliders,
} from 'lucide-react';

export function BillingPage() {
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
  const [scheduleData, setScheduleData] = useState<BillingScheduleResponse | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Proration Modal state
  const [selectedLineForProrate, setSelectedLineForProrate] = useState<RecurringLine | null>(null);
  const [prorateDate, setProrateDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [prorateResult, setProrateResult] = useState<ProrationResponse | null>(null);
  const [calculatingProrate, setCalculatingProrate] = useState(false);

  // Cancel Modal state
  const [selectedLineForCancel, setSelectedLineForCancel] = useState<RecurringLine | null>(null);
  const [cancelling, setCancelling] = useState(false);

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
      loadSchedule(selectedQuoteId);
    }
  }, [selectedQuoteId]);

  const loadSchedule = async (quoteId: number) => {
    setLoadingSchedule(true);
    setActionSuccess(null);
    setErrorMessage(null);
    try {
      const data = await getBillingSchedule(quoteId);
      setScheduleData(data);
    } catch (err: any) {
      console.error('Failed to load billing schedule:', err);
      setErrorMessage(err?.message || 'Failed to load billing schedule');
      setScheduleData(null);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleOpenProrateModal = (line: RecurringLine) => {
    setSelectedLineForProrate(line);
    setNewQuantity(parseInt(line.quantity) || 1);
    setProrateResult(null);
  };

  const handleCalculateProration = async () => {
    if (!selectedLineForProrate) return;
    setCalculatingProrate(true);
    try {
      const res = await prorateSubscription(selectedLineForProrate.line_id, {
        change_date: prorateDate,
        new_quantity: newQuantity,
      });
      setProrateResult(res);
      setActionSuccess(`Prorated charge computed: ${formatCurrency(parseFloat(res.prorated_amount))} due for remaining cycle.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to compute proration');
    } finally {
      setCalculatingProrate(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!selectedLineForCancel) return;
    setCancelling(true);
    try {
      const res = await cancelSubscription(selectedLineForCancel.line_id);
      setActionSuccess(`Subscription cancelled. Credit note issued: ${formatCurrency(parseFloat(res.credit_note_amount))}.`);
      setSelectedLineForCancel(null);
      if (selectedQuoteId) loadSchedule(selectedQuoteId);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h2 className="font-outfit text-xl md:text-2xl font-extrabold text-slate-900">
            Subscription & Hybrid Billing Schedule
          </h2>
          <p className="text-xs text-slate-500">
            Unified billing schedule partitioning one-time CapEx and recurring SaaS OpEx with calendar-accurate proration
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
            onClick={() => selectedQuoteId && loadSchedule(selectedQuoteId)}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
            disabled={loadingSchedule || !selectedQuoteId}
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loadingSchedule ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
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
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">One-Time CapEx</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-2xl font-extrabold text-slate-900 truncate">
              {scheduleData ? formatCurrency(parseFloat(scheduleData.total_one_time || '0')) : '—'}
            </span>
            <span className="text-xs font-semibold text-slate-500">Upfront Invoice</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Recurring ARR</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-success">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-2xl font-extrabold text-success truncate">
              {scheduleData ? formatCurrency(parseFloat(scheduleData.total_recurring || '0')) : '—'}
            </span>
            <span className="text-xs font-semibold text-success">Annualized OpEx</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Plans</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {scheduleData?.recurring_lines ? scheduleData.recurring_lines.length : 0}
            </span>
            <span className="text-xs font-semibold text-slate-500">SaaS Streams</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Proration Engine</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-xl font-extrabold text-slate-900">Calendar Exact</span>
            <span className="text-xs font-semibold text-slate-500">Co-termed Daily</span>
          </div>
        </div>
      </div>

      {/* Section 1: One-Time Lines (CapEx) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-premium overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-outfit text-base font-bold text-slate-900">One-Time Capital Purchases (CapEx)</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-light text-primary">Instant Invoice</span>
            </div>
            <p className="text-xs text-slate-500">Hardware appliances, perpetual software licenses, and implementation services</p>
          </div>
          <span className="font-outfit text-xs font-bold text-slate-700">
            Subtotal: {scheduleData ? formatCurrency(parseFloat(scheduleData.total_one_time || '0')) : '$0.00'}
          </span>
        </div>

        {loadingSchedule ? (
          <div className="py-12 flex justify-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !scheduleData?.one_time_lines || scheduleData.one_time_lines.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No one-time line items on this quotation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Line #</th>
                  <th className="px-6 py-3">Product Description</th>
                  <th className="px-6 py-3 text-right">Quantity</th>
                  <th className="px-6 py-3 text-right">Unit Price</th>
                  <th className="px-6 py-3 text-right">Discount</th>
                  <th className="px-6 py-3 text-right">Line Total</th>
                  <th className="px-6 py-3 text-center">Invoice Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduleData.one_time_lines.map((line) => (
                  <tr key={line.line_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">#{line.line_id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{line.product_name}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs">{line.quantity}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs">{formatCurrency(parseFloat(line.unit_price))}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-500">{line.discount_percent}%</td>
                    <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-900">
                      {formatCurrency(parseFloat(line.line_total))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="badge badge-success text-[10px]">Invoice Ready</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Recurring Subscription Lines (OpEx) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-premium overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-outfit text-base font-bold text-slate-900">Recurring SaaS Subscription Schedules (OpEx)</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success-light text-success">Recurring Engine</span>
            </div>
            <p className="text-xs text-slate-500">Contracted software tiers, SLA support packages, and recurring services</p>
          </div>
          <span className="font-outfit text-xs font-bold text-success">
            Total Recurring: {scheduleData ? formatCurrency(parseFloat(scheduleData.total_recurring || '0')) : '$0.00'}
          </span>
        </div>

        {loadingSchedule ? (
          <div className="py-12 flex justify-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !scheduleData?.recurring_lines || scheduleData.recurring_lines.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No recurring subscription lines configured on this quotation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Line #</th>
                  <th className="px-6 py-3">Subscription Product</th>
                  <th className="px-6 py-3">Cycle & Plan</th>
                  <th className="px-6 py-3 text-right">Recurring Rate</th>
                  <th className="px-6 py-3 text-center">Next Renewal</th>
                  <th className="px-6 py-3 text-center">Lifecycle Status</th>
                  <th className="px-6 py-3 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduleData.recurring_lines.map((line) => {
                  const sub = line.subscription;
                  return (
                    <tr key={line.line_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">#{line.line_id}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{line.product_name}</div>
                        <div className="text-[11px] text-slate-400">Qty: {line.quantity} units</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{sub?.plan_name || 'Standard Tier'}</div>
                        <div className="text-[10px] uppercase font-bold text-primary">
                          {sub?.billing_cycle || 'monthly'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-900">
                        {formatCurrency(parseFloat(line.line_total))}
                        <span className="text-[10px] text-slate-400 font-normal">/{sub?.billing_cycle || 'mo'}</span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-xs text-slate-600">
                        {sub?.next_billing_date || 'In 30 Days'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`badge ${
                            sub?.status === 'cancelled'
                              ? 'badge-danger'
                              : sub?.status === 'prorated'
                              ? 'badge-warning'
                              : 'badge-success'
                          }`}
                        >
                          {sub?.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenProrateModal(line)}
                            className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                          >
                            <Sliders className="w-3 h-3 text-slate-400" />
                            <span>Prorate</span>
                          </button>
                          <button
                            onClick={() => setSelectedLineForCancel(line)}
                            className="flex items-center space-x-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-danger shadow-sm hover:bg-rose-50 transition-all cursor-pointer"
                          >
                            <XCircle className="w-3 h-3 text-danger" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proration Calculation Modal (VendorBridge style) */}
      {selectedLineForProrate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-outfit text-base font-bold text-slate-900">
                  Mid-Cycle Proration Calculator
                </h3>
                <p className="text-xs text-slate-500">
                  Adjust contract quantity or plan mid-term with exact calendar-day proration
                </p>
              </div>
              <button
                onClick={() => setSelectedLineForProrate(null)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1 border border-slate-200">
              <div className="font-semibold text-slate-800">
                {selectedLineForProrate.product_name}
              </div>
              <div className="text-slate-500">
                Current: {selectedLineForProrate.quantity} units @{' '}
                {formatCurrency(parseFloat(selectedLineForProrate.line_total))}/cycle
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Effective Date of Change:
                </label>
                <input
                  type="date"
                  value={prorateDate}
                  onChange={(e) => setProrateDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Quantity (Units / Seats):
                </label>
                <input
                  type="number"
                  min="1"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {prorateResult && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs space-y-1.5 animate-fade-in">
                <div className="font-bold text-blue-900 flex items-center justify-between">
                  <span>Proration Calculation Result:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary text-white">
                    {prorateResult.days_remaining} / {prorateResult.cycle_days} Days Remaining
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Prorated Charge Due Today:</span>
                  <span className="font-mono font-bold text-primary">
                    {formatCurrency(parseFloat(prorateResult.prorated_amount))}
                  </span>
                </div>
                {parseFloat(prorateResult.credit_amount) > 0 && (
                  <div className="flex items-center justify-between text-success font-bold">
                    <span>Credit Note Issued:</span>
                    <span className="font-mono">
                      {formatCurrency(parseFloat(prorateResult.credit_amount))}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedLineForProrate(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleCalculateProration}
                disabled={calculatingProrate}
                className="flex items-center space-x-1.5 rounded-lg bg-primary hover:bg-primary-hover px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
              >
                {calculatingProrate ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Sliders className="w-3 h-3" />
                )}
                <span>Calculate & Apply</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {selectedLineForCancel && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center space-x-2 text-danger">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-outfit text-base font-bold text-slate-900">
                Cancel Recurring Subscription
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to terminate the subscription for{' '}
              <strong className="text-slate-900">{selectedLineForCancel.product_name}</strong>?
              Unused calendar days in the current billing cycle will be automatically refunded via Credit Note.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedLineForCancel(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 cursor-pointer"
                disabled={cancelling}
              >
                Keep Active
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="flex items-center space-x-1.5 rounded-lg bg-danger hover:bg-danger-hover px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
              >
                {cancelling ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                <span>Confirm Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
