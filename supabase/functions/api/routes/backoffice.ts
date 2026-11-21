// Back-office (doar operatorul): jurnalul de dovezi si coada de revizuire umana (rutele 15-16).
// Citiri prin `db` (RLS: operatorul vede tot). ledger_verify e executabila doar de service_role -> `admin.rpc`.

import { Hono } from 'hono';
import { type Env, requireOperator } from '../lib/auth.ts';
import { bad, conflict, isUuid, notFound, onlyKeys, readJson } from '../lib/http.ts';
import { admin } from '../lib/supabase.ts';
import { appendLedger } from '../lib/ledger.ts';

const r = new Hono<Env>();
// Montat in index.ts la /backoffice -> middleware-ul se aplica doar pe /backoffice/*
r.use('*', requireOperator);

const LIST_LIMIT = 25; // decizie 21.11: ultimele 25 de cereri, verificate in paralel, fara migrare

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
type Rec = Record<string, unknown>;
/** PostgREST da obiect sau lista pentru tabelele legate; luam primul rand. */
const rec = (v: unknown): Rec | null => one(v as Rec | Rec[] | null);

async function verify(applicationId: string) {
  const { data, error } = await admin.rpc('ledger_verify', { p_application_id: applicationId });
  if (error) throw new Error(`ledger_verify: ${error.message}`);
  const row = one(data as { valid: boolean; entries: number; first_invalid_seq: number | null }[]);
  return { valid: Boolean(row?.valid), entries: Number(row?.entries ?? 0), first_invalid_seq: row?.first_invalid_seq ?? null };
}

// 15. GET /backoffice/ledger[?application_id=...]
r.get('/ledger', async (c) => {
  const db = c.get('db');
  const id = c.req.query('application_id');

  if (id !== undefined) {
    if (!isUuid(id)) throw bad('VALIDATION', 'application_id nu este valid.', ['application_id']);
    const { data: app, error: ae } = await db.from('applications')
      .select('id, status, sku, product_id, term_months, created_at, customers(code, display_name)').eq('id', id).maybeSingle();
    if (ae) throw new Error(ae.message);
    if (!app) throw notFound('Cererea nu exista.');

    const [{ data: rows, error: le }, v] = await Promise.all([
      db.from('ledger_entries').select('seq, occurred_at, event, ccd2_ref, actor, payload, prev_hash, hash, ledger_event_types(description)')
        .eq('application_id', id).order('seq'),
      verify(id),
    ]);
    if (le) throw new Error(le.message);
    const cu = one(app.customers as unknown as { code: string; display_name: string });
    return c.json({
      application: {
        application_id: app.id, status: app.status, sku: app.sku, product_id: app.product_id, term_months: app.term_months,
        created_at: app.created_at, customer: cu,
      },
      valid: v.valid, entries_count: v.entries, first_invalid_seq: v.first_invalid_seq,
      entries: (rows ?? []).map((e) => ({
        seq: e.seq, at: e.occurred_at, event: e.event,
        description: one(e.ledger_event_types as unknown as { description: string })?.description ?? null,
        ccd2_ref: e.ccd2_ref, actor: e.actor, payload: e.payload, hash: e.hash, prev_hash: e.prev_hash,
      })),
    });
  }

  const { data: apps, error } = await db.from('applications')
    .select('id, status, sku, product_id, term_months, created_at, customers(code, display_name)')
    .order('created_at', { ascending: false }).limit(LIST_LIMIT);
  if (error) throw new Error(error.message);
  const checks = await Promise.all((apps ?? []).map((a) => verify(a.id)));
  const list = (apps ?? []).map((a, i) => ({
    application_id: a.id, status: a.status, sku: a.sku, product_id: a.product_id, term_months: a.term_months,
    created_at: a.created_at, customer: one(a.customers as unknown as { code: string; display_name: string }),
    ledger: checks[i],
  }));
  return c.json({ all_valid: checks.every((x) => x.valid), count: list.length, applications: list });
});

