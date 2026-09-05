/**
 * Approval Detail Page — B4 Discount Approval Screen.
 *
 * Per the context (section 1.4/B4):
 * - Shows blended risk score and which lines caused it
 * - Approval steps list (Manager, +Finance if required)
 * - Approve/Reject/Return buttons
 * - Confirmation view showing the audit trail entry
 */

import { Notice } from '../workspace/shared';
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchQuotation, fetchRiskScore,
  approveQuotation, rejectQuotation, returnQuotation,
} from '../../api/quotations';
import {
  formatCurrency, formatPercent, formatDateTime,
  getRiskBadgeClass, getRiskLabel, getStatusBadgeClass,
} from '../../lib/utils';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle2,
  XCircle, RotateCcw, FileText, User, Clock,
  TrendingUp, TrendingDown, Shield,
} from 'lucide-react';

export function ApprovalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [actionTaken, setActionTaken] = useState<string | null>(null);

  const { data: quotation, isLoading } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => fetchQuotation(Number(id)),
  });

  const { data: riskData } = useQuery({
    queryKey: ['risk-score', id],
    queryFn: () => fetchRiskScore(Number(id)),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['quotation', id] });
    queryClient.invalidateQueries({ queryKey: ['risk-score', id] });
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approveQuotation(Number(id), reason),
    onSuccess: () => { invalidate(); setActionTaken('approved'); },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectQuotation(Number(id), reason),
    onSuccess: () => { invalidate(); setActionTaken('rejected'); },
  });

  const returnMutation = useMutation({
    mutationFn: () => returnQuotation(Number(id), reason),
    onSuccess: () => { invalidate(); setActionTaken('returned'); },
  });

  if (isLoading || !quotation) {
    return <div className="p-6"><div className="text-sm text-[var(--color-text-muted)]">Loading approval details...</div></div>;
  }

  const riskScore = parseFloat(quotation.blended_risk_score);
  const isPending = quotation.status === 'pending_approval';
  const lineDetails = riskData?.line_details || [];
  const breachedLines = lineDetails.filter(l => l.policy_status === 'over_limit');

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => navigate('/approvals')} className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-1 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Approval Queue
          </button>
          <h1 className="text-headline-xl flex items-center gap-3">
            Discount Approval — {quotation.quote_number}
            <span className={`badge ${getStatusBadgeClass(quotation.status)}`}>
              <span className="badge-dot" /> {quotation.status_display}
            </span>
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {quotation.customer_name} • {quotation.customer_tier_display} Tier • Rep: {quotation.sales_rep_name}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--color-text-muted)]">DEAL VALUE</div>
          <div className="font-mono text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(quotation.total)}</div>
        </div>
      </div>

      <Notice error={approveMutation.error||rejectMutation.error||returnMutation.error}/>
      {/* Action Result Banner */}
      {actionTaken && (
        <div className={`mb-6 p-4 rounded-md border flex items-center gap-3 ${
          actionTaken === 'approved' ? 'bg-[var(--color-emerald-bg)] border-[var(--color-emerald-border)]' :
          actionTaken === 'rejected' ? 'bg-[var(--color-rose-bg)] border-[var(--color-rose-border)]' :
          'bg-[var(--color-amber-bg)] border-[var(--color-amber-border)]'
        }`}>
          {actionTaken === 'approved' ? <CheckCircle2 className="w-5 h-5 text-[var(--color-emerald)]" /> :
           actionTaken === 'rejected' ? <XCircle className="w-5 h-5 text-[var(--color-rose)]" /> :
           <RotateCcw className="w-5 h-5 text-[var(--color-amber)]" />}
          <span className="text-sm font-medium">
            {actionTaken === 'approved' ? 'Quotation approved successfully. Audit trail entry recorded.' :
             actionTaken === 'rejected' ? 'Quotation rejected. Sales rep notified.' :
             'Quotation returned for revision. Rep can edit and resubmit.'}
          </span>
          <Link to={`/quotations/${id}`} className="ml-auto text-sm text-[var(--color-primary)] hover:underline font-medium">
            View Quotation →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Left — 2 cols */}
        <div className="col-span-2 space-y-4">
          {/* Why This Quote Was Flagged */}
          <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--color-amber)]" />
              <h2 className="text-title-sm">Why This Quote Was Flagged</h2>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className={`px-4 py-3 rounded-md border ${
                  riskScore >= 5 ? 'bg-[var(--color-rose-bg)] border-[var(--color-rose-border)]' :
                  riskScore > 0 ? 'bg-[var(--color-amber-bg)] border-[var(--color-amber-border)]' :
                  'bg-[var(--color-emerald-bg)] border-[var(--color-emerald-border)]'
                }`}>
                  <div className="text-xs font-medium mb-0.5 text-[var(--color-text-muted)]">BLENDED RISK SCORE</div>
                  <div className="font-mono text-2xl font-bold">{riskScore.toFixed(2)}</div>
                  <span className={`badge ${getRiskBadgeClass(quotation.blended_risk_score)} mt-1`}>
                    <span className="badge-dot" /> {getRiskLabel(quotation.blended_risk_score)}
                  </span>
                </div>
                <div className="flex-1 text-sm text-[var(--color-text-secondary)]">
                  <p className="mb-2">
                    {breachedLines.length > 0
                      ? `${breachedLines.length} line item${breachedLines.length > 1 ? 's' : ''} exceed${breachedLines.length === 1 ? 's' : ''} the discount ceiling for this customer's tier (${quotation.customer_tier_display}).`
                      : 'Blended overage across all lines triggers approval threshold.'}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Required approval: <strong>{quotation.approval_level_display}</strong>
                  </p>
                </div>
              </div>

              {/* Per-line breakdown */}
              {lineDetails.length > 0 && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--color-canvas)]">
                      <th className="text-label-uppercase text-left px-3 py-2 border-b border-[var(--color-border)]">Product</th>
                      <th className="text-label-uppercase text-left px-3 py-2 border-b border-[var(--color-border)]">Category</th>
                      <th className="text-label-uppercase text-right px-3 py-2 border-b border-[var(--color-border)]">Discount</th>
                      <th className="text-label-uppercase text-right px-3 py-2 border-b border-[var(--color-border)]">Ceiling</th>
                      <th className="text-label-uppercase text-right px-3 py-2 border-b border-[var(--color-border)]">Overage</th>
                      <th className="text-label-uppercase text-right px-3 py-2 border-b border-[var(--color-border)]">Line Value</th>
                      <th className="text-label-uppercase text-center px-3 py-2 border-b border-[var(--color-border)]">Policy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineDetails.map((line) => (
                      <tr key={line.line_id} className={`border-b border-[var(--color-surface-alt)] ${
                        line.policy_status === 'over_limit' ? 'bg-[var(--color-rose-bg)]/30' : ''
                      }`}>
                        <td className="px-3 py-2 text-sm font-medium">{line.product_name}</td>
                        <td className="px-3 py-2 text-sm text-[var(--color-text-muted)]">{line.category_name}</td>
                        <td className="px-3 py-2 text-right font-mono text-sm">{formatPercent(line.discount_percent)}</td>
                        <td className="px-3 py-2 text-right font-mono text-sm text-[var(--color-text-muted)]">{formatPercent(line.ceiling)}</td>
                        <td className="px-3 py-2 text-right font-mono text-sm font-semibold">
                          {parseFloat(line.overage) > 0
                            ? <span className="text-[var(--color-rose)]">+{formatPercent(line.overage)}</span>
                            : <span className="text-[var(--color-text-disabled)]">—</span>
                          }
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-sm">{formatCurrency(line.line_value)}</td>
                        <td className="px-3 py-2 text-center">
                          {line.policy_status === 'over_limit'
                            ? <span className="badge badge-high-risk"><span className="badge-dot" />BREACH</span>
                            : <span className="badge badge-approved"><span className="badge-dot" />OK</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Quote Line Item Valuation */}
          <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--color-primary)]" />
              <h2 className="text-title-sm">Quote Line Item Valuation</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-canvas)]">
                  <th className="text-label-uppercase text-left px-4 py-2 border-b border-[var(--color-border)]">Product</th>
                  <th className="text-label-uppercase text-center px-4 py-2 border-b border-[var(--color-border)]">Qty</th>
                  <th className="text-label-uppercase text-right px-4 py-2 border-b border-[var(--color-border)]">Unit Price</th>
                  <th className="text-label-uppercase text-right px-4 py-2 border-b border-[var(--color-border)]">Discount</th>
                  <th className="text-label-uppercase text-right px-4 py-2 border-b border-[var(--color-border)]">Net Price</th>
                  <th className="text-label-uppercase text-right px-4 py-2 border-b border-[var(--color-border)]">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {quotation.lines.map(line => (
                  <tr key={line.id} className="border-b border-[var(--color-surface-alt)] hover:bg-[var(--color-canvas)] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium">{line.product_name}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{line.product_sku} • {line.category_name}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-sm">{line.quantity}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">{formatCurrency(line.unit_price)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">
                      <span className={parseFloat(line.discount_percent) > 0 ? 'text-[var(--color-rose)]' : ''}>
                        {formatPercent(line.discount_percent)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">{formatCurrency(line.net_price)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold">{formatCurrency(line.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--color-canvas)] font-semibold">
                  <td colSpan={5} className="px-4 py-2.5 text-right text-sm">Grand Total</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm">{formatCurrency(quotation.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deal Economics & Margin */}
          <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
              <h2 className="text-title-sm">Deal Economics & Margin</h2>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-[var(--color-text-muted)] mb-0.5">GROSS VALUE</div>
                <div className="font-mono text-lg font-bold">{formatCurrency(quotation.gross_total)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-muted)] mb-0.5">TOTAL DISCOUNT</div>
                <div className="font-mono text-lg font-bold text-[var(--color-rose)]">-{formatCurrency(quotation.total_discount_amount)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-muted)] mb-0.5">BLENDED DISCOUNT %</div>
                <div className="font-mono text-lg font-bold">{formatPercent(quotation.blended_discount_percent)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-muted)] mb-0.5">BLENDED MARGIN %</div>
                <div className={`font-mono text-lg font-bold ${
                  parseFloat(quotation.blended_margin_percent) > 30 ? 'text-[var(--color-emerald)]' : 'text-[var(--color-amber)]'
                }`}>
                  {formatPercent(quotation.blended_margin_percent)}
                </div>
              </div>
            </div>
          </div>

          {/* Governance History & Revision Log */}
          <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
              <h2 className="text-title-sm">Governance History & Revision Log</h2>
            </div>
            <div className="p-4">
              {quotation.approval_logs.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] italic">No audit trail entries yet.</p>
              ) : (
                <div className="space-y-3">
                  {quotation.approval_logs.map((log, i) => (
                    <div key={log.id} className="flex items-start gap-3">
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          log.action === 'approved' ? 'bg-[var(--color-emerald-bg)] text-[var(--color-emerald)]' :
                          log.action === 'rejected' ? 'bg-[var(--color-rose-bg)] text-[var(--color-rose)]' :
                          log.action === 'returned' ? 'bg-[var(--color-amber-bg)] text-[var(--color-amber)]' :
                          'bg-[var(--color-indigo-bg)] text-[var(--color-indigo)]'
                        }`}>
                          {log.action === 'approved' ? <CheckCircle2 className="w-4 h-4" /> :
                           log.action === 'rejected' ? <XCircle className="w-4 h-4" /> :
                           log.action === 'returned' ? <RotateCcw className="w-4 h-4" /> :
                           <Shield className="w-4 h-4" />}
                        </div>
                        {i < quotation.approval_logs.length - 1 && (
                          <div className="w-px h-6 bg-[var(--color-border)] mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{log.action_display}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">by {log.actor_name || log.actor_username}</span>
                          <span className="text-xs text-[var(--color-text-disabled)]">({log.role_at_action})</span>
                        </div>
                        {log.reason && (
                          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">"{log.reason}"</p>
                        )}
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--color-text-muted)]">
                          <span>{formatDateTime(log.timestamp)}</span>
                          <span>Risk Score at action: {parseFloat(log.blended_risk_score_at_action).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Multi-Tier Approval Pathway */}
          <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[var(--color-primary)]" />
              <h3 className="text-title-sm">Multi-Tier Approval Pathway</h3>
            </div>
            <div className="space-y-3">
              {[
                {
                  label: 'Submitted by Rep',
                  detail: quotation.sales_rep_name,
                  done: true,
                },
                {
                  label: 'Sales Manager Review',
                  detail: quotation.manager_approved ? 'Approved' : (isPending ? 'Awaiting Review' : '—'),
                  done: quotation.manager_approved,
                  active: isPending && !quotation.manager_approved,
                },
                {
                  label: 'Finance / Ops Review',
                  detail: quotation.required_approval_level === 'manager_finance'
                    ? (quotation.finance_approved ? 'Approved' : (isPending && quotation.manager_approved ? 'Awaiting Review' : '—'))
                    : 'Not required',
                  done: quotation.finance_approved,
                  active: isPending && quotation.manager_approved && !quotation.finance_approved && quotation.required_approval_level === 'manager_finance',
                  skipped: quotation.required_approval_level !== 'manager_finance',
                },
                {
                  label: 'Final Status',
                  detail: quotation.status === 'approved' ? 'Approved — ready for fulfillment'
                    : quotation.status === 'rejected' ? 'Rejected'
                    : quotation.status === 'confirmed' ? 'Confirmed'
                    : 'Pending',
                  done: quotation.status === 'approved' || quotation.status === 'confirmed',
                },
              ].map((step, i) => (
                <div key={i} className={`flex items-start gap-3 p-2.5 rounded ${step.active ? 'bg-[var(--color-primary-light)] border border-[var(--color-primary-ring)]' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    step.done ? 'bg-[var(--color-emerald)] text-white' :
                    step.active ? 'bg-[var(--color-primary)] text-white animate-pulse' :
                    step.skipped ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-disabled)]' :
                    'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                  }`}>
                    {step.done ? '✓' : step.skipped ? '—' : i + 1}
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${step.active ? 'text-[var(--color-primary)]' : step.skipped ? 'text-[var(--color-text-disabled)]' : ''}`}>
                      {step.label}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Manager Decision Memorandum — only if pending */}
          {isPending && (
            <div className="bg-white border-2 border-[var(--color-primary)] rounded-md elevation-2 p-4">
              <h3 className="text-title-sm mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-[var(--color-primary)]" />
                Manager Decision Memorandum
              </h3>

              <div className="mb-3">
                <label className="text-label-uppercase block mb-1">Rationale / Comments</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder="Enter your reasoning for this decision..."
                  className="w-full px-3 py-2 border border-[var(--color-border-muted)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 resize-none"
                />
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 h-10 bg-[var(--color-emerald)] hover:bg-[#047857] text-white font-semibold rounded transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {approveMutation.isPending ? 'Processing...' : 'Approve Quotation'}
                </button>
                <button
                  onClick={() => returnMutation.mutate()}
                  disabled={returnMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 h-10 bg-white border border-[var(--color-amber)] text-[var(--color-amber-text)] font-semibold rounded hover:bg-[var(--color-amber-bg)] transition disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  {returnMutation.isPending ? 'Processing...' : 'Return for Revision'}
                </button>
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 h-10 bg-white border border-[var(--color-rose)] text-[var(--color-rose-text)] font-semibold rounded hover:bg-[var(--color-rose-bg)] transition disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  {rejectMutation.isPending ? 'Processing...' : 'Reject Quotation'}
                </button>
              </div>

              {(approveMutation.isError || rejectMutation.isError || returnMutation.isError) && (
                <div className="mt-3 p-2 bg-[var(--color-rose-bg)] border border-[var(--color-rose-border)] rounded text-xs text-[var(--color-rose-text)]">
                  {(approveMutation.error || rejectMutation.error || returnMutation.error)?.message}
                </div>
              )}
            </div>
          )}

          {/* Deal Summary */}
          <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 p-4">
            <h3 className="text-title-sm mb-3">Deal Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Customer</span>
                <span className="font-medium">{quotation.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Tier</span>
                <span className="font-medium">{quotation.customer_tier_display}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Line Items</span>
                <span className="font-mono">{quotation.lines.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Payment Terms</span>
                <span className="font-medium">{quotation.payment_terms}</span>
              </div>
              <hr className="border-[var(--color-border)]" />
              <div className="flex justify-between font-semibold">
                <span>Grand Total</span>
                <span className="font-mono">{formatCurrency(quotation.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
