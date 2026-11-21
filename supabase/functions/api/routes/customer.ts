// Rutele clientului, partea 1: /me, /catalog, /quotes, /applications, /consents, /assessment.

import { Hono } from 'hono';
import type { Env } from '../lib/auth.ts';
import { bad, conflict, onlyKeys, readJson } from '../lib/http.ts';
import { catalog, myCustomer, visibleApplication } from '../lib/data.ts';
import { admin } from '../lib/supabase.ts';
import { appendLedger } from '../lib/ledger.ts';
import {
  assessAffordability, buildQuote, canonicalJson, countLateBills12m, localDate, QuoteError, sha256Hex,
  validateAssessmentInput,
} from '../../_shared/engine/index.ts';

export const AD_WARNING = 'Atentie! Banii imprumutati costa bani.';
const PERSONALISED_TEXT = 'Oferta personalizata automat pe baza istoricului tau de plata.';

const r = new Hono<Env>();

// 1. GET /me
r.get('/me', async (c) => {
  if (c.get('isOperator')) return c.json({ role: 'operator', display_name: 'Operator' });
  const cu = await myCustomer(c.get('db'), c.get('userId'));
  return c.json({
    role: 'customer', customer_id: cu.code, display_name: cu.display_name, segment: cu.segment,
    tenure_months: cu.tenure_months, plan_name: cu.plan_name, monthly_bill_lei: cu.monthly_bill_lei,
  });
});

// 2. GET /catalog
r.get('/catalog', async (c) => {
  const cu = await myCustomer(c.get('db'), c.get('userId'));
  const cat = await catalog(c.get('db'));
  const personalised = cu.segment === 'postpaid';
  return c.json({
    devices: cat.devices,
    products: cat.products.map((p) => ({
      id: p.id, name: p.name, lender: p.lender_name, nominal_rate_pct: p.nominal_rate_pct,
      fees_lei: p.fees_lei, terms: p.terms, applies_to: p.applies_to,
    })),
    ad_warning: AD_WARNING,
    personalised: { is_personalised: personalised, text: personalised ? PERSONALISED_TEXT : null },
  });
});

/** Valideaza { sku, product_id, term_months } si calculeaza oferta. */
async function quoteFor(c: { get: (k: 'db') => Env['Variables']['db'] }, body: Record<string, unknown>) {
  const { sku, product_id, term_months } = body;
  if (typeof sku !== 'string' || typeof product_id !== 'string' || typeof term_months !== 'number') {
    throw bad('VALIDATION', 'Trimite sku, product_id si term_months.', ['sku', 'product_id', 'term_months']);
  }
  const cat = await catalog(c.get('db'));
  const device = cat.devices.find((d) => d.sku === sku);
  const product = cat.products.find((p) => p.id === product_id);
  if (!device) throw bad('VALIDATION', 'Produsul nu exista.', ['sku']);
  if (!product) throw bad('VALIDATION', 'Produsul de credit nu exista.', ['product_id']);
  try {
    return { device, product, quote: buildQuote(device, product, term_months, localDate(new Date())) };
  } catch (e) {
    if (e instanceof QuoteError) throw bad(e.code, e.message, ['term_months']);
    throw e;
  }
}

const quoteJson = (q: ReturnType<typeof buildQuote>) => ({
  installment_lei: q.installment_lei, last_installment_lei: q.last_installment_lei, installments: q.installments,
  total_credit_lei: q.total_credit_lei, total_payable_lei: q.total_payable_lei, total_cost_lei: q.total_cost_lei,
  nominal_rate_pct: q.nominal_rate_pct, apr_pct: q.apr_pct,
});

// 3. POST /quotes  (doar calcul, nu salveaza nimic)
r.post('/quotes', async (c) => {
  await myCustomer(c.get('db'), c.get('userId'));
  const body = await readJson(c.req.raw);
  onlyKeys(body, ['sku', 'product_id', 'term_months']);
  const { quote } = await quoteFor(c, body);
  return c.json(quoteJson(quote));
});