// 16a. GET /backoffice/reviews[?status=pending|all]  (implicit: pending, cele mai vechi primele)
r.get('/reviews', async (c) => {
  const db = c.get('db');
  const which = c.req.query('status') ?? 'pending';
  if (which !== 'pending' && which !== 'all') throw bad('VALIDATION', 'status poate fi pending sau all.', ['status']);

  let q = db.from('human_reviews').select(`
    id, requested_by, customer_message, status, operator_note, requested_at, resolved_at,
    applications!inner(id, status, sku, product_id, term_months, principal_lei, installment_lei, created_at,
      customers(code, display_name, segment, tenure_months),
      assessments(decision, reasons, dti_pct, residual_lei, late_bills_12m, net_income_lei, monthly_expenses_lei,
        other_installments_declared_lei, other_installments_bureau_lei, other_installments_used_lei, billing_history_used))
  `);
  q = which === 'pending' ? q.eq('status', 'pending').order('requested_at') : q.order('requested_at', { ascending: false }).limit(50);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const num = (v: unknown) => (v == null ? null : Number(v));
  return c.json({
    reviews: (data ?? []).map((h) => {
      const a = rec(h.applications)!;
      const cu = rec(a.customers);
      const as = rec(a.assessments);
      return {
        review_id: h.id, status: h.status, requested_by: h.requested_by, requested_at: h.requested_at,
        customer_message: h.customer_message, operator_note: h.operator_note, resolved_at: h.resolved_at,
        application: {
          application_id: a.id, status: a.status, sku: a.sku, product_id: a.product_id, term_months: a.term_months,
          principal_lei: num(a.principal_lei), installment_lei: num(a.installment_lei), created_at: a.created_at,
        },
        customer: cu,
        assessment: as && {
          decision: as.decision, reasons: as.reasons, dti_pct: num(as.dti_pct), residual_lei: num(as.residual_lei),
          late_bills_12m: as.late_bills_12m, net_income_lei: num(as.net_income_lei), monthly_expenses_lei: num(as.monthly_expenses_lei),
          other_installments_declared_lei: num(as.other_installments_declared_lei),
          other_installments_bureau_lei: num(as.other_installments_bureau_lei),
          other_installments_used_lei: num(as.other_installments_used_lei), billing_history_used: as.billing_history_used,
        },
      };
    }),
  });
});

// 16b. POST /backoffice/reviews  body: { review_id, status: 'approved'|'rejected', note? }
r.post('/reviews', async (c) => {
  const db = c.get('db');
  const body = await readJson(c.req.raw);
  onlyKeys(body, ['review_id', 'status', 'note']);
  const { review_id, status } = body;
  if (typeof review_id !== 'string' || !isUuid(review_id)) throw bad('VALIDATION', 'review_id nu este valid.', ['review_id']);
  if (status !== 'approved' && status !== 'rejected') throw bad('VALIDATION', 'status poate fi approved sau rejected.', ['status']);
  const note = body.note === undefined || body.note === null ? null : body.note;
  if (note !== null && (typeof note !== 'string' || note.trim().length > 1000)) {
    throw bad('VALIDATION', 'Nota poate avea cel mult 1000 de caractere.', ['note']);
  }
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim() : null;

  const { data: rev, error: re } = await db.from('human_reviews')
    .select('id, application_id, status, applications!inner(status)').eq('id', review_id).maybeSingle();
  if (re) throw new Error(re.message);
  if (!rev) throw notFound('Revizuirea nu exista.');
  if (rev.status !== 'pending') throw conflict('REVIEW_ALREADY_RESOLVED', 'Revizuirea a fost deja rezolvata.');
  const prevAppStatus = String(one(rev.applications as unknown as { status: string })?.status);

  const resolvedAt = new Date().toISOString();
  const { data: upd, error: ue } = await admin.from('human_reviews').update({
    status, operator_user_id: c.get('userId'), operator_note: cleanNote, resolved_at: resolvedAt,
  }).eq('id', review_id).eq('status', 'pending').select('id');
  if (ue) throw new Error(ue.message);
  if (!upd?.length) throw conflict('REVIEW_ALREADY_RESOLVED', 'Revizuirea a fost deja rezolvata.');

  // Cererea primeste decizia omului (nu atingem cererile semnate sau anulate)
  const { data: app, error: ae } = await admin.from('applications').update({ status })
    .eq('id', rev.application_id).in('status', ['manual_review', 'approved', 'rejected']).select('status').maybeSingle();
  if (ae) throw new Error(ae.message);

  await appendLedger(rev.application_id, [{
    event: 'human_review_resolved', actor: 'operator',
    payload: { review_id, status, previous_status: prevAppStatus, has_note: cleanNote !== null },
  }]);
  return c.json({ review_id, status, resolved_at: resolvedAt, application_status: app?.status ?? prevAppStatus });
});

export default r;
