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

// Implicit: acord pentru datele bancare, iar banca confirma exact ce a declarat clientul (engine-v2);
// ratele vazute in cont = cele de la Birou (engine-v3)
type AIn = Parameters<typeof assessAffordability>[0];
const A = (i: Omit<AIn, 'bank_status' | 'bank_income_lei' | 'bank_expenses_lei' | 'bank_installments_lei'> & Partial<AIn>) =>
  assessAffordability({ bank_status: 'used', bank_income_lei: i.net_income_lei, bank_expenses_lei: i.monthly_expenses_lei,
    bank_installments_lei: i.other_installments_bureau_lei, ...i });


const base = { other_installments_bureau_lei: 0, late_bills_12m: 0, history_status: 'used' as const };

test('Ana -> aprobat, 4 motive (venit verificat), fara consiliere', () => {
  const r = A({ ...base, net_income_lei: 5200, monthly_expenses_lei: 2100,
    other_installments_declared_lei: 300, other_installments_bureau_lei: 300, new_installment_lei: 106.52 });
  assert.equal(r.decision, 'approved');
  assert.deepEqual(r.reasons.map((x) => x.code), ['INCOME_VERIFIED', 'DTI_OK', 'RESIDUAL_OK', 'BILLS_ON_TIME']);
  assert.equal(r.metrics.residual_lei, 2693.48);
  assert.equal(r.reasons[1].text, 'Ratele tale ar fi 8% din venit, sub limita de 40%.');
  assert.deepEqual(r.verification, {
    bank_data_used: true, source: 'Open Banking (simulat)',
    income: { declared_lei: 5200, verified_lei: 5200, used_lei: 5200 },
    expenses: { declared_lei: 2100, verified_lei: 2100, used_lei: 2100 },
    other_installments: { declared_lei: 300, bureau_lei: 300, bank_lei: 300, used_lei: 300 },
  });
  assert.equal(r.debt_advice, null);
});

test('Mihai -> revizuire umana pentru 2 facturi intarziate (nu respingere)', () => {
  const r = A({ ...base, net_income_lei: 3900, monthly_expenses_lei: 1800,
    other_installments_declared_lei: 650, other_installments_bureau_lei: 650, new_installment_lei: 169.49, late_bills_12m: 2 });
  assert.equal(r.decision, 'manual_review');
  assert.equal(r.reasons[0].code, 'BILLS_LATE');
});

test('Ioana (prepaid) -> respinsa, nu ramane nimic; primeste consiliere; lipsa istoricului nu e minus', () => {
  const r = A({ net_income_lei: 2600, monthly_expenses_lei: 1700,
    other_installments_declared_lei: 900, other_installments_bureau_lei: 900, new_installment_lei: 106.52,
    late_bills_12m: null, history_status: 'no_history' });
  assert.equal(r.decision, 'rejected');
  assert.equal(r.reasons[0].code, 'RESIDUAL_NEGATIVE');
  assert.ok(r.reasons.some((x) => x.code === 'NO_HISTORY'));
  assert.notEqual(r.debt_advice, null);
});

test('Biroul de Credit: se foloseste valoarea mai mare si se explica', () => {
  const r = A({ ...base, net_income_lei: 5000, monthly_expenses_lei: 1500,
    other_installments_declared_lei: 200, other_installments_bureau_lei: 700, new_installment_lei: 100 });
  assert.equal(r.metrics.other_installments_used_lei, 700);
  assert.ok(r.reasons.some((x) => x.code === 'BUREAU_HIGHER'));
});

test('Pragul de 40%: exact 40% trece, peste 40% e respins', () => {
  const p = { ...base, monthly_expenses_lei: 0, other_installments_declared_lei: 300 };
  assert.notEqual(A({ ...p, net_income_lei: 1000, new_installment_lei: 100 }).decision, 'rejected');
  const r = A({ ...p, net_income_lei: 1000, new_installment_lei: 100.01 });
  assert.equal(r.decision, 'rejected');
  assert.equal(r.reasons[0].code, 'DTI_HIGH');
});

test('Pragul de 500 lei: sub 500 -> revizuire, 500 -> aprobat, sub 0 -> respins', () => {
  const p = { ...base, net_income_lei: 10000, other_installments_declared_lei: 0, new_installment_lei: 100 };
  assert.equal(A({ ...p, monthly_expenses_lei: 9400 }).decision, 'approved');     // ramane 500
  assert.equal(A({ ...p, monthly_expenses_lei: 9400.01 }).decision, 'manual_review');
  assert.equal(A({ ...p, monthly_expenses_lei: 9900.01 }).decision, 'rejected');
});

