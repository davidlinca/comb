// Citiri comune. Citirile clientului merg prin `db` (tokenul lui -> RLS).

import type { SupabaseClient } from '@supabase/supabase-js';
import { forbidden, isUuid, notFound } from './http.ts';

export type CustomerRow = {
  id: string; code: string; display_name: string; segment: 'postpaid' | 'prepaid';
  tenure_months: number; plan_name: string; monthly_bill_lei: number;
};

/** Clientul legat de userul logat. Operatorul nu e client -> 403 pe rutele de client. */
export async function myCustomer(db: SupabaseClient, userId: string): Promise<CustomerRow> {
  const { data, error } = await db.from('customers')
    .select('id, code, display_name, segment, tenure_months, plan_name, monthly_bill_lei')
    .eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw forbidden('Contul tau nu e legat de un abonat.');
  return { ...data, monthly_bill_lei: Number(data.monthly_bill_lei) } as CustomerRow;
}

export type ApplicationRow = {
  id: string; customer_id: string; sku: string; product_id: string; term_months: number; status: string;
  principal_lei: number; installment_lei: number; installments: number; total_payable_lei: number;
  total_cost_lei: number; nominal_rate_pct: number; apr_pct: number; personalised_offer: boolean; created_at: string;
};

/** Cererea, DOAR daca userul o poate vedea (RLS). Altfel 404, fara sa spunem ca exista. */
export async function visibleApplication(db: SupabaseClient, id: string): Promise<ApplicationRow> {
  if (!isUuid(id)) throw notFound('Cererea nu exista.');
  const { data, error } = await db.from('applications').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFound('Cererea nu exista.');
  const num = ['principal_lei', 'installment_lei', 'total_payable_lei', 'total_cost_lei', 'nominal_rate_pct', 'apr_pct'] as const;
  const row = { ...data } as Record<string, unknown>;
  for (const k of num) row[k] = Number(row[k]);
  return row as unknown as ApplicationRow;
}

/**
 * Pentru rutele in care CLIENTUL actioneaza (acorduri, evaluare, semnare, retragere):
 * userul trebuie sa fie client (operatorul -> 403) si cererea sa fie a lui (altfel 404).
 * Operatorul vede tot prin RLS, dar lucreaza doar prin /backoffice/*.
 */
export async function myApplication(db: SupabaseClient, userId: string, id: string) {
  const cu = await myCustomer(db, userId);
  const app = await visibleApplication(db, id);
  if (app.customer_id !== cu.id) throw notFound('Cererea nu exista.');
  return { cu, app };
}

export type SecciRow = {
  id: string; application_id: string; secci_version: string; content: Record<string, unknown>;
  content_sha256: string; first_shown_at: string; time_on_screen_ms: number | null;
  details_opened: boolean | null; emailed_at: string | null;
};

/** SECCI-ul salvat pentru cerere (versiunea v1), daca a fost afisat. */
export async function savedSecci(db: SupabaseClient, applicationId: string, version: string): Promise<SecciRow | null> {
  const { data, error } = await db.from('secci_documents').select('*')
    .eq('application_id', applicationId).eq('secci_version', version).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SecciRow | null;
}

export type AgreementRow = {
  id: string; application_id: string; secci_document_id: string; signed_at: string; info_received_at: string;
  first_installment_due: string; withdrawal_deadline: string; reminder_required: boolean;
  reminder_from: string | null; reminder_to: string | null; status: 'active' | 'withdrawn';
  withdrawn_at: string | null; amount_to_return_lei: number | null; return_by: string | null; demo_offset_days: number;
  app: { customer_id: string; principal_lei: number; nominal_rate_pct: number; installments: number };
};

/** Contractul clientului logat (operatorul -> 403, contractul altcuiva -> 404). */
export async function myAgreement(db: SupabaseClient, userId: string, id: unknown): Promise<AgreementRow> {
  const cu = await myCustomer(db, userId);
  if (typeof id !== 'string' || !isUuid(id)) throw notFound('Contractul nu exista.');
  const { data, error } = await db.from('agreements')
    .select('*, applications!inner(customer_id, principal_lei, nominal_rate_pct, installments)').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFound('Contractul nu exista.');
  const { applications: a, ...rest } = data as Record<string, unknown> & { applications: Record<string, unknown> };
  if (a.customer_id !== cu.id) throw notFound('Contractul nu exista.');
  return {
    ...(rest as unknown as Omit<AgreementRow, 'app'>),
    amount_to_return_lei: rest.amount_to_return_lei == null ? null : Number(rest.amount_to_return_lei),
    app: {
      customer_id: String(a.customer_id), principal_lei: Number(a.principal_lei), nominal_rate_pct: Number(a.nominal_rate_pct),
      installments: Number(a.installments),
    },
  };
}

export async function catalog(db: SupabaseClient) {
  const [d, p] = await Promise.all([
    db.from('devices').select('sku, name, category, price_lei').eq('is_active', true).order('sort_order'),
    db.from('credit_products').select('id, name, applies_to, nominal_rate_pct, fees_lei, terms, lender_name, lender_address').eq('is_active', true),
  ]);
  if (d.error) throw new Error(d.error.message);
  if (p.error) throw new Error(p.error.message);
  return {
    devices: d.data.map((x) => ({ ...x, price_lei: Number(x.price_lei) })),
    products: p.data.map((x) => ({ ...x, nominal_rate_pct: Number(x.nominal_rate_pct), fees_lei: Number(x.fees_lei) })),
  };
}
