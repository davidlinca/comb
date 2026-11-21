// Teste pentru motor. Rulare (Node 22.18+): node --test supabase/functions/_shared/engine/engine.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths, aprPct, assessAffordability, buildQuote, countLateBills12m, QuoteError,
  reminderWindow, validateAssessmentInput, withdrawalAmount, withdrawalDeadline,
  type CreditProduct, type Device,
} from './index.ts';

const RATE: CreditProduct = { id: 'RATE', applies_to: 'phone', nominal_rate_pct: 14.9, fees_lei: 0, terms: [12, 24] };
const ZERO4: CreditProduct = { id: 'ZERO4', applies_to: 'accessory', nominal_rate_pct: 0, fees_lei: 0, terms: [4] };
const PH2: Device = { sku: 'PH-2', category: 'phone', price_lei: 2199 };
const PH3: Device = { sku: 'PH-3', category: 'phone', price_lei: 3499 };
const AC1: Device = { sku: 'AC-1', category: 'accessory', price_lei: 399 };
const SIGN = '2026-11-21';

const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x * 100, 0)) / 100;

// ---------- Oferta si graficul ----------

test('Ana: PH-2, 24 luni, 14,9% -> 106,52 lei/luna, DAE 15,96%', () => {
  const q = buildQuote(PH2, RATE, 24, SIGN);
  assert.equal(q.installment_lei, 106.52);
  assert.equal(q.installments, 24);
  assert.equal(q.apr_pct, 15.96);
  assert.equal(q.total_credit_lei, 2199);
});

test('Mihai: PH-3, 24 luni -> 169,49 lei/luna', () => {
  assert.equal(buildQuote(PH3, RATE, 24, SIGN).installment_lei, 169.49);
});

test('Graficul e exact: suma ratelor = total de plata; creditul se ramburseaza complet', () => {
  for (const [d, t] of [[PH2, 12], [PH2, 24], [PH3, 24]] as const) {
    const q = buildQuote(d, RATE, t, SIGN);
    assert.equal(sum(q.schedule.map((s) => s.amount_lei)), q.total_payable_lei);
    assert.equal(sum(q.schedule.map((s) => s.principal_lei)), d.price_lei);
    assert.equal(q.schedule.at(-1)!.balance_lei, 0);
    assert.equal(q.total_payable_lei, Math.round((q.total_credit_lei + q.total_cost_lei) * 100) / 100);
    // primele n-1 rate sunt egale; ultima difera cu cel mult cativa bani
    assert.ok(q.schedule.slice(0, -1).every((s) => s.amount_lei === q.installment_lei));
    assert.ok(Math.abs(q.last_installment_lei - q.installment_lei) < 0.25);
  }
});

test('Prima rata la o luna de la semnare; ultima dupa n luni', () => {
  const q = buildQuote(PH2, RATE, 24, SIGN);
  assert.equal(q.schedule[0].due_date, '2026-12-21');
  assert.equal(q.schedule[23].due_date, '2028-11-21');
});

test('ZERO4: 399 lei in 4 rate de 99,75; cost 0; DAE 0', () => {
  const q = buildQuote(AC1, ZERO4, 4, SIGN);
  assert.deepEqual(q.schedule.map((s) => s.amount_lei), [99.75, 99.75, 99.75, 99.75]);
  assert.equal(q.total_cost_lei, 0);
  assert.equal(q.apr_pct, 0);
});

test('Produs 0% fara costuri -> DAE 0 (cerinta din checklist)', () => {
  assert.equal(aprPct(1000, [250, 250, 250, 250]), 0);
});

test('DAE creste daca exista costuri (comision la acordare)', () => {
  const fara = aprPct(1000, [250, 250, 250, 250], 0);
  const cu = aprPct(1000, [250, 250, 250, 250], 20);
  assert.equal(fara, 0);
  assert.ok(cu > 0);
});

test('DAE = (1 + r/12)^12 - 1 cand nu sunt costuri (Anexa I, 12 luni egale)', () => {
  const q = buildQuote(PH2, RATE, 12, SIGN);
  const teoretic = Math.round((Math.pow(1 + 0.149 / 12, 12) - 1) * 10000) / 100;
  assert.ok(Math.abs(q.apr_pct - teoretic) <= 0.01, `${q.apr_pct} vs ${teoretic}`);
});

