import { Notice, Stat, downloadFile } from '../workspace/shared';
/**
 * Quotation Pipeline — Kanban board & table with KPI cards.
 * Styled in the exact visual design system of VendorBridge:
 * - Outfit bold headers and figures
 * - Rounded-xl shadow-premium cards
 * - Colored Kanban column headers & badges
 * - Micro-interactions and pill badges
 * - Native HTML5 Drag & Drop between stages with real-time API status transitions
 * - Bulk Customer CSV Import with template download & execution
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { quotationsApi, QuotationListItem, PipelineSummary } from '../../api/quotations';
import { formatCurrency, getStatusBadgeClass, getStatusLabel, timeAgo, cn } from '../../lib/utils';
import { ApiClient } from '../../api/client';
import {
  Plus, Search, LayoutGrid, Table, Filter, Clock, AlertTriangle,
  TrendingUp, Target, RefreshCw, Download, Sparkles, ExternalLink,
  DollarSign, CheckCircle2, SlidersHorizontal, PlusCircle,
  Upload, X, Check, FileSpreadsheet, ArrowRight, Layers, Lock
} from 'lucide-react';
import { BulkImportModal } from './BulkImportModal';

const kanbanColumns = [
  { key: 'draft', label: 'Draft & Config', colorClass: 'text-slate-700 bg-slate-100', borderClass: 'border-slate-200' },
  { key: 'pending_approval', label: 'Pending Approval', colorClass: 'text-amber-700 bg-amber-100', borderClass: 'border-amber-200/60' },
  { key: 'approved', label: 'Approved', colorClass: 'text-emerald-700 bg-emerald-100', borderClass: 'border-emerald-200/60' },
  { key: 'under_negotiation', label: 'Portal Active', colorClass: 'text-blue-700 bg-blue-100', borderClass: 'border-blue-200/60' },
  { key: 'sent', label: 'Sent to Customer', colorClass: 'text-purple-700 bg-purple-100', borderClass: 'border-purple-200/60' },
  ...['confirmed', 'fulfillment', 'invoiced', 'paid', 'rejected', 'cancelled'].map(key => ({
    key, label: getStatusLabel(key), colorClass: 'text-slate-700 bg-slate-100', borderClass: 'border-slate-200'
  })),
];

export function PipelinePage() {
  const [params] = useSearchParams();
  const [error, setError] = useState<unknown>(null);
  const [stage, setStage] = useState(params.get('status') || '');
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState(params.get('search') || '');
  const navigate = useNavigate();

  // Drag & drop state
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bulk Quotations/Deals Import modal state
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setSearchQuery(params.get('search') || '');
    setStage(params.get('status') || '');
  }, [params]);

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



  const handleDropOnColumn = async (e: React.DragEvent, targetCol: string, targetColLabel: string) => {
    e.preventDefault();
    setDragOverCol(null);
    setDraggingId(null);
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const { id, currentStatus, quoteNumber } = JSON.parse(raw);
      if (currentStatus === targetCol) return;

      const res = await ApiClient.post<any>(`/quotations/${id}/transition/`, {
        target_status: targetCol,
      });
      setToastMessage(`✓ ${quoteNumber}: ${res.message || `Moved to ${targetColLabel}`}`);
      setTimeout(() => setToastMessage(null), 4500);
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Transition not permitted for your role or deal policy.';
      setError(msg);
      setTimeout(() => setError(null), 6000);
    }
  };

  const quotesList = Array.isArray(quotations) ? quotations : [];
  const filteredQuotations = quotesList.filter(q => !stage || q.status === stage).filter(q =>
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
      <Notice error={error} />

      {/* Real-time Action Feedback Toast */}
      {toastMessage && (
        <div className="flex items-center space-x-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl shadow-xs animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h2 className="font-outfit text-xl md:text-2xl font-extrabold text-slate-900">Quotations</h2>
          <p className="text-xs text-slate-500">
            Track each deal from first draft to customer acceptance with live drag & drop.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{summary?.active_pipeline_count || quotesList.length} Active Ops</span>
          </div>

          <button
            onClick={() => setIsBulkOpen(true)}
            className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all cursor-pointer"
            title="Bulk import RFQs, deals, and quotations via CSV or Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            <span>Bulk Import</span>
          </button>

          <button
            onClick={() => navigate('/quotations/new')}
            className="flex items-center space-x-1.5 rounded-lg bg-primary hover:bg-primary-hover px-4 py-2 text-xs font-bold text-white shadow-xs transition-all cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Pipeline</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {formatCurrency(summary?.active_pipeline_value || 0)}
            </span>
            <span className="text-xs font-semibold text-slate-500">{summary?.active_pipeline_count || 0} Deals</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Review</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {summary?.pending_approvals || 0}
            </span>
            <span className="text-xs font-semibold text-amber-600">Review Gate</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Policy Outliers</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {summary?.at_risk_count || 0}
            </span>
            <span className="text-xs font-semibold text-rose-600">Risk &gt; 5%</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium hover:shadow-premium-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Closed & Won</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-outfit text-3xl font-extrabold text-slate-900">
              {formatCurrency(summary?.closed_won_value || 0)}
            </span>
            <span className="text-xs font-semibold text-emerald-600">{summary?.closed_won_count || 0} Won</span>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-premium space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by quote number (e.g. Q-1001) or customer name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <select
            aria-label="Filter by stage"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg bg-slate-50 px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All stages</option>
            {kanbanColumns.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-xs">
              <button
                className={cn(
                  'flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded transition-all cursor-pointer',
                  viewMode === 'kanban'
                    ? 'bg-white text-primary shadow-xs'
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
                    ? 'bg-white text-primary shadow-xs'
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-xs cursor-pointer transition-colors"
              title="Reload Data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase">Stage:</span>
          {[
            { key: '', label: 'All' },
            { key: 'draft', label: 'Drafts' },
            { key: 'pending_approval', label: 'Pending Review' },
            { key: 'approved', label: 'Approved' },
            { key: 'under_negotiation', label: 'Portal Active' },
            { key: 'sent', label: 'Sent to Customer' },
            { key: 'confirmed', label: 'Confirmed / Won' },
          ].map((chip) => (
            <button
              key={chip.key}
              onClick={() => setStage(chip.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                stage === chip.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Board Container */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View with Drag & Drop */
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 min-h-[520px]">
          {kanbanColumns.filter(c => stage ? c.key === stage : ['draft', 'pending_approval', 'approved', 'sent'].includes(c.key) || filteredQuotations.some(q => q.status === c.key)).map((col) => {
            const items = getColumnQuotations(col.key);
            const total = getColumnTotal(col.key);
            const isOver = dragOverCol === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverCol !== col.key) setDragOverCol(col.key);
                }}
                onDragLeave={() => {
                  if (dragOverCol === col.key) setDragOverCol(null);
                }}
                onDrop={(e) => handleDropOnColumn(e, col.key, col.label)}
                className={`flex flex-col w-72 shrink-0 rounded-xl border bg-slate-50 shadow-sm transition-all ${
                  isOver
                    ? 'border-primary ring-2 ring-primary/40 bg-blue-50/60 shadow-md scale-[1.01]'
                    : `border-slate-200 ${col.borderClass}`
                }`}
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
                  {items.map((q) => {
                    const isDragging = draggingId === q.id;
                    const isLocked = ['confirmed', 'fulfillment', 'invoiced', 'paid', 'cancelled'].includes(q.status);
                    return (
                      <div
                        key={q.id}
                        draggable={!isLocked}
                        onDragStart={(e) => {
                          if (isLocked) return;
                          e.dataTransfer.setData('text/plain', JSON.stringify({ id: q.id, currentStatus: q.status, quoteNumber: q.quote_number }));
                          setDraggingId(q.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCol(null);
                        }}
                        onClick={() => navigate(`/quotations/${q.id}`)}
                        className={`p-4 rounded-xl border bg-white shadow-xs hover:shadow-md transition-all space-y-3 border-slate-200 hover:border-slate-300 relative overflow-hidden group select-none ${
                          isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                        } ${isDragging ? 'opacity-40 scale-95 ring-2 ring-primary rotate-1' : ''}`}
                        title={isLocked ? "Finalized order (Locked) — click to inspect details" : "Drag to transition stages or click to edit"}
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
                            <div className="flex items-center gap-1.5">
                              {isLocked && (
                                <span className="flex items-center text-[10px] text-slate-400 font-bold" title="Order finalized and locked">
                                  <Lock className="w-2.5 h-2.5 mr-0.5" />
                                </span>
                              )}
                              <span className={`badge ${getStatusBadgeClass(q.status)}`}>
                                {getStatusLabel(q.status)}
                              </span>
                            </div>
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
                    );
                  })}

                  {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                      <span className="text-[11px] font-semibold">Drop deal here</span>
                    </div>
                  )}

                  {col.key === 'draft' && (
                    <button
                      onClick={() => navigate('/quotations/new')}
                      className="flex w-full items-center justify-center space-x-1.5 rounded-xl border border-dashed border-slate-300 py-3 text-xs font-semibold text-slate-500 hover:border-primary hover:text-primary hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New Draft</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
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

      <div className="flex justify-between items-center border-t border-slate-200 pt-4">
        <span className="muted">{filteredQuotations.length} matching quotations · INR</span>
        <button className="btn btn-secondary" onClick={() => downloadFile('/reports/?export=csv', 'dealflow-pipeline.csv').catch(setError)}>
          Export portfolio CSV
        </button>
      </div>

      {/* Smart Bulk Import Engine Modal */}
      <BulkImportModal
        isOpen={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        onSuccess={() => {
          loadData();
          setToastMessage('✓ Bulk import completed successfully. Pipeline deals updated.');
          setTimeout(() => setToastMessage(null), 5000);
        }}
      />
    </div>
  );
}