test('Fara acord pentru istoric: intarzierile nu se folosesc', () => {
  const r = A({ net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_declared_lei: 300,
    other_installments_bureau_lei: 300, new_installment_lei: 106.52, late_bills_12m: null, history_status: 'no_consent' });
  assert.equal(r.decision, 'approved');
  assert.ok(r.reasons.some((x) => x.code === 'HISTORY_NOT_USED'));
});

test('Venit 0 -> respins, fara impartire la 0', () => {
  const r = A({ ...base, net_income_lei: 0, monthly_expenses_lei: 0, other_installments_declared_lei: 0, new_installment_lei: 50 });
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
  assert.equal(zero.interest_lei, 0);
  assert.equal(zero.text, 'Returnezi suma primita, fara dobanda, in maximum 30 de zile.'); // nu pomeni dobanda la 0%
  assert.match(trei.text, /dobanda pentru 3 zile/);
});

// ---------- Verificarea venitului (Open Banking, simulat) – engine-v2 ----------

const ana = { net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_declared_lei: 300,
  other_installments_bureau_lei: 300, new_installment_lei: 106.52, late_bills_12m: 0, history_status: 'used' as const };

test('Ana declara 9.000 lei, banca arata 5.200 -> se foloseste 5.200 si se explica', () => {
  const r = A({ ...ana, net_income_lei: 9000, bank_income_lei: 5200, bank_expenses_lei: 2100 });
  assert.equal(r.metrics.income_used_lei, 5200);
  assert.equal(r.metrics.residual_lei, 2693.48);
  assert.equal(r.reasons[0].code, 'INCOME_VERIFIED_LOWER');
  assert.match(r.reasons[0].text, /5\.200 lei/);
  assert.equal(r.verification.income.declared_lei, 9000);
  assert.equal(r.verification.income.used_lei, 5200);
});

test('Ioana declara 9.000 lei (minte), banca arata 2.600 -> ramane respinsa', () => {
  const r = A({ net_income_lei: 9000, monthly_expenses_lei: 1700, other_installments_declared_lei: 900,
    other_installments_bureau_lei: 900, new_installment_lei: 106.52, late_bills_12m: null, history_status: 'no_history',
    bank_income_lei: 2600, bank_expenses_lei: 1700 });
  assert.equal(r.decision, 'rejected');
  assert.equal(r.reasons[0].code, 'RESIDUAL_NEGATIVE');
  assert.ok(r.reasons.some((x) => x.code === 'INCOME_VERIFIED_LOWER'));
});

test('Banca arata cheltuieli mai mari decat cele declarate -> se folosesc cele din banca', () => {
  const r = A({ ...ana, monthly_expenses_lei: 1000, bank_expenses_lei: 2100 });
  assert.equal(r.metrics.expenses_used_lei, 2100);
  assert.ok(r.reasons.some((x) => x.code === 'EXPENSES_VERIFIED_HIGHER'));
});

test('Banca arata venit mai MARE decat cel declarat -> se foloseste cel declarat (prudent)', () => {
  const r = A({ ...ana, bank_income_lei: 8000 });
  assert.equal(r.metrics.income_used_lei, 5200);
  assert.equal(r.reasons[0].code, 'INCOME_VERIFIED');
});

test('Fara acord pentru datele bancare -> revizuire umana, niciodata aprobare automata', () => {
  const r = A({ ...ana, bank_status: 'no_consent', bank_income_lei: null, bank_expenses_lei: null });
  assert.equal(r.decision, 'manual_review');
  assert.equal(r.reasons[0].code, 'INCOME_NOT_VERIFIED');
  assert.equal(r.verification.bank_data_used, false);
  assert.equal(r.verification.source, null);
  assert.equal(r.verification.income.verified_lei, null);
  assert.equal(r.debt_advice, null);
});

test('Acord dat, dar fara date in banca -> revizuire umana (BANK_DATA_UNAVAILABLE)', () => {
  const r = A({ ...ana, bank_status: 'unavailable', bank_income_lei: null, bank_expenses_lei: null });
  assert.equal(r.decision, 'manual_review');
  assert.equal(r.reasons[0].code, 'BANK_DATA_UNAVAILABLE');
});

