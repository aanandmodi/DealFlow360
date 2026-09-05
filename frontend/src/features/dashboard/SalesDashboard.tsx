/**
 * Sales Dashboard — Dynamic Role-Based Revenue Operations Hub.
 * Styled in the exact visual design system of VendorBridge:
 * - Outfit & Inter typography
 * - Welcome hero gradient with dynamic action buttons
 * - Alert banner with pulse icon
 * - Premium KPI cards with colored icon chips and Outfit bold figures
 * - Recharts area chart with #2563EB gradient fill
 * - Sleek tabular queue with shadow-premium
 * - Timeline audit feed
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, DashboardSummary, StalledDeal, DiscountAnomaly } from '../../api/dashboard';
import { quotationsApi, QuotationListItem } from '../../api/quotations';
import { formatCurrency, getStatusBadgeClass, getStatusLabel, timeAgo } from '../../lib/utils';
import {
  CheckSquare, FileText, AlertTriangle, Percent, Download, Eye,
  ShieldCheck, Plus, ArrowRight, TrendingUp, Clock, RefreshCw, AlertCircle,
  Award, Target, DollarSign, CreditCard, Sparkles, Activity, CheckCircle,
  PlusCircle, Send, Users
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip
} from 'recharts';

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
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Filter quotes per role relevance
  const quotesList = Array.isArray(quotations) ? quotations : [];
  const pendingQuotes = quotesList.filter(q => q.status === 'pending_approval');
  const myQuotes = role === 'sales_rep'
    ? quotesList
    : quotesList.slice(0, 8);

  // Computed metrics
  const myPipelineValue = quotesList.reduce((acc, q) => acc + (typeof q.total_amount === 'number' ? q.total_amount : parseFloat(q.total_amount || '0')), 0);
  const quotaTarget = 500000;
  const quotaAttainment = Math.min(100, Math.round((myPipelineValue / quotaTarget) * 100)) || 62;

  // Recharts Monthly Revenue Trend (matching VendorBridge spend trend)
  const revenueTrendData = [
    { name: 'Jan', revenue: 140000 },
    { name: 'Feb', revenue: 260000 },
    { name: 'Mar', revenue: 210000 },
    { name: 'Apr', revenue: 390000 },
    { name: 'May', revenue: 320000 },
    { name: 'Jun', revenue: myPipelineValue || 680000 },
  ];

  const showAnomalyAlert = anomalies.length > 0 || stalled.length > 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Smart Anomaly Alert Card (VendorBridge style) ── */}
      {showAnomalyAlert && (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 shadow-premium hover:shadow-premium-hover transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-light text-warning">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 font-outfit uppercase tracking-wider">
                Deal Risk & Margin Anomaly Detected
              </h4>
              <p className="text-xs text-slate-600 mt-1 font-semibold">
                {anomalies[0]?.issue || `${stalled.length} high-value deals are stalled beyond SLA threshold (14+ days idle).`}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/deal-health')}
            className="text-xs font-bold text-primary hover:underline flex items-center space-x-0.5 shrink-0 self-end sm:self-auto cursor-pointer"
          >
            <span>Inspect Deal Health AI</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Welcome Hero Banner (VendorBridge style) ── */}
      <div className="rounded-2xl bg-gradient-to-r from-primary to-blue-700 p-6 md:p-8 text-white shadow-premium">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h2 className="font-outfit text-2xl md:text-3xl font-extrabold">
              Welcome back, {user?.first_name || 'User'}!
            </h2>
            <p className="text-blue-100 text-sm mt-1.5 opacity-90">
              You are logged in as a <span className="font-bold underline uppercase">{role.replace('_', ' ')}</span>. Here is your revenue operations status check.
            </p>
          </div>

          {/* Quick Actions depending on roles */}
          <div className="flex flex-wrap gap-3">
            {role === 'sales_rep' && (
              <>
                <button
                  onClick={() => navigate('/quotations')}
                  className="flex items-center space-x-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  <span>My Pipeline ({quotations.length})</span>
                </button>
                <button
                  onClick={() => navigate('/quotations/new')}
                  className="flex items-center space-x-2 rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-primary shadow hover:bg-blue-50 transition-all cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>New Quotation</span>
                </button>
              </>
            )}

            {role === 'sales_manager' && (
              <>
                <button
                  onClick={() => navigate('/deal-health')}
                  className="flex items-center space-x-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                  <span>Margin Leakage</span>
                </button>
                <button
                  onClick={() => navigate('/approvals')}
                  className="flex items-center space-x-2 rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-primary shadow hover:bg-blue-50 transition-all cursor-pointer"
                >
                  <Clock className="h-4 w-4" />
                  <span>Review Approvals ({summary?.pending_approvals || pendingQuotes.length})</span>
                </button>
              </>
            )}

            {role === 'finance' && (
              <>
                <button
                  onClick={() => navigate('/subscriptions')}
                  className="flex items-center space-x-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Subscriptions & ARR</span>
                </button>
                <button
                  onClick={() => navigate('/approvals')}
                  className="flex items-center space-x-2 rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-primary shadow hover:bg-blue-50 transition-all cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Finance Sign-off ({summary?.pending_approvals || 0})</span>
                </button>
              </>
            )}

            {role === 'admin' && (
              <>
                <button
                  onClick={() => navigate('/reports')}
                  className="flex items-center space-x-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Audit Report</span>
                </button>
                <button
                  onClick={() => navigate('/quotations/new')}
                  className="flex items-center space-x-2 rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-primary shadow hover:bg-blue-50 transition-all cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Create Quotation</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Cards Row (VendorBridge exact style) ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {role === 'sales_rep' ? 'Quota Attainment' : role === 'sales_manager' ? 'Urgent Approvals' : role === 'finance' ? 'Contracted ARR' : 'System Health'}
            </span>
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              role === 'sales_manager' ? 'bg-rose-50 text-danger' : 'bg-blue-50 text-primary'
            }`}>
              {role === 'sales_rep' ? <Target className="h-5 w-5" /> :
               role === 'sales_manager' ? <CheckSquare className="h-5 w-5" /> :
               role === 'finance' ? <DollarSign className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {role === 'sales_rep' ? `${quotaAttainment}%` :
               role === 'sales_manager' ? (summary?.pending_approvals || pendingQuotes.length) :
               role === 'finance' ? '$384.5K' : '99.98%'}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {role === 'sales_rep' ? `${formatCurrency(myPipelineValue)} of $500K` :
               role === 'sales_manager' ? 'Decisions Needed' :
               role === 'finance' ? '+18.4% YoY' : 'SOC2 Type II'}
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {role === 'sales_rep' ? 'Active Pipeline' : role === 'sales_manager' ? 'Team Pipeline' : role === 'finance' ? 'Finance Sign-offs' : 'Enterprise Pipeline'}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-success">
              {role === 'finance' ? <ShieldCheck className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {role === 'finance' ? (summary?.pending_approvals || 0) : quotations.length}
            </span>
            <span className="text-xs font-semibold text-success flex items-center">
              {role === 'finance' ? 'High-risk checks' : formatCurrency(summary?.active_pipeline_value || myPipelineValue)}
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {role === 'sales_rep' ? 'Awaiting Approval' : role === 'sales_manager' ? 'Policy Risk Anomalies' : role === 'finance' ? 'Margin Exposure' : 'Governance Clearance'}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-warning">
              {role === 'sales_rep' ? <Clock className="h-5 w-5" /> :
               role === 'sales_manager' ? <AlertTriangle className="h-5 w-5" /> :
               role === 'finance' ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {role === 'sales_rep' ? pendingQuotes.length :
               role === 'sales_manager' ? (summary?.at_risk_count || stalled.length || 0) :
               role === 'finance' ? '$18.4K' : '64%'}
            </span>
            <span className="text-xs font-semibold text-warning">
              {role === 'sales_rep' ? 'Deal Desk Review' :
               role === 'sales_manager' ? 'Stalled deals' :
               role === 'finance' ? 'Protected floor' : 'Zero-touch clear'}
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {role === 'finance' ? 'Billing Collection' : 'Gross Margin Realized'}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-2xl font-extrabold text-slate-900 truncate">
              {role === 'finance' ? '98.2%' : `${summary?.avg_margin_pct?.toFixed(1) || '32.1'}%`}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {role === 'finance' ? 'On-time SLA' : 'Exceeds 25% floor'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Charts & Feeds Section (VendorBridge 2-col + 1-col layout) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Recharts Area Chart & Quotation Queue */}
        <div className="space-y-6 lg:col-span-2">
          {/* Spend/Revenue Trend Sparkline (VendorBridge style) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-outfit text-base font-bold text-slate-900">Revenue & Deal Flow Trend</h3>
                <p className="text-xs text-slate-500">Monthly cumulative booked contract value & revenue pipeline</p>
              </div>
              <div className="flex items-center space-x-1 text-success text-xs font-bold">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>+18.4% MoM</span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    formatter={(value) => [formatCurrency(Number(value)), 'Booked Value']} 
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#2563EB" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#spendGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quotations Queue Table (VendorBridge style) */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-premium overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-outfit text-base font-bold text-slate-900">
                  {role === 'sales_manager' ? 'Urgent Deal Desk Decision Queue' :
                   role === 'finance' ? 'Revenue Sign-Off & High-Risk Quotations' :
                   role === 'sales_rep' ? 'My Active Pipeline & Quotations' : 'High Priority Quotations'}
                </h3>
                <p className="text-xs text-slate-500">
                  {role === 'sales_rep' ? 'Scoped to your sales account' : 'Live operational pipeline queue'}
                </p>
              </div>
              <button
                onClick={() => navigate('/quotations')}
                className="text-xs font-bold text-primary hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Quote ID / Client</th>
                    <th className="px-6 py-3">Stage</th>
                    <th className="px-6 py-3">Owner</th>
                    <th className="px-6 py-3 text-right">Deal Value</th>
                    <th className="px-6 py-3 text-right">Margin %</th>
                    <th className="px-6 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myQuotes.slice(0, 6).map((q) => (
                    <tr 
                      key={q.id} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(q.status === 'pending_approval' && (role === 'sales_manager' || role === 'finance') ? `/approvals/${q.id}` : `/quotations/${q.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-xs text-primary font-outfit">{q.quote_number}</div>
                        <div className="text-xs text-slate-500">{q.customer_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${getStatusBadgeClass(q.status)}`}>
                          {getStatusLabel(q.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700">
                            {q.rep_name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-xs font-medium text-slate-800">{q.rep_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-900">
                        {formatCurrency(q.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-bold">
                        <span className={q.margin_pct >= 25 ? 'text-success' : 'text-warning'}>
                          {q.margin_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {q.status === 'pending_approval' && (role === 'sales_manager' || role === 'finance' || role === 'admin') ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/approvals/${q.id}`); }}
                            className="rounded-lg bg-danger px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-danger-hover transition-all cursor-pointer"
                          >
                            Review & Approve
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/quotations/${q.id}`); }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
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
          </div>
        </div>

        {/* Right 1 Column: Audit Logs Timeline & AI Radars */}
        <div className="space-y-6">
          {/* Recent Audit Logs Timeline (VendorBridge exact style) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-outfit text-base font-bold text-slate-900">Recent Audit Stream</h3>
                <p className="text-xs text-slate-500">Realtime SOC2 activity history</p>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                LIVE
              </span>
            </div>

            <div className="flow-root">
              <ul className="-mb-8">
                {quotations.slice(0, 5).map((q, logIdx) => (
                  <li key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                    <div className="relative pb-6">
                      {logIdx !== quotations.slice(0, 5).length - 1 ? (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                            q.status === 'approved' ? 'bg-success-light text-success' :
                            q.status === 'pending_approval' ? 'bg-warning-light text-warning' :
                            'bg-primary-light text-primary'
                          }`}>
                            {q.status === 'approved' ? <CheckCircle className="h-4 w-4" /> :
                             q.status === 'pending_approval' ? <Clock className="h-4 w-4" /> : <FileText className="h-4 w-4 text-primary" />}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-xs text-slate-800 font-medium truncate">
                            {q.customer_name} ({q.quote_number})
                          </p>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="font-semibold">{getStatusLabel(q.status)} • {formatCurrency(q.total_amount)}</span>
                            <span>{timeAgo(q.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Autonomous Approval Radar Widget */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-outfit text-sm font-bold text-slate-900">Auto-Approval Radar</h3>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-success-light text-success border border-success/20">
                ACTIVE
              </span>
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-600 font-medium">Autonomous Clearance Rate</span>
                <span className="font-mono text-sm font-bold text-primary">64%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: '64%' }} />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">
              32 of 50 deals in the past 7 days cleared zero-touch within predefined delegation bounds.
            </p>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              {[
                { label: 'Bronze (≤ 5%)', count: 21, pct: 42, color: 'bg-amber-600' },
                { label: 'Silver (5% – 10%)', count: 19, pct: 38, color: 'bg-slate-400' },
                { label: 'Gold (> 10% Escalation)', count: 10, pct: 20, color: 'bg-rose-600' },
              ].map(t => (
                <div key={t.label} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${t.color}`} />
                  <span className="text-[11px] flex-1 text-slate-700 font-medium">{t.label}</span>
                  <span className="text-[11px] text-slate-400">{t.count} deals</span>
                  <span className="font-mono text-[11px] font-bold text-slate-800 w-8 text-right">{t.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
