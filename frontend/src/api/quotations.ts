/**
 * Quotations API — Unified client supporting Person A (CPQ & Approvals) and Person C (Pipeline & Analytics).
 */
import { ApiClient, apiClient } from './client';
import type {
  Quotation, QuotationLine, QuotationCreate,
  QuotationLineCreate, RiskScoreResult, ApprovalLog,
  SubmitResult, ApproveResult, PipelineSummary,
  QuotationListItem, Customer, Product,
} from '../types';

export type {
  Quotation, QuotationLine, QuotationCreate,
  QuotationLineCreate, RiskScoreResult, ApprovalLog,
  SubmitResult, ApproveResult, PipelineSummary,
  QuotationListItem, Customer, Product,
};

// === Quotation CRUD (Person A) ===

export async function fetchQuotations(params?: Record<string, string>): Promise<{ results: Quotation[]; count: number }> {
  const res = await apiClient<any>('/quotations/', { params });
  if (Array.isArray(res)) {
    return { results: res, count: res.length };
  }
  return { results: res?.results || [], count: res?.count ?? (res?.results?.length || 0) };
}

export function fetchQuotation(id: number) {
  return apiClient<Quotation>(`/quotations/${id}/`);
}

export function createQuotation(data: QuotationCreate) {
  return apiClient<Quotation>('/quotations/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateQuotation(id: number, data: Partial<QuotationCreate>) {
  return apiClient<Quotation>(`/quotations/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteQuotation(id: number) {
  return apiClient(`/quotations/${id}/`, { method: 'DELETE' });
}

// === Line Items (Person A) ===

export function addLine(quotationId: number, data: QuotationLineCreate) {
  return apiClient<QuotationLine>(`/quotations/${quotationId}/lines/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateLine(quotationId: number, lineId: number, data: Partial<QuotationLineCreate>) {
  return apiClient<QuotationLine>(`/quotations/${quotationId}/lines/${lineId}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteLine(quotationId: number, lineId: number) {
  return apiClient(`/quotations/${quotationId}/lines/${lineId}/`, { method: 'DELETE' });
}

// === State Machine Actions (Person A) ===

export function submitQuotation(id: number) {
  return apiClient<SubmitResult>(`/quotations/${id}/submit/`, { method: 'POST' });
}

export function approveQuotation(id: number, reason?: string) {
  return apiClient<ApproveResult>(`/quotations/${id}/approve/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function rejectQuotation(id: number, reason?: string) {
  return apiClient(`/quotations/${id}/reject/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function returnQuotation(id: number, reason?: string) {
  return apiClient(`/quotations/${id}/return/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function confirmQuotation(id: number) {
  return apiClient(`/quotations/${id}/confirm/`, { method: 'POST' });
}

// === Risk Score (Person A) ===

export function fetchRiskScore(id: number) {
  return apiClient<RiskScoreResult>(`/quotations/${id}/risk-score/`);
}

// === Approval Logs (Person A) ===

export function fetchApprovalLogs(quotationId: number) {
  return apiClient<ApprovalLog[]>(`/quotations/${quotationId}/logs/`);
}

// === Config & Catalogs ===

export async function fetchDiscountTiers(): Promise<{ results: { id: number; tier_key: string; name: string; max_discount_percent: string }[] }> {
  const res = await apiClient<any>('/quotations/discount-tiers/');
  const list = Array.isArray(res) ? res : (res?.results || []);
  return { results: list };
}

export async function fetchProducts(params?: Record<string, string>): Promise<{ results: Product[] }> {
  const res = await apiClient<any>('/products/', { params });
  const list = Array.isArray(res) ? res : (res?.results || []);
  return { results: list };
}

export async function fetchCustomers(params?: Record<string, string>): Promise<{ results: Customer[] }> {
  const res = await apiClient<any>('/customers/', { params });
  const list = Array.isArray(res) ? res : (res?.results || []);
  return { results: list };
}

// === Person C Object-style API ===

export const quotationsApi = {
  list: async (params?: { status?: string; rep?: string }): Promise<QuotationListItem[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.rep) query.set('rep', params.rep);
    const qs = query.toString();
    // Backend returns paginated response; handle both paginated and array
    const raw = await ApiClient.get<any>(`/quotations/${qs ? `?${qs}` : ''}`);
    const items = Array.isArray(raw) ? raw : (raw?.results || []);
    // Transform string decimals to numbers for frontend compatibility
    return items.map((q: any) => ({
      ...q,
      blended_risk_score: parseFloat(q.blended_risk_score) || 0,
      total_amount: parseFloat(q.total_amount || q.total) || 0,
      margin_pct: parseFloat(q.margin_pct || q.blended_margin_percent) || 0,
      quote_number: q.quote_number || `Q-${q.id}`,
      rep_name: q.rep_name || q.sales_rep_name || 'Unassigned',
      customer_company: q.customer_company || '',
    }));
  },

  detail: (id: number) => ApiClient.get<Quotation>(`/quotations/${id}/`),

  create: (data: { customer_id: number; notes?: string }) =>
    ApiClient.post<Quotation>('/quotations/create/', data),

  submit: (id: number) => ApiClient.post<Quotation>(`/quotations/${id}/submit/`),

  pipelineSummary: async (): Promise<PipelineSummary> => {
    // Use the existing dashboard summary endpoint
    const summary = await ApiClient.get<any>('/dashboard/summary/');
    return {
      total_quotations: (summary.active_pipeline_count || 0) + (summary.closed_won_count || 0),
      active_pipeline_value: summary.active_pipeline_value || 0,
      active_pipeline_count: summary.active_pipeline_count || 0,
      pending_approvals: summary.pending_approvals || 0,
      at_risk_count: summary.at_risk_count || 0,
      closed_won_value: summary.closed_won_value || 0,
      closed_won_count: summary.closed_won_count || 0,
      pipeline_by_status: {},
    };
  },

  customers: async () => {
    const raw = await ApiClient.get<any>('/customers/');
    return Array.isArray(raw) ? raw : (raw?.results || []);
  },

  products: async (category?: string) => {
    const raw = await ApiClient.get<any>(`/products/${category ? `?category=${category}` : ''}`);
    return Array.isArray(raw) ? raw : (raw?.results || []);
  },

  discountTiers: async () => {
    const raw = await ApiClient.get<any>('/quotations/discount-tiers/');
    return Array.isArray(raw) ? raw : (raw?.results || []);
  },

  approvalRules: async () => {
    const raw = await ApiClient.get<any>('/quotations/approval-rules/');
    return Array.isArray(raw) ? raw : (raw?.results || []);
  },
};

export async function downloadQuotationPdf(quotationId: number, quoteNumber: string = 'Quotation', sig?: string, token?: string): Promise<void> {
  let url = `/quotations/${quotationId}/pdf/`;
  const params = new URLSearchParams();
  if (sig) params.set('sig', sig);
  if (token) params.set('token', token);
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const blob = await ApiClient.download(url);
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${quoteNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

export async function fetchVerificationData(quoteNumber: string, sig?: string, token?: string) {
  const params = new URLSearchParams();
  if (sig) params.set('sig', sig);
  if (token) params.set('token', token);
  const qs = params.toString();
  return ApiClient.get<any>(`/verify/${quoteNumber}/${qs ? `?${qs}` : ''}`);
}

export interface DispatchPreviewData {
  quotation_id: number;
  quote_number: string;
  customer_name: string;
  customer_company: string;
  customer_phone: string;
  customer_email: string;
  grand_total_display: string;
  links: {
    verify_url: string;
    portal_url: string;
    pdf_url: string;
    signature_hash: string;
  };
  whatsapp: {
    phone: string;
    text: string;
    url: string;
  };
  email: {
    to_email: string;
    subject: string;
    body_text: string;
    body_html: string;
    mailto_url: string;
    gmail_url: string;
  };
}

export interface DispatchExecutePayload {
  channel: 'whatsapp' | 'email';
  recipient?: string;
  template_type?: 'standard' | 'fast_track' | 'urgent';
  custom_note?: string;
  mark_as_sent?: boolean;
}

export function fetchDispatchPreview(quotationId: number, params?: {
  template_type?: string;
  custom_note?: string;
  phone?: string;
  email?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.template_type) qs.set('template_type', params.template_type);
  if (params?.custom_note) qs.set('custom_note', params.custom_note);
  if (params?.phone) qs.set('phone', params.phone);
  if (params?.email) qs.set('email', params.email);
  const qStr = qs.toString();
  return ApiClient.get<DispatchPreviewData>(`/quotations/${quotationId}/dispatch/${qStr ? `?${qStr}` : ''}`);
}

export function executeDispatchQuotation(quotationId: number, payload: DispatchExecutePayload) {
  return ApiClient.post<{
    success: boolean;
    message: string;
    quotation_status: string;
    quotation_status_display: string;
    channel: string;
    recipient: string;
    payloads: DispatchPreviewData;
  }>(`/quotations/${quotationId}/dispatch/`, payload);
}



