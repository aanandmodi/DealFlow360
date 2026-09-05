import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { bulkApi, ValidatedBulkRow, BulkValidationResponse, BulkCommitResponse } from '../../api/bulk';
import { formatCurrency } from '../../lib/utils';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  RefreshCw,
  FileText,
  Sparkles,
  ChevronRight,
  Layers,
  FileCheck,
  Check,
} from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  targetQuotationId?: number;
  targetQuotationNumber?: string;
}

export function BulkImportModal({
  isOpen,
  onClose,
  onSuccess,
  targetQuotationId,
  targetQuotationNumber,
}: BulkImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [validationData, setValidationData] = useState<BulkValidationResponse | null>(null);
  const [commitResult, setCommitResult] = useState<BulkCommitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleReset();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('upload');
    setCsvText('');
    setFileName('');
    setValidationData(null);
    setCommitResult(null);
    setError(null);
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setCsvText(content);
    };
    reader.onerror = () => {
      setError('Failed to read selected file. Please ensure it is a valid CSV or text file.');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleLoadDemo = () => {
    const demoCsv = `customer_name,customer_email,sku,product_name,quantity,unit_price,discount_pct,payment_terms,notes
Aravali Healthcare,orders@aravalihealthcare.com,IN-LAP14,BusinessBook Pro 14,4,84900,8,Net 30 Days,Hospital clinic workstations
Aravali Healthcare,orders@aravalihealthcare.com,IN-MON27,StudioView 27 Monitor,4,24500,5,Net 30 Days,Radiology dual monitor setup
Malabar Logistics,billing@malabarlogistics.com,IN-NET48,Enterprise Network Switch,2,62500,10,Net 60 Days,Hub datacenter networking
Malabar Logistics,billing@malabarlogistics.com,IN-DEPLOY,On-site Deployment,2,12500,0,Net 60 Days,On-site logistics engineer setup
Narmada Technologies,procurement@narmada.com,IN-LAP14,BusinessBook Pro 14,8,84900,12,Due on Receipt,Software development laptops
Sahyadri Manufacturing,purchase@sahyadrimfg.com,IN-NET48,Enterprise Network Switch,3,62500,15,Net 30 Days,Factory IoT switch setup
Kaveri Digital Labs,admin@kaveridigital.in,IN-CLOUD,CloudSuite Business / seat,15,1800,6,Net 30 Days,Cloud suite seat expansion
Konkan Retail Systems,supply@konkanretail.com,IN-MON27,StudioView 27 Monitor,6,24500,8,Net 30 Days,Retail POS back-office monitors
Vindhya Analytics,ops@vindhyaanalytics.com,IN-DEPLOY,On-site Deployment,1,12500,5,Net 60 Days,Data engineering setup
Deccan Learning Co.,admin@deccanlearning.org,IN-SECURE,SecureDesk Endpoint / seat,20,650,0,Due on Receipt,Student lab security endpoints`;
    setCsvText(demoCsv);
    setFileName('database_matched_bulk_rfq.csv');
    setInputMode('paste');
    setError(null);
  };

  const handleValidate = async () => {
    if (!csvText.trim()) {
      setError('Please select a CSV file or paste tabular data.');
      return;
    }
    setError(null);
    setIsValidating(true);
    try {
      const res = await bulkApi.validate(csvText);
      setValidationData(res);
      setStep('preview');
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to parse and validate CSV payload.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!validationData || !validationData.rows) return;
    setError(null);
    setIsCommitting(true);
    try {
      const res = await bulkApi.commit(validationData.rows, targetQuotationId);
      setCommitResult(res);
      setStep('success');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to commit bulk quotations.');
    } finally {
      setIsCommitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
      onClick={() => {
        handleReset();
        onClose();
      }}
    >
      <div
        className={`relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full ${
          step === 'preview' ? 'max-w-5xl' : 'max-w-2xl'
        } overflow-hidden flex flex-col max-h-[90vh] my-auto transition-all`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-outfit text-base font-extrabold text-slate-900 tracking-tight">
                  {targetQuotationId
                    ? `Bulk Import Items → ${targetQuotationNumber || `Q-${targetQuotationId}`}`
                    : 'Smart Bulk Quotation Importer'}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  Pre-flight Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {targetQuotationId
                  ? 'Inject multi-line items with instant catalog match and stock checks'
                  : 'Import multi-customer RFQs and quotations in bulk from CSV/Excel'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => bulkApi.downloadTemplate()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Download Sample CSV Template"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>CSV Template</span>
            </button>
            <button
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 text-rose-800 flex items-center gap-2 text-xs font-medium shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* BODY BY STEP */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {/* STEP 1: UPLOAD & INPUT */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Input Mode Switch & Demo Loader */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setInputMode('file')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      inputMode === 'file'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Upload CSV File
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('paste')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      inputMode === 'paste'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Paste Raw CSV
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadDemo}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Load Sample RFQ Data</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              {inputMode === 'file' ? (
                <div
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-white cursor-pointer ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                      : 'border-slate-300 hover:border-blue-400'
                  }`}
                >
                  <input
                    type="file"
                    id="bulk-csv-upload"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="bulk-csv-upload"
                    className="flex flex-col items-center justify-center cursor-pointer space-y-3"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {fileName ? fileName : 'Click to select or drag & drop CSV file'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Accepts standard CSV with columns: customer_name, sku, quantity, unit_price, discount_pct
                      </p>
                    </div>

                    {!fileName ? (
                      <span className="inline-flex items-center px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-xs transition-colors">
                        Browse Files
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          File Loaded ({Math.max(0, csvText.split('\n').filter(Boolean).length - 1)} rows detected)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFileName('');
                            setCsvText('');
                          }}
                          className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-medium transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 block">
                      Paste CSV or Tabular Data (Comma Separated):
                    </label>
                    {csvText && (
                      <button
                        type="button"
                        onClick={() => {
                          setCsvText('');
                          setFileName('');
                        }}
                        className="text-xs text-slate-400 hover:text-rose-600 underline font-medium cursor-pointer"
                      >
                        Clear text
                      </button>
                    )}
                  </div>
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="customer_name,sku,quantity,unit_price,discount_pct&#10;Aravali Healthcare,IN-LAP14,4,84900,8&#10;Malabar Logistics,IN-NET48,2,62500,10"
                    rows={7}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              )}

              {/* Supported Columns Guide */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Recognized Column Schema:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono font-bold text-blue-600 block">customer_name</span>
                    <span className="text-slate-500 text-[11px]">Client name or email</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono font-bold text-blue-600 block">sku / product_name</span>
                    <span className="text-slate-500 text-[11px]">Exact SKU or title</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono font-bold text-blue-600 block">quantity</span>
                    <span className="text-slate-500 text-[11px]">Order units (e.g. 5)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono font-bold text-blue-600 block">discount_pct</span>
                    <span className="text-slate-500 text-[11px]">Discount (e.g. 10)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PRE-FLIGHT VALIDATION PREVIEW */}
          {step === 'preview' && validationData && (
            <div className="space-y-5">
              {/* Metrics Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-slate-400 text-[11px] font-bold uppercase block">Total Rows</span>
                  <span className="text-lg font-black text-slate-900">{validationData.total_rows}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 shadow-xs">
                  <span className="text-emerald-700 text-[11px] font-bold uppercase block">Ready to Commit</span>
                  <span className="text-lg font-black text-emerald-800">{validationData.valid_count}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 shadow-xs">
                  <span className="text-amber-700 text-[11px] font-bold uppercase block">Approval Warnings</span>
                  <span className="text-lg font-black text-amber-800">{validationData.warning_count}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 shadow-xs">
                  <span className="text-rose-700 text-[11px] font-bold uppercase block">Errors (Skipped)</span>
                  <span className="text-lg font-black text-rose-800">{validationData.error_count}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 shadow-xs col-span-2 sm:col-span-1">
                  <span className="text-blue-700 text-[11px] font-bold uppercase block">Total Value</span>
                  <span className="text-lg font-black text-blue-900 font-mono">
                    {formatCurrency(validationData.total_value)}
                  </span>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="max-h-[380px] overflow-y-auto overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 min-w-[140px]">Customer</th>
                        <th className="px-4 py-3 min-w-[160px]">Product / SKU</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Discount</th>
                        <th className="px-4 py-3 text-right">Net Total</th>
                        <th className="px-4 py-3 min-w-[180px]">Pre-flight Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validationData.rows.map((row, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50 transition-colors ${
                            row.status === 'ERROR'
                              ? 'bg-rose-50/40'
                              : row.status === 'WARNING'
                              ? 'bg-amber-50/20'
                              : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-slate-400 font-semibold">{row.row_index}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {row.status === 'VALID' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                VALID
                              </span>
                            )}
                            {row.status === 'WARNING' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                <AlertTriangle className="w-3 h-3" />
                                WARNING
                              </span>
                            )}
                            {row.status === 'ERROR' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                <AlertCircle className="w-3 h-3" />
                                ERROR
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {row.resolved_customer}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{row.product_name}</div>
                            <span className="font-mono text-[10px] text-slate-400">{row.sku}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{row.quantity}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{formatCurrency(row.unit_price)}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">{row.discount_pct}%</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(row.line_total)}
                          </td>
                          <td className="px-4 py-3 text-[11px]">
                            {row.errors.length > 0 ? (
                              <span className="text-rose-700 font-medium">{row.errors.join(' • ')}</span>
                            ) : row.warnings.length > 0 ? (
                              <span className="text-amber-700 font-medium">{row.warnings.join(' • ')}</span>
                            ) : (
                              <span className="text-emerald-700">Catalog match & stock verified</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS RESULT */}
          {step === 'success' && commitResult && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-extrabold text-slate-900">Bulk Import Completed!</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{commitResult.message}</p>
              </div>

              {/* Created Quotations List */}
              <div className="max-w-2xl mx-auto space-y-2 text-left">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                  Created Deals & Line Items:
                </span>
                <div className="space-y-2">
                  {commitResult.quotations.map((q) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-blue-600">{q.quote_number}</span>
                            <span className="text-xs font-semibold text-slate-900">{q.customer_name}</span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {q.line_count} line items • Status:{' '}
                            <span className="capitalize font-semibold text-slate-700">{q.status}</span>
                            {q.required_approval && q.required_approval !== 'No Approval Needed' && (
                              <span className="text-amber-700 font-semibold ml-1">({q.required_approval})</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-xs text-slate-900">{formatCurrency(q.total)}</span>
                        <Link
                          to={`/quotations/${q.id}`}
                          onClick={() => {
                            handleReset();
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between shrink-0">
          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleValidate}
                disabled={isValidating || !csvText.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-all disabled:opacity-40 cursor-pointer"
              >
                {isValidating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Running Pre-flight Validation...</span>
                  </>
                ) : (
                  <>
                    <span>Preview & Validate Rows</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={isCommitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                ← Back to Upload
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={
                    isCommitting ||
                    !validationData ||
                    validationData.valid_count + validationData.warning_count === 0
                  }
                  className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-40 cursor-pointer"
                >
                  {isCommitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Transactions...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Execute Bulk Import (
                        {validationData ? validationData.valid_count + validationData.warning_count : 0} items)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                className="px-6 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
