/**
 * Approval List Page — shows all quotations pending approval.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchQuotations } from '../../api/quotations';
import { formatCurrency, formatDate, getRiskBadgeClass, getRiskLabel } from '../../lib/utils';
import { ShieldCheck, Clock, AlertTriangle } from 'lucide-react';

export function ApprovalListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['quotations', 'pending_approval'],
    queryFn: () => fetchQuotations({ status: 'pending_approval' }),
  });

  const { data: allData } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => fetchQuotations(),
  });

  const pending = data?.results || [];
  const allQuotations = allData?.results || [];
  const recentlyActioned = allQuotations.filter(q =>
    q.status === 'approved' || q.status === 'rejected'
  ).slice(0, 5);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-1">GOVERNANCE › DISCOUNT APPROVAL QUEUE</p>
          <h1 className="text-headline-xl">Discount Approval Queue</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Review quotations flagged by the blended risk score engine</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold font-mono text-[var(--color-primary)]">{pending.length}</div>
            <div className="text-xs text-[var(--color-text-muted)]">Awaiting Review</div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-[var(--color-border)] rounded-md p-4 elevation-1">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-[var(--color-amber)]" />
            <span className="text-label-uppercase">Manager Only</span>
          </div>
          <div className="font-mono text-xl font-bold">
            {pending.filter(q => q.required_approval_level === 'manager').length}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">Low-risk overages requiring manager sign-off</div>
        </div>
        <div className="bg-white border border-[var(--color-border)] rounded-md p-4 elevation-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-[var(--color-rose)]" />
            <span className="text-label-uppercase">Manager + Finance</span>
          </div>
          <div className="font-mono text-xl font-bold">
            {pending.filter(q => q.required_approval_level === 'manager_finance').length}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">High-risk: dual approval pathway required</div>
        </div>
        <div className="bg-white border border-[var(--color-border)] rounded-md p-4 elevation-1">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-[var(--color-emerald)]" />
            <span className="text-label-uppercase">Total Pipeline Value</span>
          </div>
          <div className="font-mono text-xl font-bold">
            {formatCurrency(pending.reduce((s, q) => s + parseFloat(q.total || '0'), 0))}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">Pending approval total</div>
        </div>
      </div>

      {/* Pending Approval Table */}
      <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-title-sm">Pending Approval</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--color-canvas)]">
              <th className="text-label-uppercase text-left px-4 py-2.5 border-b border-[var(--color-border)]">Quote</th>
              <th className="text-label-uppercase text-left px-4 py-2.5 border-b border-[var(--color-border)]">Customer</th>
              <th className="text-label-uppercase text-left px-4 py-2.5 border-b border-[var(--color-border)]">Sales Rep</th>
              <th className="text-label-uppercase text-right px-4 py-2.5 border-b border-[var(--color-border)]">Value</th>
              <th className="text-label-uppercase text-center px-4 py-2.5 border-b border-[var(--color-border)]">Risk Score</th>
              <th className="text-label-uppercase text-center px-4 py-2.5 border-b border-[var(--color-border)]">Approval Level</th>
              <th className="text-label-uppercase text-left px-4 py-2.5 border-b border-[var(--color-border)]">Submitted</th>
              <th className="text-label-uppercase text-center px-4 py-2.5 border-b border-[var(--color-border)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">Loading...</td></tr>
            ) : pending.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-[var(--color-emerald)]" />
                All clear — no quotations pending approval
              </td></tr>
            ) : pending.map(q => (
              <tr key={q.id} className="hover:bg-[var(--color-canvas)] transition-colors border-b border-[var(--color-surface-alt)]">
                <td className="px-4 py-2.5">
                  <Link to={`/approvals/${q.id}`} className="text-[var(--color-primary)] font-semibold text-sm hover:underline">Q-{q.id}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <div className="text-sm font-medium">{q.customer_name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{q.customer_tier?.toUpperCase()} tier</div>
                </td>
                <td className="px-4 py-2.5 text-sm text-[var(--color-text-secondary)]">{q.sales_rep_name}</td>
                <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold">{formatCurrency(q.total || '0')}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`badge ${getRiskBadgeClass(q.blended_risk_score)}`}>
                    <span className="badge-dot" />
                    {getRiskLabel(q.blended_risk_score)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    q.required_approval_level === 'manager_finance'
                      ? 'bg-[var(--color-rose-bg)] text-[var(--color-rose-text)]'
                      : 'bg-[var(--color-amber-bg)] text-[var(--color-amber-text)]'
                  }`}>
                    {q.required_approval_level === 'manager_finance' ? 'Mgr + Finance' : 'Manager Only'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-sm text-[var(--color-text-muted)]">{formatDate(q.updated_at)}</td>
                <td className="px-4 py-2.5 text-center">
                  <Link
                    to={`/approvals/${q.id}`}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded transition"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recently Actioned */}
      {recentlyActioned.length > 0 && (
        <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-title-sm">Recently Actioned</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-canvas)]">
                <th className="text-label-uppercase text-left px-4 py-2 border-b border-[var(--color-border)]">Quote</th>
                <th className="text-label-uppercase text-left px-4 py-2 border-b border-[var(--color-border)]">Customer</th>
                <th className="text-label-uppercase text-left px-4 py-2 border-b border-[var(--color-border)]">Decision</th>
                <th className="text-label-uppercase text-right px-4 py-2 border-b border-[var(--color-border)]">Value</th>
              </tr>
            </thead>
            <tbody>
              {recentlyActioned.map(q => (
                <tr key={q.id} className="border-b border-[var(--color-surface-alt)]">
                  <td className="px-4 py-2 text-sm"><Link to={`/quotations/${q.id}`} className="text-[var(--color-primary)] hover:underline">Q-{q.id}</Link></td>
                  <td className="px-4 py-2 text-sm">{q.customer_name}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${q.status === 'approved' ? 'badge-approved' : 'badge-high-risk'}`}>
                      <span className="badge-dot" /> {q.status_display}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-sm">{formatCurrency(q.total || '0')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
