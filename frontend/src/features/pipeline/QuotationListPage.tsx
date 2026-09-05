/**
 * Quotation List Page — B2 Pipeline / List view.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchQuotations } from '../../api/quotations';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../lib/utils';
import { Plus, Filter, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export function QuotationListPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['quotations', statusFilter],
    queryFn: () => fetchQuotations(statusFilter ? { status: statusFilter } : undefined),
  });

  const quotations = data?.results || [];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-1">WORKSPACE › QUOTATIONS PIPELINE</p>
          <h1 className="text-headline-xl">Quotations & Deals Pipeline</h1>
        </div>
        <Link
          to="/quotations/new"
          className="flex items-center gap-1.5 px-4 h-9 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded border border-[var(--color-primary-hover)] transition"
        >
          <Plus className="w-4 h-4" /> New Quotation
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Filter className="w-4 h-4" /> Filter:
        </div>
        {['', 'draft', 'pending_approval', 'approved', 'confirmed', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm rounded border transition ${
              statusFilter === status
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]'
            }`}
          >
            {status === '' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--color-canvas)]">
              <th className="text-label-uppercase text-left px-4 py-2.5 border-b border-[var(--color-border)]">Quote ID</th>
              <th className="text-label-uppercase text-left px-4 py-2.5 border-b border-[var(--color-border)]">Customer</th>
              <th className="text-label-uppercase text-left px-4 py-2.5 border-b border-[var(--color-border)]">Status</th>
              <th className="text-label-uppercase text-left px-4 py-2.5 border-b border-[var(--color-border)]">Rep</th>
              <th className="text-label-uppercase text-right px-4 py-2.5 border-b border-[var(--color-border)]">Value</th>
              <th className="text-label-uppercase text-right px-4 py-2.5 border-b border-[var(--color-border)]">Risk Score</th>
              <th className="text-label-uppercase text-left px-4 py-2.5 border-b border-[var(--color-border)]">Created</th>
              <th className="text-label-uppercase text-center px-4 py-2.5 border-b border-[var(--color-border)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">Loading...</td></tr>
            ) : quotations.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">No quotations found</td></tr>
            ) : quotations.map(q => (
              <tr key={q.id} className="hover:bg-[var(--color-canvas)] transition-colors border-b border-[var(--color-surface-alt)]">
                <td className="px-4 py-2.5">
                  <Link to={`/quotations/${q.id}`} className="text-[var(--color-primary)] font-medium text-sm hover:underline">Q-{q.id}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-sm font-medium">{q.customer_name}</span>
                  <span className={`ml-2 badge ${q.customer_tier === 'gold' ? 'badge-active' : q.customer_tier === 'silver' ? 'badge-pending' : 'badge-approved'}`}>
                    {q.customer_tier?.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`badge ${getStatusBadgeClass(q.status)}`}>
                    <span className="badge-dot" />
                    {q.status_display}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-sm text-[var(--color-text-secondary)]">{q.sales_rep_name}</td>
                <td className="px-4 py-2.5 text-right font-mono text-sm font-medium">{formatCurrency(q.total || '0')}</td>
                <td className="px-4 py-2.5 text-right font-mono text-sm">
                  {parseFloat(q.blended_risk_score) > 0
                    ? <span className="text-[var(--color-rose)]">{parseFloat(q.blended_risk_score).toFixed(1)}</span>
                    : <span className="text-[var(--color-text-disabled)]">—</span>
                  }
                </td>
                <td className="px-4 py-2.5 text-sm text-[var(--color-text-muted)]">{formatDate(q.created_at)}</td>
                <td className="px-4 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Link
                      to={q.status === 'pending_approval' ? `/approvals/${q.id}` : `/quotations/${q.id}`}
                      className="px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded hover:bg-[var(--color-primary-light)] transition"
                    >
                      {q.status === 'pending_approval' ? 'Review' : 'Open'}
                    </Link>
                    <a
                      href={`/portal/quotations/${(q as any).portal_token || q.quote_number || q.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in Customer Portal"
                      className="p-1 text-slate-500 hover:text-blue-600 border border-slate-200 rounded hover:bg-slate-50 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
