// Clientul API pentru back-office (rutele 15-16). Nu depinde de restul aplicatiei:
// primeste URL-ul, cheia publishable si o functie care da tokenul userului logat.

export type BackofficeConfig = {
  apiUrl: string;
  publishableKey: string;
  getAccessToken: () => Promise<string | null>;
};

export class BackofficeApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type CustomerRef = { code: string; display_name: string } | null;

export type LedgerEntry = {
  seq: number;
  at: string;
  event: string;
  description: string | null;
  ccd2_ref: string;
  actor: 'customer' | 'system' | 'operator';
  payload: Record<string, unknown>;
  hash: string;
  prev_hash: string;
};

export type LedgerDetail = {
  application: {
    application_id: string; status: string; sku: string; product_id: string; term_months: number;
    created_at: string; customer: CustomerRef;
  };
  valid: boolean;
  entries_count: number;
  first_invalid_seq: number | null;
  entries: LedgerEntry[];
};

export type LedgerListItem = {
  application_id: string; status: string; sku: string; product_id: string; term_months: number;
  created_at: string; customer: CustomerRef;
  ledger: { valid: boolean; entries: number; first_invalid_seq: number | null };
};

export type LedgerList = { all_valid: boolean; count: number; applications: LedgerListItem[] };

export type Reason = { code: string; text: string };

export type Review = {
  review_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: 'customer' | 'engine';
  requested_at: string;
  customer_message: string | null;
  operator_note: string | null;
  resolved_at: string | null;
  // art. 35 (v0.6): „vorbeste cu un om” dupa o rata ratata (contract deja semnat); lipsesc pe API-ul vechi
  topic?: 'decision' | 'forbearance';
  forbearance?: { option: 'defer' | 'reschedule' | 'talk'; installment_n: number; missed_due_date: string } | null;
  application: {
    application_id: string; status: string; sku: string; product_id: string; term_months: number;
    principal_lei: number | null; installment_lei: number | null; created_at: string;
  };
  customer: { code: string; display_name: string; segment: 'postpaid' | 'prepaid'; tenure_months: number } | null;
  assessment: {
    decision: 'approved' | 'manual_review' | 'rejected'; reasons: Reason[]; dti_pct: number | null;
    residual_lei: number | null; late_bills_12m: number | null; net_income_lei: number | null;
    monthly_expenses_lei: number | null; other_installments_declared_lei: number | null;
    other_installments_bureau_lei: number | null; other_installments_used_lei: number | null;
    other_installments_bank_lei?: number | null; // rate vazute in cont (engine-v3); null fara acord / pe evaluarile vechi
    billing_history_used: boolean;
    // verificarea venitului (Open Banking, simulat); null pe evaluarile vechi
    bank_data_used?: boolean; income_verified_lei?: number | null; income_used_lei?: number | null;
    expenses_verified_lei?: number | null; expenses_used_lei?: number | null;
  } | null;
};

export type ResolveResult = { review_id: string; status: 'approved' | 'rejected'; resolved_at: string; application_status: string };

async function call<T>(cfg: BackofficeConfig, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const token = await cfg.getAccessToken();
  if (!token) throw new BackofficeApiError(401, 'UNAUTHORIZED', 'Sesiunea a expirat. Intra din nou in cont.');
  let res: Response;
  try {
    res = await fetch(`${cfg.apiUrl.replace(/\/$/, '')}${path}`, {
      method,
      headers: {
        apikey: cfg.publishableKey,
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new BackofficeApiError(0, 'NETWORK', 'Serverul nu raspunde. Verifica conexiunea si incearca din nou.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new BackofficeApiError(res.status, e?.code ?? 'HTTP_' + res.status, e?.message ?? 'Cererea a esuat.');
  }
  return json as T;
}

export function createBackofficeApi(cfg: BackofficeConfig) {
  return {
    ledgerList: () => call<LedgerList>(cfg, 'GET', '/backoffice/ledger'),
    ledgerDetail: (applicationId: string) =>
      call<LedgerDetail>(cfg, 'GET', `/backoffice/ledger?application_id=${encodeURIComponent(applicationId)}`),
    reviews: (which: 'pending' | 'all') =>
      call<{ reviews: Review[] }>(cfg, 'GET', `/backoffice/reviews${which === 'all' ? '?status=all' : ''}`),
    resolveReview: (reviewId: string, status: 'approved' | 'rejected', note: string) =>
      call<ResolveResult>(cfg, 'POST', '/backoffice/reviews', { review_id: reviewId, status, ...(note.trim() ? { note: note.trim() } : {}) }),
  };
}

export type BackofficeApi = ReturnType<typeof createBackofficeApi>;
