// Rutele clientului, partea 1: /me, /catalog, /quotes, /applications, /consents, /assessment
// + GET /applications/:id (starea cererii, adaugata in partea 2).

import { Hono } from 'hono';
import type { Env } from '../lib/auth.ts';
import { bad, conflict, onlyKeys, readJson } from '../lib/http.ts';
import { catalog, myApplication, myCustomer } from '../lib/data.ts';
import { admin } from '../lib/supabase.ts';
import { appendLedger } from '../lib/ledger.ts';
import { nextStep, pickCurrent } from '../lib/flow.ts';
import {
  assessAffordability, BANK_SOURCE, buildQuote, canonicalJson, countLateBills12m, DEBT_ADVICE, localDate, QuoteError, sha256Hex,
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
  const { app } = await myApplication(c.get('db'), c.get('userId'), c.req.param('id'));
  const body = await readJson(c.req.raw);
  onlyKeys(body, ['billing_history', 'bank_data', 'privacy_notice_read']);
  if (body.privacy_notice_read !== true) {
    throw bad('PRIVACY_NOTICE_REQUIRED', 'Trebuie sa confirmi ca ai citit nota de informare.', ['privacy_notice_read']);
  }
  if (typeof body.billing_history !== 'boolean') throw bad('VALIDATION', 'Alege daca folosim istoricul facturilor.', ['billing_history']);
  // bank_data: obligatoriu true/false, fara valoare implicita (decizie 21.11, 11:45)
  if (typeof body.bank_data !== 'boolean') throw bad('VALIDATION', 'Alege daca putem citi datele din contul tau bancar.', ['bank_data']);
  if (app.status !== 'draft') throw conflict('ALREADY_ASSESSED', 'Cererea a fost deja evaluata.');

  const now = new Date().toISOString();
  const { error } = await admin.from('consents').upsert([
    { application_id: app.id, purpose: 'privacy_notice', granted: true, created_at: now },
    { application_id: app.id, purpose: 'billing_history', granted: body.billing_history, created_at: now },
    { application_id: app.id, purpose: 'bank_data', granted: body.bank_data, created_at: now },
  ], { onConflict: 'application_id,purpose' });
  if (error) throw new Error(error.message);

  await appendLedger(app.id, [
    { event: 'consent_given', actor: 'customer', payload: { purpose: 'privacy_notice', notice_version: 'v1' } },
    ...(body.billing_history ? [{ event: 'consent_given', actor: 'customer' as const, payload: { purpose: 'billing_history', notice_version: 'v1' } }] : []),
    ...(body.bank_data ? [{ event: 'consent_given', actor: 'customer' as const, payload: { purpose: 'bank_data', notice_version: 'v1' } }] : []),
  ]);
  return c.json({ ok: true });
});

