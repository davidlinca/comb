// Oferta si graficul de rate (anuitate: rate lunare egale, dobanda fixa).
// Rotunjire: rata se rotunjeste la ban; ULTIMA rata se ajusteaza ca suma din grafic sa fie exacta.

import { addMonths } from './dates.ts';
import { toBani, toLei } from './money.ts';
import { aprPct } from './apr.ts';

export type CreditProduct = {
  id: string;
  applies_to: 'phone' | 'accessory';
  nominal_rate_pct: number;
  fees_lei: number;
  terms: number[];
};

export type Device = { sku: string; category: 'phone' | 'accessory'; price_lei: number };

export type ScheduleRow = {
  n: number;
  due_date: string;      // YYYY-MM-DD
  amount_lei: number;    // cat plateste clientul in luna n
  principal_lei: number; // din care credit
  interest_lei: number;  // din care dobanda
  balance_lei: number;   // cat mai are de plata din credit dupa rata n
};

export type Quote = {
  installment_lei: number;     // rata lunara (primele n-1 rate)
  last_installment_lei: number;
  installments: number;
  total_credit_lei: number;    // cat primeste (valoarea finantata)
  total_interest_lei: number;
  fees_lei: number;
  total_payable_lei: number;   // tot ce plateste
  total_cost_lei: number;      // total de plata - credit
  nominal_rate_pct: number;
  apr_pct: number;
  schedule: ScheduleRow[];
};

export class QuoteError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Graficul unei anuitati (rate egale, dobanda fixa), in bani.
 * Rata k e la addMonths(anchorDate, monthOffset + k) – la oferta: anchor = data semnarii, offset 0.
 * Rata se rotunjeste la ban; ULTIMA rata se ajusteaza ca soldul sa ajunga exact la 0.
 * O folosesc si oferta, si masurile de toleranta (art. 35).
 */
/** Rata lunara a unei anuitati, in bani, rotunjita la ban. */
export function annuityPaymentBani(principalBani: number, n: number, nominalRatePct: number): number {
  const r = nominalRatePct / 100 / 12;
  return r === 0 ? Math.round(principalBani / n) : Math.round((principalBani * r) / (1 - Math.pow(1 + r, -n)));
}

export function amortize(principalBani: number, n: number, nominalRatePct: number, anchorDate: string, monthOffset: number): ScheduleRow[] {
  const P = principalBani;
  const r = nominalRatePct / 100 / 12;
  const payment = annuityPaymentBani(P, n, nominalRatePct);

  const schedule: ScheduleRow[] = [];
  let balance = P;
  for (let k = 1; k <= n; k++) {
    const interest = Math.round(balance * r);
    const principal = k === n ? balance : payment - interest;
    balance -= principal;
    schedule.push({
      n: k,
      due_date: addMonths(anchorDate, monthOffset + k),
      amount_lei: toLei(principal + interest),
      principal_lei: toLei(principal),
      interest_lei: toLei(interest),
      balance_lei: toLei(balance),
    });
  }
  return schedule;
}

/**
 * Calculeaza oferta pentru un produs si un termen.
 * startDate = data semnarii (YYYY-MM-DD); prima rata e la o luna de la semnare.
 */
export function buildQuote(device: Device, product: CreditProduct, termMonths: number, startDate: string): Quote {
  if (device.category !== product.applies_to) {
    throw new QuoteError('PRODUCT_NOT_APPLICABLE', 'Produsul de credit nu se aplica acestui articol.');
  }
  if (!Number.isInteger(termMonths) || !product.terms.includes(termMonths)) {
    throw new QuoteError('TERM_NOT_ALLOWED', `Termen permis: ${product.terms.join(' sau ')} luni.`);
  }

  const P = toBani(device.price_lei);
  const n = termMonths;
  const schedule = amortize(P, n, product.nominal_rate_pct, startDate, 0);
  const payment = annuityPaymentBani(P, n, product.nominal_rate_pct);
  const totalInterest = schedule.reduce((s, row) => s + toBani(row.interest_lei), 0);

  const fees = toBani(product.fees_lei);
  const totalPayable = P + totalInterest + fees;

  return {
    installment_lei: toLei(payment),
    last_installment_lei: schedule[n - 1].amount_lei,
    installments: n,
    total_credit_lei: toLei(P),
    total_interest_lei: toLei(totalInterest),
    fees_lei: toLei(fees),
    total_payable_lei: toLei(totalPayable),
    total_cost_lei: toLei(totalPayable - P),
    nominal_rate_pct: product.nominal_rate_pct,
    apr_pct: aprPct(toLei(P), schedule.map((s) => s.amount_lei), toLei(fees)),
    schedule,
  };
}
