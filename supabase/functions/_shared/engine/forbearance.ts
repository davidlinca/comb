// Rata ratata: masuri de toleranta (CCD2 art. 35). Decizii 21.11, 15:55 si 16:20 (Varianta A).
// - Amanare o luna: toate ratele ramase se muta cu o luna; in plus DOAR dobanda pe o luna pe soldul ramas,
//   adaugata la ultima rata. Rata lunara ramane aceeasi.
// - Reesalonare: datoria la scadenta ratata (soldul + dobanda lunii respective) se imparte pe
//   ratele ramase + 6, cu aceeasi dobanda. Se termina la 6 luni dupa termenul initial.
// - Fara comisioane in niciun caz (art. 35: nimic peste costul real).
// In demo, prima rata e considerata neplatita cand „azi” trece de scadenta (aplicatia nu tine evidenta platilor).

import { addMonths, daysBetween } from './dates.ts';
import { amortize, type ScheduleRow } from './loan.ts';
import { toBani, toLei } from './money.ts';

export const RESCHEDULE_EXTRA_MONTHS = 6;

/** Ce stim despre contract (din cererea salvata + data semnarii). */
export type ContractTerms = {
  principal_lei: number;
  nominal_rate_pct: number;
  installments: number;
  signed_date: string; // YYYY-MM-DD (ora Romaniei)
};

export type MissedInstallment = { n: number; due_date: string; amount_lei: number; days_late: number };

export type ForbearancePlan = {
  option: 'defer' | 'reschedule';
  installment_lei: number;      // rata lunara de acum incolo (primele rate)
  last_installment_lei: number;
  installments: number;         // cate rate mai are de platit (inclusiv cea ratata)
  first_due_date: string;
  last_due_date: string;
  total_payable_lei: number;    // tot ce plateste pe contract dupa masura
  extra_cost_lei: number;       // fata de contractul semnat; doar dobanda, fara comisioane
  schedule: ScheduleRow[];      // ratele ramase, numerotate de la rata ratata
};

/** Graficul contractului semnat (acelasi calcul ca la oferta, pornind de la data semnarii). */
export function contractSchedule(t: ContractTerms): ScheduleRow[] {
  return amortize(toBani(t.principal_lei), t.installments, t.nominal_rate_pct, t.signed_date, 0);
}

/**
 * Rata ratata in demo: prima rata, daca „azi” e DUPA scadenta ei (in ziua scadentei nu e inca intarziata).
 * null daca scadenta nu a trecut.
 */
export function missedInstallment(t: ContractTerms, today: string): MissedInstallment | null {
  const first = contractSchedule(t)[0];
  const late = daysBetween(first.due_date, today);
  return late > 0 ? { n: 1, due_date: first.due_date, amount_lei: first.amount_lei, days_late: late } : null;
}

const sumBani = (rows: ScheduleRow[]) => rows.reduce((s, r) => s + toBani(r.amount_lei), 0);

function check(t: ContractTerms, n: number): ScheduleRow[] {
  const sched = contractSchedule(t);
  if (!Number.isInteger(n) || n < 1 || n > sched.length) throw new Error(`Rata ${n} nu exista in contract.`);
  return sched;
}

function plan(option: ForbearancePlan['option'], sched: ScheduleRow[], n: number, rows: ScheduleRow[]): ForbearancePlan {
  const paidBani = sumBani(sched.slice(0, n - 1)); // ratele dinainte de cea ratata (in demo: niciuna)
  const totalBani = paidBani + sumBani(rows);
  return {
    option,
    installment_lei: rows[0].amount_lei,
    last_installment_lei: rows[rows.length - 1].amount_lei,
    installments: rows.length,
    first_due_date: rows[0].due_date,
    last_due_date: rows[rows.length - 1].due_date,
    total_payable_lei: toLei(totalBani),
    extra_cost_lei: toLei(totalBani - sumBani(sched)),
    schedule: rows,
  };
}

/** Soldul inainte de rata n (in bani) si dobanda pe luna ratei n pe acest sold. */
function balanceAndMonthInterest(t: ContractTerms, sched: ScheduleRow[], n: number) {
  const before = n === 1 ? toBani(t.principal_lei) : toBani(sched[n - 2].balance_lei);
  return { before, interest: Math.round(before * (t.nominal_rate_pct / 100 / 12)) };
}

/** Amanare o luna: ratele n..N se muta cu o luna; dobanda pe luna in plus se adauga la ultima rata. */
export function deferOneMonth(t: ContractTerms, n: number): ForbearancePlan {
  const sched = check(t, n);
  const { interest } = balanceAndMonthInterest(t, sched, n);
  const rows = sched.slice(n - 1).map((r) => ({ ...r, due_date: addMonths(t.signed_date, r.n + 1) }));
  const last = rows[rows.length - 1];
  rows[rows.length - 1] = {
    ...last,
    amount_lei: toLei(toBani(last.amount_lei) + interest),
    interest_lei: toLei(toBani(last.interest_lei) + interest),
  };
  return plan('defer', sched, n, rows);
}

/** Reesalonare: datoria la scadenta ratei n (sold + dobanda lunii n) pe (N - n) + 6 rate egale, aceeasi dobanda. */
export function reschedule(t: ContractTerms, n: number): ForbearancePlan {
  const sched = check(t, n);
  const { before, interest } = balanceAndMonthInterest(t, sched, n);
  const count = (t.installments - n) + RESCHEDULE_EXTRA_MONTHS;
  const rows = amortize(before + interest, count, t.nominal_rate_pct, t.signed_date, n)
    .map((r) => ({ ...r, n: r.n + n - 1 }));
  return plan('reschedule', sched, n, rows);
}

/** Cele doua variante cu cifre, aratate clientului INAINTE sa aleaga (a treia e „vorbeste cu un om”). */
export function forbearanceOptions(t: ContractTerms, n: number) {
  return { defer: deferOneMonth(t, n), reschedule: reschedule(t, n) };
}