// 6. POST /applications/:id/assessment  body: DOAR { net_income_lei, monthly_expenses_lei, other_installments_lei }
r.post('/applications/:id/assessment', async (c) => {
  const db = c.get('db');
  const { app } = await myApplication(db, c.get('userId'), c.req.param('id'));
  const v = validateAssessmentInput(await readJson(c.req.raw));
  if (!v.ok) throw bad(v.code, v.message, v.fields);
  if (app.status !== 'draft') throw conflict('ALREADY_ASSESSED', 'Cererea a fost deja evaluata.');

  const { data: consents } = await db.from('consents').select('purpose, granted').eq('application_id', app.id);
  if (!consents?.some((x) => x.purpose === 'privacy_notice' && x.granted)) {
    throw bad('CONSENTS_MISSING', 'Mai intai confirma nota de informare.', ['consents']);
  }
  const billingConsent = consents.some((x) => x.purpose === 'billing_history' && x.granted);
  const bankConsent = consents.some((x) => x.purpose === 'bank_data' && x.granted);

  const [{ data: cust }, { data: bureau }, { data: bank }] = await Promise.all([
    db.from('customers').select('segment').eq('id', app.customer_id).single(),
    db.from('credit_bureau_records').select('other_installments_lei').eq('customer_id', app.customer_id).maybeSingle(),
    // Open Banking (simulat): citit DOAR cu acordul bank_data
    bankConsent
      ? db.from('bank_account_insights').select('net_income_lei, essential_expenses_lei, installments_seen_lei').eq('customer_id', app.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const bankStatus: 'used' | 'no_consent' | 'unavailable' = !bankConsent ? 'no_consent' : bank ? 'used' : 'unavailable';
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
    bank_income_lei: bank ? Number(bank.net_income_lei) : null,
    bank_expenses_lei: bank ? Number(bank.essential_expenses_lei) : null,
    bank_installments_lei: bank ? Number(bank.installments_seen_lei) : null,
    bank_status: bankStatus,
  });
  const vf = res.verification;

  const { error } = await admin.from('assessments').insert({
    application_id: app.id, net_income_lei: inp.net_income_lei, monthly_expenses_lei: inp.monthly_expenses_lei,
    other_installments_declared_lei: inp.other_installments_lei,
    other_installments_bureau_lei: Number(bureau?.other_installments_lei ?? 0),
    other_installments_used_lei: res.metrics.other_installments_used_lei, other_installments_bank_lei: vf.other_installments.bank_lei,
    new_installment_lei: app.installment_lei,
    late_bills_12m: late, billing_history_used: historyStatus === 'used', dti_pct: res.metrics.dti_pct,
    residual_lei: res.metrics.residual_lei, decision: res.decision, reasons: res.reasons, automated: true,
    engine_version: res.engine_version,
    bank_data_used: vf.bank_data_used, income_verified_lei: vf.income.verified_lei, income_used_lei: vf.income.used_lei,
    expenses_verified_lei: vf.expenses.verified_lei, expenses_used_lei: vf.expenses.used_lei,
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
      income_verification: vf.bank_data_used ? 'open_banking_simulated' : bankStatus === 'no_consent' ? 'no_consent' : 'unavailable',
    } },
    ...(res.decision === 'rejected' ? [{ event: 'debt_advice_shown', actor: 'system' as const, payload: { version: 'v1' } }] : []),
    ...(res.decision === 'manual_review' ? [{ event: 'human_review_requested', actor: 'system' as const, payload: { requested_by: 'engine' } }] : []),
  ]);

  return c.json({
    decision: res.decision, automated: true, reasons: res.reasons,
    metrics: { dti_pct: res.metrics.dti_pct, residual_lei: res.metrics.residual_lei, late_bills_12m: res.metrics.late_bills_12m },
    verification: vf,
    human_review_available: true, debt_advice: res.debt_advice,
  });
});

// 6c. GET /applications/current  (cardul „Cererea ta” din magazin; decizie 21.11, 15:55)
// Ultima cerere neincheiata a clientului (in curs / in analiza / aprobata / contract activ), fara cele arhivate.
// Trebuie inregistrata INAINTE de /applications/:id. Doar citire, fara jurnal.
r.get('/applications/current', async (c) => {
  const db = c.get('db');
  const cu = await myCustomer(db, c.get('userId'));
  const { data, error } = await db.from('applications')
    .select('id, status, sku, product_id, term_months, installment_lei, installments, total_payable_lei, created_at, agreements(id, status)')
    .eq('customer_id', cu.id).is('archived_at', null).order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  const one = (v: unknown) => (Array.isArray(v) ? v[0] ?? null : v ?? null) as { id: string; status: string } | null;
  const rows = (data ?? []).map((a) => ({ ...a, agreement: one(a.agreements), agreement_status: one(a.agreements)?.status ?? null }));
  const cur = pickCurrent(rows);
  if (!cur) return c.json({ application: null });

  const [cons, secci, dev] = await Promise.all([
    db.from('consents').select('purpose, granted').eq('application_id', cur.id),
    db.from('secci_documents').select('id').eq('application_id', cur.id).limit(1),
    db.from('devices').select('name').eq('sku', cur.sku).maybeSingle(),
  ]);
  for (const x of [cons, secci, dev]) if (x.error) throw new Error(x.error.message);
  return c.json({
    application: {
      application_id: cur.id, status: cur.status, created_at: cur.created_at,
      next_step: nextStep(cur.status, {
        consents_given: (cons.data ?? []).some((x) => x.purpose === 'privacy_notice' && x.granted),
        secci_shown: (secci.data ?? []).length > 0,
      }),
      sku: cur.sku, device_name: dev.data?.name ?? cur.sku, product_id: cur.product_id, term_months: cur.term_months,
      installment_lei: Number(cur.installment_lei), installments: cur.installments, total_payable_lei: Number(cur.total_payable_lei),
      agreement_id: cur.agreement?.id ?? null, agreement_status: cur.agreement_status,
    },
  });
});