// 4. POST /applications  body: { sku, product_id, term_months, shown: { ad_warning: true, personalised_label?: boolean } }
r.post('/applications', async (c) => {
  const cu = await myCustomer(c.get('db'), c.get('userId'));
  const body = await readJson(c.req.raw);
  onlyKeys(body, ['sku', 'product_id', 'term_months', 'shown']);
  const shown = (body.shown ?? {}) as Record<string, unknown>;
  // art. 8: dovada ca avertismentul a fost afisat inainte de cerere
  if (shown.ad_warning !== true) {
    throw bad('AD_WARNING_NOT_SHOWN', 'Avertismentul "Banii imprumutati costa bani" trebuie afisat inainte.', ['shown.ad_warning']);
  }
  const personalised = cu.segment === 'postpaid';
  // art. 13: daca oferta e personalizata, clientul trebuie sa fi vazut eticheta
  if (personalised && shown.personalised_label !== true) {
    throw bad('PERSONALISED_LABEL_NOT_SHOWN', 'Eticheta "Oferta personalizata automat" trebuie afisata inainte.', ['shown.personalised_label']);
  }
  const { device, product, quote } = await quoteFor(c, body);

  const { data: app, error } = await admin.from('applications').insert({
    customer_id: cu.id, sku: device.sku, product_id: product.id, term_months: quote.installments, status: 'draft',
    principal_lei: quote.total_credit_lei, installment_lei: quote.installment_lei, installments: quote.installments,
    total_payable_lei: quote.total_payable_lei, total_cost_lei: quote.total_cost_lei,
    nominal_rate_pct: quote.nominal_rate_pct, apr_pct: quote.apr_pct, personalised_offer: personalised,
  }).select('id, status').single();
  if (error) throw new Error(error.message);

  await appendLedger(app.id, [
    { event: 'offer_requested', actor: 'customer', payload: { sku: device.sku, product_id: product.id, term_months: quote.installments } },
    { event: 'ad_warning_shown', actor: 'system', payload: { text: AD_WARNING, version: 'v1' } },
    ...(personalised ? [{ event: 'personalised_offer_disclosed', actor: 'system' as const, payload: { version: 'v1' } }] : []),
  ]);
  return c.json({ application_id: app.id, status: app.status, quote: quoteJson(quote) }, 201);
});

// 5. POST /applications/:id/consents  body: { billing_history: boolean, privacy_notice_read: true }
r.post('/applications/:id/consents', async (c) => {
  const app = await visibleApplication(c.get('db'), c.req.param('id'));
  const body = await readJson(c.req.raw);
  onlyKeys(body, ['billing_history', 'privacy_notice_read']);
  if (body.privacy_notice_read !== true) {
    throw bad('PRIVACY_NOTICE_REQUIRED', 'Trebuie sa confirmi ca ai citit nota de informare.', ['privacy_notice_read']);
  }
  if (typeof body.billing_history !== 'boolean') throw bad('VALIDATION', 'Alege daca folosim istoricul facturilor.', ['billing_history']);
  if (app.status !== 'draft') throw conflict('ALREADY_ASSESSED', 'Cererea a fost deja evaluata.');

  const now = new Date().toISOString();
  const { error } = await admin.from('consents').upsert([
    { application_id: app.id, purpose: 'privacy_notice', granted: true, created_at: now },
    { application_id: app.id, purpose: 'billing_history', granted: body.billing_history, created_at: now },
  ], { onConflict: 'application_id,purpose' });
  if (error) throw new Error(error.message);

  await appendLedger(app.id, [
    { event: 'consent_given', actor: 'customer', payload: { purpose: 'privacy_notice', notice_version: 'v1' } },
    ...(body.billing_history ? [{ event: 'consent_given', actor: 'customer' as const, payload: { purpose: 'billing_history', notice_version: 'v1' } }] : []),
  ]);
  return c.json({ ok: true });
});

