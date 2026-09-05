/**
 * Shared TypeScript types for DealFlow360 frontend.
 */

// === Core Entities ===

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: number;
  category_name: string;
  base_price: string;
  unit: string;
  tax_rate: string;
  is_subscription: boolean;
  description: string;
}

export interface Customer {
  id: number;
  name: string;
  company: string;
  email: string;
  tier: 'bronze' | 'silver' | 'gold';
  tier_display: string;
}

// === Quotation ===

export type QuotationStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'confirmed'
  | 'under_negotiation';

export type ApprovalLevel = 'none' | 'manager' | 'manager_finance';

export interface QuotationLine {
  id: number;
  quotation: number;
  product: number;
  product_name: string;
  product_sku: string;
  category_name: string;
  quantity: number;
  unit_price: string;
  discount_percent: string;
  net_price: string;
  gross_total: string;
  discount_amount: string;
  line_total: string;
  tax_amount: string;
}

export interface ApprovalLog {
  id: number;
  quotation: number;
  actor: number;
  actor_name: string;
  actor_username: string;
  action: string;
  action_display: string;
  role_at_action: string;
  reason: string;
  blended_risk_score_at_action: string;
  timestamp: string;
}

export interface Quotation {
  id: number;
  customer: number;
  customer_name: string;
  customer_tier: string;
  customer_tier_display: string;
  sales_rep: number;
  sales_rep_name: string;
  status: QuotationStatus;
  status_display: string;
  blended_risk_score: string;
  required_approval_level: ApprovalLevel;
  approval_level_display: string;
  manager_approved: boolean;
  finance_approved: boolean;
  notes: string;
  payment_terms: string;
  subtotal: string;
  total_discount_amount: string;
  tax_amount: string;
  total: string;
  gross_total: string;
  blended_discount_percent: string;
  blended_margin_percent: string;
  created_at: string;
  updated_at: string;
  lines: QuotationLine[];
  approval_logs: ApprovalLog[];
}

// === API Payloads ===

export interface QuotationCreate {
  customer: number;
  notes?: string;
  payment_terms?: string;
}

export interface QuotationLineCreate {
  product: number;
  quantity: number;
  unit_price?: number;
  discount_percent?: number;
}

export interface LineRiskDetail {
  line_id: number;
  product_name: string;
  category_name: string;
  discount_percent: string;
  ceiling: string;
  overage: string;
  line_value: string;
  policy_status: 'ok' | 'over_limit';
}

export interface RiskScoreResult {
  quotation_id: number;
  blended_risk_score: string;
  has_any_breach: boolean;
  required_approval_level: ApprovalLevel;
  requires_finance: boolean;
  total_order_value: string;
  total_weighted_overage: string;
  line_details: LineRiskDetail[];
}

export interface SubmitResult {
  status: QuotationStatus;
  blended_risk_score: string;
  required_approval_level: ApprovalLevel;
  requires_finance: boolean;
  has_any_breach: boolean;
  line_details: LineRiskDetail[];
  message: string;
}

export interface ApproveResult {
  status: QuotationStatus;
  fully_approved: boolean;
  manager_approved: boolean;
  finance_approved: boolean;
  message: string;
}

export interface PipelineSummary {
  total_quotations: number;
  active_pipeline_value: number;
  active_pipeline_count: number;
  pending_approvals: number;
  at_risk_count: number;
  closed_won_value?: number;
  closed_won_count?: number;
  pipeline_by_status: Record<string, { count: number; total: number }>;
}

export interface QuotationListItem {
  id: number;
  quote_number: string;
  customer_name: string;
  customer_tier: string;
  customer_company?: string;
  rep_name: string;
  status: string;
  blended_risk_score: number;
  total_amount: number;
  margin_pct: number;
  line_count: number;
  created_at: string;
  updated_at: string;
}
