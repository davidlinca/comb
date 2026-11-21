// Generator de date demo (sintetice, deterministe: acelasi seed -> aceleasi date).
// Rulare: node data/generate_seed.ts  ->  scrie data/seed_demo.sql
//
// Ce genereaza:
//  - catalogul (5 produse) si cele 2 produse de credit
//  - cele 3 persone (Ana, Mihai, Ioana), fara cereri: cererile lor se fac live in demo
//  - ~60 de abonati sintetici (45 postpaid, 15 prepaid), cu facturi si date de la Birou (simulat)
//  - ~40 de cereri trecute, in toate starile. Fiecare decizie e calculata de MOTOR (nu scrisa de mana)
//  - jurnalul fiecarei cereri (hash-ul il pune baza de date)
//
// Nu generam „timp pe ecran SECCI” pentru abonatii sintetici: cifrele pentru pitch vin doar din testul real cu oameni.

import { writeFileSync } from 'node:fs';
import {
  addDays, addMonths, assessAffordability, buildQuote, buildSecci, canonicalJson, countLateBills12m,
  daysBetween, localDate, reminderWindow, sha256Hex, withdrawalAmount, withdrawalDeadline,
  type CreditProduct, type Device,
} from '../supabase/functions/_shared/engine/index.ts';

const TODAY = '2026-11-21';
const OPERATOR_NAME = 'Operatorul demo';
const AD_WARNING = 'Atentie! Banii imprumutati costa bani.';