// 6b. GET /applications/:id  (doar citire: starea cererii dupa refresh sau dupa revizuirea umana; decizie 21.11, 03:20)
/** Verificarea salvata in `assessments` (evaluarile engine-v1 nu au cifre folosite: atunci folosit = declarat). */
function verificationFromRow(a: Record<string, unknown>) {
  const num = (v: unknown) => (v == null ? null : Number(v));
  const used = a.bank_data_used === true;
  return {
    bank_data_used: used,
    source: used ? BANK_SOURCE : null,
    income: { declared_lei: Number(a.net_income_lei), verified_lei: num(a.income_verified_lei), used_lei: num(a.income_used_lei) ?? Number(a.net_income_lei) },
    expenses: { declared_lei: Number(a.monthly_expenses_lei), verified_lei: num(a.expenses_verified_lei), used_lei: num(a.expenses_used_lei) ?? Number(a.monthly_expenses_lei) },
    other_installments: {
      declared_lei: Number(a.other_installments_declared_lei), bureau_lei: Number(a.other_installments_bureau_lei),
      bank_lei: num(a.other_installments_bank_lei), used_lei: Number(a.other_installments_used_lei),
    },
  };
}

r.get('/applications/:id', async (c) => {
  const db = c.get('db');
  const { app } = await myApplication(db, c.get('userId'), c.req.param('id'));
  const [cons, asmt, rev, secci, agr] = await Promise.all([
    db.from('consents').select('purpose, granted').eq('application_id', app.id),
    db.from('assessments').select(`decision, automated, reasons, dti_pct, residual_lei, late_bills_12m,
      net_income_lei, monthly_expenses_lei, other_installments_declared_lei, other_installments_bureau_lei, other_installments_used_lei, other_installments_bank_lei,
      bank_data_used, income_verified_lei, income_used_lei, expenses_verified_lei, expenses_used_lei`).eq('application_id', app.id).maybeSingle(),
    db.from('human_reviews').select('status, requested_by, requested_at, resolved_at').eq('application_id', app.id)
      .order('requested_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('secci_documents').select('id').eq('application_id', app.id).limit(1),
    db.from('agreements').select('id, status').eq('application_id', app.id).maybeSingle(),
  ]);
  for (const x of [cons, asmt, rev, secci, agr]) if (x.error) throw new Error(x.error.message);

  const consentsGiven = (cons.data ?? []).some((x) => x.purpose === 'privacy_notice' && x.granted);
  const secciShown = (secci.data ?? []).length > 0;
  const a = asmt.data;
  return c.json({
    application_id: app.id, status: app.status, created_at: app.created_at,
    next_step: nextStep(app.status, { consents_given: consentsGiven, secci_shown: secciShown }),
    offer: {
      sku: app.sku, product_id: app.product_id, term_months: app.term_months, installment_lei: app.installment_lei,
      installments: app.installments, total_credit_lei: app.principal_lei, total_payable_lei: app.total_payable_lei,
      total_cost_lei: app.total_cost_lei, nominal_rate_pct: app.nominal_rate_pct, apr_pct: app.apr_pct,
    },
    // decizia AUTOMATA (motivele raman cele initiale); statusul curent e in `status`
    decision: a ? {
      decision: a.decision, automated: a.automated, reasons: a.reasons,
      metrics: { dti_pct: Number(a.dti_pct), residual_lei: Number(a.residual_lei), late_bills_12m: a.late_bills_12m },
      verification: verificationFromRow(a),
    } : null,
    debt_advice: app.status === 'rejected' ? DEBT_ADVICE : null,
    review: rev.data ? {
      status: rev.data.status, requested_by: rev.data.requested_by, requested_at: rev.data.requested_at, resolved_at: rev.data.resolved_at,
    } : null,
    secci_shown: secciShown,
    agreement_id: agr.data?.id ?? null,
    agreement_status: agr.data?.status ?? null,
  });
});

export default r;
