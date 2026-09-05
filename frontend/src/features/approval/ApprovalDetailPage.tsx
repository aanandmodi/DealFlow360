/**
 * Approval Detail Page — B4 Discount Approval Screen.
 * Styled in the exact visual design system of VendorBridge:
 * - Outfit font for headers and financial KPIs
 * - shadow-premium cards
 * - Tabular risk breakdown with status pills
 * - Interactive Decision Memorandum panel
 * - Timeline audit trail
 */

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
  TrendingUp, Shield, MessageSquare, RefreshCw
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
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const riskScore = parseFloat(quotation.blended_risk_score);
  const isPending = quotation.status === 'pending_approval';
  const lineDetails = riskData?.line_details || [];
  const breachedLines = lineDetails.filter(l => l.policy_status === 'over_limit');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <button
            onClick={() => navigate('/approvals')}
            className="flex items-center space-x-1 text-xs font-semibold text-slate-500 hover:text-primary mb-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Approval Queue</span>
          </button>
          <div className="flex items-center space-x-3">
            <h2 className="font-outfit text-xl md:text-2xl font-extrabold text-slate-900">
              Discount Approval — Q-{id}
            </h2>
            <span className={`badge ${getStatusBadgeClass(quotation.status)}`}>
              {quotation.status_display}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {quotation.customer_name} • {quotation.customer_tier_display} Tier • Rep: {quotation.sales_rep_name}
          </p>
        </div>

        <div className="text-left sm:text-right rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Contract Value</div>
          <div className="font-outfit text-2xl font-extrabold text-slate-900">{formatCurrency(quotation.total)}</div>
        </div>
      </div>

      {/* Action Result Banner */}
      {actionTaken && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 shadow-sm ${
          actionTaken === 'approved' ? 'bg-success-light border-success/30 text-success' :
          actionTaken === 'rejected' ? 'bg-danger-light border-danger/30 text-danger' :
          'bg-warning-light border-warning/30 text-warning'
        }`}>
          {actionTaken === 'approved' ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> :
           actionTaken === 'rejected' ? <XCircle className="w-5 h-5 text-danger shrink-0" /> :
           <RotateCcw className="w-5 h-5 text-warning shrink-0" />}
          <span className="text-xs font-bold">
            {actionTaken === 'approved' ? 'Quotation approved successfully. Audit trail entry recorded.' :
             actionTaken === 'rejected' ? 'Quotation rejected. Sales rep notified.' :
             'Quotation returned for revision. Rep can edit and resubmit.'}
          </span>
          <Link to={`/quotations/${id}`} className="ml-auto text-xs font-bold underline">
            View Quotation →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Why This Quote Was Flagged Card (VendorBridge style) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-warning">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-outfit text-sm font-bold text-slate-900">Governance Risk Trigger Explanation</h3>
                <p className="text-[11px] text-slate-500">Autonomous risk analysis of requested discounts</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <div className={`p-4 rounded-xl border shrink-0 text-center min-w-[140px] ${
                riskScore >= 5 ? 'bg-rose-50 border-rose-200 text-danger' :
                riskScore > 0 ? 'bg-amber-50 border-amber-200 text-warning' :
                'bg-emerald-50 border-emerald-200 text-success'
              }`}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Blended Risk</div>
                <div className="font-outfit text-3xl font-extrabold">{riskScore.toFixed(2)}</div>
                <span className={`badge ${getRiskBadgeClass(quotation.blended_risk_score)} mt-1.5`}>
                  {getRiskLabel(quotation.blended_risk_score)}
                </span>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed">
                <p className="font-medium mb-1">
                  {breachedLines.length > 0
                    ? `${breachedLines.length} line item${breachedLines.length > 1 ? 's exceed' : ' exceeds'} the allowable discount ceiling for this customer's tier (${quotation.customer_tier_display}).`
                    : 'Blended margin overage across all quotation lines triggers the Deal Desk threshold.'}
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-[11px] text-slate-400">Required Approval Pathway:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-light text-primary border border-primary/20">
                    {quotation.approval_level_display}
                  </span>
                </div>
              </div>
            </div>

            {/* Per-line breakdown table */}
            {lineDetails.length > 0 && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Product</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5 text-right">Discount</th>
                      <th className="px-4 py-2.5 text-right">Ceiling</th>
                      <th className="px-4 py-2.5 text-right">Overage</th>
                      <th className="px-4 py-2.5 text-right">Line Value</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineDetails.map((line) => (
                      <tr key={line.line_id} className={`hover:bg-slate-50/50 ${line.policy_status === 'over_limit' ? 'bg-rose-50/30' : ''}`}>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{line.product_name}</td>
                        <td className="px-4 py-2.5 text-slate-500">{line.category_name}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">{formatPercent(line.discount_percent)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400">{formatPercent(line.ceiling)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold">
                          {parseFloat(line.overage) > 0 ? (
                            <span className="text-danger">+{formatPercent(line.overage)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700">{formatCurrency(line.line_value)}</td>
                        <td className="px-4 py-2.5 text-center">
                          {line.policy_status === 'over_limit' ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-danger-light text-danger border border-danger/20">
                              BREACH
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-success-light text-success border border-success/20">
                              OK
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

          {/* Line Items Valuation Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-premium overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center space-x-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="font-outfit text-sm font-bold text-slate-900">Quotation Line Items & Valuation</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3 text-center">Qty</th>
                  <th className="px-6 py-3 text-right">Unit Price</th>
                  <th className="px-6 py-3 text-right">Discount</th>
                  <th className="px-6 py-3 text-right">Net Price</th>
                  <th className="px-6 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotation.lines.map(line => (
                  <tr key={line.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900">{line.product_name}</div>
                      <div className="text-[10px] text-slate-400">{line.product_sku} • {line.category_name}</div>
                    </td>
                    <td className="px-6 py-3 text-center font-mono font-medium text-slate-700">{line.quantity}</td>
                    <td className="px-6 py-3 text-right font-mono text-slate-700">{formatCurrency(line.unit_price)}</td>
                    <td className="px-6 py-3 text-right font-mono">
                      <span className={parseFloat(line.discount_percent) > 0 ? 'text-danger font-bold' : 'text-slate-400'}>
                        {formatPercent(line.discount_percent)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-slate-700">{formatCurrency(line.net_price)}</td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-900">{formatCurrency(line.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                <tr>
                  <td colSpan={5} className="px-6 py-3 text-right text-slate-700 uppercase tracking-wider text-[10px]">Grand Total</td>
                  <td className="px-6 py-3 text-right font-mono font-outfit text-sm text-slate-900">{formatCurrency(quotation.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deal Economics & Margin */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-outfit text-sm font-bold text-slate-900">Deal Economics & Margin Analysis</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Value</div>
                <div className="font-outfit text-lg font-bold text-slate-900 mt-0.5">{formatCurrency(quotation.gross_total)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Discount</div>
                <div className="font-outfit text-lg font-bold text-danger mt-0.5">-{formatCurrency(quotation.total_discount_amount)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Blended Discount</div>
                <div className="font-outfit text-lg font-bold text-slate-900 mt-0.5">{formatPercent(quotation.blended_discount_percent)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Realized Margin</div>
                <div className={`font-outfit text-lg font-bold mt-0.5 ${
                  parseFloat(quotation.blended_margin_percent) > 30 ? 'text-success' : 'text-warning'
                }`}>
                  {formatPercent(quotation.blended_margin_percent)}
                </div>
              </div>
            </div>
          </div>

          {/* Governance History & Revision Log */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-5">
              <Clock className="h-4 w-4 text-slate-500" />
              <h3 className="font-outfit text-sm font-bold text-slate-900">Audit History & Governance Log</h3>
            </div>
            {quotation.approval_logs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No previous audit trail entries for this quotation.</p>
            ) : (
              <div className="flow-root">
                <ul className="-mb-8">
                  {quotation.approval_logs.map((log, i) => (
                    <li key={log.id}>
                      <div className="relative pb-6">
                        {i !== quotation.approval_logs.length - 1 ? (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                              log.action === 'approved' ? 'bg-success-light text-success' :
                              log.action === 'rejected' ? 'bg-danger-light text-danger' :
                              log.action === 'returned' ? 'bg-warning-light text-warning' :
                              'bg-primary-light text-primary'
                            }`}>
                              {log.action === 'approved' ? <CheckCircle2 className="w-4 h-4" /> :
                               log.action === 'rejected' ? <XCircle className="w-4 h-4" /> :
                               log.action === 'returned' ? <RotateCcw className="w-4 h-4" /> :
                               <Shield className="w-4 h-4" />}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-900">{log.action_display}</span>
                              <span className="text-[11px] text-slate-500">by {log.actor_name || log.actor_username} ({log.role_at_action})</span>
                            </div>
                            {log.reason && (
                              <p className="text-xs text-slate-600 mt-1 italic bg-slate-50 p-2 rounded border border-slate-100">
                                "{log.reason}"
                              </p>
                            )}
                            <div className="mt-1 text-[10px] text-slate-400">
                              {formatDateTime(log.timestamp)} • Risk at decision: {parseFloat(log.blended_risk_score_at_action).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Multi-Tier Pathway */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="font-outfit text-sm font-bold text-slate-900">Approval Pathway Steps</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Submitted by Rep', detail: quotation.sales_rep_name, done: true },
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
                  label: 'Fulfillment Ready',
                  detail: quotation.status === 'approved' ? 'Ready for conversion' : 'Pending',
                  done: quotation.status === 'approved' || quotation.status === 'confirmed',
                },
              ].map((step, i) => (
                <div
                  key={i}
                  className={`flex items-start space-x-3 p-3 rounded-lg border transition-all ${
                    step.active
                      ? 'bg-blue-50/50 border-primary/30 ring-1 ring-primary/20'
                      : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    step.done ? 'bg-success text-white' :
                    step.active ? 'bg-primary text-white animate-pulse' :
                    step.skipped ? 'bg-slate-200 text-slate-400' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    {step.done ? '✓' : step.skipped ? '—' : i + 1}
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${step.active ? 'text-primary' : 'text-slate-800'}`}>
                      {step.label}
                    </div>
                    <div className="text-[10px] text-slate-500">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Decision Memorandum Panel */}
          {isPending && (
            <div className="rounded-xl border border-primary/30 bg-white p-6 shadow-premium space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="font-outfit text-sm font-bold text-slate-900">Decision Memorandum</h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Mandatory Audit Rationale
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder="Enter policy justification, counter-offer details, or rejection reasons..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="w-full flex items-center justify-center space-x-2 rounded-lg bg-success hover:bg-success-hover py-2.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{approveMutation.isPending ? 'Processing...' : 'Approve Quotation'}</span>
                </button>
                <button
                  onClick={() => returnMutation.mutate()}
                  disabled={returnMutation.isPending}
                  className="w-full flex items-center justify-center space-x-2 rounded-lg border border-warning text-warning hover:bg-warning-light py-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{returnMutation.isPending ? 'Processing...' : 'Return for Revision'}</span>
                </button>
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                  className="w-full flex items-center justify-center space-x-2 rounded-lg border border-danger text-danger hover:bg-danger-light py-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  <span>{rejectMutation.isPending ? 'Processing...' : 'Reject Quotation'}</span>
                </button>
              </div>

              {(approveMutation.isError || rejectMutation.isError || returnMutation.isError) && (
                <div className="p-3 text-[10px] font-bold text-danger bg-danger-light border border-danger/20 rounded-lg">
                  {(approveMutation.error || rejectMutation.error || returnMutation.error)?.message}
                </div>
              )}
            </div>
          )}

          {/* Deal Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium space-y-3">
            <h3 className="font-outfit text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Contract Metadata
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold text-slate-800">{quotation.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tier:</span>
                <span className="font-semibold text-slate-800">{quotation.customer_tier_display}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Line Items:</span>
                <span className="font-mono font-bold text-slate-800">{quotation.lines.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Terms:</span>
                <span className="font-semibold text-slate-800">{quotation.payment_terms}</span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between font-bold">
                <span className="text-slate-700">Grand Total:</span>
                <span className="font-outfit text-sm text-primary font-extrabold">{formatCurrency(quotation.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
