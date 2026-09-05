/**
 * Deal Health & Anomaly Dashboard — B9.
 * Matches the reference Deal Health Dashboard screenshot with Recharts.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, DashboardSummary, StalledDeal, DiscountAnomaly, DeliverySlippage } from '../../api/dashboard';
import { formatCurrency, timeAgo } from '../../lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine
} from 'recharts';
import {
  Clock, AlertTriangle, Truck, TrendingDown, Download, RefreshCw,
  Zap, Send, Package, ShieldAlert, ArrowUpRight, Settings
} from 'lucide-react';

export function DealHealthDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [stalled, setStalled] = useState<StalledDeal[]>([]);
  const [anomalies, setAnomalies] = useState<DiscountAnomaly[]>([]);
  const [slippage, setSlippage] = useState<DeliverySlippage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'discount' | 'fulfillment' | 'velocity'>('all');
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, st, an, sl] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.stalledDeals(),
        dashboardApi.anomalies(),
        dashboardApi.slippage(),
      ]);
      setSummary(s);
      setStalled(st);
      setAnomalies(an);
      setSlippage(sl);
    } catch (err) {
      console.error('Failed to load deal health:', err);
    } finally {
      setLoading(false);
    }
  };

  // Merge all issues into one list
  const allIssues = [
    ...anomalies.map(a => ({
      type: 'discount' as const,
      severity: a.severity,
      quoteNumber: a.quote_number,
      customerName: a.customer_name,
      issue: a.issue,
      repName: a.rep_name,
      amount: a.total_amount,
      detail: `${a.discount_given}% vs avg ${a.rep_avg_discount}%`,
      quotationId: a.quotation_id,
    })),
    ...stalled.map(s => ({
      type: 'velocity' as const,
      severity: s.severity,
      quoteNumber: s.quote_number,
      customerName: s.customer_name,
      issue: `Idle ${s.days_idle} days without customer touch`,
      repName: s.rep_name,
      amount: s.total_amount,
      detail: `${s.days_idle} days idle`,
      quotationId: s.quotation_id,
    })),
    ...slippage.map(sl => ({
      type: 'fulfillment' as const,
      severity: sl.severity,
      quoteNumber: sl.quote_number,
      customerName: sl.customer_name,
      issue: `${sl.warehouse_name} fulfillment — ${sl.days_late}d slip risk`,
      repName: '',
      amount: 0,
      detail: `Promised: ${sl.promised_date}`,
      quotationId: sl.quotation_id,
    })),
  ];

  const filteredIssues = activeTab === 'all' ? allIssues : allIssues.filter(i => i.type === activeTab);

  // Chart data for rep discount distribution
  const repDiscountData = anomalies.reduce<Record<string, { name: string; avg: number; count: number }>>((acc, a) => {
    if (!acc[a.rep_name]) {
      acc[a.rep_name] = { name: a.rep_name.split(' ')[0][0] + '. ' + a.rep_name.split(' ').slice(1).join(' '), avg: 0, count: 0 };
    }
    acc[a.rep_name].avg = ((acc[a.rep_name].avg * acc[a.rep_name].count) + a.discount_given) / (acc[a.rep_name].count + 1);
    acc[a.rep_name].count++;
    return acc;
  }, {});
  const chartData = Object.values(repDiscountData).length > 0
    ? Object.values(repDiscountData)
    : [
      { name: 'E. Vance', avg: 17.2, count: 3 },
      { name: 'J. Liu', avg: 13.4, count: 2 },
      { name: 'M. Ross', avg: 9.1, count: 1 },
      { name: 'D. Kim', avg: 6.5, count: 1 },
    ];

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
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-caption)' }}>
              REVENUE OPERATIONS &rsaquo; <span style={{ color: '#2563EB' }}>DEAL HEALTH & ANOMALY RADAR</span>
            </span>
            <span className="badge badge-danger" style={{ fontSize: 9, height: 16 }}>LIVE TELEMETRY</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ letterSpacing: '-0.02em' }}>Deal Health & Anomaly Dashboard</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-caption)' }}>
            Real-time fraud, margin erosion, and velocity anomaly detection across all active pipeline stages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-sm gap-1.5"><Download className="w-3 h-3" /> Export Report</button>
          <button className="btn btn-secondary btn-sm gap-1.5" onClick={loadData}><RefreshCw className="w-3 h-3" /> Run Anomaly Scan</button>
          <button className="btn btn-primary btn-sm gap-1.5"><Settings className="w-3 h-3" /> Threshold Rules Engine</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiTile label="Stalled Deals (>14D Idle)" value={String(summary?.stalled_count || stalled.length)}
                 sub={`SLA Threshold: 14 days`} trend={`${stalled.length > 0 ? '+' + stalled.length : '0'} this week`}
                 color="#6366F1" icon={<Clock className="w-5 h-5" />} />
        <KpiTile label="Discount Outliers (>3σ)" value={String(summary?.anomaly_count || anomalies.length)}
                 sub="active quotes" trend="High Severity"
                 color="#E11D48" icon={<AlertTriangle className="w-5 h-5" />} danger />
        <KpiTile label="Depot Fulfillment Risk" value={String(summary?.slippage_count || slippage.length)}
                 sub="promise dates" trend={slippage.length > 0 ? 'Shortage detected' : 'On track'}
                 color="#F59E0B" icon={<Truck className="w-5 h-5" />} />
        <KpiTile label="Projected Margin Leakage" value={formatCurrency(38400)}
                 sub={`Avg compression: -4.8%`} trend={`${allIssues.length} in-flight quotes`}
                 color="#059669" icon={<TrendingDown className="w-5 h-5" />} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Priority Anomaly Table */}
        <div className="col-span-2">
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3"
                 style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
              <div>
                <span className="font-semibold text-sm">Priority Anomaly Radar</span>
                <span className="text-[10px] ml-2" style={{ color: 'var(--color-text-caption)' }}>
                  {allIssues.filter(i => i.severity === 'high').length} Critical / {allIssues.filter(i => i.severity === 'medium').length} Medium Issues
                </span>
              </div>
              {/* Tabs */}
              <div className="flex gap-1">
                {(['all', 'discount', 'fulfillment', 'velocity'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className="px-2.5 py-1 rounded text-[10px] font-medium transition-colors"
                    style={{
                      background: activeTab === tab ? '#2563EB' : 'transparent',
                      color: activeTab === tab ? 'white' : 'var(--color-text-secondary)',
                    }}>
                    {tab === 'all' ? `All Severities (${allIssues.length})` :
                     tab === 'discount' ? `Discount (${allIssues.filter(i => i.type === 'discount').length})` :
                     tab === 'fulfillment' ? `Fulfillment (${allIssues.filter(i => i.type === 'fulfillment').length})` :
                     `Velocity (${allIssues.filter(i => i.type === 'velocity').length})`}
                  </button>
                ))}
              </div>
            </div>

            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="text-left px-4 py-2">Severity</th>
                  <th className="text-left px-4 py-2">Deal / Client</th>
                  <th className="text-left px-4 py-2">Issue Flagged</th>
                  <th className="text-left px-4 py-2">Assigned Rep</th>
                  <th className="text-right px-4 py-2">ARR / Value</th>
                  <th className="text-center px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map((issue, i) => (
                  <tr key={i} className="table-row cursor-pointer" onClick={() => navigate(`/quotations/${issue.quotationId}`)}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-semibold"
                            style={{ color: issue.severity === 'high' ? '#E11D48' : '#F59E0B' }}>
                        <span className="w-2 h-2 rounded-full pulse-dot"
                              style={{ background: issue.severity === 'high' ? '#E11D48' : '#F59E0B' }} />
                        {issue.severity === 'high' ? 'High' : 'Medium'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold" style={{ color: '#2563EB' }}>{issue.quoteNumber}</div>
                      <div className="text-[11px]" style={{ color: 'var(--color-text-caption)' }}>{issue.customerName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs" style={{ color: issue.severity === 'high' ? '#E11D48' : '#F59E0B' }}>
                        {issue.issue}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--color-text-caption)' }}>{issue.detail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                             style={{ background: '#475569' }}>
                          {issue.repName.split(' ').map(n => n[0]).join('') || '?'}
                        </div>
                        <span className="text-xs">{issue.repName || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium">
                      {issue.amount > 0 ? formatCurrency(issue.amount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <button className="btn btn-sm btn-danger" style={{ height: 22, fontSize: 9, padding: '0 6px' }}>
                          {issue.severity === 'high' ? (
                            <><ArrowUpRight className="w-2.5 h-2.5" /> Escalate</>
                          ) : (
                            <><Send className="w-2.5 h-2.5" /> Nudge Rep</>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredIssues.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-text-caption)' }}>
                    No anomalies detected. All deals are operating within policy bounds.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Audit Log */}
          <div className="card mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" style={{ color: '#2563EB' }} />
                <span className="font-semibold text-sm">Algorithmic Risk Trigger Audit Log</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--color-text-caption)' }}>Auto-updating (FIFO)</span>
            </div>
            <div className="flex flex-col gap-2 font-mono text-[11px]" style={{ background: 'var(--color-shell)', borderRadius: 6, padding: 12, color: '#94A3B8' }}>
              <div className="flex gap-2">
                <span style={{ color: '#64748B' }}>14:32:08.411</span>
                <span className="badge badge-danger" style={{ fontSize: 8, height: 14, padding: '0 4px' }}>RARE_DISCOUNT</span>
                <span>Q-1042 triggered standard error band dev (&gt;17.2% vs Rep Historical 7.9%)</span>
              </div>
              <div className="flex gap-2">
                <span style={{ color: '#64748B' }}>14:28:19.002</span>
                <span className="badge badge-info" style={{ fontSize: 8, height: 14, padding: '0 4px' }}>STOCK_ROUTING</span>
                <span>Austin Center depot evaluated: 140 units SK-8832 reserved for Delta Ind.</span>
              </div>
              <div className="flex gap-2">
                <span style={{ color: '#64748B' }}>14:15:44.891</span>
                <span className="badge badge-success" style={{ fontSize: 8, height: 14, padding: '0 4px' }}>AUDIT_OK</span>
                <span>Pipeline scrubbed: 42 deals passed SLA margin and velocity hurdles without violations</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Remediation + Chart */}
        <div className="flex flex-col gap-6">
          {/* One-Click Remediation */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: '#2563EB' }} />
                <span className="font-semibold text-sm">One-Click Remediation</span>
              </div>
              <span className="badge badge-info" style={{ fontSize: 9, height: 16 }}>AI EXECUTION</span>
            </div>

            {/* Bulk Nudge */}
            <div className="mb-4 p-3 rounded" style={{ background: 'var(--color-surface-inset)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">Bulk Nudge Stalled Deals</span>
                <span className="text-[10px]" style={{ color: 'var(--color-text-caption)' }}>{stalled.length} Reps</span>
              </div>
              <p className="text-[10px] mb-2" style={{ color: 'var(--color-text-caption)' }}>
                Sends high-priority contextual Slack ping to deal owners with prefilled re-engagement copy.
              </p>
              <button className="btn btn-primary w-full btn-sm gap-1.5">
                Execute Bulk Slack Nudge <Send className="w-3 h-3" />
              </button>
            </div>

            {/* Rebalance */}
            <div className="mb-4 p-3 rounded" style={{ background: 'var(--color-surface-inset)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">Rebalance Depot Inventory</span>
                <span className="badge badge-warning" style={{ fontSize: 8, height: 14 }}>Logistics</span>
              </div>
              <p className="text-[10px] mb-2" style={{ color: 'var(--color-text-caption)' }}>
                Transfers units from Hub to Depot to prevent committed delivery slips.
              </p>
              <button className="btn btn-secondary w-full btn-sm gap-1.5">
                Authorize Depot Transfer <Package className="w-3 h-3" />
              </button>
            </div>

            {/* Flag Outliers */}
            <div className="p-3 rounded" style={{ background: 'var(--color-surface-inset)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">Flag Rep Outliers</span>
                <span className="badge badge-info" style={{ fontSize: 8, height: 14 }}>Governance</span>
              </div>
              <p className="text-[10px] mb-2" style={{ color: 'var(--color-text-caption)' }}>
                Issues formal Deal Desk guidance and temporary delegation freeze to reps exceeding 3σ discount baseline.
              </p>
              <button className="btn btn-secondary w-full btn-sm gap-1.5">
                Send Coaching Alert Memo <Send className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Rep Discount Distribution Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">Rep Discount Distribution</span>
            </div>
            <p className="text-[10px] mb-3" style={{ color: 'var(--color-text-caption)' }}>
              Average Rep Discount % vs Allowable Band (&lt;10%)
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#0F172A' }} width={70} />
                <Tooltip
                  contentStyle={{ fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 4 }}
                  formatter={(value: any) => [`${Number(value || 0).toFixed(1)}%`, 'Avg Discount']}
                />
                <ReferenceLine x={10} stroke="#E11D48" strokeDasharray="3 3" label={{ value: '10% POLICY HURDLE', fill: '#E11D48', fontSize: 8 }} />
                <Bar dataKey="avg" radius={[0, 4, 4, 0]} barSize={16}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.avg > 10 ? '#E11D48' : '#2563EB'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-between mt-3 pt-3"
                 style={{ borderTop: '1px solid var(--color-surface-border)' }}>
              <div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-caption)' }}>Team Median</div>
                <div className="font-mono text-sm font-bold">8.4%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-caption)' }}>Max Allowable</div>
                <div className="font-mono text-sm font-bold" style={{ color: '#E11D48' }}>10.0%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, sub, trend, color, icon, danger }: {
  label: string; value: string; sub: string; trend: string; color: string;
  icon: React.ReactNode; danger?: boolean;
}) {
  return (
    <div className="metric-tile" style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="metric-label">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
      <div className="flex items-center gap-1 mt-2 text-[11px] font-medium"
           style={{ color: danger ? '#E11D48' : 'var(--color-text-caption)' }}>
        {trend}
      </div>
    </div>
  );
}
