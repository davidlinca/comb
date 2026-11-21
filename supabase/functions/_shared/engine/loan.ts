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
  const r = product.nominal_rate_pct / 100 / 12;

  const payment = r === 0 ? Math.round(P / n) : Math.round((P * r) / (1 - Math.pow(1 + r, -n)));

  const schedule: ScheduleRow[] = [];
  let balance = P;
  let totalInterest = 0;
  for (let k = 1; k <= n; k++) {
    const interest = Math.round(balance * r);
    const principal = k === n ? balance : payment - interest;
    const amount = principal + interest;
    balance -= principal;
    totalInterest += interest;
    schedule.push({
      n: k,
      due_date: addMonths(startDate, k),
      amount_lei: toLei(amount),
      principal_lei: toLei(principal),
      interest_lei: toLei(interest),
      balance_lei: toLei(balance),
    });
  }

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
