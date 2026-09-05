/**
 * Sales Dashboard — Dynamic Role-Based Revenue Operations Hub.
 * Tailors KPIs, action buttons, table queues, and analytic widgets per persona:
 * - Sales Rep: Quota target tracking, personal pipeline, approval status, rapid quotation builder.
 * - Sales Manager: Urgent deal desk approvals, team leaderboard, autonomous clearance radar, escalations.
 * - Finance: High-risk discount sign-off, ARR/MRR subscriptions, margin leakage protection, billing cashflow.
 * - Admin: Full enterprise command center with SOC2/SLA metrics and direct admin controls.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, DashboardSummary, StalledDeal, DiscountAnomaly } from '../../api/dashboard';
import { quotationsApi, QuotationListItem } from '../../api/quotations';
import { formatCurrency, getStatusBadgeClass, getStatusLabel, timeAgo } from '../../lib/utils';
import {
  CheckSquare, FileText, AlertTriangle, Percent, Download, Eye,
  ShieldCheck, Plus, ArrowRight, TrendingUp, Clock, RefreshCw, Home, AlertCircle,
  Award, Target, DollarSign, CreditCard, ShieldAlert, Sparkles, UserCheck, Activity
} from 'lucide-react';

export function SalesDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [stalled, setStalled] = useState<StalledDeal[]>([]);
  const [anomalies, setAnomalies] = useState<DiscountAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const role = user?.role || 'admin';

  useEffect(() => {
    loadData();
  }, [user]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#2563EB' }} />
      </div>
    );
  }

  // Filter quotes per role relevance
  const pendingQuotes = quotations.filter(q => q.status === 'pending_approval');
  const myQuotes = role === 'sales_rep'
    ? quotations
    : quotations.slice(0, 8);

  // Computed metrics
  const myPipelineValue = quotations.reduce((acc, q) => acc + (typeof q.total_amount === 'number' ? q.total_amount : parseFloat(q.total_amount || '0')), 0);
  const quotaTarget = 500000;
  const quotaAttainment = Math.min(100, Math.round((myPipelineValue / quotaTarget) * 100)) || 62;

  return (
    <div className="p-6 animate-fade-in">
      {/* ── Role-Specific Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px]" style={{ color: 'var(--color-text-caption)' }}>
              {role === 'sales_rep' && 'Sales Executive Workspace'}
              {role === 'sales_manager' && 'Deal Desk & Manager Command'}
              {role === 'finance' && 'Revenue & Finance Control Hub'}
              {role === 'admin' && 'Enterprise Revenue Operations'}
            </span>
            <span className="text-[10px] font-semibold" style={{ color: '#10B981' }}>• Realtime Sync Active</span>
          </div>

          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            {role === 'sales_rep' && `Welcome back, ${user?.first_name || 'Elena'}!`}
            {role === 'sales_manager' && 'Sales Operations Hub'}
            {role === 'finance' && 'Revenue & Margin Governance Hub'}
            {role === 'admin' && 'Executive Operations Hub'}
          </h1>

          <div className="mt-1 flex items-center gap-2">
            <span className="badge badge-info" style={{ fontSize: 10 }}>
              {role === 'sales_rep' && `Q1 Quota Target: ${formatCurrency(quotaTarget)}`}
              {role === 'sales_manager' && 'Governance Active • 4 Reps Overseen'}
              {role === 'finance' && 'Billing Period: Q1-FY25 • Margin Floor: 25%'}
              {role === 'admin' && 'Enterprise 360 Admin Mode'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Role: <strong className="text-slate-800 uppercase">{role.replace('_', ' ')}</strong>
            </span>
          </div>
        </div>

        {/* Action Header Buttons per Role */}
        <div className="flex items-center gap-2">
          {role === 'sales_rep' && (
            <>
              <button className="btn btn-secondary btn-sm gap-1.5" onClick={() => navigate('/quotations')}>
                <FileText className="w-3 h-3" /> View My Pipeline ({quotations.length})
              </button>
              <button className="btn btn-primary gap-1.5" onClick={() => navigate('/quotations/new')}>
                <Plus className="w-4 h-4" /> New Quotation
              </button>
            </>
          )}

          {role === 'sales_manager' && (
            <>
              <button className="btn btn-secondary btn-sm gap-1.5" onClick={() => navigate('/deal-health')}>
                <AlertTriangle className="w-3 h-3 text-amber-500" /> Margin Leakage
              </button>
              <button className="btn btn-primary btn-sm gap-1.5" onClick={() => navigate('/approvals')}>
                <ShieldCheck className="w-3.5 h-3.5" /> Approvals Queue
                <span className="w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center bg-rose-600">
                  {summary?.pending_approvals || pendingQuotes.length || 0}
                </span>
              </button>
            </>
          )}

          {role === 'finance' && (
            <>
              <button className="btn btn-secondary btn-sm gap-1.5" onClick={() => navigate('/subscriptions')}>
                <CreditCard className="w-3 h-3" /> Subscriptions & ARR
              </button>
              <button className="btn btn-primary btn-sm gap-1.5" onClick={() => navigate('/approvals')}>
                <ShieldCheck className="w-3.5 h-3.5" /> Finance Sign-off
                <span className="w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center bg-rose-600">
                  {summary?.pending_approvals || 0}
                </span>
              </button>
            </>
          )}

          {role === 'admin' && (
            <>
              <button className="btn btn-secondary btn-sm gap-1.5" onClick={() => navigate('/reports')}>
                <Download className="w-3 h-3" /> Export Audit Report
              </button>
              <button className="btn btn-primary gap-1.5" onClick={() => navigate('/quotations/new')}>
                <Plus className="w-4 h-4" /> Create Quotation
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Role-Tailored KPI Cards ── */}
      {role === 'sales_rep' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">My Quota Attainment</span>
              <Target className="w-4 h-4 text-blue-600" />
            </div>
            <div className="metric-value">{quotaAttainment}%</div>
            <div className="metric-sub">{formatCurrency(myPipelineValue)} of {formatCurrency(quotaTarget)}</div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${quotaAttainment}%` }} />
            </div>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">My Open Deals</span>
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div className="metric-value">{quotations.length}</div>
            <div className="metric-sub">Active quotes in pipeline</div>
            <div className="text-xs mt-1 text-slate-500 font-mono">
              {formatCurrency(myPipelineValue)} Total Value
            </div>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">Awaiting Approval</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="metric-value">{pendingQuotes.length}</div>
            <div className="metric-sub">Pending Deal Desk sign-off</div>
            {pendingQuotes.length > 0 ? (
              <span className="badge badge-warning text-[10px] mt-1">In Manager Review</span>
            ) : (
              <span className="badge badge-success text-[10px] mt-1">All Cleared</span>
            )}
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">My Avg Margin</span>
              <Percent className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="metric-value">{summary?.avg_margin_pct?.toFixed(1) || '31.4'}%</div>
            <div className="metric-sub">Healthy margin pricing</div>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-600">
              <TrendingUp className="w-3 h-3" /> Exceeds 25% floor
            </div>
          </div>
        </div>
      )}

      {role === 'sales_manager' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="metric-tile border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label font-bold text-rose-700">Urgent Approvals</span>
              <CheckSquare className="w-4 h-4 text-rose-600" />
            </div>
            <div className="metric-value text-rose-600">{summary?.pending_approvals || pendingQuotes.length || 0}</div>
            <div className="metric-sub">Stage 1 Decision Needed</div>
            <button
              onClick={() => navigate('/approvals')}
              className="text-xs font-semibold text-rose-700 hover:underline mt-1 flex items-center gap-1"
            >
              Open Queue <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">Team Active Pipeline</span>
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div className="metric-value">{summary?.active_pipeline_count || quotations.length}</div>
            <div className="metric-sub">{formatCurrency(summary?.active_pipeline_value || 1420000)} Total Value</div>
            <div className="text-xs text-slate-500 mt-1">Across 4 Reps</div>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">Policy Risk Anomalies</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="metric-value">{summary?.at_risk_count || stalled.length || 0}</div>
            <div className="metric-sub">Discount overages / stalled</div>
            <span className="badge badge-danger text-[10px] mt-1">Action Required</span>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">Gross Margin Realized</span>
              <Percent className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="metric-value">{summary?.avg_margin_pct?.toFixed(1) || '32.1'}%</div>
            <div className="metric-sub">Team blended margin</div>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-600">
              <TrendingUp className="w-3 h-3" /> +2.8% vs last month
            </div>
          </div>
        </div>
      )}

      {role === 'finance' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="metric-tile border-l-4 border-l-emerald-600">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label font-bold text-emerald-800">Contracted ARR</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="metric-value text-emerald-700">$384,500</div>
            <div className="metric-sub">Annual Recurring Revenue</div>
            <div className="text-xs text-emerald-600 mt-1 font-semibold">+18.4% YoY Expansion</div>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">Finance Sign-Offs</span>
              <ShieldCheck className="w-4 h-4 text-rose-600" />
            </div>
            <div className="metric-value text-rose-600">{summary?.pending_approvals || 0}</div>
            <div className="metric-sub">High-risk discount checks</div>
            <span className="badge badge-warning text-[10px] mt-1">Stage 2 Sign-off</span>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">Margin Exposure ($)</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="metric-value text-amber-600">$18,450</div>
            <div className="metric-sub">Total discount ceiling overages</div>
            <div className="text-xs text-slate-500 mt-1">Protected by Risk Scoring</div>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">Billing Invoices</span>
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <div className="metric-value">98.2%</div>
            <div className="metric-sub">On-time collection SLA</div>
            <div className="text-xs text-slate-500 mt-1">Hybrid One-time + Recurring</div>
          </div>
        </div>
      )}

      {role === 'admin' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">System Health</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="metric-value text-emerald-600">99.98%</div>
            <div className="metric-sub">SLA Uptime • SOC2 Type II</div>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">Enterprise Pipeline</span>
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div className="metric-value">{quotations.length} Quotes</div>
            <div className="metric-sub">{formatCurrency(summary?.active_pipeline_value || 1420000)} Active</div>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">Approval Governance</span>
              <ShieldCheck className="w-4 h-4 text-purple-600" />
            </div>
            <div className="metric-value">{summary?.pending_approvals || 0} Pending</div>
            <div className="metric-sub">Autonomous clearance 64%</div>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-label">Active Modules</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div className="metric-value">CPQ + WH + Sub</div>
            <div className="metric-sub">All 3 engines connected</div>
          </div>
        </div>
      )}

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left 2 Columns: Main Pipeline / Approval Queue */}
        <div className="col-span-2">
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3"
                 style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
              <div className="flex items-center gap-2">
                {role === 'sales_manager' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold text-sm">Urgent Deal Desk Decision Queue</span>
                  </>
                ) : role === 'finance' ? (
                  <>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-sm">Revenue Sign-Off & High-Risk Quotations</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-sm">
                      {role === 'sales_rep' ? 'My Active Pipeline & Quotations' : 'High Priority Quotations'}
                    </span>
                  </>
                )}
              </div>
              <span className="text-[10px]" style={{ color: 'var(--color-text-caption)' }}>
                {role === 'sales_rep' ? 'Scoped to your sales account' : 'Live operational pipeline queue'}
              </span>
            </div>

            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="text-left px-4 py-2">Quote ID / Client</th>
                  <th className="text-left px-4 py-2">Stage</th>
                  <th className="text-left px-4 py-2">Owner</th>
                  <th className="text-right px-4 py-2">Deal Value</th>
                  <th className="text-right px-4 py-2">Margin %</th>
                  <th className="text-center px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {myQuotes.slice(0, 6).map((q) => (
                  <tr key={q.id} className="table-row cursor-pointer" onClick={() => navigate(q.status === 'pending_approval' && (role === 'sales_manager' || role === 'finance') ? `/approvals/${q.id}` : `/quotations/${q.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-xs text-blue-600">{q.quote_number}</div>
                      <div className="text-[11px] text-slate-500">{q.customer_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getStatusBadgeClass(q.status)}`} style={{ fontSize: 10 }}>
                        {getStatusLabel(q.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold bg-slate-600">
                          {q.rep_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-xs text-slate-700">{q.rep_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium">{formatCurrency(q.total_amount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium"
                        style={{ color: q.margin_pct >= 25 ? '#10B981' : '#F59E0B' }}>
                      {q.margin_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      {q.status === 'pending_approval' && (role === 'sales_manager' || role === 'finance' || role === 'admin') ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/approvals/${q.id}`); }}
                          className="btn btn-primary btn-sm bg-rose-600 hover:bg-rose-700 border-none"
                          style={{ height: 24, fontSize: 10, padding: '0 8px' }}
                        >
                          Review & Approve
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/quotations/${q.id}`); }}
                          className="btn btn-secondary btn-sm"
                          style={{ height: 24, fontSize: 10, padding: '0 8px' }}
                        >
                          {q.status === 'approved' ? 'Send' : 'Open'}
                        </button>
                      )}
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
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-sm">Recent Deal Stream & Audit Trail</span>
              </div>
              <span className="text-[10px] text-slate-400">Live SOC2 Audit Log</span>
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
                    <div className="text-[11px] text-slate-500">
                      {getStatusLabel(q.status)} • {formatCurrency(q.total_amount)} • Rep: {q.rep_name}
                    </div>
                  </div>
                  <span className="text-[10px] whitespace-nowrap text-slate-400">
                    {timeAgo(q.updated_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Role-Tailored Widgets */}
        <div className="flex flex-col gap-6">
          {/* Role Widget 1: Manager Leaderboard / Rep Target Widget / Finance Ledger */}
          {role === 'sales_manager' ? (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" /> Rep Performance Leaderboard
                </span>
                <span className="badge badge-info text-[9px]">Q1 Standings</span>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Elena Vance', deals: 8, volume: '$345,000', margin: '34.2%', pct: 86 },
                  { name: 'Marcus Chen', deals: 6, volume: '$280,000', margin: '31.0%', pct: 70 },
                  { name: 'Sophia Reeves', deals: 4, volume: '$190,000', margin: '28.5%', pct: 48 },
                ].map((rep, idx) => (
                  <div key={rep.name} className="p-2.5 rounded bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-blue-600">#{idx + 1}</span>
                        <span className="text-xs font-semibold text-slate-800">{rep.name}</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-slate-700">{rep.volume}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
                      <span>{rep.deals} closed deals</span>
                      <span className="text-emerald-600 font-semibold">{rep.margin} margin</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${rep.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : role === 'finance' ? (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600" /> Revenue Stream Composition
                </span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Recurring Cloud Subscriptions</span>
                  <span className="font-mono font-bold text-slate-800">$264,000 / yr</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Hardware & Appliance Sales</span>
                  <span className="font-mono font-bold text-slate-800">$480,000</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Professional Services & SLA</span>
                  <span className="font-mono font-bold text-slate-800">$120,500</span>
                </div>
                <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px]">
                  <strong>Revenue Recognition:</strong> Compliant with ASC 606 standards. Hybrid proration engine active.
                </div>
              </div>
            </div>
          ) : (
            /* Sales Rep Widget: Delegation Guidelines */
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" /> Discount Delegation Bounds
                </span>
                <span className="badge badge-success text-[9px]">TIER RULES</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Discounts within tier limits clear automatically without Deal Desk delays.
              </p>
              <div className="space-y-2">
                <div className="p-2 rounded bg-amber-50 border border-amber-200 text-xs flex justify-between">
                  <div>
                    <span className="font-bold text-amber-800">Bronze Tier (≤ 5%):</span>
                    <div className="text-[10px] text-amber-700">Auto-approved instant checkout</div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 self-center">Instant</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-200 text-xs flex justify-between">
                  <div>
                    <span className="font-bold text-slate-800">Silver Tier (5% – 10%):</span>
                    <div className="text-[10px] text-slate-600">Requires Sales Manager sign-off</div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 self-center">~2h SLA</span>
                </div>
                <div className="p-2 rounded bg-rose-50 border border-rose-200 text-xs flex justify-between">
                  <div>
                    <span className="font-bold text-rose-800">Gold Tier (&gt; 10%):</span>
                    <div className="text-[10px] text-rose-700">Manager + Finance dual sign-off</div>
                  </div>
                  <span className="text-[10px] font-bold text-rose-600 self-center">~6h SLA</span>
                </div>
              </div>
            </div>
          )}

          {/* Autonomous Approval Clearance Radar */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">Auto-Approval Radar</span>
              <span className="badge badge-success" style={{ fontSize: 9, height: 16 }}>ENGINE ACTIVE</span>
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-600">Autonomous Clearance Rate</span>
                <span className="font-mono text-sm font-bold text-blue-600">64%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: '64%' }} />
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mb-3">
              32 of 50 deals in the past 7 days cleared zero-touch within predefined delegation bounds.
            </div>

            <div className="text-xs font-semibold mb-2 uppercase tracking-wider text-slate-500 text-[10px]">
              Discount Tier Utilization
            </div>
            {[
              { label: 'Bronze (≤ 5%)', count: 21, pct: 42, color: '#CD7F32' },
              { label: 'Silver (5% – 10%)', count: 19, pct: 38, color: '#94A3B8' },
              { label: 'Gold (> 10% Escalation)', count: 10, pct: 20, color: '#E11D48' },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2 py-1">
                <span className="w-2 h-2 rounded-sm" style={{ background: t.color }} />
                <span className="text-[11px] flex-1 text-slate-700">{t.label}</span>
                <span className="text-[11px] text-slate-500">{t.count} deals</span>
                <span className="font-mono text-[11px] font-semibold w-8 text-right text-slate-800">{t.pct}%</span>
              </div>
            ))}
          </div>

          {/* Stalled Deal Radar */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">Stalled Deal Radar</span>
              {stalled.length > 0 && (
                <span className="text-xs font-semibold text-rose-600">{stalled.length} Alerts</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 mb-3">
              Deals idle beyond 14 days or exhibiting margin slippage during counter-offers.
            </div>
            {stalled.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-t border-slate-100">
                <div>
                  <div className="text-xs font-semibold text-slate-800">{s.customer_name}</div>
                  <div className="text-[10px] text-slate-500">
                    Idle {s.days_idle} days • {formatCurrency(s.total_amount)}
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/quotations`)}
                  className="btn btn-sm"
                  style={{
                    height: 22, fontSize: 10, padding: '0 8px',
                    color: s.severity === 'high' ? '#E11D48' : '#2563EB',
                    border: `1px solid ${s.severity === 'high' ? 'var(--color-danger-border)' : 'var(--color-surface-border)'}`,
                    background: s.severity === 'high' ? 'var(--color-danger-bg)' : 'white',
                  }}
                >
                  {s.severity === 'high' ? 'Escalate' : 'Inspect'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
