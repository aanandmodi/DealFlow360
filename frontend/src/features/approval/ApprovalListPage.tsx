/**
 * Approval List Page — Governance & Discount Approval Queue.
 * Styled in the exact visual design system of VendorBridge:
 * - Outfit bold headers and figures
 * - shadow-premium KPI cards with colored icon chips
 * - Clean tabular queue with status pills
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchQuotations } from '../../api/quotations';
import { formatCurrency, formatDate, getRiskBadgeClass, getRiskLabel } from '../../lib/utils';
import { ShieldCheck, Clock, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

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

  const managerOnlyCount = pending.filter(q => q.required_approval_level === 'manager').length;
  const dualApprovalCount = pending.filter(q => q.required_approval_level === 'manager_finance').length;
  const totalPipelineValue = pending.reduce((s, q) => s + parseFloat(q.total || '0'), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h2 className="font-outfit text-xl md:text-2xl font-extrabold text-slate-900">
            Discount & Governance Approval Queue
          </h2>
          <p className="text-xs text-slate-500">
            Review quotations flagged by the autonomous risk score engine requiring deal desk sign-off
          </p>
        </div>
        <div className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <Clock className="h-4 w-4 text-warning" />
          <span className="font-outfit text-base font-bold text-slate-900">{pending.length}</span>
          <span className="text-xs text-slate-500 font-medium">Awaiting Review</span>
        </div>
      </div>

      {/* Summary KPI Cards (VendorBridge exact style) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 1: Manager Only</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-warning">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">{managerOnlyCount}</span>
            <span className="text-xs font-semibold text-slate-500">Standard Overages</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 2: Manager + Finance</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-danger">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">{dualApprovalCount}</span>
            <span className="text-xs font-semibold text-danger">High-Risk Pathway</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Value Under Review</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-success">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-2xl font-extrabold text-slate-900 truncate">
              {formatCurrency(totalPipelineValue)}
            </span>
            <span className="text-xs font-semibold text-success">At Risk Deals</span>
          </div>
        </div>
      </div>

      {/* Pending Approval Table (VendorBridge style) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-premium overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-outfit text-base font-bold text-slate-900">Pending Decision Queue</h3>
            <p className="text-xs text-slate-500">Quotations requiring operational validation</p>
          </div>
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-50 text-warning border border-amber-200">
            {pending.length} Urgent
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Quote</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Sales Rep</th>
                <th className="px-6 py-3 text-right">Value</th>
                <th className="px-6 py-3 text-center">Risk Score</th>
                <th className="px-6 py-3 text-center">Required Level</th>
                <th className="px-6 py-3 text-left">Submitted</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-xs text-slate-400">
                    Loading pending approval queue...
                  </td>
                </tr>
              ) : pending.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-xs text-slate-400">
                    <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                    All clear — zero quotations pending approval!
                  </td>
                </tr>
              ) : pending.map(q => (
                <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link to={`/approvals/${q.id}`} className="font-outfit font-bold text-xs text-primary hover:underline">
                      Q-{q.id}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-semibold text-slate-900">{q.customer_name}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{q.customer_tier} tier</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-800">
                    {q.sales_rep_name}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-900">
                    {formatCurrency(q.total || '0')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`badge ${getRiskBadgeClass(q.blended_risk_score)}`}>
                      {getRiskLabel(q.blended_risk_score)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${
                      q.required_approval_level === 'manager_finance'
                        ? 'bg-rose-50 text-danger border-rose-200'
                        : 'bg-amber-50 text-warning border-amber-200'
                    }`}>
                      {q.required_approval_level === 'manager_finance' ? 'Mgr + Finance' : 'Manager Only'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {formatDate(q.updated_at)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link
                      to={`/approvals/${q.id}`}
                      className="rounded-lg bg-primary hover:bg-primary-hover px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recently Actioned Table (VendorBridge style) */}
      {recentlyActioned.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-premium overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-outfit text-sm font-bold text-slate-900">Recently Actioned History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Quote</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Decision</th>
                  <th className="px-6 py-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentlyActioned.map(q => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-xs font-bold">
                      <Link to={`/quotations/${q.id}`} className="text-primary hover:underline font-outfit">
                        Q-{q.id}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-900">{q.customer_name}</td>
                    <td className="px-6 py-3">
                      <span className={`badge ${q.status === 'approved' ? 'badge-success' : 'badge-danger'}`}>
                        {q.status_display || q.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-xs font-bold text-slate-900">
                      {formatCurrency(q.total || '0')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
