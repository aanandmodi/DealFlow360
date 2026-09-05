/**
 * Portal API — magic link, quotation view, negotiation.
 */
import { ApiClient } from './client';

export interface PortalQuotation {
  id: number;
  quote_number: string;
  status: string;
  status_display: string;
  customer_name: string;
  customer_company: string;
  customer_email: string;
  rep_name: string;
  rep_email: string;
  lines: Array<{
    id: number;
    product_name: string;
    product_category: string;
    description: string;
    qty: number;
    unit_price: number;
    discount_pct: number;
    line_total: number;
    is_subscription: boolean;
  }>;
  negotiation_messages: Array<{
    id: number;
    author_type: string;
    author_name: string;
    message: string;
    counter_discount_percent: number | null;
    line_product_name: string | null;
    created_at: string;
  }>;
  total_amount: number;
  total_discount: number;
  valid_until: string;
  notes: string;
  created_at: string;
}

export interface PortalQuotationSummary {
  id: number;
  quote_number: string;
  customer_name: string;
  customer_company: string;
  customer_tier: string;
  status: string;
  status_display: string;
  total_amount: number;
  portal_token: string;
  valid_until: string | null;
  created_at: string;
}

export const portalApi = {
  requestMagicLink: (email: string, quotation_id?: number) =>
    ApiClient.post<{ token: string; link: string; expires_at: string }>(
      '/auth/portal/request-magic-link/',
      { email, quotation_id }
    ),

  verifyToken: (token: string) =>
    ApiClient.post<{ verified: boolean; email: string; quotation_id: number | null; tokens: { access: string; refresh: string } | null }>(
      '/auth/portal/verify/',
      { token }
    ),

  listQuotations: (email?: string) =>
    ApiClient.get<PortalQuotationSummary[]>(`/portal/quotations/${email ? `?email=${encodeURIComponent(email)}` : ''}`),

  getQuotation: (token: string) =>
    ApiClient.get<PortalQuotation>(`/portal/quotations/${token}/`),

  comment: (id: number, message: string, line_id?: number) =>
    ApiClient.post(`/portal/quotations/${id}/comment/`, { message, line_id }),

  counterDiscount: (id: number, counter_discount_percent: number, message?: string) =>
    ApiClient.post<{ status: string; message: string; new_status: string; blended_risk_score?: number }>(
      `/portal/quotations/${id}/counter-discount/`,
      { counter_discount_percent, message }
    ),

  confirm: (id: number) =>
    ApiClient.post<{ status: string; message: string }>(
      `/portal/quotations/${id}/confirm/`
    ),
};
