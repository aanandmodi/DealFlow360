/**
 * Subscription & Hybrid Billing Page — B7: Unified One-Time + Recurring billing with mid-cycle proration.
 * Matches DealFlow360 enterprise design system.
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
  DollarSign,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Sliders,
  ChevronRight,
  TrendingDown,
  Percent,
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
              FINANCE & OPS &rsaquo; <span style={{ color: '#2563EB' }}>HYBRID BILLING & SUBSCRIPTIONS</span>
            </span>
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
          >
            Subscription & Hybrid Billing Schedule
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Unified billing schedule partitioning one-time CapEx and recurring SaaS OpEx with calendar-accurate proration.
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
            onClick={() => selectedQuoteId && loadSchedule(selectedQuoteId)}
            className="btn btn-secondary btn-sm gap-1.5"
            disabled={loadingSchedule || !selectedQuoteId}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSchedule ? 'animate-spin' : ''}`} />
            Refresh
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
            <span>ONE-TIME REVENUE (CAPEX)</span>
            <Receipt className="w-4 h-4 text-blue-500" />
          </div>
          <div className="metric-value">
            {scheduleData ? formatCurrency(parseFloat(scheduleData.total_one_time || '0')) : '—'}
          </div>
          <div className="metric-sub">Upfront hardware & service billing</div>
        </div>

        <div className="metric-tile">
          <div className="metric-label flex items-center justify-between">
            <span>RECURRING ARR (OPEX)</span>
            <CreditCard className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="metric-value text-emerald-600">
            {scheduleData ? formatCurrency(parseFloat(scheduleData.total_recurring || '0')) : '—'}
          </div>
          <div className="metric-sub">Annualized subscription run-rate</div>
        </div>

        <div className="metric-tile">
          <div className="metric-label flex items-center justify-between">
            <span>ACTIVE SUBSCRIPTIONS</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="metric-value">
            {scheduleData?.recurring_lines ? scheduleData.recurring_lines.length : 0}
          </div>
          <div className="metric-sub">Recurring contract streams</div>
        </div>

        <div className="metric-tile">
          <div className="metric-label flex items-center justify-between">
            <span>PRORATION POLICY</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="metric-value text-base">
            <span className="badge badge-info text-xs">Calendar Exact</span>
          </div>
          <div className="metric-sub">Co-termed daily billing cycle</div>
        </div>
      </div>

      {/* Section 1: One-Time Lines (CapEx) */}
      <div className="card p-0 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                One-Time Capital Purchases (CapEx)
              </h3>
              <span className="badge badge-info text-[10px]">Instant Invoice</span>
            </div>
            <p className="text-xs text-slate-500">
              Hardware appliances, perpetual licenses, and onboarding professional services.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-700">
            Subtotal: {scheduleData ? formatCurrency(parseFloat(scheduleData.total_one_time || '0')) : '$0.00'}
          </span>
        </div>

        {loadingSchedule ? (
          <div className="py-12 flex justify-center text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
          </div>
        ) : !scheduleData?.one_time_lines || scheduleData.one_time_lines.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No one-time line items on this quotation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-2.5">Line #</th>
                  <th className="px-4 py-2.5">Product Description</th>
                  <th className="px-4 py-2.5 text-right">Quantity</th>
                  <th className="px-4 py-2.5 text-right">Unit Price</th>
                  <th className="px-4 py-2.5 text-right">Discount</th>
                  <th className="px-4 py-2.5 text-right">Line Total</th>
                  <th className="px-4 py-2.5 text-center">Invoice Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduleData.one_time_lines.map((line) => (
                  <tr key={line.line_id} className="table-row">
                    <td className="px-4 py-3 font-mono text-slate-400">#{line.line_id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{line.product_name}</td>
                    <td className="px-4 py-3 text-right font-mono">{line.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(parseFloat(line.unit_price))}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{line.discount_percent}%</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(parseFloat(line.line_total))}
                    </td>
                    <td className="px-4 py-3 text-center">
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
      <div className="card p-0 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Recurring SaaS Subscription Schedules (OpEx)
              </h3>
              <span className="badge badge-success text-[10px]">Recurring Engine</span>
            </div>
            <p className="text-xs text-slate-500">
              Contracted software tiers, SLA support packages, and recurring services.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-700">
            Total Recurring: {scheduleData ? formatCurrency(parseFloat(scheduleData.total_recurring || '0')) : '$0.00'}
          </span>
        </div>

        {loadingSchedule ? (
          <div className="py-12 flex justify-center text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
          </div>
        ) : !scheduleData?.recurring_lines || scheduleData.recurring_lines.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No recurring subscription lines configured on this quotation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-2.5">Line #</th>
                  <th className="px-4 py-2.5">Subscription Product</th>
                  <th className="px-4 py-2.5">Cycle & Plan</th>
                  <th className="px-4 py-2.5 text-right">Recurring Rate</th>
                  <th className="px-4 py-2.5 text-center">Next Renewal</th>
                  <th className="px-4 py-2.5 text-center">Lifecycle Status</th>
                  <th className="px-4 py-2.5 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduleData.recurring_lines.map((line) => {
                  const sub = line.subscription;
                  return (
                    <tr key={line.line_id} className="table-row">
                      <td className="px-4 py-3 font-mono text-slate-400">#{line.line_id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{line.product_name}</div>
                        <div className="text-[11px] text-slate-400">Qty: {line.quantity} seats/units</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{sub?.plan_name || 'Standard Tier'}</div>
                        <div className="text-[10px] uppercase font-bold text-blue-600">
                          {sub?.billing_cycle || 'monthly'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                        {formatCurrency(parseFloat(line.line_total))}
                        <span className="text-[10px] text-slate-400 font-normal">/{sub?.billing_cycle || 'mo'}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600">
                        {sub?.next_billing_date || 'In 30 Days'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`badge ${
                            sub?.status === 'cancelled'
                              ? 'badge-danger'
                              : sub?.status === 'prorated'
                              ? 'badge-warning'
                              : 'badge-success'
                          } text-[10px]`}
                        >
                          {sub?.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenProrateModal(line)}
                            className="btn btn-secondary btn-sm text-[11px] h-7"
                          >
                            <Sliders className="w-3 h-3" /> Prorate
                          </button>
                          <button
                            onClick={() => setSelectedLineForCancel(line)}
                            className="btn btn-danger btn-sm text-[11px] h-7"
                          >
                            <XCircle className="w-3 h-3" /> Cancel
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

      {/* Proration Calculation Drawer / Modal */}
      {selectedLineForProrate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Mid-Cycle Proration Calculator
                </h3>
                <p className="text-xs text-slate-500">
                  Adjust contract quantity or plan mid-term with exact calendar-day proration.
                </p>
              </div>
              <button
                onClick={() => setSelectedLineForProrate(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded p-3 mb-4 text-xs space-y-1">
              <div className="font-semibold text-slate-800">
                {selectedLineForProrate.product_name}
              </div>
              <div className="text-slate-500">
                Current: {selectedLineForProrate.quantity} units @{' '}
                {formatCurrency(parseFloat(selectedLineForProrate.line_total))}/cycle
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Effective Date of Change:
                </label>
                <input
                  type="date"
                  value={prorateDate}
                  onChange={(e) => setProrateDate(e.target.value)}
                  className="input text-xs"
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
                  className="input text-xs"
                />
              </div>
            </div>

            {prorateResult && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-xs space-y-1.5 animate-fade-in">
                <div className="font-bold text-blue-900 flex items-center justify-between">
                  <span>Proration Calculation Result:</span>
                  <span className="badge badge-info text-[10px]">
                    {prorateResult.days_remaining} / {prorateResult.cycle_days} Days Remaining
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Prorated Charge Due Today:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {formatCurrency(parseFloat(prorateResult.prorated_amount))}
                  </span>
                </div>
                {parseFloat(prorateResult.credit_amount) > 0 && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>Credit Note Issued:</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(parseFloat(prorateResult.credit_amount))}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedLineForProrate(null)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
              <button
                onClick={handleCalculateProration}
                disabled={calculatingProrate}
                className="btn btn-primary btn-sm gap-1.5"
              >
                {calculatingProrate ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Sliders className="w-3 h-3" />
                )}
                Calculate & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {selectedLineForCancel && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center gap-2 text-rose-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">
                Cancel Recurring Subscription
              </h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Are you sure you want to terminate the subscription for{' '}
              <strong className="text-slate-900">{selectedLineForCancel.product_name}</strong>?
              Unused calendar days in the current billing cycle will be automatically refunded via Credit Note.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedLineForCancel(null)}
                className="btn btn-secondary btn-sm"
                disabled={cancelling}
              >
                Keep Active
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="btn btn-danger btn-sm gap-1.5"
              >
                {cancelling ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
