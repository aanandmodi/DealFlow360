/**
 * Quotation Pipeline — B2: Kanban board with KPI cards.
 * Matches the reference Quotations & Deals Pipeline screenshot.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { quotationsApi, QuotationListItem, PipelineSummary } from '../../api/quotations';
import { formatCurrency, getStatusBadgeClass, getStatusLabel, timeAgo, cn } from '../../lib/utils';
import {
  Plus, Search, LayoutGrid, Table, Filter, Clock, AlertTriangle,
  TrendingUp, Target, RefreshCw, Download, Sparkles
} from 'lucide-react';

const kanbanColumns = [
  { key: 'draft', label: 'Draft & Config', color: '#6366F1' },
  { key: 'pending_approval', label: 'Pending Approval', color: '#F59E0B' },
  { key: 'approved', label: 'Approved', color: '#10B981' },
  { key: 'under_negotiation', label: 'Portal Active', color: '#2563EB' },
  { key: 'sent', label: 'Sent', color: '#8B5CF6' },
  { key: 'confirmed', label: 'Confirmed', color: '#059669' },
];

export function PipelinePage() {
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [q, s] = await Promise.all([
        quotationsApi.list(),
        quotationsApi.pipelineSummary(),
      ]);
      setQuotations(q);
      setSummary(s);
    } catch (err) {
      console.error('Failed to load pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredQuotations = quotations.filter(q =>
    !searchQuery ||
    q.quote_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getColumnQuotations = (statusKey: string) =>
    filteredQuotations.filter(q => q.status === statusKey);

  const getColumnTotal = (statusKey: string) =>
    getColumnQuotations(statusKey).reduce((sum, q) => sum + q.total_amount, 0);

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: 'var(--color-text-caption)' }}>
              WORKSPACE &rsaquo; <span style={{ color: '#2563EB' }}>QUOTATIONS PIPELINE</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            Quotations & Deals Pipeline
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded text-xs"
               style={{ background: 'var(--color-shell)', color: 'var(--color-text-disabled)' }}>
            Live Sync • {summary?.active_pipeline_count || 0} Active Ops
          </div>
          <button className="btn btn-primary gap-1.5" onClick={() => navigate('/quotations/new')}>
            <Plus className="w-4 h-4" /> New Quotation
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--color-text-disabled)' }} />
          <input
            type="text"
            placeholder="Filter by quote, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
            style={{ height: 32, fontSize: 12 }}
          />
        </div>
        <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--color-surface-border)' }}>
          <button
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors')}
            style={{
              background: viewMode === 'kanban' ? '#2563EB' : 'white',
              color: viewMode === 'kanban' ? 'white' : 'var(--color-text-secondary)',
            }}
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: viewMode === 'table' ? '#2563EB' : 'white',
              color: viewMode === 'table' ? 'white' : 'var(--color-text-secondary)',
              borderLeft: '1px solid var(--color-surface-border)',
            }}
            onClick={() => setViewMode('table')}
          >
            <Table className="w-3.5 h-3.5" /> Table
          </button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Total Active Pipeline"
            value={formatCurrency(summary.active_pipeline_value)}
            sub={`${summary.active_pipeline_count} deals`}
            trend="+14.8% vs previous cohort"
            trendUp
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <KpiCard
            label="Avg Deal Velocity"
            value="4.2"
            sub="Days"
            trend="-1.1 days — Approval bottleneck cleared"
            trendUp
            icon={<Clock className="w-4 h-4" />}
          />
          <KpiCard
            label="SLA Compliance Rate"
            value="94.2%"
            sub={`Target >90%`}
            trend={summary.at_risk_count > 0 ? `${summary.at_risk_count} at risk` : 'On track'}
            trendUp={summary.at_risk_count === 0}
            icon={<Target className="w-4 h-4" />}
          />
          <KpiCard
            label="Closed Won (Q1)"
            value={formatCurrency(summary.closed_won_value ?? 0)}
            sub={`${summary.closed_won_count ?? 0} Closed`}
            trend="On Track"
            trendUp
            icon={<Sparkles className="w-4 h-4" />}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#2563EB' }} />
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 500 }}>
          {kanbanColumns.map((col) => {
            const items = getColumnQuotations(col.key);
            const total = getColumnTotal(col.key);
            return (
              <div key={col.key} className="flex-shrink-0" style={{ width: 280 }}>
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {col.label}
                    </span>
                    <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white"
                          style={{ background: col.color }}>
                      {items.length}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatCurrency(total)}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="flex flex-col gap-2.5">
                  {items.map((q) => (
                    <QuotationCard key={q.id} quotation={q} onClick={() => navigate(`/quotations/${q.id}`)} />
                  ))}
                  {col.key === 'draft' && (
                    <button
                      className="flex items-center justify-center gap-1.5 py-3 rounded-md text-xs font-medium transition-colors"
                      style={{
                        border: '1px dashed var(--color-surface-muted)',
                        color: 'var(--color-text-caption)',
                      }}
                      onClick={() => navigate('/quotations/new')}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Deal Card
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left px-4 py-2">Quote / Client</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Owner</th>
                <th className="text-right px-4 py-2">Amount</th>
                <th className="text-right px-4 py-2">Margin</th>
                <th className="text-right px-4 py-2">Risk</th>
                <th className="text-left px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.map((q) => (
                <tr key={q.id} className="table-row cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                  <td className="px-4 py-2">
                    <div className="font-semibold text-sm" style={{ color: '#2563EB' }}>{q.quote_number}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-caption)' }}>{q.customer_name}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`badge ${getStatusBadgeClass(q.status)}`}>{getStatusLabel(q.status)}</span>
                  </td>
                  <td className="px-4 py-2 text-xs">{q.rep_name}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm font-medium">{formatCurrency(q.total_amount)}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm"
                      style={{ color: q.margin_pct > 25 ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                    {q.margin_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-sm">{q.blended_risk_score.toFixed(1)}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-caption)' }}>
                    {timeAgo(q.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between mt-6 pt-4"
           style={{ borderTop: '1px solid var(--color-surface-border)' }}>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
            Revenue Target Attainment: 80.3%
          </span>
          {summary && summary.at_risk_count > 0 && (
            <span className="flex items-center gap-1.5" style={{ color: '#E11D48' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#E11D48' }} />
              Governance Alerts: {summary.at_risk_count} Critical
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-sm gap-1.5">
            <Download className="w-3 h-3" /> Export Pipeline CSV
          </button>
          <button className="btn btn-primary btn-sm gap-1.5">
            <Sparkles className="w-3 h-3" /> Run Pipeline Forecast (AI)
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function KpiCard({ label, value, sub, trend, trendUp, icon }: {
  label: string; value: string; sub: string; trend: string; trendUp: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric-tile">
      <div className="flex items-center justify-between mb-2">
        <span className="metric-label">{label}</span>
        <span style={{ color: 'var(--color-text-caption)' }}>{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--color-text-caption)' }}>{sub}</div>
      <div className="flex items-center gap-1 mt-2 text-[11px] font-medium"
           style={{ color: trendUp ? 'var(--color-success-dot)' : 'var(--color-danger-dot)' }}>
        <span>{trendUp ? '↑' : '↓'}</span> {trend}
      </div>
    </div>
  );
}

function QuotationCard({ quotation: q, onClick }: { quotation: QuotationListItem; onClick: () => void }) {
  const tierColors: Record<string, string> = { gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32' };

  return (
    <div className="card cursor-pointer transition-all hover:border-blue-300 animate-fade-in"
         onClick={onClick}
         style={{ padding: 12 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: '#2563EB' }}>{q.quote_number}</span>
        <div className="flex items-center gap-1.5">
          {q.blended_risk_score > 5 && (
            <span className="badge badge-danger" style={{ fontSize: 10, height: 18, padding: '0 6px' }}>
              <AlertTriangle className="w-2.5 h-2.5" /> Over {q.blended_risk_score.toFixed(0)}% Policy
            </span>
          )}
          <span className={`badge ${getStatusBadgeClass(q.status)}`} style={{ fontSize: 10, height: 18, padding: '0 6px' }}>
            {getStatusLabel(q.status)}
          </span>
        </div>
      </div>

      {/* Customer */}
      <div className="font-semibold text-sm mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
        {q.customer_name}
      </div>
      <div className="text-[11px] mb-3" style={{ color: 'var(--color-text-caption)' }}>
        {q.customer_company || 'Enterprise'}
      </div>

      {/* Amount + Margin */}
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-mono text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {formatCurrency(q.total_amount)}
        </span>
        <span className="font-mono text-xs font-medium"
              style={{ color: q.margin_pct > 25 ? 'var(--color-success-dot)' : 'var(--color-warning-dot)' }}>
          Margin: {q.margin_pct.toFixed(1)}%
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2"
           style={{ borderTop: '1px solid var(--color-surface-inset)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
               style={{ background: '#475569' }}>
            {q.rep_name.split(' ').map(n => n[0]).join('')}
          </div>
          <span className="text-[11px]" style={{ color: 'var(--color-text-caption)' }}>
            {q.rep_name}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-disabled)' }}>
          <Clock className="w-3 h-3" /> {timeAgo(q.updated_at)}
        </div>
      </div>
    </div>
  );
}
