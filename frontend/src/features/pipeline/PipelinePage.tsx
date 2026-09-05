import {Notice,Stat,downloadFile} from '../workspace/shared';
/**
 * Quotation Pipeline — Kanban board & table with KPI cards.
 * Styled in the exact visual design system of VendorBridge:
 * - Outfit bold headers and figures
 * - Rounded-xl shadow-premium cards
 * - Colored Kanban column headers & badges
 * - Micro-interactions and pill badges
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { quotationsApi, QuotationListItem, PipelineSummary } from '../../api/quotations';
import { formatCurrency, getStatusBadgeClass, getStatusLabel, timeAgo, cn } from '../../lib/utils';
import {
  Plus, Search, LayoutGrid, Table, Filter, Clock, AlertTriangle,
  TrendingUp, Target, RefreshCw, Download, Sparkles, ExternalLink,
  DollarSign, CheckCircle2, SlidersHorizontal, PlusCircle
} from 'lucide-react';

const kanbanColumns = [
  { key: 'draft', label: 'Draft & Config', colorClass: 'text-slate-700 bg-slate-100', borderClass: 'border-slate-200' },
  { key: 'pending_approval', label: 'Pending Approval', colorClass: 'text-amber-700 bg-amber-100', borderClass: 'border-amber-200/60' },
  { key: 'approved', label: 'Approved', colorClass: 'text-emerald-700 bg-emerald-100', borderClass: 'border-emerald-200/60' },
  { key: 'under_negotiation', label: 'Portal Active', colorClass: 'text-blue-700 bg-blue-100', borderClass: 'border-blue-200/60' },
  { key: 'sent', label: 'Sent to Customer', colorClass: 'text-purple-700 bg-purple-100', borderClass: 'border-purple-200/60' },
  ...['confirmed','fulfillment','invoiced','paid','rejected','cancelled'].map(key=>({key,label:getStatusLabel(key),colorClass:'text-slate-700 bg-slate-100',borderClass:'border-slate-200'})),
];

export function PipelinePage() {
  const [params]=useSearchParams();
  const [error,setError]=useState<unknown>(null);
  const [stage,setStage]=useState(params.get('status')||'');
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState(params.get('search')||'');
  const navigate = useNavigate();

  useEffect(() => {loadData();const timer=setInterval(loadData,30000);return()=>clearInterval(timer);}, []);
  useEffect(()=>{setSearchQuery(params.get('search')||'');setStage(params.get('status')||'');},[params]);

  const loadData = async () => {
    setError(null);
    try {
      const [q, s] = await Promise.all([
        quotationsApi.list(),
        quotationsApi.pipelineSummary(),
      ]);
      setQuotations(q);
      setSummary(s);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const quotesList = Array.isArray(quotations) ? quotations : [];
  const filteredQuotations = quotesList.filter(q=>!stage||q.status===stage).filter(q =>
    !searchQuery ||
    (q.quote_number && q.quote_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (q.customer_name && q.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getColumnQuotations = (statusKey: string) =>
    filteredQuotations.filter(q => q.status === statusKey);

  const getColumnTotal = (statusKey: string) =>
    getColumnQuotations(statusKey).reduce((sum, q) => sum + (typeof q.total_amount === 'number' ? q.total_amount : parseFloat(q.total_amount || '0')), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Notice error={error}/>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h2 className="font-outfit text-xl md:text-2xl font-extrabold text-slate-900">Quotations</h2>
          <p className="text-xs text-slate-500">
            Track each deal from first draft to customer acceptance.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{summary?.active_pipeline_count || quotesList.length} Active Ops</span>
          </div>
          <button
            onClick={() => navigate('/quotations/new')}
            className="flex items-center space-x-2 rounded-lg bg-primary hover:bg-primary-hover px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      <div className="metrics-grid"><Stat label="Active pipeline" value={formatCurrency(summary?.active_pipeline_value||0)} note="Open quotations · net value"/><Stat label="Pending decisions" value={quotesList.filter(q=>q.status==='pending_approval').length} note="Awaiting pricing approval"/><Stat label="Average margin" value={`${quotesList.length?(quotesList.reduce((s,q)=>s+Number(q.margin_pct),0)/quotesList.length).toFixed(1):0}%`} note="Across the current deal portfolio"/><Stat label="Confirmed bookings" value={formatCurrency(summary?.closed_won_value||0)} note={`${summary?.closed_won_count||0} accepted orders`}/></div>
      {/* Filter Bar (VendorBridge style) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-premium flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Filter by quote number, customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>

        <select aria-label="Filter quotation stage" value={stage} onChange={e=>setStage(e.target.value)}><option value="">All stages</option>{kanbanColumns.map(s=><option value={s.key} key={s.key}>{s.label}</option>)}</select>
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
            <button
              className={cn(
                'flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded transition-all cursor-pointer',
                viewMode === 'kanban'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Kanban</span>
            </button>
            <button
              className={cn(
                'flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded transition-all cursor-pointer',
                viewMode === 'table'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              onClick={() => setViewMode('table')}
            >
              <Table className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={loadData}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer"
            title="Reload Data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Board Container */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View (VendorBridge exact board style) */
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 min-h-[520px]">
          {kanbanColumns.filter(c=>stage?c.key===stage:['draft','pending_approval','approved','sent'].includes(c.key)||filteredQuotations.some(q=>q.status===c.key)).map((col) => {
            const items = getColumnQuotations(col.key);
            const total = getColumnTotal(col.key);
            return (
              <div
                key={col.key}
                className={`flex flex-col w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-50 shadow-sm ${col.borderClass}`}
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-slate-200 bg-white rounded-t-xl flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-outfit font-black text-xs text-slate-800 tracking-wide uppercase">
                      {col.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${col.colorClass}`}>
                      {items.length}
                    </span>
                  </div>
                  <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <DollarSign className="h-3 w-3 shrink-0 mr-0.5 text-slate-400" />
                    <span>Est: {formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Column Cards Dropzone */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[420px]">
                  {items.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => navigate(`/quotations/${q.id}`)}
                      className="p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all space-y-3 border-slate-200 hover:border-slate-300 relative overflow-hidden group cursor-pointer"
                    >
                      {/* Over policy alert stripe */}
                      {Number(q.blended_risk_score || 0) > 5 && (
                        <div className="absolute top-0 right-0 w-2 h-full bg-danger" title="Risk Alert" />
                      )}

                      <div className="space-y-1 pr-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-primary font-outfit">
                            {q.quote_number}
                          </span>
                          <span className={`badge ${getStatusBadgeClass(q.status)}`}>
                            {getStatusLabel(q.status)}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
                          {q.customer_name}
                        </h4>
                        <p className="text-[10px] text-slate-400 line-clamp-1">
                          {q.customer_company || 'Enterprise Account'}
                        </p>
                      </div>

                      {/* Value & Margin */}
                      <div className="border-t border-slate-100 pt-2.5 flex items-baseline justify-between text-[11px]">
                        <span className="font-outfit text-sm font-extrabold text-slate-900">
                          {formatCurrency(q.total_amount)}
                        </span>
                        <span className={`text-[10px] font-bold font-mono ${q.margin_pct >= 25 ? 'text-success' : 'text-warning'}`}>
                          Margin: {q.margin_pct.toFixed(1)}%
                        </span>
                      </div>

                      {/* Footer Info */}
                      <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between text-[10px] text-slate-500">
                        <div className="flex items-center space-x-1.5">
                          <div className="h-5 w-5 rounded-full bg-slate-200 text-[8px] font-bold text-slate-700 flex items-center justify-center">
                            {q.rep_name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="truncate max-w-[80px]">{q.rep_name}</span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {q.status === 'under_negotiation' && (
                            <a
                              href={`/quotations/${q.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[9px] font-bold text-primary hover:underline flex items-center space-x-0.5 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200"
                              title="Customer Portal"
                            >
                              <span>Portal</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                          <span className="text-slate-400">{timeAgo(q.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                      <span className="text-[11px] font-semibold">Column is empty</span>
                    </div>
                  )}

                  {col.key === 'draft' && (
                    <button
                      onClick={() => navigate('/quotations/new')}
                      className="flex w-full items-center justify-center space-x-1.5 rounded-xl border border-dashed border-slate-300 py-3 text-xs font-semibold text-slate-500 hover:border-primary hover:text-primary hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Deal Card</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View (VendorBridge style) */
        <div className="rounded-xl border border-slate-200 bg-white shadow-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Quote / Client</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Owner</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3 text-right">Margin</th>
                  <th className="px-6 py-3 text-right">Risk</th>
                  <th className="px-6 py-3 text-left">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotations.map((q) => (
                  <tr
                    key={q.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/quotations/${q.id}`)}
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
                    <td className="px-6 py-4 text-xs font-medium text-slate-800">{q.rep_name}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-900">
                      {formatCurrency(Number(q.total_amount || 0))}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs font-bold">
                      <span className={Number(q.margin_pct || 0) >= 25 ? 'text-success' : 'text-danger'}>
                        {Number(q.margin_pct || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs font-medium text-slate-700">
                      {Number(q.blended_risk_score || 0).toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {timeAgo(q.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center border-t border-slate-200 pt-4"><span className="muted">{filteredQuotations.length} matching quotations · INR</span><button className="btn btn-secondary" onClick={()=>downloadFile('/reports/?export=csv','dealflow-pipeline.csv').catch(setError)}>Export portfolio CSV</button></div>
    </div>
  );
}
