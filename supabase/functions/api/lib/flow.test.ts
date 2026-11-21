// Teste pentru regulile pure din partea 2 (OTP, revizuire, contract, retragere).
// Rulare: node --test supabase/functions/api/lib/flow.test.ts   (si: deno test supabase/functions/api/lib/flow.test.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type AgreementLike, canWithdrawNow, cleanMessage, dataRo, demoToday, isDemoDays, isOtpFormat, isReviewable, newOtpCode,
  isInProgress, nextStep, OTP_MAX_ATTEMPTS, pickCurrent, otpHash, otpState, reminderDue, reminderText, safeEqual, sameKeyFigures,
} from './flow.ts';
import { buildQuote, localDate, reminderWindow, withdrawalAmount, withdrawalDeadline } from '../../_shared/engine/index.ts';

const RATE = { id: 'RATE', applies_to: 'phone' as const, nominal_rate_pct: 14.9, fees_lei: 0, terms: [12, 24] };
const PH2 = { sku: 'PH-2', category: 'phone' as const, price_lei: 2199 };

// ---------- Revizuire ----------

test('revizuire: permisa doar dupa o decizie automata si inainte de semnare', () => {
  for (const s of ['approved', 'rejected', 'manual_review']) assert.equal(isReviewable(s), true, s);
  for (const s of ['draft', 'signed', 'cancelled']) assert.equal(isReviewable(s), false, s);
});

test('revizuire: mesajul e optional, max 1000 caractere, gol -> null', () => {
  assert.deepEqual(cleanMessage(undefined), { ok: true, value: null });
  assert.deepEqual(cleanMessage('   '), { ok: true, value: null });
  assert.deepEqual(cleanMessage(' Va rog '), { ok: true, value: 'Va rog' });
  assert.equal(cleanMessage('x'.repeat(1000)).ok, true);
  assert.equal(cleanMessage('x'.repeat(1001)).ok, false);
  assert.equal(cleanMessage(42).ok, false);
});

test('starea cererii: pasul la care revine aplicatia', () => {
  const f = (consents_given: boolean, secci_shown: boolean) => ({ consents_given, secci_shown });
  assert.equal(nextStep('draft', f(false, false)), 'consents');
  assert.equal(nextStep('draft', f(true, false)), 'assessment');
  assert.equal(nextStep('manual_review', f(true, false)), 'wait_review');
  assert.equal(nextStep('rejected', f(true, false)), 'rejected');
  assert.equal(nextStep('approved', f(true, false)), 'secci');
  assert.equal(nextStep('approved', f(true, true)), 'sign');
  assert.equal(nextStep('signed', f(true, true)), 'agreement');
  assert.equal(nextStep('cancelled', f(true, true)), 'none');
});

// ---------- OTP ----------

test('OTP: 6 cifre, variate, din generatorul criptografic', () => {
  const codes = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const c = newOtpCode();
    assert.match(c, /^\d{6}$/);
    codes.add(c);
  }
  assert.ok(codes.size > 490, `prea multe repetitii: ${codes.size}`);
});

test('OTP: hash-ul depinde de cerere, cod si pepper; codul nu apare in hash', async () => {
  const app = '11111111-1111-4111-8111-111111111111';
  const h = await otpHash(app, '482913', 'pepper-de-test-1234');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.ok(!h.includes('482913'));
  assert.notEqual(h, await otpHash(app, '482914', 'pepper-de-test-1234'));
  assert.notEqual(h, await otpHash('22222222-2222-4222-8222-222222222222', '482913', 'pepper-de-test-1234'));
  assert.notEqual(h, await otpHash(app, '482913', 'alt-pepper-de-test-12'));
  assert.equal(h, await otpHash(app, '482913', 'pepper-de-test-1234'));
});

test('OTP: comparatie corecta si format', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(isOtpFormat('012345'), true);
  for (const v of ['12345', '1234567', '12a456', 123456, null]) assert.equal(isOtpFormat(v), false, String(v));
});

test('OTP: lipsa / consumat / expirat / blocat / folosibil', () => {
  const now = new Date('2026-11-21T12:00:00Z');
  const future = '2026-11-21T12:04:00Z';
  assert.equal(otpState(null, now), 'missing');
  assert.equal(otpState({ expires_at: future, attempts: 0, consumed_at: '2026-11-21T11:59:00Z' }, now), 'missing');
  assert.equal(otpState({ expires_at: '2026-11-21T12:00:00Z', attempts: 0, consumed_at: null }, now), 'expired');
  assert.equal(otpState({ expires_at: future, attempts: OTP_MAX_ATTEMPTS, consumed_at: null }, now), 'locked');
  assert.equal(otpState({ expires_at: future, attempts: OTP_MAX_ATTEMPTS - 1, consumed_at: null }, now), 'usable');
});

