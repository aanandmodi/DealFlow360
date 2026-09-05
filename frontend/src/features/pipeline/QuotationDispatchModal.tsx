import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  MessageCircle,
  Mail,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  FileText,
  Zap,
  Tag,
  Phone,
  CheckCircle2,
  AlertCircle,
  Share2,
} from 'lucide-react';
import {
  fetchDispatchPreview,
  executeDispatchQuotation,
  DispatchPreviewData,
} from '../../api/quotations';

interface QuotationDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotationId: number;
  quoteNumber: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  onSuccess?: () => void;
}

export function QuotationDispatchModal({
  isOpen,
  onClose,
  quotationId,
  quoteNumber,
  customerName,
  customerPhone,
  customerEmail,
  onSuccess,
}: QuotationDispatchModalProps) {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const [templateType, setTemplateType] = useState<'standard' | 'fast_track' | 'urgent'>('standard');
  const [phone, setPhone] = useState(customerPhone || '');
  const [email, setEmail] = useState(customerEmail || '');
  const [customNote, setCustomNote] = useState('');
  const [markAsSent, setMarkAsSent] = useState(true);

  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<DispatchPreviewData | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load preview data whenever quotation, template, note, or recipient inputs change
  useEffect(() => {
    if (!isOpen || !quotationId) return;

    let isMounted = true;
    setLoading(true);
    fetchDispatchPreview(quotationId, {
      template_type: templateType,
      custom_note: customNote,
      phone: phone,
      email: email,
    })
      .then((res) => {
        if (isMounted) {
          setPreviewData(res);
          if (!phone && res.customer_phone) setPhone(res.customer_phone);
          if (!email && res.customer_email) setEmail(res.customer_email);
        }
      })
      .catch((err) => {
        if (isMounted) console.error('Failed to fetch preview:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, quotationId, templateType, customNote, phone, email]);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDispatch = async (launchExternal: boolean = false, clientType: 'gmail' | 'native' = 'gmail') => {
    if (!quotationId) return;
    try {
      setDispatching(true);
      setErrorMsg(null);

      const recipient = activeTab === 'whatsapp' ? phone : email;
      const res = await executeDispatchQuotation(quotationId, {
        channel: activeTab,
        recipient: recipient,
        template_type: templateType,
        custom_note: customNote,
        mark_as_sent: markAsSent,
      });

      setSuccessMsg(res.message);

      if (launchExternal && previewData) {
        if (activeTab === 'whatsapp' && previewData.whatsapp.url) {
          window.open(previewData.whatsapp.url, '_blank');
        } else if (activeTab === 'email') {
          if (clientType === 'native' && previewData.email.mailto_url) {
            window.location.href = previewData.email.mailto_url;
          } else {
            // Open in Google Chrome / Gmail Web Composer in a new tab
            const gmailUrl = previewData.email.gmail_url || previewData.email.mailto_url;
            window.open(gmailUrl, '_blank');
          }
        }
      }

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err: any) {
      setErrorMsg(err?.detail || err?.message || 'Failed to dispatch quotation.');
    } finally {
      setDispatching(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Dispatch Quotation</h3>
                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {quoteNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Direct WhatsApp &amp; Email Dispatcher with Digital Proof and Audit Log
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channel Tab Selector */}
        <div className="grid grid-cols-2 p-1.5 mx-6 mt-5 bg-slate-100/90 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'whatsapp'
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            WhatsApp Dispatcher
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'email'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-4 h-4 text-blue-600" />
            Enterprise Email
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {/* Success / Error Banners */}
          {successMsg && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Template Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Message Template
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setTemplateType('standard')}
                className={`text-left p-3 rounded-xl border text-xs transition ${
                  templateType === 'standard'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-950 font-bold shadow-xs ring-1 ring-blue-600/30'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Standard Proposal</span>
                </div>
                <div className="text-[10px] text-slate-500 font-normal mt-1">Formal commercial summary</div>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType('fast_track')}
                className={`text-left p-3 rounded-xl border text-xs transition ${
                  templateType === 'fast_track'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-950 font-bold shadow-xs ring-1 ring-blue-600/30'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Fast-Track Executive</span>
                </div>
                <div className="text-[10px] text-slate-500 font-normal mt-1">1-click review &amp; confirm</div>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType('urgent')}
                className={`text-left p-3 rounded-xl border text-xs transition ${
                  templateType === 'urgent'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-950 font-bold shadow-xs ring-1 ring-blue-600/30'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Tier Discount Offer</span>
                </div>
                <div className="text-[10px] text-slate-500 font-normal mt-1">Special tier pricing terms</div>
              </button>
            </div>
          </div>

          {/* Recipient Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {activeTab === 'whatsapp' ? (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Recipient WhatsApp / Mobile No.
                </label>
                <div className="flex items-center w-full bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition">
                  <div className="flex items-center justify-center pl-3 pr-1 text-slate-400 select-none shrink-0">
                    <Phone className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="w-full text-xs text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
                    style={{ border: 'none', padding: '8px 10px', minHeight: '36px', height: '36px', boxShadow: 'none' }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Recipient Email Address
                </label>
                <div className="flex items-center w-full bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition">
                  <div className="flex items-center justify-center pl-3 pr-1 text-slate-400 select-none shrink-0">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@domain.com"
                    className="w-full text-xs text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
                    style={{ border: 'none', padding: '8px 10px', minHeight: '36px', height: '36px', boxShadow: 'none' }}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Custom Rep Note (Optional)
              </label>
              <div className="flex items-center w-full bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition">
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. Special 19% volume pricing applied for this order."
                  className="w-full text-xs text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
                  style={{ border: 'none', padding: '8px 12px', minHeight: '36px', height: '36px', boxShadow: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Live Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Live {activeTab === 'whatsapp' ? 'WhatsApp Message' : 'Email'} Preview
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    activeTab === 'whatsapp'
                      ? previewData?.whatsapp.text || ''
                      : previewData?.email.body_text || ''
                  )
                }
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Text'}
              </button>
            </div>

            {activeTab === 'whatsapp' ? (
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 text-xs text-slate-800 font-mono whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed select-all">
                {previewData?.whatsapp.text || 'Generating WhatsApp message preview...'}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 max-h-44 overflow-y-auto space-y-2">
                <div className="font-semibold text-slate-900 border-b border-slate-200 pb-1.5 text-xs">
                  <span className="text-slate-500 font-normal">Subject: </span>
                  {previewData?.email.subject}
                </div>
                <div className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {previewData?.email.body_text || 'Generating email content preview...'}
                </div>
              </div>
            )}
          </div>

          {/* Audit Ledger & Status Options - Clean Layout */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700 select-none">
              <input
                type="checkbox"
                checked={markAsSent}
                onChange={(e) => setMarkAsSent(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                style={{ minHeight: '16px', height: '16px', width: '16px', padding: 0, margin: 0 }}
              />
              <span className="leading-none text-xs text-slate-700">
                Mark quotation stage as <strong className="text-blue-700 font-semibold">Sent</strong> and record in audit log
              </span>
            </label>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-md shrink-0 self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Immutable Audit Trail</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={dispatching || loading}
              onClick={() => handleDispatch(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              Record Audit Dispatch
            </button>

            {activeTab === 'whatsapp' ? (
              <button
                type="button"
                disabled={dispatching || loading}
                onClick={() => handleDispatch(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <MessageCircle className="w-4 h-4" />
                {dispatching ? 'Launching...' : 'Launch WhatsApp'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Open in default desktop app (e.g. Outlook)"
                  disabled={dispatching || loading}
                  onClick={() => handleDispatch(true, 'native')}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Outlook / App
                </button>
                <button
                  type="button"
                  disabled={dispatching || loading}
                  onClick={() => handleDispatch(true, 'gmail')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  {dispatching ? 'Opening in Chrome...' : 'Open in Gmail (Chrome)'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
