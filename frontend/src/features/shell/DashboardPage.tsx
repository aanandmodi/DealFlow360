/**
 * Dashboard Page — Sales Operations Hub (B1 landing).
 * Matches the reference Sales Dashboard screenshot.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchQuotations } from '../../api/quotations';
import { formatCurrency, getStatusBadgeClass } from '../../lib/utils';
import { Plus, Download, ShieldCheck, AlertTriangle, TrendingUp } from 'lucide-react';

export function DashboardPage() {
  const { data: quotationsData } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => fetchQuotations(),
  });

  const quotations = quotationsData?.results || [];
  const pending = quotations.filter(q => q.status === 'pending_approval');
  const active = quotations.filter(q => ['draft', 'pending_approval', 'under_negotiation'].includes(q.status));
  const atRisk = quotations.filter(q => parseFloat(q.blended_risk_score) > 2);

  const pipelineValue = active.reduce((sum, q) => sum + parseFloat(q.total || '0'), 0);
  const avgMargin = active.length > 0
    ? active.reduce((sum, q) => sum + parseFloat(q.blended_margin_percent || '0'), 0) / active.length
    : 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Deal Desk Command • <span className="text-[var(--color-emerald)]">Realtime Sync Active</span></p>
          <h1 className="text-headline-xl">Sales Operations Hub</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 h-9 bg-white border border-[var(--color-border-muted)] rounded text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] transition">
            <Download className="w-4 h-4" /> Export Forecast
          </button>
          <Link
            to="/approvals"
            className="flex items-center gap-1.5 px-3 h-9 bg-white border border-[var(--color-border-muted)] rounded text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] transition"
          >
            <ShieldCheck className="w-4 h-4" /> View Approvals
            {pending.length > 0 && (
              <span className="ml-1 w-5 h-5 bg-[var(--color-amber)] rounded-full text-white text-[10px] font-bold flex items-center justify-center">{pending.length}</span>
            )}
          </Link>
          <Link
            to="/quotations/new"
            className="flex items-center gap-1.5 px-4 h-9 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded border border-[var(--color-primary-hover)] transition"
          >
            <Plus className="w-4 h-4" /> New Quotation
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'PENDING APPROVALS', value: pending.length, sub: `${formatCurrency(pending.reduce((s, q) => s + parseFloat(q.total || '0'), 0))} pending review`, icon: ShieldCheck, color: 'text-[var(--color-primary)]' },
          { label: 'OPEN QUOTATIONS', value: active.length, sub: `${formatCurrency(pipelineValue)} Pipeline value`, icon: TrendingUp, color: 'text-[var(--color-primary)]' },
          { label: 'AT-RISK / ANOMALIES', value: atRisk.length, sub: 'Flagged Deals', icon: AlertTriangle, color: 'text-[var(--color-rose)]' },
          { label: 'GROSS MARGIN REALIZED', value: `${avgMargin.toFixed(1)}%`, sub: `Avg blended`, icon: TrendingUp, color: 'text-[var(--color-emerald)]' },
        ].map((metric, i) => (
          <div key={i} className="bg-white border border-[var(--color-border)] rounded-md p-4 elevation-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-label-uppercase">{metric.label}</span>
              <metric.icon className={`w-5 h-5 ${metric.color}`} />
            </div>
            <div className="font-mono text-2xl font-bold text-[var(--color-text-primary)] mb-1">{metric.value}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{metric.sub}</div>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* High Priority Quotations Table */}
        <div className="col-span-2 bg-white border border-[var(--color-border)] rounded-md elevation-1">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <div>
              <h2 className="text-title-sm flex items-center gap-2">
                High Priority Quotations
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">Live operational pipeline queue</p>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-canvas)]">
                <th className="text-label-uppercase text-left px-4 py-2 border-b border-[var(--color-border)]">Quote ID / Client</th>
                <th className="text-label-uppercase text-left px-4 py-2 border-b border-[var(--color-border)]">Stage</th>
                <th className="text-label-uppercase text-right px-4 py-2 border-b border-[var(--color-border)]">Value</th>
                <th className="text-label-uppercase text-right px-4 py-2 border-b border-[var(--color-border)]">Margin %</th>
                <th className="text-label-uppercase text-center px-4 py-2 border-b border-[var(--color-border)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {quotations.slice(0, 6).map(q => (
                <tr key={q.id} className="hover:bg-[var(--color-canvas)] transition-colors">
                  <td className="px-4 py-2.5 border-b border-[var(--color-surface-alt)]">
                    <Link to={`/quotations/${q.id}`} className="text-[var(--color-primary)] font-medium text-sm hover:underline">Q-{q.id}</Link>
                    <div className="text-xs text-[var(--color-text-muted)]">{q.customer_name}</div>
                  </td>
                  <td className="px-4 py-2.5 border-b border-[var(--color-surface-alt)]">
                    <span className={`badge ${getStatusBadgeClass(q.status)}`}>
                      <span className="badge-dot" />
                      {q.status_display}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 border-b border-[var(--color-surface-alt)] text-right font-mono text-sm font-medium">
                    {formatCurrency(q.total || '0')}
                  </td>
                  <td className="px-4 py-2.5 border-b border-[var(--color-surface-alt)] text-right font-mono text-sm">
                    <span className={parseFloat(q.blended_margin_percent || '0') > 30 ? 'text-[var(--color-emerald)]' : 'text-[var(--color-amber)]'}>
                      {parseFloat(q.blended_margin_percent || '0').toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 border-b border-[var(--color-surface-alt)] text-center">
                    <Link
                      to={q.status === 'pending_approval' ? `/approvals/${q.id}` : `/quotations/${q.id}`}
                      className="text-[var(--color-primary)] text-sm font-medium hover:underline"
                    >
                      {q.status === 'pending_approval' ? 'Review' : q.status === 'approved' ? 'Send' : 'Edit'}
                    </Link>
                  </td>
                </tr>
              ))}
              {quotations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                    No quotations yet. <Link to="/quotations/new" className="text-[var(--color-primary)] hover:underline">Create your first quotation</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Ops Quick Access */}
          <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 p-4">
            <h3 className="text-title-sm mb-3">Ops Quick Access</h3>
            {[
              { label: 'Discount Matrix Config', sub: 'Hardware & Services caps', to: '/config' },
              { label: 'Fulfillment Inventory Split', sub: 'Main vs East Depot dispatch', to: '/fulfillment' },
              { label: 'Approval Queue', sub: `${pending.length} pending review`, to: '/approvals' },
            ].map((item, i) => (
              <Link
                key={i}
                to={item.to}
                className="flex items-center justify-between py-2.5 border-b border-[var(--color-surface-alt)] last:border-0 hover:bg-[var(--color-canvas)] -mx-2 px-2 rounded transition"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{item.label}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{item.sub}</div>
                </div>
                <span className="text-[var(--color-text-disabled)]">→</span>
              </Link>
            ))}
          </div>

          {/* Stalled Deal Radar */}
          <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-title-sm">Stalled Deal Radar</h3>
              <span className="text-xs font-medium text-[var(--color-rose)]">{atRisk.length} Alerts</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">Deals idle beyond 14 days or exhibiting margin slippage</p>
            {atRisk.length === 0 && (
              <p className="text-xs text-[var(--color-text-disabled)] italic">No stalled deals detected</p>
            )}
            {atRisk.slice(0, 3).map(q => (
              <div key={q.id} className="flex items-center justify-between py-2 border-b border-[var(--color-surface-alt)] last:border-0">
                <div>
                  <div className="text-sm font-medium">{q.customer_name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Risk Score: {parseFloat(q.blended_risk_score).toFixed(1)}</div>
                </div>
                <Link to={`/approvals/${q.id}`} className="text-xs font-medium text-[var(--color-primary)] hover:underline">Review</Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
