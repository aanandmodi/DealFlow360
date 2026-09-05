/**
 * Customer Portal Negotiation Screen — B8.
 * A genuinely separate, restricted view (different auth, different layout).
 * Matches the reference Customer Portal screenshot.
 */
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { portalApi, PortalQuotation } from '../../api/portal';
import { formatCurrency, formatDate, getStatusBadgeClass, getStatusLabel } from '../../lib/utils';
import {
  Download, MessageSquare, CheckCircle2, Send, Shield, Calendar,
  User, ExternalLink, RefreshCw, AlertTriangle, FileText
} from 'lucide-react';

export function PortalNegotiationPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [quotation, setQuotation] = useState<PortalQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Counter-discount form
  const [counterDiscount, setCounterDiscount] = useState(14);
  const [targetDate, setTargetDate] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ status: string; message: string } | null>(null);

  useEffect(() => {
    if (token) {
      loadQuotation();
    }
  }, [token]);

  const loadQuotation = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await portalApi.getQuotation(token);
      setQuotation(data);
    } catch {
      setError('Unable to load quotation. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleCounterDiscount = async () => {
    if (!quotation) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const result = await portalApi.counterDiscount(
        quotation.id,
        counterDiscount,
        customerMessage || `Counter-discount proposal: ${counterDiscount}%`
      );
      setSubmitResult(result);
      loadQuotation();
    } catch {
      setSubmitResult({ status: 'error', message: 'Failed to submit counter-discount' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!quotation) return;
    setSubmitting(true);
    try {
      const result = await portalApi.confirm(quotation.id);
      setSubmitResult(result);
      loadQuotation();
    } catch {
      setSubmitResult({ status: 'error', message: 'Failed to confirm quotation' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#2563EB' }} />
        </div>
      </PortalLayout>
    );
  }

  if (error || !quotation) {
    return (
      <PortalLayout>
        <div className="max-w-lg mx-auto py-24 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: '#F59E0B' }} />
          <h2 className="text-xl font-bold mb-2">Unable to Load Quotation</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-caption)' }}>{error || 'Quotation not found'}</p>
        </div>
      </PortalLayout>
    );
  }

  const grossTotal = quotation.lines.reduce((s, l) => s + l.qty * l.unit_price, 0);

  return (
    <PortalLayout>
      {/* Quotation Header */}
      <div className="card mb-4 flex items-center justify-between"
           style={{ background: 'var(--color-surface-inset)' }}>
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">Quotation {quotation.quote_number}</span>
              <span className={`badge ${getStatusBadgeClass(quotation.status)}`}>
                {getStatusLabel(quotation.status)}
              </span>
              <span className="badge badge-success" style={{ fontSize: 9 }}>VERIFIED VENDOR</span>
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-caption)' }}>
              Prepared for {quotation.customer_name} • Representative: {quotation.rep_name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-sm gap-1.5"><Download className="w-3 h-3" /> Download PDF</button>
          <button className="btn btn-secondary btn-sm gap-1.5"><MessageSquare className="w-3 h-3" /> Activity (2)</button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="card mb-6 flex items-start justify-between"
           style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5" style={{ color: '#2563EB' }} />
          <div>
            <div className="font-semibold text-sm">Revised Proposal Pending Customer Review</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {quotation.rep_name} updated terms reflecting your request on hardware discounting. Review the attached breakdown, inline comments, or suggest automated adjustments below before confirming.
            </div>
          </div>
        </div>
        <div className="text-right whitespace-nowrap ml-4">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-caption)' }}>Valid Until</div>
          <div className="font-mono text-sm font-bold">{quotation.valid_until ? formatDate(quotation.valid_until) : 'N/A'}</div>
        </div>
      </div>

      {/* Main Content — 3 column layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left 2 columns: Quotation Details */}
        <div className="col-span-2">
          {/* Customer / Vendor Info */}
          <div className="flex justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg">{quotation.customer_name}</span>
                <CheckCircle2 className="w-4 h-4" style={{ color: '#10B981' }} />
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-caption)' }}>
                Attn: {quotation.customer_name}, Procurement Director<br />
                {quotation.customer_company}
              </div>
            </div>
            <div className="text-right text-xs" style={{ color: 'var(--color-text-caption)' }}>
              <div className="uppercase tracking-wider text-[10px] font-semibold" style={{ color: '#2563EB' }}>Vendor Entity</div>
              <div className="font-mono font-semibold">DealFlow360 Enterprise Corp</div>
              <div className="font-mono">Tax ID: US-94-382910</div>
              <div className="font-mono">Issue Date: {formatDate(quotation.created_at)}</div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="card p-0 overflow-hidden mb-6">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="text-left px-4 py-2">Item & Specification</th>
                  <th className="text-center px-4 py-2">Qty</th>
                  <th className="text-right px-4 py-2">Unit Price</th>
                  <th className="text-right px-4 py-2">Ext Total</th>
                </tr>
              </thead>
              <tbody>
                {quotation.lines.map((line) => {
                  const lineMessages = quotation.negotiation_messages.filter(
                    m => m.line_product_name === line.product_name
                  );
                  return (
                    <tr key={line.id} className="table-row" style={{ verticalAlign: 'top' }}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm">{line.product_name}</div>
                        <div className="text-[11px] mb-2" style={{ color: 'var(--color-text-caption)' }}>
                          {line.description || `${line.product_category} — Enterprise Deployment`}
                        </div>
                        {/* Inline messages */}
                        {lineMessages.map((msg) => (
                          <div key={msg.id} className="mt-2 p-2 rounded text-[11px]"
                               style={{
                                 background: msg.author_type === 'customer' ? '#FFF7ED' : '#F0FDF4',
                                 border: `1px solid ${msg.author_type === 'customer' ? '#FDE68A' : '#BBF7D0'}`,
                               }}>
                            <span className="font-semibold uppercase text-[9px] tracking-wider"
                                  style={{ color: msg.author_type === 'customer' ? '#D97706' : '#059669' }}>
                              {msg.author_type === 'customer' ? 'CUSTOMER NOTE' : msg.author_name}:
                            </span>{' '}
                            <span style={{ color: 'var(--color-text-secondary)' }}>{msg.message}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm">{Number(line.qty)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{formatCurrency(line.unit_price)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-mono text-sm font-semibold">{formatCurrency(line.line_total)}</div>
                        {line.discount_pct > 0 && (
                          <span className="badge badge-success mt-1" style={{ fontSize: 9, height: 16 }}>
                            {line.discount_pct}% OFF Applied
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals + Payment Terms */}
          <div className="card">
            <div className="flex justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                     style={{ color: 'var(--color-text-secondary)' }}>Payment & Terms</div>
                <div className="text-xs" style={{ color: 'var(--color-text-caption)' }}>
                  Net 30 payment schedule. Invoicing initiated upon physical hardware carrier dispatch.
                </div>
              </div>
              <div className="text-right font-mono text-sm" style={{ minWidth: 200 }}>
                <div className="flex justify-between py-1"><span style={{ color: 'var(--color-text-caption)' }}>Gross Total:</span><span>{formatCurrency(grossTotal)}</span></div>
                <div className="flex justify-between py-1" style={{ color: '#10B981' }}><span>Negotiated Discounts:</span><span>-{formatCurrency(quotation.total_discount)}</span></div>
                <div className="flex justify-between py-1"><span style={{ color: 'var(--color-text-caption)' }}>Estimated Shipping:</span><span>$0.00 (Enterprise Tier)</span></div>
                <div className="flex justify-between py-2 mt-2 font-bold text-base"
                     style={{ borderTop: '2px solid var(--color-text-primary)' }}>
                  <span>Net Payable:</span>
                  <span style={{ color: '#2563EB' }}>{formatCurrency(quotation.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Negotiation Panel */}
        <div className="flex flex-col gap-4">
          {/* Counter-Offer Panel */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Settings2Icon />
              <span className="font-semibold text-sm">Negotiation & Counter-Offer</span>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-caption)' }}>
              Submit requested amendments directly into DealFlow360. Automated deal desk routing will calculate impact instantly.
            </p>

            {/* Discount Slider */}
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-2"
                   style={{ color: 'var(--color-text-secondary)' }}>
                Requested Hardware Discount
              </div>
              <input
                type="range"
                min={0}
                max={25}
                value={counterDiscount}
                onChange={(e) => setCounterDiscount(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: '#2563EB' }}
              />
              <div className="flex justify-between text-[10px] mt-1">
                <span style={{ color: 'var(--color-text-caption)' }}>Current: {counterDiscount}%</span>
                <span className="font-mono font-bold" style={{ color: counterDiscount > 15 ? '#E11D48' : '#2563EB' }}>
                  {counterDiscount}%
                </span>
              </div>
              <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--color-text-disabled)' }}>
                <span></span>
                <span>15%+ requires VP approval</span>
              </div>
            </div>

            {/* Target Delivery Date */}
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-2"
                   style={{ color: 'var(--color-text-secondary)' }}>Target Delivery Date</div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-disabled)' }} />
                <input type="date" className="input pl-9" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </div>
            </div>

            {/* Customer Message */}
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-2"
                   style={{ color: 'var(--color-text-secondary)' }}>
                Customer Message / Procurement Justification
              </div>
              <textarea
                className="input"
                style={{ height: 80, padding: '8px 10px', resize: 'none' }}
                placeholder="We are finalizing our Q3 procurement budget..."
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value)}
              />
            </div>

            {/* Auto-Approval Forecast */}
            <div className="p-3 rounded mb-4"
                 style={{ background: counterDiscount > 15 ? 'var(--color-warning-bg)' : 'var(--color-success-bg)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Shield className="w-3.5 h-3.5" style={{ color: counterDiscount > 15 ? '#D97706' : '#059669' }} />
                <span className="text-xs font-semibold"
                      style={{ color: counterDiscount > 15 ? '#92400E' : '#065F46' }}>
                  Auto-Approval Forecast
                </span>
              </div>
              <p className="text-[10px]" style={{ color: counterDiscount > 15 ? '#92400E' : '#065F46' }}>
                {counterDiscount > 15
                  ? `At ${counterDiscount}% discount, this request will require 2-step review from Sales Manager M. Shah and Finance.`
                  : counterDiscount > 10
                  ? `At ${counterDiscount}% discount, this request will require 1-step review from Sales Manager.`
                  : `At ${counterDiscount}% discount, this request is within auto-approval bounds. No additional review needed.`
                }
              </p>
            </div>

            {/* Submit Result */}
            {submitResult && (
              <div className={`p-3 rounded mb-4 text-xs ${submitResult.status === 'error' ? '' : ''}`}
                   style={{
                     background: submitResult.status === 'reapproval_triggered' ? 'var(--color-warning-bg)' :
                       submitResult.status === 'confirmed' ? 'var(--color-success-bg)' :
                       submitResult.status === 'error' ? 'var(--color-danger-bg)' : 'var(--color-info-bg)',
                     border: `1px solid ${submitResult.status === 'error' ? 'var(--color-danger-border)' : 'var(--color-info-border)'}`,
                   }}>
                {submitResult.message}
              </div>
            )}

            {/* Action Buttons */}
            <button
              className="btn btn-primary w-full mb-2 gap-1.5"
              onClick={handleConfirm}
              disabled={submitting || quotation.status === 'pending_approval'}
            >
              <CheckCircle2 className="w-4 h-4" /> Accept & Confirm Quotation
            </button>
            <button
              className="btn btn-secondary w-full gap-1.5"
              onClick={handleCounterDiscount}
              disabled={submitting}
            >
              <Send className="w-4 h-4" /> Submit Counter-Offer (Request Review)
            </button>
            <div className="text-[9px] text-center mt-2 uppercase tracking-wider"
                 style={{ color: 'var(--color-text-disabled)' }}>
              Automated Re-Entry Rule Active: Screen 6 Linkage
            </div>
          </div>

          {/* Sales Rep Contact */}
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                   style={{ background: '#475569' }}>
                {quotation.rep_name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{quotation.rep_name}</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-caption)' }}>
                  Assigned Sales Director • DealFlow360
                </div>
              </div>
              <MessageSquare className="w-4 h-4" style={{ color: 'var(--color-text-disabled)' }} />
            </div>
          </div>

          {/* Security Footer */}
          <div className="flex items-center justify-center gap-3 text-[10px] py-2"
               style={{ color: 'var(--color-text-disabled)' }}>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> SOC2 Type II Encrypted</span>
            <span>|</span>
            <span className="flex items-center gap-1">🏢 East/Main Hub Reserved</span>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

/* ── Portal Layout (separate from internal app shell) ── */
function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-surface-canvas)' }}>
      {/* Portal Header */}
      <header className="flex items-center h-14 px-6 shrink-0"
              style={{ background: 'white', borderBottom: '1px solid var(--color-surface-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs"
               style={{ background: '#2563EB' }}>A</div>
          <span className="font-semibold">DealFlow<span style={{ color: '#2563EB' }}>360</span></span>
        </div>
        <div className="mx-4 text-xs" style={{ color: 'var(--color-text-disabled)' }}>|</div>
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Customer Portal</span>
        <div className="flex-1" />
        <span className="text-xs" style={{ color: 'var(--color-text-caption)' }}>Secure Portal Access</span>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between h-8 px-6 shrink-0 text-[10px]"
              style={{ background: 'white', borderTop: '1px solid var(--color-surface-border)', color: 'var(--color-text-caption)' }}>
        <span>DealFlow360 Enterprise Revenue Operations Platform <span className="font-mono">v4.18.2-prod</span></span>
        <div className="flex items-center gap-4">
          <span>System SLA 99.98%</span>
          <span>Audited SOC2 Type II</span>
          <span>© 2025 DealFlow360 Inc. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

function Settings2Icon() {
  return (
    <svg className="w-4 h-4" style={{ color: '#2563EB' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
    </svg>
  );
}
