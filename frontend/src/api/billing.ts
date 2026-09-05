/**
 * Billing API client — Person B.
 * Uses the repo's existing ApiClient for JWT auth.
 */
import { ApiClient } from './client';

// === Types ===

export interface OneTimeLine {
  line_id: number;
  product_name: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  line_total: string;
}

export interface SubscriptionInfo {
  plan_id: number;
  available_plans: {id:number;name:string;price:string}[];
  plan_name: string;
  billing_cycle: string;
  plan_price: string;
  next_billing_date: string;
  status: string;
  prorated_amount: string;
  credit_note_amount: string;
}

export interface RecurringLine {
  line_id: number;
  product_name: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  line_total: string;
  subscription: SubscriptionInfo;
}

export interface BillingScheduleResponse {
  one_time_lines: OneTimeLine[];
  recurring_lines: RecurringLine[];
  total_one_time: string;
  total_recurring: string;
}

export interface ProrationRequest {
  change_date: string;
  new_plan_id?: number;
  new_quantity?: number;
}

export interface ProrationResponse {
  old_plan_price: string;
  new_plan_price: string;
  days_remaining: number;
  cycle_days: number;
  prorated_amount: string;
  credit_amount: string;
  effective_date: string | null;
  next_billing_date: string | null;
}

export interface CancelResponse {
  message: string;
  credit_note_amount: string;
  proration: ProrationResponse;
}

export interface UpsellSuggestion {
  id: number;
  suggested_product: {
    id: number;
    name: string;
    category: string;
    base_price: string;
  };
  margin_delta: string;
  is_promoted: boolean;
}

export interface UpsellSuggestionsResponse {
  suggestions: UpsellSuggestion[];
}

// === API Functions ===

export function getBillingSchedule(quotationId: number) {
  return ApiClient.get<BillingScheduleResponse>(
    `/billing/${quotationId}/schedule/`
  );
}

export function prorateSubscription(lineId: number, data: ProrationRequest) {
  return ApiClient.post<ProrationResponse>(
    `/billing/${lineId}/prorate/`,
    data
  );
}

export function cancelSubscription(lineId: number) {
  return ApiClient.post<CancelResponse>(
    `/billing/${lineId}/cancel/`
  );
}

export function getUpsellSuggestions(quotationId: number) {
  return ApiClient.get<UpsellSuggestionsResponse>(
    `/quotations/${quotationId}/upsell-suggestions/`
  );
}