// ---------- Contract, reminder, retragere (scenariul din demo: Ana, "Sari la ziua 3") ----------

const signedAt = new Date('2026-11-21T12:02:00Z');
const signedDate = localDate(signedAt); // 2026-11-21
const secciAt = new Date('2026-11-21T11:58:00Z');
const rem = reminderWindow(secciAt, signedAt, signedDate);
const agr: AgreementLike = {
  status: 'active', withdrawal_deadline: withdrawalDeadline(signedDate),
  reminder_required: rem.required, reminder_from: rem.from, reminder_to: rem.to,
};

test('contract: "azi" in demo = data din Bucuresti + zilele sarite', () => {
  assert.equal(demoToday(new Date('2026-11-21T22:30:00Z'), 0), '2026-11-22'); // dupa miezul noptii in Romania
  assert.equal(demoToday(signedAt, 3), '2026-11-24');
  assert.equal(isDemoDays(3), true);
  for (const v of [-1, 61, 2.5, '3']) assert.equal(isDemoDays(v), false, String(v));
});

test('contract: termen 5 dec., reminder 22-28 nov.', () => {
  assert.equal(agr.withdrawal_deadline, '2026-12-05');
  assert.deepEqual([agr.reminder_from, agr.reminder_to], ['2026-11-22', '2026-11-28']);
});

test('reminder: nu in ziua semnarii, da in ziua 3, o singura data, nu dupa retragere', () => {
  assert.equal(reminderDue(agr, '2026-11-21', false), false);
  assert.equal(reminderDue(agr, '2026-11-24', false), true);
  assert.equal(reminderDue(agr, '2026-11-24', true), false);
  assert.equal(reminderDue(agr, '2026-11-29', false), false);
  assert.equal(reminderDue({ ...agr, status: 'withdrawn' }, '2026-11-24', false), false);
  assert.equal(reminderDue({ ...agr, reminder_required: false, reminder_from: null, reminder_to: null }, '2026-11-24', false), false);
});

test('retragere: posibila pana pe 5 dec. inclusiv; suma in ziua 3 = 2.201,69 lei', () => {
  assert.equal(canWithdrawNow(agr, '2026-12-05'), true);
  assert.equal(canWithdrawNow(agr, '2026-12-06'), false);
  assert.equal(canWithdrawNow({ ...agr, status: 'withdrawn' }, '2026-11-24'), false);
  const w = withdrawalAmount(2199, 14.9, signedDate, demoToday(signedAt, 3));
  assert.equal(w.days_used, 3);
  assert.equal(w.amount_to_return_lei, 2201.69);
  assert.equal(w.return_by, '2026-12-24');
});

// ---------- Snapshot vs recalculare ----------

test('oferta: aceleasi cifre cheie indiferent de ziua semnarii; o diferenta e detectata', () => {
  const q1 = buildQuote(PH2, RATE, 24, '2026-11-21');
  const q2 = buildQuote(PH2, RATE, 24, '2026-11-22');
  const snap = {
    principal_lei: q1.total_credit_lei, installment_lei: q1.installment_lei, installments: q1.installments,
    total_payable_lei: q1.total_payable_lei, total_cost_lei: q1.total_cost_lei, nominal_rate_pct: q1.nominal_rate_pct, apr_pct: q1.apr_pct,
  };
  assert.equal(sameKeyFigures(snap, q2), true);
  assert.equal(q2.schedule[0].due_date, '2026-12-22'); // graficul porneste de la data semnarii
  assert.equal(sameKeyFigures({ ...snap, installment_lei: 106.53 }, q2), false);
});

test('reminder: data in format romanesc', () => {
  assert.equal(dataRo('2026-12-05'), '5 dec. 2026');
  assert.equal(dataRo('2027-09-01'), '1 sept. 2027');
  assert.equal(reminderText('2026-12-05'), 'Iti amintim ca te poti retrage din contract pana la 5 dec. 2026, fara motiv.');
});

test('cardul „Cererea ta”: ultima cerere neincheiata', () => {
  const a = (status: string, created_at: string, agreement_status: string | null = null) => ({ status, created_at, agreement_status });
  assert.equal(isInProgress(a('draft', '1')), true);
  assert.equal(isInProgress(a('manual_review', '1')), true);
  assert.equal(isInProgress(a('approved', '1')), true);
  assert.equal(isInProgress(a('signed', '1', 'active')), true);
  assert.equal(isInProgress(a('signed', '1', 'withdrawn')), false);
  assert.equal(isInProgress(a('rejected', '1')), false);
  assert.equal(isInProgress(a('cancelled', '1')), false);
  // cea mai noua respinsa e sarita, se ia urmatoarea in curs
  const list = [a('approved', '2026-11-21T10:00'), a('rejected', '2026-11-21T12:00'), a('signed', '2026-11-21T09:00', 'active')];
  assert.equal(pickCurrent(list)?.created_at, '2026-11-21T10:00');
  assert.equal(pickCurrent([a('rejected', '1'), a('signed', '2', 'withdrawn')]), null);
  assert.equal(pickCurrent([]), null);
});

