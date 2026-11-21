// SECCI (art. 10 + Anexa II CCD2), in forma din contractul API v0.
// Esentialul primul (cheia "key"), detaliile dupa. Continutul exact afisat se pastreaza cu hash.

import type { CreditProduct, Quote } from './loan.ts';
import { WITHDRAWAL_DAYS } from './agreement.ts';

export const SECCI_VERSION = 'v1';

export type Lender = { name: string; address: string };

export function buildSecci(q: Quote, product: CreditProduct & { lender_name: string; lender_address: string }, intermediaryName: string) {
  return {
    secci_version: SECCI_VERSION,
    key: {
      total_credit_lei: q.total_credit_lei,
      installment_lei: q.installment_lei,
      last_installment_lei: q.last_installment_lei,
      installments: q.installments,
      total_payable_lei: q.total_payable_lei,
      total_cost_lei: q.total_cost_lei,
      apr_pct: q.apr_pct,
      nominal_rate_pct: q.nominal_rate_pct,
      rate_type: 'fixa',
      withdrawal_days: WITHDRAWAL_DAYS,
    },
    creditor: { name: product.lender_name, address: product.lender_address },
    intermediary: { name: intermediaryName },
    product: { id: product.id, fees_lei: q.fees_lei },
    late_payment: 'Penalitati de intarziere conform contractului (demo).',
    early_repayment: 'Poti rambursa oricand inainte de termen.',
    schedule: q.schedule.map((s) => ({ n: s.n, due_date: s.due_date, amount_lei: s.amount_lei })),
  };
}

/** JSON cu cheile sortate, ca acelasi continut sa dea mereu acelasi hash. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

/** SHA-256 hex (Web Crypto: merge si in Deno, si in Node). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
