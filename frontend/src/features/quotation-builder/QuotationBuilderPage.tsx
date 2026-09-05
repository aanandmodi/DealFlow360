/**
 * Quotation Builder — B3 CPQ (Configure-Price-Quote) Screen.
 * Matches the reference: product picker, line items table, discount inputs,
 * live margin indicator, blended risk badge, approval chain routing.
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
  Package, ArrowLeft, CheckCircle2, MinusCircle,
} from 'lucide-react';
import type { Quotation, QuotationLine } from '../../types';
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

  // === Render ===
  if (!isNew && loadingQuotation) {
    return <div className="p-6"><div className="text-sm text-[var(--color-text-muted)]">Loading quotation...</div></div>;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-1 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Pipeline
          </button>
          <h1 className="text-headline-xl">
            {isNew ? 'New Quotation' : `Quotation Q-${id}`}
          </h1>
          {quotation && (
            <div className="flex items-center gap-3 mt-1">
              <span className={`badge ${getStatusBadgeClass(quotation.status)}`}>
                <span className="badge-dot" /> {quotation.status_display}
              </span>
              {parseFloat(quotation.blended_risk_score) > 0 && (
                <span className={`badge ${getRiskBadgeClass(quotation.blended_risk_score)}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {getRiskLabel(quotation.blended_risk_score)} ({parseFloat(quotation.blended_risk_score).toFixed(1)})
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {canEdit && !isNew && (
            <>
              <button onClick={() => saveMutation.mutate()} className="flex items-center gap-1.5 px-3 h-9 bg-white border border-[var(--color-border-muted)] rounded text-sm font-medium hover:bg-[var(--color-surface-alt)] transition">
                <Save className="w-4 h-4" /> Save Draft
              </button>
              <button
                onClick={() => submitMutation.mutate()}
                disabled={lines.length === 0}
                className="flex items-center gap-1.5 px-4 h-9 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded border border-[var(--color-primary-hover)] transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Submit for Approval
              </button>
            </>
          )}
          {quotation?.status === 'approved' && (
            <button className="flex items-center gap-1.5 px-4 h-9 bg-[var(--color-emerald)] hover:bg-[#047857] text-white font-semibold rounded transition">
              <Eye className="w-4 h-4" /> Preview as Customer
            </button>
          )}
        </div>
      </div>

      {/* Submit result banner */}
      {submitMutation.isSuccess && (
        <div className={`mb-4 p-4 rounded border flex items-start gap-3 ${
          submitMutation.data.required_approval_level === 'none'
            ? 'bg-[var(--color-emerald-bg)] border-[var(--color-emerald-border)]'
            : 'bg-[var(--color-amber-bg)] border-[var(--color-amber-border)]'
        }`}>
          {submitMutation.data.required_approval_level === 'none'
            ? <CheckCircle2 className="w-5 h-5 text-[var(--color-emerald)] mt-0.5" />
            : <AlertTriangle className="w-5 h-5 text-[var(--color-amber)] mt-0.5" />
          }
          <div>
            <div className="text-sm font-medium">{submitMutation.data.message}</div>
            {submitMutation.data.has_any_breach && (
              <div className="text-xs mt-1">
                Risk Score: {submitMutation.data.blended_risk_score} •
                Approval: {submitMutation.data.required_approval_level.replace('_', ' + ')}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Main Section — 2 cols */}
        <div className="col-span-2 space-y-4">
          {/* Customer Selection (new quotation) */}
          {isNew && (
            <div className="bg-white border border-[var(--color-border)] rounded-md p-4 elevation-1">
              <h2 className="text-title-sm mb-3">Select Customer</h2>
              <select
                value={selectedCustomer}
                onChange={e => setSelectedCustomer(Number(e.target.value))}
                className="w-full h-9 px-3 border border-[var(--color-border-muted)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value={0}>Choose a customer...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.company} ({c.tier_display})</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-label-uppercase block mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full h-9 px-3 border border-[var(--color-border-muted)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  >
                    <option>Net 30 Days</option>
                    <option>Net 60 Days</option>
                    <option>Due on Receipt</option>
                  </select>
                </div>
                <div>
                  <label className="text-label-uppercase block mb-1">Notes</label>
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full h-9 px-3 border border-[var(--color-border-muted)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    placeholder="Internal notes..."
                  />
                </div>
              </div>

              <button
                onClick={handleCreateQuotation}
                disabled={!selectedCustomer || createMutation.isPending}
                className="mt-4 flex items-center gap-1.5 px-4 h-9 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded transition disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Create Quotation
              </button>
            </div>
          )}

          {/* Customer Info Bar (existing quotation) */}
          {quotation && (
            <div className="bg-white border border-[var(--color-border)] rounded-md p-4 elevation-1 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)] font-bold text-sm">
                  {quotation.customer_name?.[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold">{quotation.customer_name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Tier: <span className="font-medium">{quotation.customer_tier_display}</span> • 
                    Rep: {quotation.sales_rep_name} • 
                    Terms: {quotation.payment_terms}
                  </div>
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Created {new Date(quotation.created_at).toLocaleDateString()}
              </div>
            </div>
          )}

          {/* Line Items Table */}
          {!isNew && (
            <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <div>
                  <h2 className="text-title-sm">Line Items</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">{lines.length} items • Mixed one-time + recurring</p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => setShowProductPicker(!showProductPicker)}
                    className="flex items-center gap-1.5 px-3 h-8 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-medium rounded transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                )}
              </div>

              {/* Product Picker Dropdown */}
              {showProductPicker && (
                <div className="border-b border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
                  <div className="flex gap-2 mb-3">
                    {['', 'Hardware', 'Services', 'Warranty', 'Subscription'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 text-xs rounded border transition ${
                          selectedCategory === cat
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                            : 'bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]'
                        }`}
                      >
                        {cat || 'All'}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {products.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleAddProduct(p.id, p.base_price)}
                        className="flex items-center gap-3 p-2.5 bg-white border border-[var(--color-border)] rounded hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition text-left"
                      >
                        <Package className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {p.sku} • {formatCurrency(p.base_price)}/{p.unit}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-canvas)]">
                    <th className="text-label-uppercase text-left px-4 py-2 border-b border-[var(--color-border)]">Product</th>
                    <th className="text-label-uppercase text-center px-4 py-2 border-b border-[var(--color-border)]">Qty</th>
                    <th className="text-label-uppercase text-right px-4 py-2 border-b border-[var(--color-border)]">Unit Price</th>
                    <th className="text-label-uppercase text-center px-4 py-2 border-b border-[var(--color-border)]">Discount %</th>
                    <th className="text-label-uppercase text-right px-4 py-2 border-b border-[var(--color-border)]">Net Price</th>
                    <th className="text-label-uppercase text-right px-4 py-2 border-b border-[var(--color-border)]">Line Total</th>
                    {canEdit && <th className="text-label-uppercase text-center px-4 py-2 border-b border-[var(--color-border)]" style={{width: 44}} />}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="hover:bg-[var(--color-canvas)] transition-colors border-b border-[var(--color-surface-alt)]">
                      <td className="px-4 py-2.5">
                        <div className="text-sm font-medium">{line.product_name}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{line.product_sku} • {line.category_name}</div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {canEdit ? (
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => handleQuantityChange(line.id, line.quantity - 1)} className="w-6 h-6 rounded border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-surface-alt)] transition">
                              <MinusCircle className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center font-mono text-sm">{line.quantity}</span>
                            <button onClick={() => handleQuantityChange(line.id, line.quantity + 1)} className="w-6 h-6 rounded border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-surface-alt)] transition">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-sm">{line.quantity}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm">{formatCurrency(line.unit_price)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {canEdit ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={line.discount_percent}
                            onChange={e => handleDiscountChange(line.id, parseFloat(e.target.value) || 0)}
                            className="w-16 h-7 text-center border border-[var(--color-border-muted)] rounded font-mono text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        ) : (
                          <span className="font-mono text-sm">{formatPercent(line.discount_percent)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm">{formatCurrency(line.net_price)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm font-medium">{formatCurrency(line.line_total)}</td>
                      {canEdit && (
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => deleteLineMutation.mutate(line.id)}
                            className="p-1 text-[var(--color-text-disabled)] hover:text-[var(--color-rose)] transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 7 : 6} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                        No items yet. Click "Add Product" to begin building your quote.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Upsell Panel Slot (Person B) */}
          {!isNew && lines.length > 0 && (
            <UpsellPanel
              quotationId={Number(id)}
              onAddProduct={canEdit ? handleAddProduct : undefined}
            />
          )}
        </div>

        {/* Right Sidebar — CPQ Pricing Engine */}
        {!isNew && quotation && (
          <div className="space-y-4">
            {/* Order Summary */}
            <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 p-4">
              <h3 className="text-title-sm mb-3">CPQ Pricing Engine</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Gross Total</span>
                  <span className="font-mono font-medium">{formatCurrency(quotation.gross_total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Total Discount</span>
                  <span className="font-mono text-[var(--color-rose)]">-{formatCurrency(quotation.total_discount_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Subtotal</span>
                  <span className="font-mono font-medium">{formatCurrency(quotation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Tax</span>
                  <span className="font-mono">{formatCurrency(quotation.tax_amount)}</span>
                </div>
                <hr className="border-[var(--color-border)]" />
                <div className="flex justify-between text-base font-semibold">
                  <span>Grand Total</span>
                  <span className="font-mono">{formatCurrency(quotation.total)}</span>
                </div>
              </div>
            </div>

            {/* Margin & Risk */}
            <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 p-4">
              <h3 className="text-title-sm mb-3">Margin & Risk Analysis</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
                    <span>BLENDED DISCOUNT</span>
                    <span className="font-mono">{formatPercent(quotation.blended_discount_percent)}</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-primary)] rounded-full transition-all"
                      style={{ width: `${Math.min(parseFloat(quotation.blended_discount_percent), 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
                    <span>BLENDED MARGIN</span>
                    <span className={`font-mono ${parseFloat(quotation.blended_margin_percent) > 30 ? 'text-[var(--color-emerald)]' : 'text-[var(--color-amber)]'}`}>
                      {formatPercent(quotation.blended_margin_percent)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${parseFloat(quotation.blended_margin_percent) > 30 ? 'bg-[var(--color-emerald)]' : 'bg-[var(--color-amber)]'}`}
                      style={{ width: `${Math.min(parseFloat(quotation.blended_margin_percent), 100)}%` }}
                    />
                  </div>
                </div>
                <div className="border-t border-[var(--color-border)] pt-3 mt-3">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">BLENDED RISK SCORE</div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${getRiskBadgeClass(quotation.blended_risk_score)}`}>
                      <span className="badge-dot" />
                      {getRiskLabel(quotation.blended_risk_score)}
                    </span>
                    <span className="font-mono text-sm font-semibold">{parseFloat(quotation.blended_risk_score).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Approval Chain Routing */}
            <div className="bg-white border border-[var(--color-border)] rounded-md elevation-1 p-4">
              <h3 className="text-title-sm mb-3">Approval Chain Routing</h3>
              <div className="space-y-2">
                {[
                  { label: 'Submitted', active: quotation.status !== 'draft' },
                  { label: 'Sales Manager', active: quotation.manager_approved },
                  { label: 'Finance / Ops', active: quotation.finance_approved, needed: quotation.required_approval_level === 'manager_finance' },
                  { label: 'Confirmed', active: quotation.status === 'confirmed' || quotation.status === 'approved' },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      step.active
                        ? 'bg-[var(--color-emerald)] text-white'
                        : step.needed === false
                        ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-disabled)]'
                        : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                    }`}>
                      {step.active ? '✓' : i + 1}
                    </div>
                    <span className={`text-sm ${step.active ? 'font-medium text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                      {step.label}
                    </span>
                    {step.needed === false && (
                      <span className="text-[10px] text-[var(--color-text-disabled)]">skipped</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-text-muted)]">
                  Required: <span className="font-medium">{quotation.approval_level_display || 'No Approval Needed'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