test('Fara acord bancar, dar chiar si cifrele declarate nu ajung -> respins (respins bate revizuirea)', () => {
  const r = A({ ...ana, monthly_expenses_lei: 5000, bank_status: 'no_consent', bank_income_lei: null, bank_expenses_lei: null });
  assert.equal(r.decision, 'rejected');
  assert.equal(r.reasons[0].code, 'RESIDUAL_NEGATIVE');
  assert.equal(r.reasons[1].code, 'INCOME_NOT_VERIFIED');
});

test('Maximum 4 motive afisate', () => {
  const r = A({ ...ana, net_income_lei: 9000, monthly_expenses_lei: 1000, other_installments_declared_lei: 0,
    bank_income_lei: 5200, bank_expenses_lei: 2100 });
  assert.ok(r.reasons.length <= 4);
});

// ---------- Alte rate vazute in contul bancar (Open Banking, simulat) – engine-v3 ----------

const mihai = { net_income_lei: 3900, monthly_expenses_lei: 1800, other_installments_declared_lei: 650,
  other_installments_bureau_lei: 650, new_installment_lei: 169.49, late_bills_12m: 2, history_status: 'used' as const };

test('Mihai: banca arata 750 lei rate (BNPL +100) -> se folosesc 750, ramane in revizuire, motivul explica', () => {
  const r = A({ ...mihai, bank_installments_lei: 750 });
  assert.equal(r.decision, 'manual_review');
  assert.equal(r.metrics.other_installments_used_lei, 750);
  assert.equal(r.metrics.residual_lei, 1180.51);
  assert.deepEqual(r.reasons.map((x) => x.code), ['BILLS_LATE', 'BANK_INSTALLMENTS_HIGHER', 'INCOME_VERIFIED', 'DTI_OK']);
  assert.equal(r.reasons[1].text, 'Am folosit ratele pe care le platesti lunar, vazute in contul tau bancar (750 lei pe luna), mai mari decat cele declarate (650 lei) si decat cele de la Biroul de Credit (650 lei).');
  assert.equal(r.reasons[3].text, 'Ratele tale ar fi 24% din venit, sub limita de 40%.');
  assert.deepEqual(r.verification.other_installments, { declared_lei: 650, bureau_lei: 650, bank_lei: 750, used_lei: 750 });
});

test('Ratele din banca mai mici decat Biroul -> se foloseste Biroul (BUREAU_HIGHER), nu banca', () => {
  const r = A({ ...ana, other_installments_declared_lei: 100, other_installments_bureau_lei: 300, bank_installments_lei: 200 });
  assert.equal(r.metrics.other_installments_used_lei, 300);
  assert.ok(r.reasons.some((x) => x.code === 'BUREAU_HIGHER'));
  assert.ok(!r.reasons.some((x) => x.code === 'BANK_INSTALLMENTS_HIGHER'));
});

test('Fara acord bancar -> ratele din banca NU se folosesc (bank_lei null)', () => {
  const r = A({ ...ana, bank_status: 'no_consent', bank_income_lei: null, bank_expenses_lei: null, bank_installments_lei: 900 });
  assert.equal(r.metrics.other_installments_used_lei, 300);
  assert.equal(r.verification.other_installments.bank_lei, null);
});

test('Ratele din banca pot duce la respingere (DTI peste 40%)', () => {
  const r = A({ ...ana, bank_installments_lei: 2000 });
  assert.equal(r.decision, 'rejected');
  assert.equal(r.reasons[0].code, 'DTI_HIGH');
  assert.equal(r.reasons[1].code, 'BANK_INSTALLMENTS_HIGHER');
  assert.ok(r.debt_advice);
});

test('engine-v3', () => {
  assert.equal(A({ ...ana }).engine_version, 'engine-v3');
});

// ---------- Rata ratata (art. 35), decizii 21.11, 15:55 si 16:20 (Varianta A) ----------
import { contractSchedule, deferOneMonth, forbearanceOptions, missedInstallment, reschedule, type ContractTerms } from './index.ts';

const ANA_C: ContractTerms = { principal_lei: 2199, nominal_rate_pct: 14.9, installments: 24, signed_date: SIGN };
const sumAmounts = (rows: { amount_lei: number }[]) => sum(rows.map((r) => r.amount_lei));

test('Art. 35: graficul contractului = graficul ofertei de la data semnarii', () => {
  assert.deepEqual(contractSchedule(ANA_C), buildQuote(PH2, RATE, 24, SIGN).schedule);
});