// ---------- PRNG determinist ----------
let state = 20261121;
const rnd = (): number => {
  state |= 0; state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;
const uuid = (): string => {
  const b = Array.from({ length: 16 }, () => int(0, 255));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

// ---------- SQL ----------
const s = (v: string | null) => (v === null ? 'null' : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null) => (v === null ? 'null' : String(v));
const b = (v: boolean | null) => (v === null ? 'null' : v ? 'true' : 'false');
const j = (v: unknown) => `${s(JSON.stringify(v))}::jsonb`;
const out: string[] = [];
const emit = (sql: string) => out.push(sql);
const rows = (table: string, cols: string[], values: string[][]) => {
  if (!values.length) return;
  emit(`insert into public.${table} (${cols.join(', ')}) values\n  ${values.map((v) => `(${v.join(', ')})`).join(',\n  ')};`);
};

// ---------- Catalog ----------
const DEVICES: (Device & { name: string; sort_order: number })[] = [
  { sku: 'PH-1', name: 'Nova 3', category: 'phone', price_lei: 999, sort_order: 1 },
  { sku: 'PH-2', name: 'Nova 5', category: 'phone', price_lei: 2199, sort_order: 2 },
  { sku: 'PH-3', name: 'Nova 7', category: 'phone', price_lei: 3499, sort_order: 3 },
  { sku: 'PH-4', name: 'Nova 9', category: 'phone', price_lei: 5999, sort_order: 4 },
  { sku: 'AC-1', name: 'Casti Air', category: 'accessory', price_lei: 399, sort_order: 5 },
];
const LENDER = { lender_name: 'Credis IFN (demo)', lender_address: 'Str. Exemplu 1, Bucuresti (demo)' };
const PRODUCTS: (CreditProduct & { name: string; lender_name: string; lender_address: string })[] = [
  { id: 'RATE', name: 'Rate prin partener', applies_to: 'phone', nominal_rate_pct: 14.9, fees_lei: 0, terms: [12, 24], ...LENDER },
  { id: 'ZERO4', name: '4 rate fara dobanda', applies_to: 'accessory', nominal_rate_pct: 0, fees_lei: 0, terms: [4], ...LENDER },
];

// ---------- Clienti ----------
type Bill = { period: string; amount_lei: number; due_date: string; paid_on: string | null; days_late: number };
type Customer = {
  id: string; code: string; display_name: string; segment: 'postpaid' | 'prepaid'; tenure_months: number;
  plan_name: string; monthly_bill_lei: number; bills: Bill[]; bureau_lei: number; active_credits: number;
};

const LAST_PERIOD = '2026-10-01'; // ultima factura emisa (scadenta 20 nov.)

function makeBills(tenure: number, amount: number, lateMap: Record<string, number>, profile: 'punctual' | 'occasional' | 'risky'): Bill[] {
  const months = Math.min(tenure, 24);
  const bills: Bill[] = [];
  const lateCount = profile === 'risky' ? int(3, 5) : profile === 'occasional' ? 1 : 0;
  const lateIdx = new Set<number>();
  while (lateIdx.size < Math.min(lateCount, Math.max(0, months - 2))) lateIdx.add(int(2, months - 1));
  for (let k = 0; k < months; k++) {
    const period = addMonths(LAST_PERIOD, -k);
    const due = addDays(addMonths(period, 1), 19); // ziua 20 a lunii urmatoare
    let delay = period in lateMap ? lateMap[period] : lateIdx.has(k) ? int(31, 75) : chance(0.15) ? int(1, 12) : -int(0, 8);
    let paid: string | null = addDays(due, delay);
    if (paid > TODAY) { paid = null; delay = Math.max(0, daysBetween(due, TODAY)); }
    bills.push({ period, amount_lei: amount, due_date: due, paid_on: paid, days_late: Math.max(0, delay) });
  }
  return bills;
}

const PERSONAS: (Customer & { email: string })[] = [
  { id: uuid(), code: 'c_ana', display_name: 'Ana Popescu', segment: 'postpaid', tenure_months: 38, plan_name: 'Nelimitat 15',
    monthly_bill_lei: 45, bills: [], bureau_lei: 300, active_credits: 1, email: 'ana@demo.comb.ro' },
  { id: uuid(), code: 'c_mihai', display_name: 'Mihai Ionescu', segment: 'postpaid', tenure_months: 14, plan_name: 'Nelimitat 10',
    monthly_bill_lei: 35, bills: [], bureau_lei: 650, active_credits: 2, email: 'mihai@demo.comb.ro' },
  { id: uuid(), code: 'c_ioana', display_name: 'Ioana Marin', segment: 'prepaid', tenure_months: 20, plan_name: 'Cartela Prepaid',
    monthly_bill_lei: 0, bills: [], bureau_lei: 900, active_credits: 2, email: 'ioana@demo.comb.ro' },
];
PERSONAS[0].bills = makeBills(38, 45, {}, 'punctual').map((x) => ({ ...x, paid_on: x.paid_on && x.days_late > 0 ? x.due_date : x.paid_on, days_late: 0 }));
PERSONAS[1].bills = makeBills(14, 35, { '2026-03-01': 45, '2026-08-01': 38 }, 'punctual');

const FIRST = ['Andrei', 'Elena', 'Alexandru', 'Maria', 'Stefan', 'Ioana', 'Radu', 'Cristina', 'Vlad', 'Andreea', 'Bogdan', 'Diana',
  'Cosmin', 'Roxana', 'Mihaela', 'George', 'Larisa', 'Florin', 'Simona', 'Adrian', 'Bianca', 'Catalin', 'Oana', 'Sorin', 'Alina', 'Dan', 'Irina', 'Paul'];
const LAST = ['Pop', 'Popa', 'Rusu', 'Stan', 'Munteanu', 'Matei', 'Lazar', 'Ciobanu', 'Dobre', 'Barbu', 'Nistor', 'Florea', 'Toma', 'Moldovan',
  'Sima', 'Ene', 'Dinu', 'Tudor', 'Ilie', 'Neagu', 'Voicu', 'Preda', 'Constantin', 'Oprea', 'Marinescu', 'Dumitru'];
const PLANS: [string, number][] = [['Nelimitat 10', 35], ['Nelimitat 15', 45], ['Nelimitat 20', 55], ['Nelimitat 25', 65], ['Familie', 89]];

const synthetic: Customer[] = [];
const usedNames = new Set(PERSONAS.map((p) => p.display_name));
for (let i = 1; i <= 60; i++) {
  let name = '';
  do { name = `${pick(FIRST)} ${pick(LAST)}`; } while (usedNames.has(name));
  usedNames.add(name);
  const postpaid = i <= 45;
  const [plan, bill] = postpaid ? pick(PLANS) : ['Cartela Prepaid', 0] as [string, number];
  const tenure = int(3, 96);
  const profile = chance(0.7) ? 'punctual' : chance(0.66) ? 'occasional' : 'risky';
  const bureau = chance(0.5) ? 0 : int(2, 30) * 50;
  synthetic.push({
    id: uuid(), code: `c_s${String(i).padStart(3, '0')}`, display_name: name, segment: postpaid ? 'postpaid' : 'prepaid',
    tenure_months: tenure, plan_name: plan, monthly_bill_lei: bill,
    bills: postpaid ? makeBills(tenure, bill, {}, profile) : [], bureau_lei: bureau, active_credits: bureau === 0 ? 0 : int(1, 3),
  });
}
const customers: Customer[] = [...PERSONAS, ...synthetic];

// ---------- Cereri trecute + jurnal ----------
type Ledger = { at: Date; event: string; actor: 'customer' | 'system' | 'operator'; payload: Record<string, unknown> };
const apps: string[][] = [], consents: string[][] = [], assessments: string[][] = [], reviews: string[][] = [];
const seccis: string[][] = [], agreements: string[][] = [], notifications: string[][] = [];
const ledgerByApp: { app: string; entries: Ledger[] }[] = [];
const stats: Record<string, number> = {};
const bump = (k: string) => { stats[k] = (stats[k] ?? 0) + 1; };

const plus = (d: Date, sec: number) => new Date(d.getTime() + sec * 1000);
const iso = (d: Date) => d.toISOString();
const OPERATOR_SQL = `(select id from auth.users where email = 'operator@demo.comb.ro')`;

// Scenarii-tinta: primele 6 cereri sunt recente (coada de revizuire), restul amestecate.
const older: ('approved' | 'manual_review' | 'rejected' | 'draft')[] = [
  ...Array(25).fill('approved'), ...Array(5).fill('manual_review'), ...Array(4).fill('rejected'),
].sort(() => rnd() - 0.5);
older.splice(1, 0, 'draft'); older.splice(13, 0, 'draft');
const TARGETS = ['manual_review', 'manual_review', 'manual_review', 'manual_review', 'manual_review', 'rejected', ...older];

const candidates = [...synthetic].sort(() => rnd() - 0.5).slice(0, TARGETS.length);
for (let idx = 0; idx < candidates.length; idx++) {
  const c = candidates[idx];
  const appId = uuid();
  // cereri din ultimele 30 de zile; ultimele 6 in ultimele 2 zile (ca sa avem coada de revizuire)
  const dayOffset = idx < 6 ? int(0, 1) : int(2, 30);
  const day = addDays(TODAY, -dayOffset - 1);
  const t0 = new Date(`${day}T${String(int(7, 18)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}Z`);
  const accessory = chance(0.15);
  const device = accessory ? DEVICES[4] : pick([DEVICES[0], DEVICES[1], DEVICES[1], DEVICES[2], DEVICES[2], DEVICES[3]]);
  const product = accessory ? PRODUCTS[1] : PRODUCTS[0];
  const term = accessory ? 4 : chance(0.7) ? 24 : 12;
  const L: Ledger[] = [];
  const add = (at: Date, event: string, actor: Ledger['actor'], payload: Record<string, unknown> = {}) => L.push({ at, event, actor, payload });

  const quote = buildQuote(device, product, term, localDate(t0));
  let status = 'draft';
  const personalised = c.segment === 'postpaid';
  add(t0, 'offer_requested', 'customer', { sku: device.sku, product_id: product.id, term_months: term });
  add(plus(t0, 1), 'ad_warning_shown', 'system', { text: AD_WARNING, version: 'v1' });
  if (personalised) add(plus(t0, 2), 'personalised_offer_disclosed', 'system', { version: 'v1' });

  // 2 cereri abandonate inainte de evaluare
  if (TARGETS[idx] === 'draft') {
    bump('draft');
    apps.push([s(appId), s(c.id), s(device.sku), s(product.id), n(term), s('draft'), n(quote.total_credit_lei), n(quote.installment_lei),
      n(quote.installments), n(quote.total_payable_lei), n(quote.total_cost_lei), n(quote.nominal_rate_pct), n(quote.apr_pct), b(personalised), s(iso(t0))]);
    ledgerByApp.push({ app: appId, entries: L });
    continue;
  }

  // Acorduri
  let t = plus(t0, int(60, 180));
  const billingConsent = c.segment === 'postpaid' ? chance(0.85) : true;
  consents.push([s(appId), s('privacy_notice'), 'true', s(iso(t))]);
  add(t, 'consent_given', 'customer', { purpose: 'privacy_notice', notice_version: 'v1' });
  consents.push([s(appId), s('billing_history'), b(billingConsent), s(iso(t))]);
  if (billingConsent) add(plus(t, 1), 'consent_given', 'customer', { purpose: 'billing_history', notice_version: 'v1' });

  // Evaluare (prin motor). Datele declarate pornesc de la un scenariu-tinta, dar DECIZIA o ia motorul.
  const target = TARGETS[idx];
  const inst = quote.installment_lei;
  let income = c.segment === 'postpaid' ? int(60, 180) * 50 : int(44, 100) * 50;
  let declaredFinal = c.bureau_lei > 0 && chance(0.2) ? Math.max(0, c.bureau_lei - int(1, 6) * 50) : c.bureau_lei;
  const other = () => Math.max(declaredFinal, c.bureau_lei);
  const fitDti = () => { while ((other() + inst) / income > 0.36) income += 250; };
  let expenses: number;
  if (target === 'approved') {
    fitDti();
    expenses = Math.round((income * (0.3 + rnd() * 0.15)) / 10) * 10;
  } else if (target === 'manual_review') {
    fitDti();
    expenses = Math.max(0, Math.round(income - other() - inst - int(8, 45) * 10));
  } else if (chance(0.5)) { // respins: nu ramane nimic
    fitDti();
    expenses = Math.round(income - other() - inst + int(5, 40) * 10);
  } else {                  // respins: grad de indatorare peste 40%
    declaredFinal = Math.max(declaredFinal, Math.ceil((income * 0.42 - inst) / 50) * 50);
    expenses = Math.round((income * 0.3) / 10) * 10;
  }
  const historyStatus = c.segment === 'prepaid' ? 'no_history' : billingConsent ? 'used' : 'no_consent';
  const late = historyStatus === 'used' ? countLateBills12m(c.bills, localDate(t0)) : null;
  const res = assessAffordability({
    net_income_lei: income, monthly_expenses_lei: expenses, other_installments_declared_lei: declaredFinal,
    other_installments_bureau_lei: c.bureau_lei, new_installment_lei: inst, late_bills_12m: late,
    history_status: historyStatus as 'used' | 'no_history' | 'no_consent',
    // seed-ul istoric (engine-v1) nu avea Open Banking; aici banca confirma ce s-a declarat (vezi data/bank_insights.sql)
    bank_income_lei: income, bank_expenses_lei: expenses, bank_status: 'used',
  });
  const inputs = { net_income_lei: income, monthly_expenses_lei: expenses, other_installments_lei: declaredFinal };
  t = plus(t, int(40, 120));
  assessments.push([s(appId), n(income), n(expenses), n(declaredFinal), n(c.bureau_lei), n(res.metrics.other_installments_used_lei),
    n(quote.installment_lei), n(late), b(historyStatus === 'used'), n(res.metrics.dti_pct), n(res.metrics.residual_lei), s(res.decision),
    j(res.reasons), 'true', s(res.engine_version), s(iso(t))]);
  add(t, 'assessment_done', 'system', {
    decision: res.decision, reason_codes: res.reasons.map((r) => r.code), engine_version: res.engine_version,
    inputs_sha256: await sha256Hex(canonicalJson(inputs)),
  });
  status = res.decision;
  bump(`decizie_${res.decision}`);

  const recent = dayOffset <= 1;
  if (res.decision === 'rejected') {
    add(plus(t, 1), 'debt_advice_shown', 'system', { version: 'v1' });
    if (recent || chance(0.3)) {
      const rt = plus(t, int(30, 300));
      add(rt, 'human_review_requested', 'customer', { requested_by: 'customer' });
      if (recent) { reviews.push([s(appId), s('customer'), s('Va rog sa verificati din nou.'), s('pending'), 'null', 'null', s(iso(rt)), 'null']); bump('revizuire_in_asteptare'); }
      else {
        const rr = plus(rt, int(2, 20) * 3600);
        reviews.push([s(appId), s('customer'), s('Va rog sa verificati din nou.'), s('rejected'), OPERATOR_SQL, s('Venitul nu acopera cheltuielile si ratele.'), s(iso(rt)), s(iso(rr))]);
        add(rr, 'human_review_resolved', 'operator', { status: 'rejected' });
        bump('revizuire_rezolvata');
      }
    }
  } else if (res.decision === 'manual_review') {
    const rt = plus(t, 1);
    add(rt, 'human_review_requested', 'system', { requested_by: 'engine' });
    if (recent) { reviews.push([s(appId), s('engine'), 'null', s('pending'), 'null', 'null', s(iso(rt)), 'null']); bump('revizuire_in_asteptare'); }
    else {
      const ok = chance(0.6);
      const rr = plus(rt, int(2, 20) * 3600);
      reviews.push([s(appId), s('engine'), 'null', s(ok ? 'approved' : 'rejected'), OPERATOR_SQL,
        s(ok ? 'Intarzierile au fost izolate; venitul acopera rata.' : 'Rest prea mic dupa rate; nu e responsabil sa acordam.'), s(iso(rt)), s(iso(rr))]);
      add(rr, 'human_review_resolved', 'operator', { status: ok ? 'approved' : 'rejected' });
      status = ok ? 'approved' : 'rejected';
      bump('revizuire_rezolvata');
    }
  } else {
    // aprobat: 65% semneaza, 20% vede SECCI si se opreste, 15% se opreste dupa decizie
    const r = rnd();
    if (r < 0.85) {
      const shownAt = plus(t, int(20, 90));
      const secci = buildSecci(quote, product, OPERATOR_NAME);
      const secciSha = await sha256Hex(canonicalJson(secci));
      const secciId = uuid();
      seccis.push([s(secciId), s(appId), s('v1'), j(secci), s(secciSha), s(iso(shownAt))]);
      add(shownAt, 'secci_shown', 'system', { secci_version: 'v1', content_sha256: secciSha });
      if (r < 0.65) {
        const otpAt = plus(shownAt, int(60, 240));
        add(otpAt, 'otp_sent', 'system', { expires_in_s: 300 });
        const signedAt = plus(otpAt, int(20, 90));
        const signedDate = localDate(signedAt);
        const deadline = withdrawalDeadline(signedDate);
        const rem = reminderWindow(shownAt, signedAt, signedDate);
        const agrId = uuid();
        add(signedAt, 'agreement_signed', 'customer', { agreement_id: agrId, first_installment_due: quote.schedule[0].due_date, withdrawal_deadline: deadline });
        status = 'signed';
        bump('semnate');
        let agrStatus = 'active', withdrawnAt: string | null = null, amount: number | null = null, returnBy: string | null = null;
        // reminder trimis in ziua 1 (daca a trecut)
        if (rem.required && rem.from && rem.from <= TODAY) {
          const remAt = new Date(`${rem.from}T08:00:00Z`);
          notifications.push([s(appId), s('withdrawal_reminder'), s(iso(remAt)),
            s(`Iti amintim ca te poti retrage din contract pana la ${deadline}, fara motiv.`)]);
          add(remAt, 'withdrawal_reminder_sent', 'system', { channel: 'email (simulat)', window_from: rem.from, window_to: rem.to });
        }
        // fiecare al 5-lea contract semnat se retrage (doar daca a trecut destul timp)
        if ((stats['semnate'] ?? 0) % 5 === 2 && daysBetween(signedDate, TODAY) >= 3) {
          const wDate = addDays(signedDate, int(2, Math.min(13, daysBetween(signedDate, TODAY) - 1)));
          const wAt = new Date(`${wDate}T10:${String(int(10, 59)).padStart(2, '0')}:00Z`);
          const w = withdrawalAmount(quote.total_credit_lei, quote.nominal_rate_pct, signedDate, wDate);
          agrStatus = 'withdrawn'; withdrawnAt = iso(wAt); amount = w.amount_to_return_lei; returnBy = w.return_by;
          add(wAt, 'withdrawn', 'customer', { days_used: w.days_used, amount_to_return_lei: w.amount_to_return_lei, return_by: w.return_by });
          bump('retrase');
        }
        agreements.push([s(agrId), s(appId), s(secciId), s(iso(signedAt)), s(iso(shownAt)), s(quote.schedule[0].due_date), s(deadline),
          b(rem.required), s(rem.from), s(rem.to), s(agrStatus), withdrawnAt ? s(withdrawnAt) : 'null', n(amount), s(returnBy)]);
      } else bump('oprit_dupa_secci');
    } else bump('oprit_dupa_decizie');
  }

  apps.push([s(appId), s(c.id), s(device.sku), s(product.id), n(term), s(status), n(quote.total_credit_lei), n(quote.installment_lei),
    n(quote.installments), n(quote.total_payable_lei), n(quote.total_cost_lei), n(quote.nominal_rate_pct), n(quote.apr_pct), b(personalised), s(iso(t0))]);
  L.sort((a, x) => a.at.getTime() - x.at.getTime());
  ledgerByApp.push({ app: appId, entries: L });
}

// ---------- SQL ----------
emit(`-- Date demo generate de data/generate_seed.ts (seed 20261121). Toate datele sunt FICTIVE.\nbegin;`);
rows('devices', ['sku', 'name', 'category', 'price_lei', 'is_active', 'sort_order'],
  DEVICES.map((d) => [s(d.sku), s(d.name), s(d.category), n(d.price_lei), 'true', n(d.sort_order)]));
rows('credit_products', ['id', 'name', 'applies_to', 'nominal_rate_pct', 'fees_lei', 'terms', 'lender_name', 'lender_address', 'is_active'],
  PRODUCTS.map((p) => [s(p.id), s(p.name), s(p.applies_to), n(p.nominal_rate_pct), n(p.fees_lei), s(`{${p.terms.join(',')}}`), s(p.lender_name), s(p.lender_address), 'true']));
rows('customers', ['id', 'code', 'display_name', 'segment', 'tenure_months', 'plan_name', 'monthly_bill_lei', 'is_demo'],
  customers.map((c) => [s(c.id), s(c.code), s(c.display_name), s(c.segment), n(c.tenure_months), s(c.plan_name), n(c.monthly_bill_lei), 'true']));
rows('billing_history', ['customer_id', 'period', 'amount_lei', 'due_date', 'paid_on', 'days_late'],
  customers.flatMap((c) => c.bills.map((x) => [s(c.id), s(x.period), n(x.amount_lei), s(x.due_date), s(x.paid_on), n(x.days_late)])));
rows('credit_bureau_records', ['customer_id', 'other_installments_lei', 'active_credits'],
  customers.map((c) => [s(c.id), n(c.bureau_lei), n(c.active_credits)]));
rows('applications', ['id', 'customer_id', 'sku', 'product_id', 'term_months', 'status', 'principal_lei', 'installment_lei', 'installments',
  'total_payable_lei', 'total_cost_lei', 'nominal_rate_pct', 'apr_pct', 'personalised_offer', 'created_at'], apps);
rows('consents', ['application_id', 'purpose', 'granted', 'created_at'], consents);
rows('assessments', ['application_id', 'net_income_lei', 'monthly_expenses_lei', 'other_installments_declared_lei', 'other_installments_bureau_lei',
  'other_installments_used_lei', 'new_installment_lei', 'late_bills_12m', 'billing_history_used', 'dti_pct', 'residual_lei', 'decision', 'reasons',
  'automated', 'engine_version', 'created_at'], assessments);
rows('human_reviews', ['application_id', 'requested_by', 'customer_message', 'status', 'operator_user_id', 'operator_note', 'requested_at', 'resolved_at'], reviews);
rows('secci_documents', ['id', 'application_id', 'secci_version', 'content', 'content_sha256', 'first_shown_at'], seccis);
rows('agreements', ['id', 'application_id', 'secci_document_id', 'signed_at', 'info_received_at', 'first_installment_due', 'withdrawal_deadline',
  'reminder_required', 'reminder_from', 'reminder_to', 'status', 'withdrawn_at', 'amount_to_return_lei', 'return_by'], agreements);
rows('notifications', ['application_id', 'kind', 'sent_at', 'body'], notifications);
// jurnalul: in ordine, pe cerere (seq, prev_hash si hash le pune trigger-ul)
rows('ledger_entries', ['application_id', 'occurred_at', 'event', 'actor', 'payload'],
  ledgerByApp.flatMap(({ app, entries }) => entries.map((e) => [s(app), s(iso(e.at)), s(e.event), s(e.actor), j(e.payload)])));
emit('commit;');

writeFileSync(new URL('./seed_demo.sql', import.meta.url), out.join('\n\n') + '\n');
const ledgerCount = ledgerByApp.reduce((a, x) => a + x.entries.length, 0);
console.log(JSON.stringify({
  clienti: customers.length, postpaid: customers.filter((c) => c.segment === 'postpaid').length,
  facturi: customers.reduce((a, c) => a + c.bills.length, 0), cereri: apps.length, jurnal: ledgerCount, ...stats,
}, null, 1));
