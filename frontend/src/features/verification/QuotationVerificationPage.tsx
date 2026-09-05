import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Calendar,
  Building2,
  User,
  CreditCard,
  Hash,
  ArrowRight,
  Sparkles,
  Lock,
  Layers,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  Share2,
  MessageCircle,
} from 'lucide-react';
import { fetchVerificationData, downloadQuotationPdf } from '../../api/quotations';
import { QuotationDispatchModal } from '../pipeline/QuotationDispatchModal';

export function QuotationVerificationPage() {
  const { quoteNumber } = useParams<{ quoteNumber: string }>();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';
  const token = searchParams.get('token') || '';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showCert, setShowCert] = useState(false);
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);


  useEffect(() => {
    if (!quoteNumber) {
      setError('No quotation number provided in the verification URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchVerificationData(quoteNumber, sig, token)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        setError(err?.detail || err?.message || 'Failed to verify quotation authenticity against live database.');
      })
      .finally(() => setLoading(false));
  }, [quoteNumber, sig, token]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = async () => {
    if (!data?.quotation_id) return;
    try {
      setDownloading(true);
      await downloadQuotationPdf(data.quotation_id, data.quote_number, sig || data.signature_hash, token);
    } catch (err) {
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800 p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center animate-pulse">
              <ShieldCheck className="w-7 h-7 text-blue-600" />
            </div>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Verifying Cryptographic Ledger</h2>
            <p className="text-xs text-slate-500 mt-1">Cross-referencing HMAC-SHA256 signature with DealFlow360 immutable records...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800 p-4">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4 text-rose-600">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-rose-900 mb-2">Verification Failed</h2>
          <p className="text-xs text-slate-600 mb-6">{error || 'The requested quotation could not be verified or has been tampered with.'}</p>
          <div className="flex flex-col gap-2">
            <Link to="/login" className="btn btn-primary w-full py-2 text-xs font-semibold">
              Return to DealFlow360 Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isTampered = data.tamper_status === 'TAMPERED_OR_INVALID';
  const statusColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 border-slate-300',
    pending_approval: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    sent: 'bg-blue-50 text-blue-800 border-blue-200',
    under_negotiation: 'bg-purple-50 text-purple-800 border-purple-200',
    confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    fulfillment: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    invoiced: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-blue-100 selection:text-blue-900 pb-16 font-sans">
      {/* Top Banner Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-slate-900 flex items-center gap-2">
                DealFlow<span className="text-slate-400 font-normal">360</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Live Trust Engine
                </span>
              </span>
              <p className="text-[11px] text-slate-500 hidden sm:block">Cryptographic Verification &amp; Offline Proof Ledger</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDispatchOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 border border-emerald-300 shadow-xs transition"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-600" />
              Dispatch / Share
            </button>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200 shadow-xs transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              {copied ? 'Link Copied' : 'Copy Link'}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Verification Status Header Card */}
        <div
          className={`relative overflow-hidden rounded-2xl border p-6 sm:p-7 mb-6 shadow-sm ${
            isTampered
              ? 'bg-rose-50/90 border-rose-200'
              : 'bg-white border-slate-200 border-l-4 border-l-emerald-500'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
            <div className="flex items-start sm:items-center gap-4">
              <div
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                  isTampered
                    ? 'bg-rose-100 text-rose-600 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                }`}
              >
                {isTampered ? <ShieldAlert className="w-6 h-6 sm:w-7 sm:h-7" /> : <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      isTampered
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {isTampered ? 'Signature Mismatch (Tampered)' : 'Authentic Document Verified'}
                  </span>
                  <span className="text-xs text-slate-500 hidden sm:inline">· 100% Match with PostgreSQL Record</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5 flex items-center gap-2">
                  Quotation <span className="font-mono text-blue-600 font-bold">{data.quote_number}</span>
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Issued to <strong className="text-slate-900 font-semibold">{data.customer_name}</strong> ({data.customer_company || 'Direct Client'}) on{' '}
                  {new Date(data.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Live Stage:</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusColors[data.status] || 'bg-slate-100 text-slate-700'}`}>
                  {data.status_display}
                </span>
              </div>
              {data.portal_url && (
                <Link
                  to={`/portal/quotations/${data.portal_token}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline mt-1"
                >
                  Open Negotiation Portal <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Grid: Details & Commercials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {/* Customer & Rep Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> Client Profile
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Customer</span>
                <span className="font-semibold text-slate-900">{data.customer_name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Company</span>
                <span className="font-medium text-slate-800">{data.customer_company || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Client Tier</span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                  {data.customer_tier}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Account Rep</span>
                <span className="font-medium text-slate-800">{data.rep_name}</span>
              </div>
            </div>
          </div>

          {/* Payment & Terms */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" /> Commercial Terms
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Payment Terms</span>
                <span className="font-semibold text-slate-900">{data.payment_terms}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Currency</span>
                <span className="font-medium text-slate-800">Indian Rupee (₹ · INR)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Validity Expiry</span>
                <span className="font-medium text-slate-800">
                  {data.valid_until ? new Date(data.valid_until).toLocaleDateString('en-IN') : '30 Days from Issue'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">GST Compliance</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] border border-emerald-200/70">
                  Registered / Compliant
                </span>
              </div>
            </div>
          </div>

          {/* Financial Totals Highlight */}
          <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" /> Financial Value
              </h3>
              <div className="space-y-2 text-xs mb-3">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Catalog Value</span>
                  <span className="font-mono">₹ {data.gross_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Volume / Tier Discount</span>
                  <span className="font-mono">- ₹ {data.total_discount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST Output Tax</span>
                  <span className="font-mono">₹ {data.tax_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-blue-200 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-700">Grand Total</span>
              <span className="text-2xl font-bold font-mono text-blue-700">
                ₹ {data.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-6 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" /> Line Items Specification
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
              {data.lines?.length || 0} product(s)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Item &amp; SKU</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Unit Rate (₹)</th>
                  <th className="py-3 px-4 text-right">Discount</th>
                  <th className="py-3 px-4 text-right">GST %</th>
                  <th className="py-3 px-4 text-right">Net Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {data.lines?.map((line: any) => (
                  <tr key={line.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{line.product_name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        {line.sku && <span className="font-mono text-slate-400">SKU: {line.sku}</span>}
                        {line.variant && <span className="text-slate-600">({line.variant})</span>}
                        {line.is_subscription && (
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 font-semibold px-1.5 py-0.2 rounded text-[10px]">
                            Recurring Plan
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-700">{line.qty}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                      ₹ {line.unit_price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-700">
                      {line.discount_pct > 0 ? `${line.discount_pct}%` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-500">{line.tax_pct}%</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ₹ {line.line_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cryptographic Security Details Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setShowCert(!showCert)}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Cryptographic Integrity Seal
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    HMAC-SHA256
                  </span>
                </h4>
                <p className="text-xs text-slate-500">Guaranteed by DealFlow360 Autonomous Verification Engine</p>
              </div>
            </div>
            <button className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline">
              {showCert ? 'Hide Technical Certificate' : 'Show Technical Certificate'}
            </button>
          </div>

          {showCert && (
            <div className="mt-4 pt-4 border-t border-slate-200 text-xs space-y-3 font-mono">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-sans font-bold tracking-wider mb-1">
                  Document SHA-256 Checksum
                </span>
                <span className="text-emerald-800 text-[11px] break-all select-all font-mono font-semibold">
                  {data.signature_hash}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-sans">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Issuing Authority</span>
                  <span className="text-slate-800 font-medium">{data.security_metadata?.issuer}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-sans">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Corporate Tax ID</span>
                  <span className="text-slate-800 font-medium">GSTIN: {data.security_metadata?.gstin}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 text-center text-xs text-slate-400">
        DealFlow360 Autonomous Verification Engine · Enterprise Cryptographic Trust Network
      </footer>

      {/* Quotation Dispatch Modal */}
      {data?.quotation_id && (
        <QuotationDispatchModal
          isOpen={isDispatchOpen}
          onClose={() => setIsDispatchOpen(false)}
          quotationId={data.quotation_id}
          quoteNumber={data.quote_number}
          customerName={data.customer_name}
          customerPhone={data.customer_phone}
          customerEmail={data.customer_email}
          onSuccess={() => {
            // refresh data if needed
          }}
        />
      )}
    </div>
  );
}