// 6. POST /applications/:id/assessment  body: DOAR { net_income_lei, monthly_expenses_lei, other_installments_lei }
r.post('/applications/:id/assessment', async (c) => {
  const db = c.get('db');
  const app = await visibleApplication(db, c.req.param('id'));
  const v = validateAssessmentInput(await readJson(c.req.raw));
  if (!v.ok) throw bad(v.code, v.message, v.fields);
  if (app.status !== 'draft') throw conflict('ALREADY_ASSESSED', 'Cererea a fost deja evaluata.');

  const { data: consents } = await db.from('consents').select('purpose, granted').eq('application_id', app.id);
  if (!consents?.some((x) => x.purpose === 'privacy_notice' && x.granted)) {
    throw bad('CONSENTS_MISSING', 'Mai intai confirma nota de informare.', ['consents']);
  }
  const billingConsent = consents.some((x) => x.purpose === 'billing_history' && x.granted);

  const [{ data: cust }, { data: bureau }] = await Promise.all([
    db.from('customers').select('segment').eq('id', app.customer_id).single(),
    db.from('credit_bureau_records').select('other_installments_lei').eq('customer_id', app.customer_id).maybeSingle(),
  ]);
  const segment = cust?.segment as 'postpaid' | 'prepaid';
  const today = localDate(new Date());

  let late: number | null = null;
  let historyStatus: 'used' | 'no_history' | 'no_consent' = 'no_history';
  if (segment === 'postpaid') {
    if (billingConsent) {
      const { data: bills } = await db.from('billing_history').select('period, days_late').eq('customer_id', app.customer_id);
      late = countLateBills12m(bills ?? [], today);
      historyStatus = 'used';
    } else historyStatus = 'no_consent';
  }

  const inp = v.value;
  const res = assessAffordability({
    net_income_lei: inp.net_income_lei, monthly_expenses_lei: inp.monthly_expenses_lei,
    other_installments_declared_lei: inp.other_installments_lei,
    other_installments_bureau_lei: Number(bureau?.other_installments_lei ?? 0),
    new_installment_lei: app.installment_lei, late_bills_12m: late, history_status: historyStatus,
  });

  const { error } = await admin.from('assessments').insert({
    application_id: app.id, net_income_lei: inp.net_income_lei, monthly_expenses_lei: inp.monthly_expenses_lei,
    other_installments_declared_lei: inp.other_installments_lei,
    other_installments_bureau_lei: Number(bureau?.other_installments_lei ?? 0),
    other_installments_used_lei: res.metrics.other_installments_used_lei, new_installment_lei: app.installment_lei,
    late_bills_12m: late, billing_history_used: historyStatus === 'used', dti_pct: res.metrics.dti_pct,
    residual_lei: res.metrics.residual_lei, decision: res.decision, reasons: res.reasons, automated: true,
    engine_version: res.engine_version,
  });
  if (error?.code === '23505') throw conflict('ALREADY_ASSESSED', 'Cererea a fost deja evaluata.');
  if (error) throw new Error(error.message);

  await admin.from('applications').update({ status: res.decision }).eq('id', app.id);
  if (res.decision === 'manual_review') {
    await admin.from('human_reviews').insert({ application_id: app.id, requested_by: 'engine' });
  }
  await appendLedger(app.id, [
    { event: 'assessment_done', actor: 'system', payload: {
      decision: res.decision, reason_codes: res.reasons.map((x) => x.code), engine_version: res.engine_version,
      inputs_sha256: await sha256Hex(canonicalJson(inp)),
    } },
    ...(res.decision === 'rejected' ? [{ event: 'debt_advice_shown', actor: 'system' as const, payload: { version: 'v1' } }] : []),
    ...(res.decision === 'manual_review' ? [{ event: 'human_review_requested', actor: 'system' as const, payload: { requested_by: 'engine' } }] : []),
  ]);

  return c.json({
    decision: res.decision, automated: true, reasons: res.reasons,
    metrics: { dti_pct: res.metrics.dti_pct, residual_lei: res.metrics.residual_lei, late_bills_12m: res.metrics.late_bills_12m },
    human_review_available: true, debt_advice: res.debt_advice,
  });
});

export default r;