test('Termen nepermis si produs nepotrivit sunt respinse', () => {
  assert.throws(() => buildQuote(PH2, RATE, 36, SIGN), (e: unknown) => e instanceof QuoteError && e.code === 'TERM_NOT_ALLOWED');
  assert.throws(() => buildQuote(PH2, ZERO4, 4, SIGN), (e: unknown) => e instanceof QuoteError && e.code === 'PRODUCT_NOT_APPLICABLE');
});

test('Date: 31 ian. + 1 luna = 28/29 feb.', () => {
  assert.equal(addMonths('2027-01-31', 1), '2027-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-11-21', 14), '2028-01-21');
});

// ---------- Accesibilitatea (cele 3 persone) ----------

const base = { other_installments_bureau_lei: 0, late_bills_12m: 0, history_status: 'used' as const };

test('Ana -> aprobat, 3 motive, fara consiliere', () => {
  const r = assessAffordability({ ...base, net_income_lei: 5200, monthly_expenses_lei: 2100,
    other_installments_declared_lei: 300, other_installments_bureau_lei: 300, new_installment_lei: 106.52 });
  assert.equal(r.decision, 'approved');
  assert.deepEqual(r.reasons.map((x) => x.code), ['DTI_OK', 'RESIDUAL_OK', 'BILLS_ON_TIME']);
  assert.equal(r.metrics.residual_lei, 2693.48);
  assert.equal(r.reasons[0].text, 'Ratele tale ar fi 8% din venit, sub limita de 40%.');
  assert.equal(r.debt_advice, null);
});

test('Mihai -> revizuire umana pentru 2 facturi intarziate (nu respingere)', () => {
  const r = assessAffordability({ ...base, net_income_lei: 3900, monthly_expenses_lei: 1800,
    other_installments_declared_lei: 650, other_installments_bureau_lei: 650, new_installment_lei: 169.49, late_bills_12m: 2 });
  assert.equal(r.decision, 'manual_review');
  assert.equal(r.reasons[0].code, 'BILLS_LATE');
});

test('Ioana (prepaid) -> respinsa, nu ramane nimic; primeste consiliere; lipsa istoricului nu e minus', () => {
  const r = assessAffordability({ net_income_lei: 2600, monthly_expenses_lei: 1700,
    other_installments_declared_lei: 900, other_installments_bureau_lei: 900, new_installment_lei: 106.52,
    late_bills_12m: null, history_status: 'no_history' });
  assert.equal(r.decision, 'rejected');
  assert.equal(r.reasons[0].code, 'RESIDUAL_NEGATIVE');
  assert.ok(r.reasons.some((x) => x.code === 'NO_HISTORY'));
  assert.notEqual(r.debt_advice, null);
});

test('Biroul de Credit: se foloseste valoarea mai mare si se explica', () => {
  const r = assessAffordability({ ...base, net_income_lei: 5000, monthly_expenses_lei: 1500,
    other_installments_declared_lei: 200, other_installments_bureau_lei: 700, new_installment_lei: 100 });
  assert.equal(r.metrics.other_installments_used_lei, 700);
  assert.ok(r.reasons.some((x) => x.code === 'BUREAU_HIGHER'));
});

test('Pragul de 40%: exact 40% trece, peste 40% e respins', () => {
  const p = { ...base, monthly_expenses_lei: 0, other_installments_declared_lei: 300 };
  assert.notEqual(assessAffordability({ ...p, net_income_lei: 1000, new_installment_lei: 100 }).decision, 'rejected');
  const r = assessAffordability({ ...p, net_income_lei: 1000, new_installment_lei: 100.01 });
  assert.equal(r.decision, 'rejected');
  assert.equal(r.reasons[0].code, 'DTI_HIGH');
});

test('Pragul de 500 lei: sub 500 -> revizuire, 500 -> aprobat, sub 0 -> respins', () => {
  const p = { ...base, net_income_lei: 10000, other_installments_declared_lei: 0, new_installment_lei: 100 };
  assert.equal(assessAffordability({ ...p, monthly_expenses_lei: 9400 }).decision, 'approved');     // ramane 500
  assert.equal(assessAffordability({ ...p, monthly_expenses_lei: 9400.01 }).decision, 'manual_review');
  assert.equal(assessAffordability({ ...p, monthly_expenses_lei: 9900.01 }).decision, 'rejected');
});

