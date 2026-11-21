// Un singur client pentru API: headerul apikey = cheia publishable, Authorization = tokenul userului.
import { getAccessToken } from './supabase';

const API_URL = import.meta.env.VITE_API_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export class ApiError extends Error {
  code: string;
  status: number;
  fields: string[];
  constructor(status: number, code: string, message: string, fields: string[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { apikey: KEY };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Nu ne putem conecta. Verifică internetul și încearcă din nou.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? 'UNKNOWN', e?.message ?? 'A apărut o eroare. Încearcă din nou.', e?.fields ?? []);
  }
  return data as T;
}

// ---- tipuri (contract v0.3) ----
export type Me = { role: 'customer' | 'operator'; display_name: string; customer_id?: string; segment?: 'postpaid' | 'prepaid'; tenure_months?: number; plan_name?: string };
export type Device = { sku: string; name: string; category: 'phone' | 'accessory'; price_lei: number };
export type Product = { id: string; name: string; lender: string; nominal_rate_pct: number; fees_lei: number; terms: number[]; applies_to: 'phone' | 'accessory' };
export type Catalog = { devices: Device[]; products: Product[]; ad_warning: string; personalised: { is_personalised: boolean; text: string | null } };
export type Quote = { installment_lei: number; installments: number; last_installment_lei?: number; total_credit_lei: number; total_payable_lei: number; total_cost_lei: number; nominal_rate_pct: number; apr_pct: number };
export type Reason = { code: string; text: string };
export type VerifiedLine = { declared_lei: number; verified_lei?: number | null; bureau_lei?: number | null; used_lei: number };
export type Verification = { bank_data_used: boolean; source: string | null; income: VerifiedLine; expenses: VerifiedLine; other_installments: VerifiedLine };
export type Decision = { decision: 'approved' | 'manual_review' | 'rejected'; automated: boolean; reasons: Reason[]; verification?: Verification };
export type NextStep = 'consents' | 'assessment' | 'wait_review' | 'rejected' | 'secci' | 'sign' | 'agreement' | 'none';
export type Application = {
  application_id: string;
  status: string;
  next_step: NextStep;
  offer: { sku: string; product_id: string; term_months: number; installment_lei: number; installments: number; total_credit_lei: number; total_payable_lei: number; total_cost_lei: number; nominal_rate_pct: number; apr_pct: number } | null;
  decision: Decision | null;
  debt_advice: { text: string; contact: string } | null;
  review: { status: string; requested_by: string } | null;
  agreement_id: string | null;
};

export const api = {
  me: () => request<Me>('GET', '/me'),
  catalog: () => request<Catalog>('GET', '/catalog'),
  quote: (b: { sku: string; product_id: string; term_months: number }) => request<Quote>('POST', '/quotes', b),
  createApplication: (b: { sku: string; product_id: string; term_months: number; shown: { ad_warning: boolean; personalised_label: boolean } }) =>
    request<{ application_id: string; status: string; quote: Quote }>('POST', '/applications', b),
  application: (id: string) => request<Application>('GET', `/applications/${id}`),
  consents: (id: string, b: { billing_history: boolean; bank_data: boolean; privacy_notice_read: boolean }) =>
    request<{ ok: true }>('POST', `/applications/${id}/consents`, b),
  assessment: (id: string, b: { net_income_lei: number; monthly_expenses_lei: number; other_installments_lei: number }) =>
    request<Decision>('POST', `/applications/${id}/assessment`, b),
  humanReview: (id: string, message?: string) =>
    request<{ status: string; eta_text: string }>('POST', `/applications/${id}/human-review`, message ? { message } : {}),
};

// ---- ecranele 5–6 ----
export type Secci = {
  secci_version: string;
  key: { total_credit_lei: number; installment_lei: number; installments: number; last_installment_lei?: number; total_payable_lei: number; total_cost_lei: number; apr_pct: number; nominal_rate_pct: number; rate_type: string; withdrawal_days: number };
  creditor: { name: string; address: string };
  intermediary: { name: string };
  late_payment: string;
  early_repayment: string;
  schedule: { n: number; due_date: string; amount_lei: number }[];
};
export type SignResult = { agreement_id: string; signed_at: string; first_installment_due: string; withdrawal_deadline: string; reminder_window: { from: string; to: string } | null };
export type Agreement = {
  agreement_id: string; application_id: string; status: 'active' | 'withdrawn' | string; signed_at: string;
  first_installment_due: string; withdrawal_deadline: string; can_withdraw: boolean; today: string; demo_offset_days: number;
  reminder_window: { from: string; to: string } | null;
  reminders: { sent_at: string; channel: string; text: string }[];
  withdrawal: { withdrawn_at: string; amount_to_return_lei: number; return_by: string } | null;
};
export type WithdrawResult = { status: string; amount_to_return_lei: number; principal_lei: number; interest_lei: number; days_used: number; return_by: string; text: string };

export const api2 = {
  secci: (id: string) => request<Secci>('GET', `/applications/${id}/secci`),
  secciViewed: (id: string, b: { time_on_screen_ms: number; details_opened: boolean }) => request<{ ok: true }>('POST', `/applications/${id}/secci/viewed`, b),
  secciEmail: (id: string) => request<{ ok: true; sent_at: string; channel: string }>('POST', `/applications/${id}/secci/email`),
  otp: (id: string) => request<{ otp_demo_code: string; expires_in_s: number }>('POST', `/applications/${id}/otp`),
  sign: (id: string, otp: string) => request<SignResult>('POST', `/applications/${id}/sign`, { otp }),
  agreement: (aid: string) => request<Agreement>('GET', `/agreements/${aid}`),
  withdraw: (aid: string) => request<WithdrawResult>('POST', `/agreements/${aid}/withdraw`),
  timeTravel: (aid: string, days: number) => request<{ today: string }>('POST', '/demo/time-travel', { agreement_id: aid, days }),
};
