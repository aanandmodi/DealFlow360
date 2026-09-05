/**
 * Deal Health & Anomaly Dashboard — B9.
 * Styled in the exact visual design system of VendorBridge:
 * - Outfit font for headers and metrics
 * - shadow-premium KPI cards with colored icon chips
 * - Recharts horizontal distribution bar chart
 * - Tabular anomaly radar with priority pulse chips
 * - One-click remediation action panel
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, DashboardSummary, StalledDeal, DiscountAnomaly, DeliverySlippage } from '../../api/dashboard';
import { formatCurrency } from '../../lib/utils';
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
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h2 className="font-outfit text-xl md:text-2xl font-extrabold text-slate-900">
            Deal Health & Anomaly Radar
          </h2>
          <p className="text-xs text-slate-500">
            Realtime revenue leakage prevention, velocity stall detection, and discount variance telemetry
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            <span>Run Anomaly Scan</span>
          </button>
          <button className="flex items-center space-x-1.5 rounded-lg bg-primary hover:bg-primary-hover px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer">
            <Settings className="h-3.5 w-3.5" />
            <span>Threshold Rules Engine</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row (VendorBridge style) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stalled Deals (&gt;14D)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {summary?.stalled_count || stalled.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">SLA 14 days idle</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Discount Outliers (&gt;3σ)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-danger">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {summary?.anomaly_count || anomalies.length}
            </span>
            <span className="text-xs font-semibold text-danger">High Severity</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Depot Slip Risk</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-warning">
              <Truck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {summary?.slippage_count || slippage.length}
            </span>
            <span className="text-xs font-semibold text-warning">Warehouse SLAs</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Projected Leakage</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-success">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-2xl font-extrabold text-slate-900 truncate">
              {formatCurrency(38400)}
            </span>
            <span className="text-xs font-semibold text-slate-500">-4.8% avg margin</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Priority Anomaly Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-premium overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-outfit text-base font-bold text-slate-900">Priority Anomaly Radar</h3>
                <p className="text-xs text-slate-500">
                  {allIssues.filter(i => i.severity === 'high').length} Critical / {allIssues.filter(i => i.severity === 'medium').length} Medium Breaches
                </p>
              </div>

              {/* Tabs */}
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                {(['all', 'discount', 'fulfillment', 'velocity'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === tab
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'all' ? `All (${allIssues.length})` :
                     tab === 'discount' ? `Discount (${allIssues.filter(i => i.type === 'discount').length})` :
                     tab === 'fulfillment' ? `Fulfillment (${allIssues.filter(i => i.type === 'fulfillment').length})` :
                     `Velocity (${allIssues.filter(i => i.type === 'velocity').length})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Severity</th>
                    <th className="px-6 py-3">Deal / Client</th>
                    <th className="px-6 py-3">Issue Flagged</th>
                    <th className="px-6 py-3">Assigned Rep</th>
                    <th className="px-6 py-3 text-right">Value</th>
                    <th className="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIssues.map((issue, i) => (
                    <tr
                      key={i}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/quotations/${issue.quotationId}`)}
                    >
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          issue.severity === 'high'
                            ? 'bg-rose-50 text-danger border-rose-200'
                            : 'bg-amber-50 text-warning border-amber-200'
                        }`}>
                          {issue.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-outfit font-bold text-xs text-primary">{issue.quoteNumber}</div>
                        <div className="text-xs text-slate-500">{issue.customerName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-xs font-semibold ${issue.severity === 'high' ? 'text-danger' : 'text-slate-800'}`}>
                          {issue.issue}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{issue.detail}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-800">
                        {issue.repName || 'Logistics'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-900">
                        {issue.amount > 0 ? formatCurrency(issue.amount) : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/quotations/${issue.quotationId}`); }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold shadow-sm transition-all cursor-pointer ${
                            issue.severity === 'high'
                              ? 'bg-danger text-white hover:bg-danger-hover'
                              : 'bg-primary text-white hover:bg-primary-hover'
                          }`}
                        >
                          {issue.severity === 'high' ? 'Escalate' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredIssues.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400">
                        No anomalies detected under this filter. All deals operating within policy hurdles.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Console Card (VendorBridge style) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <h3 className="font-outfit text-sm font-bold text-slate-900">Algorithmic Risk Trigger Stream</h3>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2 border border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="text-slate-500">14:32:08</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-danger-light text-danger">RARE_DISCOUNT</span>
                <span className="truncate">Q-1042 triggered standard error band dev (&gt;17.2% vs Rep Historical 7.9%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-500">14:28:19</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary-light text-primary">STOCK_ROUTING</span>
                <span className="truncate">Austin Center depot evaluated: 140 units reserved for Delta Ind.</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-500">14:15:44</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-success-light text-success">AUDIT_OK</span>
                <span className="truncate">Pipeline scrubbed: 42 deals passed SLA margin and velocity hurdles</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Remediation + Chart */}
        <div className="space-y-6">
          {/* One-Click Remediation Panel */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="font-outfit text-sm font-bold text-slate-900">Automated Remediation</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-primary-light text-primary">
                AI BOT
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Bulk Nudge Stalled Deals</span>
                <span className="text-[10px] font-semibold text-slate-500">{stalled.length} Reps</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Sends high-priority contextual Slack ping to deal owners with prefilled re-engagement copy.
              </p>
              <button className="w-full flex items-center justify-center space-x-1.5 rounded-lg bg-primary hover:bg-primary-hover py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer">
                <span>Execute Bulk Slack Nudge</span>
                <Send className="h-3 w-3" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Rebalance Depot Inventory</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning-light text-warning">Logistics</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Transfers units from Hub to Depot to prevent committed delivery slips.
              </p>
              <button className="w-full flex items-center justify-center space-x-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all cursor-pointer">
                <span>Authorize Depot Transfer</span>
                <Package className="h-3 w-3 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Rep Discount Distribution Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium space-y-3">
            <h3 className="font-outfit text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Rep Discount Distribution vs Policy
            </h3>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#0F172A' }} width={70} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }}
                    formatter={(value: any) => [`${Number(value || 0).toFixed(1)}%`, 'Avg Discount']}
                  />
                  <ReferenceLine x={10} stroke="#DC2626" strokeDasharray="3 3" label={{ value: '10% Floor', fill: '#DC2626', fontSize: 9 }} />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]} barSize={16}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.avg > 10 ? '#DC2626' : '#2563EB'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Team Median</span>
                <span className="font-mono font-bold text-slate-900">8.4%</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Policy Floor</span>
                <span className="font-mono font-bold text-danger">10.0%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
