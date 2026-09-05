/**
 * Quotation Builder — B3 CPQ (Configure-Price-Quote) Screen.
 * Styled in the exact visual design system of VendorBridge:
 * - Outfit font for headers and financial totals
 * - shadow-premium cards
 * - Modern product selection & quantity spinners
 * - Live margin & risk indicators
 * - Approval chain pathway
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchQuotation, createQuotation, updateQuotation,
  addLine, updateLine, deleteLine, submitQuotation,
  fetchProducts, fetchCustomers,
} from '../../api/quotations';
import {
  formatCurrency, formatPercent, getRiskBadgeClass, getRiskLabel,
  getStatusBadgeClass,
} from '../../lib/utils';
import {
  Plus, Trash2, Save, Send, Eye, ShieldCheck, AlertTriangle,
  Package, ArrowLeft, CheckCircle2, MinusCircle, RefreshCw, PlusCircle
} from 'lucide-react';
import type { QuotationLine } from '../../types';
import { UpsellPanel } from '../upsell-panel/UpsellPanel';

export function QuotationBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id;

  const [selectedCustomer, setSelectedCustomer] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  // === Queries ===
  const { data: quotation, isLoading: loadingQuotation } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => fetchQuotation(Number(id)),
    enabled: !!id,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () => fetchProducts(selectedCategory ? { category: selectedCategory } : undefined),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchCustomers(),
  });

  // Sync form state from loaded quotation
  useEffect(() => {
    if (quotation) {
      setSelectedCustomer(quotation.customer);
      setNotes(quotation.notes || '');
      setPaymentTerms(quotation.payment_terms || 'Net 30 Days');
    }
  }, [quotation]);

  const products = productsData?.results || [];
  const customers = customersData?.results || [];
  const lines: QuotationLine[] = quotation?.lines || [];

  // === Mutations ===
  const createMutation = useMutation({
    mutationFn: (data: { customer: number; notes: string; payment_terms: string }) => createQuotation(data),
    onSuccess: (data) => navigate(`/quotations/${data.id}`, { replace: true }),
  });

  const addLineMutation = useMutation({
    mutationFn: (data: { product: number; quantity: number; unit_price: number; discount_percent: number }) =>
      addLine(Number(id), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotation', id] }),
  });

  const updateLineMutation = useMutation({
    mutationFn: ({ lineId, ...data }: { lineId: number; quantity?: number; discount_percent?: number }) =>
      updateLine(Number(id), lineId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotation', id] }),
  });

  const deleteLineMutation = useMutation({
    mutationFn: (lineId: number) => deleteLine(Number(id), lineId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotation', id] }),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitQuotation(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => updateQuotation(Number(id), { notes, payment_terms: paymentTerms }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotation', id] }),
  });

  // === Handlers ===
  const handleCreateQuotation = useCallback(() => {
    if (!selectedCustomer) return;
    createMutation.mutate({ customer: selectedCustomer, notes, payment_terms: paymentTerms });
  }, [selectedCustomer, notes, paymentTerms, createMutation]);

  const handleAddProduct = useCallback((productId: number, basePrice: string) => {
    addLineMutation.mutate({ product: productId, quantity: 1, unit_price: parseFloat(basePrice), discount_percent: 0 });
    setShowProductPicker(false);
  }, [addLineMutation]);

  const handleQuantityChange = useCallback((lineId: number, quantity: number) => {
    if (quantity < 1) return;
    updateLineMutation.mutate({ lineId, quantity });
  }, [updateLineMutation]);

  const handleDiscountChange = useCallback((lineId: number, discount_percent: number) => {
    if (discount_percent < 0 || discount_percent > 100) return;
    updateLineMutation.mutate({ lineId, discount_percent });
  }, [updateLineMutation]);

  const isDraft = !quotation || quotation.status === 'draft' || quotation.status === 'under_negotiation';
  const canEdit = isDraft;

  if (!isNew && loadingQuotation) {
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
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-1 text-xs font-semibold text-slate-500 hover:text-primary mb-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Pipeline</span>
          </button>
          <div className="flex items-center space-x-3">
            <h2 className="font-outfit text-xl md:text-2xl font-extrabold text-slate-900">
              {isNew ? 'Create New Quotation' : `Configure Quotation — Q-${id}`}
            </h2>
            {quotation && (
              <span className={`badge ${getStatusBadgeClass(quotation.status)}`}>
                {quotation.status_display}
              </span>
            )}
            {quotation && parseFloat(quotation.blended_risk_score) > 0 && (
              <span className={`badge ${getRiskBadgeClass(quotation.blended_risk_score)}`}>
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{getRiskLabel(quotation.blended_risk_score)} ({parseFloat(quotation.blended_risk_score).toFixed(1)})</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {canEdit && !isNew && (
            <>
              <button
                onClick={() => saveMutation.mutate()}
                className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
              >
                <Save className="h-3.5 w-3.5 text-slate-500" />
                <span>Save Draft</span>
              </button>
              <button
                onClick={() => submitMutation.mutate()}
                disabled={lines.length === 0}
                className="flex items-center space-x-1.5 rounded-lg bg-primary hover:bg-primary-hover px-4 py-2 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Submit for Approval</span>
              </button>
            </>
          )}
          {quotation && (
            <a
              href={`/portal/quotations/${(quotation as any).portal_token || quotation.quote_number || quotation.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 rounded-lg border border-primary/30 bg-blue-50 px-3 py-2 text-xs font-bold text-primary shadow-sm hover:bg-blue-100 transition-all cursor-pointer"
              title="Open customer-facing portal view for this deal"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Customer Portal</span>
            </a>
          )}
        </div>
      </div>

      {/* Submit Result Alert Banner */}
      {submitMutation.isSuccess && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${
          submitMutation.data.required_approval_level === 'none'
            ? 'bg-success-light border-success/30 text-success'
            : 'bg-warning-light border-warning/30 text-warning'
        }`}>
          {submitMutation.data.required_approval_level === 'none'
            ? <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            : <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          }
          <div>
            <div className="text-xs font-bold">{submitMutation.data.message}</div>
            {submitMutation.data.has_any_breach && (
              <div className="text-[11px] mt-1 font-medium text-slate-600">
                Risk Score: {submitMutation.data.blended_risk_score} • 
                Approval Pathway: {submitMutation.data.required_approval_level.replace('_', ' + ')}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Section — 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection (new quotation) */}
          {isNew && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-premium space-y-4">
              <h3 className="font-outfit text-base font-bold text-slate-900">Select Customer & Commercial Terms</h3>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Customer Account
                </label>
                <select
                  value={selectedCustomer}
                  onChange={e => setSelectedCustomer(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-primary focus:bg-white"
                >
                  <option value={0}>Choose a customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.company} ({c.tier_display})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-primary focus:bg-white"
                  >
                    <option>Net 30 Days</option>
                    <option>Net 60 Days</option>
                    <option>Due on Receipt</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Internal Deal Notes
                  </label>
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-primary focus:bg-white"
                    placeholder="Enter internal deal notes..."
                  />
                </div>
              </div>

              <button
                onClick={handleCreateQuotation}
                disabled={!selectedCustomer || createMutation.isPending}
                className="flex items-center space-x-2 rounded-lg bg-primary hover:bg-primary-hover px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Initialize Quotation</span>
              </button>
            </div>
          )}

          {/* Customer Info Bar (existing quotation) */}
          {quotation && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary font-bold font-outfit text-sm">
                  {quotation.customer_name?.[0]}
                </div>
                <div>
                  <div className="font-outfit text-base font-bold text-slate-900">{quotation.customer_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Tier: <span className="font-bold uppercase text-slate-700">{quotation.customer_tier_display}</span> • 
                    Rep: {quotation.sales_rep_name} • 
                    Terms: {quotation.payment_terms}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-400 font-medium">
                Created: {new Date(quotation.created_at).toLocaleDateString()}
              </div>
            </div>
          )}

          {/* Line Items Table (VendorBridge style) */}
          {!isNew && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-premium overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-outfit text-base font-bold text-slate-900">Configured Line Items</h3>
                  <p className="text-xs text-slate-500">{lines.length} items • Realtime line pricing & margin floor</p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => setShowProductPicker(!showProductPicker)}
                    className="flex items-center space-x-1.5 rounded-lg bg-primary hover:bg-primary-hover px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Product</span>
                  </button>
                )}
              </div>

              {/* Product Picker Panel */}
              {showProductPicker && (
                <div className="border-b border-slate-200 bg-slate-50/50 p-5 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {['', 'Hardware', 'Services', 'Warranty', 'Subscription'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cat || 'All Categories'}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                    {products.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleAddProduct(p.id, p.base_price)}
                        className="flex items-center space-x-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-primary hover:shadow-sm transition-all text-left cursor-pointer group"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-primary transition-colors truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {p.sku} • {formatCurrency(p.base_price)}/{p.unit}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3">Product</th>
                      <th className="px-6 py-3 text-center">Qty</th>
                      <th className="px-6 py-3 text-right">Unit Price</th>
                      <th className="px-6 py-3 text-center">Discount %</th>
                      <th className="px-6 py-3 text-right">Net Price</th>
                      <th className="px-6 py-3 text-right">Line Total</th>
                      {canEdit && <th className="px-4 py-3 text-center w-12" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{line.product_name}</div>
                          <div className="text-[10px] text-slate-400">{line.product_sku} • {line.category_name}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {canEdit ? (
                            <div className="inline-flex items-center space-x-1">
                              <button
                                onClick={() => handleQuantityChange(line.id, line.quantity - 1)}
                                className="h-6 w-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500 cursor-pointer"
                              >
                                <MinusCircle className="h-3 w-3" />
                              </button>
                              <span className="w-8 text-center font-mono font-bold text-slate-800">{line.quantity}</span>
                              <button
                                onClick={() => handleQuantityChange(line.id, line.quantity + 1)}
                                className="h-6 w-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500 cursor-pointer"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono font-semibold text-slate-800">{line.quantity}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-slate-700">{formatCurrency(line.unit_price)}</td>
                        <td className="px-6 py-4 text-center">
                          {canEdit ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={line.discount_percent}
                              onChange={e => handleDiscountChange(line.id, parseFloat(e.target.value) || 0)}
                              className="w-16 h-7 text-center border border-slate-300 rounded font-mono text-xs focus:outline-none focus:border-primary"
                            />
                          ) : (
                            <span className="font-mono font-semibold text-slate-800">{formatPercent(line.discount_percent)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-slate-700">{formatCurrency(line.net_price)}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{formatCurrency(line.line_total)}</td>
                        {canEdit && (
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => deleteLineMutation.mutate(line.id)}
                              className="p-1 text-slate-400 hover:text-danger transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {lines.length === 0 && (
                      <tr>
                        <td colSpan={canEdit ? 7 : 6} className="px-6 py-12 text-center text-xs text-slate-400">
                          No items added. Click "Add Product" above to begin building your quote.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upsell Panel Slot */}
          {!isNew && lines.length > 0 && (
            <UpsellPanel
              quotationId={Number(id)}
              onAddProduct={canEdit ? handleAddProduct : undefined}
            />
          )}
        </div>

        {/* Right Sidebar — CPQ Pricing Engine */}
        {!isNew && quotation && (
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium space-y-3">
              <h3 className="font-outfit text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                CPQ Pricing Engine
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Total:</span>
                  <span className="font-mono font-bold text-slate-900">{formatCurrency(quotation.gross_total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Discount:</span>
                  <span className="font-mono font-bold text-danger">-{formatCurrency(quotation.total_discount_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">{formatCurrency(quotation.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax:</span>
                  <span className="font-mono text-slate-700">{formatCurrency(quotation.tax_amount)}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between font-bold">
                  <span className="text-slate-900">Grand Total:</span>
                  <span className="font-outfit text-sm text-primary font-extrabold">{formatCurrency(quotation.total)}</span>
                </div>
              </div>
            </div>

            {/* Margin & Risk */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium space-y-4">
              <h3 className="font-outfit text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Margin & Risk Analysis
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold">BLENDED DISCOUNT</span>
                    <span className="font-mono font-bold">{formatPercent(quotation.blended_discount_percent)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(parseFloat(quotation.blended_discount_percent), 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold">BLENDED MARGIN</span>
                    <span className={`font-mono font-bold ${parseFloat(quotation.blended_margin_percent) > 30 ? 'text-success' : 'text-warning'}`}>
                      {formatPercent(quotation.blended_margin_percent)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${parseFloat(quotation.blended_margin_percent) > 30 ? 'bg-success' : 'bg-warning'}`}
                      style={{ width: `${Math.min(parseFloat(quotation.blended_margin_percent), 100)}%` }}
                    />
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Blended Risk Score</div>
                  <div className="flex items-center space-x-2">
                    <span className={`badge ${getRiskBadgeClass(quotation.blended_risk_score)}`}>
                      {getRiskLabel(quotation.blended_risk_score)}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-900">{parseFloat(quotation.blended_risk_score).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Approval Chain Routing */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-premium space-y-3">
              <h3 className="font-outfit text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Approval Chain Routing
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Submitted', active: quotation.status !== 'draft' },
                  { label: 'Sales Manager', active: quotation.manager_approved },
                  { label: 'Finance / Ops', active: quotation.finance_approved, needed: quotation.required_approval_level === 'manager_finance' },
                  { label: 'Confirmed', active: quotation.status === 'confirmed' || quotation.status === 'approved' },
                ].map((step, i) => (
                  <div key={i} className="flex items-center space-x-2.5">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      step.active
                        ? 'bg-success text-white'
                        : step.needed === false
                        ? 'bg-slate-200 text-slate-400'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {step.active ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs ${step.active ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                      {step.label}
                    </span>
                    {step.needed === false && (
                      <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">skipped</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                Required: <span className="font-bold text-slate-800">{quotation.approval_level_display || 'No Approval Needed'}</span>
              </div>
            </div>

            {/* Upsell Recommendations */}
            <UpsellPanel
              quotationId={quotation.id}
              onAddProduct={(productId) => {
                const prod = products.find((p) => p.id === productId);
                const price = prod ? Number(prod.base_price) : 0;
                addLineMutation.mutate({
                  product: productId,
                  quantity: 1,
                  unit_price: price,
                  discount_percent: 0,
                });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