test('Fara acord pentru istoric: intarzierile nu se folosesc', () => {
  const r = assessAffordability({ net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_declared_lei: 300,
    other_installments_bureau_lei: 300, new_installment_lei: 106.52, late_bills_12m: null, history_status: 'no_consent' });
  assert.equal(r.decision, 'approved');
  assert.ok(r.reasons.some((x) => x.code === 'HISTORY_NOT_USED'));
});

test('Venit 0 -> respins, fara impartire la 0', () => {
  const r = assessAffordability({ ...base, net_income_lei: 0, monthly_expenses_lei: 0, other_installments_declared_lei: 0, new_installment_lei: 50 });
  assert.equal(r.decision, 'rejected');
  assert.equal(r.metrics.dti_pct, null);
});

test('Facturi intarziate: doar > 30 zile si doar ultimele 12 luni', () => {
  const bills = [
    { period: '2025-10-01', days_late: 60 }, // prea veche
    { period: '2026-01-01', days_late: 31 },
    { period: '2026-05-01', days_late: 30 }, // fix 30 nu conteaza
    { period: '2026-10-01', days_late: 45 },
  ];
  assert.equal(countLateBills12m(bills, '2026-11-21'), 2);
});

// ---------- Lista alba (art. 18(3)) ----------

test('Evaluarea accepta doar cele 3 campuri', () => {
  const ok = validateAssessmentInput({ net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_lei: 300 });
  assert.equal(ok.ok, true);
});

test('Campurile interzise (sanatate, social media, etnie) sunt respinse si numite', () => {
  for (const f of ['health_status', 'facebook_profile', 'social_media_score', 'ethnicity', 'religion', 'diagnostic']) {
    const r = validateAssessmentInput({ net_income_lei: 1, monthly_expenses_lei: 1, other_installments_lei: 0, [f]: 'x' });
    assert.equal(r.ok, false, f);
    if (!r.ok) {
      assert.equal(r.code, 'FORBIDDEN_FIELD', f);
      assert.deepEqual(r.fields, [f]);
    }
  }
});

test('Camp necunoscut, suma negativa sau text in loc de numar -> VALIDATION', () => {
  const extra = validateAssessmentInput({ net_income_lei: 1, monthly_expenses_lei: 1, other_installments_lei: 0, age: 30 });
  assert.equal(extra.ok, false);
  const neg = validateAssessmentInput({ net_income_lei: -5, monthly_expenses_lei: 1, other_installments_lei: 0 });
  assert.equal(neg.ok, false);
  const txt = validateAssessmentInput({ net_income_lei: '5200', monthly_expenses_lei: 1, other_installments_lei: 0 });
  assert.equal(txt.ok, false);
  assert.equal(validateAssessmentInput(null).ok, false);
});

// ---------- Dupa semnare ----------

test('Retragere: termen 14 zile de la semnare', () => {
  assert.equal(withdrawalDeadline(SIGN), '2026-12-05');
});

test('Reminder: semnat la < 1 zi de la informare -> fereastra zilele 1-7', () => {
  const r = reminderWindow(new Date('2026-11-21T11:55:00Z'), new Date('2026-11-21T12:02:00Z'), SIGN);
  assert.deepEqual(r, { required: true, from: '2026-11-22', to: '2026-11-28' });
  const nu = reminderWindow(new Date('2026-11-19T10:00:00Z'), new Date('2026-11-21T12:00:00Z'), SIGN);
  assert.equal(nu.required, false);
});

test('Suma la retragere: credit + dobanda pe zilele folosite, returnare in 30 de zile', () => {
  const azi = withdrawalAmount(2199, 14.9, SIGN, SIGN);
  assert.equal(azi.amount_to_return_lei, 2199);
  assert.equal(azi.return_by, '2026-12-21');
  const trei = withdrawalAmount(2199, 14.9, SIGN, '2026-11-24');
  assert.equal(trei.interest_lei, 2.69); // 2199 * 14,9% / 365 * 3
  assert.equal(trei.amount_to_return_lei, 2201.69);
  const zero = withdrawalAmount(399, 0, SIGN, '2026-11-30');
  assert.equal(zero.amount_to_return_lei, 399);
});