test('Art. 35: rata e ratata doar DUPA scadenta (Ana, scadenta 21 dec.)', () => {
  assert.equal(missedInstallment(ANA_C, '2026-12-20'), null);
  assert.equal(missedInstallment(ANA_C, '2026-12-21'), null); // in ziua scadentei nu e intarziata
  assert.deepEqual(missedInstallment(ANA_C, '2026-12-22'), { n: 1, due_date: '2026-12-21', amount_lei: 106.52, days_late: 1 });
  assert.equal(missedInstallment(ANA_C, '2026-12-26')!.days_late, 5); // „ziua 35”
});

test('Art. 35: amanare o luna (Ana) -> aceeasi rata, +27,30 lei dobanda la ultima rata, total 2.583,72', () => {
  const d = deferOneMonth(ANA_C, 1);
  assert.equal(d.extra_cost_lei, 27.30);
  assert.equal(d.installment_lei, 106.52);
  assert.equal(d.installments, 24);
  assert.equal(d.first_due_date, '2027-01-21');
  assert.equal(d.last_due_date, '2028-12-21');
  assert.equal(d.last_installment_lei, 133.76); // 106,46 + 27,30
  assert.equal(d.total_payable_lei, 2583.72);
  assert.equal(sumAmounts(d.schedule), d.total_payable_lei);
  assert.equal(d.schedule.at(-1)!.balance_lei, 0);
});

test('Art. 35: reesalonare (Ana) -> 2.226,30 lei pe 29 de rate de 91,89, total 2.664,80, termen +6 luni', () => {
  const r = reschedule(ANA_C, 1);
  assert.equal(r.installments, 29);
  assert.equal(r.installment_lei, 91.89);
  assert.equal(r.last_installment_lei, 91.88);
  assert.equal(r.total_payable_lei, 2664.80);
  assert.equal(r.extra_cost_lei, 108.38);
  assert.equal(r.first_due_date, '2027-01-21');
  assert.equal(r.last_due_date, '2029-05-21'); // termenul initial 21 nov. 2028 + 6 luni
  assert.equal(sum(r.schedule.map((s) => s.principal_lei)), 2226.30); // 2.199 + dobanda lunii ratate
  assert.equal(r.schedule.at(-1)!.balance_lei, 0);
  assert.deepEqual(r.schedule.map((s) => s.n), Array.from({ length: 29 }, (_, i) => i + 1));
});

test('Art. 35: fara comisioane – costul in plus e doar dobanda (credit 0% -> 0 lei in plus)', () => {
  const z: ContractTerms = { principal_lei: 399, nominal_rate_pct: 0, installments: 4, signed_date: SIGN };
  const o = forbearanceOptions(z, 1);
  assert.equal(o.defer.extra_cost_lei, 0);
  assert.equal(o.defer.total_payable_lei, 399);
  assert.equal(o.reschedule.extra_cost_lei, 0);
  assert.equal(o.reschedule.installments, 9); // 3 ramase + 6
  assert.equal(o.reschedule.total_payable_lei, 399);
});

test('Art. 35: rata ratata la mijloc (n = 3) -> ratele platite intra in total, nu se reesaloneaza', () => {
  const sched = contractSchedule(ANA_C);
  const d = deferOneMonth(ANA_C, 3);
  const r = reschedule(ANA_C, 3);
  assert.equal(d.installments, 22);
  assert.equal(d.schedule[0].n, 3);
  assert.equal(d.schedule[0].due_date, addMonths(SIGN, 4));
  assert.equal(d.extra_cost_lei, Math.round(sched[1].balance_lei * 100 * 0.149 / 12) / 100);
  assert.equal(r.installments, 21 + 6);
  assert.equal(r.schedule[0].n, 3);
  assert.equal(r.total_payable_lei, sum([...sched.slice(0, 2).map((s) => s.amount_lei), ...r.schedule.map((s) => s.amount_lei)]));
  assert.throws(() => deferOneMonth(ANA_C, 25));
});

test('Art. 35: Mihai (PH-3, 3.499 lei) -> amanarea costa o luna de dobanda pe 3.499', () => {
  const m: ContractTerms = { principal_lei: 3499, nominal_rate_pct: 14.9, installments: 24, signed_date: SIGN };
  assert.equal(deferOneMonth(m, 1).extra_cost_lei, Math.round(349900 * 0.149 / 12) / 100);
  assert.equal(deferOneMonth(m, 1).installment_lei, 169.49);
});
