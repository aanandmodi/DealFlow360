import {downloadFile,Notice} from '../workspace/shared';
/**
 * Quotation List Page — Tabular Deals Pipeline.
 * Styled in the exact visual design system of VendorBridge:
 * - Outfit font for headers
 * - shadow-premium card container
 * - Modern pill filters
 * - Clean borders, hover effects, and badge chips
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchQuotations } from '../../api/quotations';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../lib/utils';
import { PlusCircle, Filter, ExternalLink, RefreshCw, Eye, FileDown, FileSpreadsheet, Share2 } from 'lucide-react';
import { useState } from 'react';
import { BulkImportModal } from './BulkImportModal';
import { QuotationDispatchModal } from './QuotationDispatchModal';

export function QuotationListPage() {
  const [error, setError] = useState<unknown>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [dispatchQuote, setDispatchQuote] = useState<any | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['quotations', statusFilter],
    queryFn: () => fetchQuotations(statusFilter ? { status: statusFilter } : undefined),
  });

  const quotations = data?.results || [];

  const handleDownloadPdf = (id: number, number?: string) =>
    downloadFile(`/quotations/${id}/pdf/`, `${number || id}.pdf`).catch((e) => setError(e));

  return (
    <div className="space-y-6 animate-fade-in">
      <Notice error={error} />
      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        onSuccess={() => refetch()}
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h2 className="font-outfit text-xl md:text-2xl font-extrabold text-slate-900">
            Quotations & Deals Register
          </h2>
          <p className="text-xs text-slate-500">
            Audit register of enterprise quotations, discount compliance, and customer approval statuses
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => refetch()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsBulkOpen(true)}
            className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            <span>Bulk Import</span>
          </button>
          <Link
            to="/quotations/new"
            className="flex items-center space-x-2 rounded-lg bg-primary hover:bg-primary-hover px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Quotation</span>
          </Link>
        </div>
      </div>

      {/* Filters (VendorBridge style) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-premium flex flex-wrap items-center gap-2">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 mr-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span>Filter Status:</span>
        </div>
        {['', 'draft', 'pending_approval', 'approved', 'confirmed', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              statusFilter === status
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {status === '' ? 'All Statuses' : status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Table (VendorBridge style) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Quote ID</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Sales Rep</th>
                <th className="px-6 py-3 text-right">Value</th>
                <th className="px-6 py-3 text-right">Risk Score</th>
                <th className="px-6 py-3 text-left">Created</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-xs text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                    Loading quotations data...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-xs text-slate-400">
                    No quotations found matching filter.
                  </td>
                </tr>
              ) : quotations.map(q => (
                <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link to={`/quotations/${q.id}`} className="font-outfit font-bold text-xs text-primary hover:underline">
                      Q-{q.id}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-900">{q.customer_name}</span>
                      {q.customer_tier && (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                          q.customer_tier === 'gold' ? 'bg-amber-50 text-warning border-amber-200' :
                          q.customer_tier === 'silver' ? 'bg-slate-100 text-slate-600 border-slate-300' :
                          'bg-blue-50 text-primary border-blue-200'
                        }`}>
                          {q.customer_tier}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${getStatusBadgeClass(q.status)}`}>
                      {q.status_display || q.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-800">
                    {q.sales_rep_name}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-900">
                    {formatCurrency(q.total || '0')}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs">
                    {parseFloat(q.blended_risk_score) > 0 ? (
                      <span className="font-bold text-danger">
                        {parseFloat(q.blended_risk_score).toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {formatDate(q.created_at)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Link
                        to={q.status === 'pending_approval' ? `/approvals/${q.id}` : `/quotations/${q.id}`}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
                      >
                        {q.status === 'pending_approval' ? 'Review' : 'Open'}
                      </Link>
                      <button
                        onClick={() => setDispatchQuote(q)}
                        title="Dispatch via WhatsApp / Email"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-all cursor-pointer shadow-2xs"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(q.id, q.quote_number)}
                        title="Download Quotation PDF"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-slate-50 transition-all cursor-pointer"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={`/portal/quotations/${(q as any).portal_token || q.quote_number || q.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Customer Portal"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-primary hover:bg-slate-50 transition-all"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Modal */}
      {dispatchQuote && (
        <QuotationDispatchModal
          isOpen={!!dispatchQuote}
          onClose={() => setDispatchQuote(null)}
          quotationId={dispatchQuote.id}
          quoteNumber={dispatchQuote.quote_number || `Q-${dispatchQuote.id}`}
          customerName={dispatchQuote.customer_name}
          customerPhone={(dispatchQuote as any).customer_phone}
          customerEmail={(dispatchQuote as any).customer_email}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