// ---------- Rata ratata (art. 35), contract v0.6 ----------
import {
  FORBEARANCE_TALK_MESSAGE, forbearanceText, isForbearanceOption, measureJson, missedNoticeText, nrRate, planJson,
} from './flow.ts';
import { deferOneMonth, reschedule } from '../../_shared/engine/index.ts';

const ANA_T = { principal_lei: 2199, nominal_rate_pct: 14.9, installments: 24, signed_date: '2026-11-21' };

test('art. 35: optiunile permise', () => {
  for (const o of ['defer', 'reschedule', 'talk']) assert.equal(isForbearanceOption(o), true, o);
  for (const o of ['forgive', '', null, 1, 'DEFER']) assert.equal(isForbearanceOption(o), false, String(o));
  assert.equal(FORBEARANCE_TALK_MESSAGE, 'Rata ratata: vreau sa vorbesc cu un om.');
});

test('art. 35: numarul de rate in romana (1 rata, 9 rate, 29 de rate)', () => {
  assert.equal(nrRate(1), '1 rata');
  assert.equal(nrRate(9), '9 rate');
  assert.equal(nrRate(19), '19 rate');
  assert.equal(nrRate(20), '20 de rate');
  assert.equal(nrRate(29), '29 de rate');
  assert.equal(nrRate(105), '105 rate');
});

test('art. 35: mesajul la rata ratata are suma, data in romana si „fara comisioane”', () => {
  assert.equal(missedNoticeText({ n: 1, due_date: '2026-12-21', amount_lei: 106.52 }),
    'Rata 1 (106,52 lei), cu scadenta pe 21 dec. 2026, nu a fost platita. Te putem ajuta: poti amana rata o luna, poti reesalona sau poti vorbi cu un coleg. Fara comisioane.');
});

test('art. 35: textele dupa alegere (Ana)', () => {
  assert.equal(forbearanceText('defer', deferOneMonth(ANA_T, 1)),
    'Ratele se muta cu o luna. Urmatoarea rata (106,52 lei) e pe 21 ian. 2027. Platesti in plus doar 27,30 lei dobanda pentru luna in plus, adaugata la ultima rata. Fara comisioane.');
  assert.equal(forbearanceText('reschedule', reschedule(ANA_T, 1)),
    'Ai 29 de rate a cate 91,89 lei, prima pe 21 ian. 2027. Total de plata: 2.664,80 lei (cu 108,38 lei dobanda in plus). Fara comisioane.');
  assert.equal(forbearanceText('talk', null), 'Un coleg revine in 24 de ore.');
  const z = { principal_lei: 399, nominal_rate_pct: 0, installments: 4, signed_date: '2026-11-21' };
  assert.match(forbearanceText('defer', deferOneMonth(z, 1)), /Nu platesti nimic in plus\. Fara comisioane\.$/);
});

test('art. 35: varianta afisata inainte de alegere (forma din contract v0.6)', () => {
  const j = planJson(reschedule(ANA_T, 1));
  assert.deepEqual(Object.keys(j), ['installment_lei', 'last_installment_lei', 'installments', 'first_due_date', 'last_due_date',
    'total_payable_lei', 'extra_cost_lei', 'schedule']);
  assert.equal(j.schedule.length, 29);
});

test('art. 35: masura salvata -> JSON (numeric din Postgres vine ca text)', () => {
  const p = deferOneMonth(ANA_T, 1);
  const j = measureJson({
    option: 'defer', installment_n: 1, missed_due_date: '2026-12-21', created_at: '2026-11-21T15:00:00Z',
    extra_cost_lei: '27.30', new_installment_lei: '106.52', new_installments: 24, new_total_payable_lei: '2583.72', schedule: p.schedule,
  }, null);
  assert.equal(j.extra_cost_lei, 27.3);
  assert.equal(j.total_payable_lei, 2583.72);
  assert.equal(j.first_due_date, '2027-01-21');
  assert.equal(j.last_due_date, '2028-12-21');
  assert.equal(j.last_installment_lei, 133.76);
  assert.equal(j.text, forbearanceText('defer', p));
  const t = measureJson({
    option: 'talk', installment_n: 1, missed_due_date: '2026-12-21', created_at: '2026-11-21T15:00:00Z',
    extra_cost_lei: null, new_installment_lei: null, new_installments: null, new_total_payable_lei: null, schedule: null,
  }, { status: 'pending', resolved_at: null });
  assert.equal(t.installment_lei, null);
  assert.equal(t.schedule, null);
  assert.equal(t.text, 'Un coleg revine in 24 de ore.');
  assert.deepEqual(t.review, { status: 'pending', resolved_at: null });
});
