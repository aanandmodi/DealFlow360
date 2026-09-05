/**
 * Sales Dashboard — B9 variant: Sales Operations Hub.
 * Matches the reference Sales Dashboard screenshot.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, DashboardSummary, StalledDeal, DiscountAnomaly } from '../../api/dashboard';
import { quotationsApi, QuotationListItem } from '../../api/quotations';
import { formatCurrency, getStatusBadgeClass, getStatusLabel, timeAgo } from '../../lib/utils';
import {
  CheckSquare, FileText, AlertTriangle, Percent, Download, Eye,
  ShieldCheck, Plus, ArrowRight, TrendingUp, Clock, RefreshCw, Home, AlertCircle
} from 'lucide-react';

export function SalesDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [stalled, setStalled] = useState<StalledDeal[]>([]);
  const [anomalies, setAnomalies] = useState<DiscountAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, q, st, an] = await Promise.all([
        dashboardApi.summary(),
        quotationsApi.list(),
        dashboardApi.stalledDeals(),
        dashboardApi.anomalies(),
      ]);
      setSummary(s);
      setQuotations(q);
      setStalled(st);
      setAnomalies(an);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const highPriorityQuotes = quotations
    .filter(q => ['pending_approval', 'under_negotiation', 'approved', 'confirmed'].includes(q.status))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#2563EB' }} />
      </div>
    );
  }

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px]" style={{ color: 'var(--color-text-caption)' }}>Deal Desk Command</span>
            <span className="text-[10px] font-semibold" style={{ color: '#10B981' }}>• Realtime Sync Active</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            Sales Operations Hub
          </h1>
          <div className="mt-1">
            <span className="badge badge-info" style={{ fontSize: 10 }}>Q1-FY25 Execution</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-sm gap-1.5"><Download className="w-3 h-3" /> Export Forecast</button>
          <button className="btn btn-secondary btn-sm gap-1.5">
            <Eye className="w-3 h-3" /> View Approvals
            <span className="w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                  style={{ background: '#E11D48' }}>{summary?.pending_approvals || 0}</span>
          </button>
          <button className="btn btn-primary gap-1.5" onClick={() => navigate('/quotations/new')}>
            <Plus className="w-4 h-4" /> New Quotation
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="metric-tile">
          <div className="flex items-center justify-between mb-2">
            <span className="metric-label">Pending Approvals</span>
            <CheckSquare className="w-4 h-4" style={{ color: '#2563EB' }} />
          </div>
          <div className="metric-value">{summary?.pending_approvals || 0}</div>
          <div className="metric-sub">Quotes</div>
        </div>
        <div className="metric-tile">
          <div className="flex items-center justify-between mb-2">
            <span className="metric-label">Open Quotations</span>
            <FileText className="w-4 h-4" style={{ color: '#2563EB' }} />
          </div>
          <div className="metric-value">{summary?.active_pipeline_count || 0}</div>
          <div className="metric-sub">Active Deals</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-caption)' }}>
            {formatCurrency(summary?.active_pipeline_value || 0)} Pipeline value
          </div>
        </div>
        <div className="metric-tile">
          <div className="flex items-center justify-between mb-2">
            <span className="metric-label">At-Risk / Anomalies</span>
            <AlertTriangle className="w-4 h-4" style={{ color: '#F59E0B' }} />
          </div>
          <div className="metric-value">{summary?.at_risk_count || 0}</div>
          <div className="metric-sub">Flagged Deals</div>
          {(summary?.at_risk_count || 0) > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <span className="badge badge-danger" style={{ fontSize: 9, height: 16 }}>Urgent Action</span>
            </div>
          )}
        </div>
        <div className="metric-tile">
          <div className="flex items-center justify-between mb-2">
            <span className="metric-label">Gross Margin Realized</span>
            <Percent className="w-4 h-4" style={{ color: '#2563EB' }} />
          </div>
          <div className="metric-value">{summary?.avg_margin_pct?.toFixed(1) || 0}%</div>
          <div className="metric-sub">Avg blended</div>
          <div className="flex items-center gap-1 mt-1 text-[11px]" style={{ color: '#10B981' }}>
            <TrendingUp className="w-3 h-3" /> +2.8% healthy
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: High Priority Quotations */}
        <div className="col-span-2">
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3"
                 style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" style={{ color: '#2563EB' }} />
                <span className="font-semibold text-sm">High Priority Quotations</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--color-text-caption)' }}>
                Live operational pipeline queue requiring dealer governance
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="text-left px-4 py-2">Quote ID / Client</th>
                  <th className="text-left px-4 py-2">Stage</th>
                  <th className="text-left px-4 py-2">Owner</th>
                  <th className="text-right px-4 py-2">ARR / Value</th>
                  <th className="text-right px-4 py-2">Margin %</th>
                  <th className="text-center px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {highPriorityQuotes.map((q) => (
                  <tr key={q.id} className="table-row cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-xs" style={{ color: '#2563EB' }}>{q.quote_number}</div>
                      <div className="text-[11px]" style={{ color: 'var(--color-text-caption)' }}>{q.customer_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getStatusBadgeClass(q.status)}`} style={{ fontSize: 10 }}>
                        {getStatusLabel(q.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                             style={{ background: '#475569' }}>
                          {q.rep_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-xs">{q.rep_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium">{formatCurrency(q.total_amount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs"
                        style={{ color: q.margin_pct > 30 ? '#10B981' : '#F59E0B' }}>
                      {q.margin_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className="btn btn-primary btn-sm" style={{ height: 24, fontSize: 10, padding: '0 8px' }}>
                        {q.status === 'pending_approval' ? 'Review' : q.status === 'approved' ? 'Send' : 'Inspect'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent Activity Feed */}
          <div className="card mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: '#2563EB' }} />
                <span className="font-semibold text-sm">Recent Activity & Deal Stream</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--color-text-caption)' }}>Feed updated 1m ago</span>
            </div>
            <div className="flex flex-col gap-3">
              {quotations.slice(0, 4).map((q, i) => (
                <div key={q.id} className="flex items-start gap-3 p-2.5 rounded transition-colors hover:bg-slate-50 cursor-pointer"
                     onClick={() => navigate(`/quotations/${q.id}`)}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                       style={{
                         background: i % 3 === 0 ? 'var(--color-success-bg)' : i % 3 === 1 ? 'var(--color-warning-bg)' : 'var(--color-info-bg)',
                         color: i % 3 === 0 ? 'var(--color-success-text)' : i % 3 === 1 ? 'var(--color-warning-text)' : 'var(--color-info-text)',
                       }}>
                    {i % 3 === 0 ? <CheckSquare className="w-3.5 h-3.5" /> : i % 3 === 1 ? <AlertTriangle className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold">{q.customer_name} — {q.quote_number}</div>
                    <div className="text-[11px]" style={{ color: 'var(--color-text-caption)' }}>
                      {getStatusLabel(q.status)} • {formatCurrency(q.total_amount)}
                    </div>
                  </div>
                  <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--color-text-disabled)' }}>
                    {timeAgo(q.updated_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Auto-Approval Radar */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-sm">Auto-Approval Radar</span>
              <span className="badge badge-success" style={{ fontSize: 9, height: 16 }}>RULES ENGINE ACTIVE</span>
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Autonomous Clearance Rate</span>
                <span className="font-mono text-sm font-bold" style={{ color: '#2563EB' }}>64%</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: 'var(--color-surface-border)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: '64%', background: '#2563EB' }} />
              </div>
            </div>
            <div className="text-[11px] mb-4" style={{ color: 'var(--color-text-caption)' }}>
              32 of 50 deals in the past 7 days cleared zero-touch within predefined delegation bounds.
            </div>

            <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.05em' }}>
              Discount Tier Utilization
            </div>
            {[
              { label: 'Bronze (≤ 5%)', count: 21, pct: 42, color: '#CD7F32' },
              { label: 'Silver (5% – 10%)', count: 19, pct: 38, color: '#94A3B8' },
              { label: 'Gold (> 10% Escalation)', count: 10, pct: 20, color: '#FFD700' },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2 py-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: t.color }} />
                <span className="text-[11px] flex-1">{t.label}</span>
                <span className="text-[11px]">{t.count} deals</span>
                <span className="font-mono text-[11px] font-semibold w-8 text-right">{t.pct}%</span>
              </div>
            ))}
          </div>

          {/* Quick Access */}
          <div className="card">
            <span className="font-semibold text-sm mb-3 block">Ops Quick Access</span>
            {[
              { label: 'Discount Matrix Config', sub: 'Hardware & Services caps', icon: ShieldCheck },
              { label: 'Fulfillment Inventory Split', sub: 'Main vs East Depot dispatch', icon: Home },
              { label: 'Customer Portal Logs', sub: 'Live negotiation counter-proposals', icon: Eye },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded cursor-pointer transition-colors hover:bg-slate-50"
                   style={{ borderBottom: i < 2 ? '1px solid var(--color-surface-inset)' : 'none' }}>
                <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'var(--color-surface-inset)' }}>
                  <item.icon className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold">{item.label}</div>
                  <div className="text-[10px]" style={{ color: 'var(--color-text-caption)' }}>{item.sub}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--color-text-disabled)' }} />
              </div>
            ))}
          </div>

          {/* Stalled Deal Radar */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">Stalled Deal Radar</span>
              {stalled.length > 0 && (
                <span className="text-xs font-semibold" style={{ color: '#E11D48' }}>{stalled.length} Alerts</span>
              )}
            </div>
            <div className="text-[10px] mb-3" style={{ color: 'var(--color-text-caption)' }}>
              Deals idle beyond 14 days or exhibiting margin slippage during counter-offers.
            </div>
            {stalled.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2"
                   style={{ borderTop: i > 0 ? '1px solid var(--color-surface-inset)' : 'none' }}>
                <div>
                  <div className="text-xs font-semibold">{s.customer_name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--color-text-caption)' }}>
                    Idle {s.days_idle} days • {formatCurrency(s.total_amount)}
                  </div>
                </div>
                <button className="btn btn-sm" style={{
                  height: 22, fontSize: 10, padding: '0 8px',
                  color: s.severity === 'high' ? '#E11D48' : '#2563EB',
                  border: `1px solid ${s.severity === 'high' ? 'var(--color-danger-border)' : 'var(--color-surface-border)'}`,
                  background: s.severity === 'high' ? 'var(--color-danger-bg)' : 'white',
                }}>
                  {s.severity === 'high' ? 'Escalate' : 'Nudge Rep'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
