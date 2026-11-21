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
