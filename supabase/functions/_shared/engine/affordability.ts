// Evaluarea accesibilitatii (art. 18 CCD2), regulile din DECIZII_HACKATHON.md, sectiunea 5.
//
//  - Venit folosit = minimul dintre declarat si contul bancar (Open Banking, simulat); cheltuieli = maximul.
//    Fara acord pentru datele bancare (sau fara date) -> venitul nu e verificat -> revizuire umana,
//    niciodata aprobare automata pe venit nedovedit (art. 18(3), decizie 21.11, 11:45).
//  - Alte rate folosite = maximul dintre ce declara clientul si Biroul de Credit (simulat).
//  - Grad de indatorare = (alte rate + rata noua) / venit net. Peste 40% -> respins (limita BNR).
//  - Ce ramane = venit - cheltuieli - alte rate - rata noua.
//      sub 0 -> respins;  intre 0 si 500 lei -> revizuire umana;  500+ -> ok.
//  - 2+ facturi intarziate > 30 zile in ultimele 12 luni -> revizuire umana (niciodata respingere automata).
//  - Fara istoric (prepaid) sau fara acord pentru istoric -> neutru, nu e un minus.
//  Ordinea: respins > revizuire umana > aprobat.

import { leiRotunjit, pctRotunjit, round2 } from './money.ts';

export const ENGINE_VERSION = 'engine-v2';
export const BANK_SOURCE = 'Open Banking (simulat)';
export const MAX_REASONS = 4;
export const DTI_MAX_PCT = 40;
export const RESIDUAL_REVIEW_LEI = 500;
export const LATE_BILLS_REVIEW = 2;

export type Decision = 'approved' | 'manual_review' | 'rejected';

/** Trimiterea la consiliere la respingere (art. 18(9)). */
export const DEBT_ADVICE = { text: 'Poti cere gratuit sfaturi despre datorii.', contact: 'serviciu de consiliere (demo)' } as const;
export type Reason = { code: string; text: string };

export type AffordabilityInput = {
  net_income_lei: number;
  monthly_expenses_lei: number;
  other_installments_declared_lei: number;
  other_installments_bureau_lei: number;
  new_installment_lei: number;
  /** null = fara istoric (prepaid) sau fara acord pentru istoricul de facturi */
  late_bills_12m: number | null;
  /** de ce lipseste istoricul, pentru motivul afisat */
  history_status: 'used' | 'no_history' | 'no_consent';
  /** contul bancar (Open Banking, simulat): null daca nu e acord sau nu exista date */
  bank_income_lei: number | null;
  bank_expenses_lei: number | null;
  /** used = acord + date; no_consent = fara acord; unavailable = acord, dar fara date */
  bank_status: 'used' | 'no_consent' | 'unavailable';
};

export type Verification = {
  bank_data_used: boolean;
  source: string | null;
  income: { declared_lei: number; verified_lei: number | null; used_lei: number };
  expenses: { declared_lei: number; verified_lei: number | null; used_lei: number };
  other_installments: { declared_lei: number; bureau_lei: number; used_lei: number };
};

export type AffordabilityResult = {
  decision: Decision;
  automated: true;
  reasons: Reason[];
  metrics: {
    dti_pct: number | null;
    residual_lei: number;
    late_bills_12m: number | null;
    other_installments_used_lei: number;
    income_used_lei: number;
    expenses_used_lei: number;
  };
  verification: Verification;
  human_review_available: true;
  debt_advice: { text: string; contact: string } | null;
  engine_version: string;
};

export function assessAffordability(i: AffordabilityInput): AffordabilityResult {
  const other = Math.max(i.other_installments_declared_lei, i.other_installments_bureau_lei);
  const bankUsed = i.bank_status === 'used' && i.bank_income_lei !== null && i.bank_expenses_lei !== null;
  const income = bankUsed ? Math.min(i.net_income_lei, i.bank_income_lei as number) : i.net_income_lei;
  const expenses = bankUsed ? Math.max(i.monthly_expenses_lei, i.bank_expenses_lei as number) : i.monthly_expenses_lei;
  const dtiExact = income > 0 ? ((other + i.new_installment_lei) / income) * 100 : null; // pentru decizie
  const dti = dtiExact === null ? null : round2(dtiExact);                                    // pentru afisare
  const residual = round2(income - expenses - other - i.new_installment_lei);

  const decisive: Reason[] = []; // motivele care au decis
  const bureau: Reason[] = [];   // ajustari din surse verificate (banca, Birou) - le aratam mereu
  const verified: Reason[] = []; // confirmarea verificarii venitului
  const info: Reason[] = [];     // motive explicative

  let decision = 'approved' as Decision; // 'as' ca TS sa nu o fixeze la 'approved'
  const worse = (d: Decision) => {
    const rank = { approved: 0, manual_review: 1, rejected: 2 } as const;
    if (rank[d] > rank[decision]) decision = d;
  };

  // 0. Verificarea venitului si a cheltuielilor (Open Banking, simulat)
  if (bankUsed) {
    const bi = i.bank_income_lei as number, be = i.bank_expenses_lei as number;
    if (bi < i.net_income_lei) {
      bureau.push({ code: 'INCOME_VERIFIED_LOWER', text: `Am folosit venitul din contul tau bancar (${leiRotunjit(bi)} lei pe luna), mai mic decat cel declarat (${leiRotunjit(i.net_income_lei)} lei).` });
    } else {
      verified.push({ code: 'INCOME_VERIFIED', text: 'Venitul tau a fost verificat in contul bancar (Open Banking, simulat).' });
    }
    if (be > i.monthly_expenses_lei) {
      bureau.push({ code: 'EXPENSES_VERIFIED_HIGHER', text: `Am folosit cheltuielile din contul tau bancar (${leiRotunjit(be)} lei pe luna), mai mari decat cele declarate (${leiRotunjit(i.monthly_expenses_lei)} lei).` });
    }
  } else if (i.bank_status === 'no_consent') {
    worse('manual_review');
    decisive.push({ code: 'INCOME_NOT_VERIFIED', text: 'Nu ai dat acordul pentru datele bancare, asa ca un coleg iti verifica venitul cu un alt document (de exemplu fluturasul de salariu). Nu te respingem pentru asta.' });
  } else {
    worse('manual_review');
    decisive.push({ code: 'BANK_DATA_UNAVAILABLE', text: 'Nu am putut citi datele din contul tau bancar, asa ca un coleg iti verifica venitul cu un alt document.' });
  }

  // 1. Venit
  if (income <= 0) {
    worse('rejected');
    decisive.push({ code: 'INCOME_MISSING', text: 'Nu avem un venit lunar (declarat sau verificat), deci nu putem calcula daca iti permiti ratele.' });
  }

  // 2. Grad de indatorare
  if (dti !== null && dtiExact !== null) {
    if (dtiExact > DTI_MAX_PCT + 1e-9) {
      worse('rejected');
      decisive.push({ code: 'DTI_HIGH', text: `Toate ratele tale ar fi ${pctRotunjit(dti)}% din venit, peste limita de ${DTI_MAX_PCT}%.` });
    } else {
      info.push({ code: 'DTI_OK', text: `Ratele tale ar fi ${pctRotunjit(dti)}% din venit, sub limita de ${DTI_MAX_PCT}%.` });
    }
  }

  // 3. Ce ramane dupa rate
  if (income > 0) {
    if (residual < 0) {
      worse('rejected');
      decisive.push({ code: 'RESIDUAL_NEGATIVE', text: `Dupa cheltuieli si rate nu ti-ar mai ramane bani (ti-ar lipsi aproximativ ${leiRotunjit(-residual)} lei pe luna).` });
    } else if (residual < RESIDUAL_REVIEW_LEI) {
      worse('manual_review');
      decisive.push({ code: 'RESIDUAL_LOW', text: `Dupa cheltuieli si rate ti-ar ramane doar aproximativ ${leiRotunjit(residual)} lei pe luna, asa ca un coleg verifica cererea.` });
    } else {
      info.push({ code: 'RESIDUAL_OK', text: `Dupa cheltuieli si rate iti raman aproximativ ${leiRotunjit(residual)} lei pe luna.` });
    }
  }

  // 4. Istoricul de facturi telco
  if (i.history_status === 'used' && i.late_bills_12m !== null) {
    if (i.late_bills_12m >= LATE_BILLS_REVIEW) {
      worse('manual_review');
      decisive.push({ code: 'BILLS_LATE', text: `Ai avut ${i.late_bills_12m} facturi platite cu peste 30 de zile intarziere in ultimele 12 luni, asa ca un coleg verifica cererea. Nu te respingem automat pentru asta.` });
    } else if (i.late_bills_12m === 0) {
      info.push({ code: 'BILLS_ON_TIME', text: 'Ti-ai platit facturile la timp in ultimele 12 luni.' });
    } else {
      info.push({ code: 'BILLS_MOSTLY_ON_TIME', text: 'Ai avut o singura factura intarziata in ultimele 12 luni; asta nu schimba decizia.' });
    }
  } else if (i.history_status === 'no_history') {
    info.push({ code: 'NO_HISTORY', text: 'Nu ai istoric de facturi la noi; asta nu conteaza in defavoarea ta.' });
  } else {
    info.push({ code: 'HISTORY_NOT_USED', text: 'Nu am folosit istoricul facturilor tale, pentru ca nu ti-ai dat acordul.' });
  }

  // 5. Verificarea cu Biroul de Credit (simulat)
  if (i.other_installments_bureau_lei > i.other_installments_declared_lei) {
    bureau.push({
      code: 'BUREAU_HIGHER',
      text: `Am folosit ratele raportate de Biroul de Credit (${leiRotunjit(i.other_installments_bureau_lei)} lei pe luna), mai mari decat cele declarate (${leiRotunjit(i.other_installments_declared_lei)} lei).`,
    });
  }

  // Ordinea: ce a decis (intai motivele de respingere, apoi cele de revizuire), ajustarile din surse verificate,
  // confirmarea verificarii, explicatiile; maximum 4 motive
  const REJECT_CODES = new Set(['INCOME_MISSING', 'DTI_HIGH', 'RESIDUAL_NEGATIVE']);
  const ordered = [...decisive.filter((x) => REJECT_CODES.has(x.code)), ...decisive.filter((x) => !REJECT_CODES.has(x.code))];
  const reasons = [...ordered, ...bureau, ...verified, ...info].slice(0, MAX_REASONS);

  return {
    decision,
    automated: true,
    reasons,
    metrics: {
      dti_pct: dti, residual_lei: residual, late_bills_12m: i.late_bills_12m, other_installments_used_lei: other,
      income_used_lei: income, expenses_used_lei: expenses,
    },
    verification: {
      bank_data_used: bankUsed,
      source: bankUsed ? BANK_SOURCE : null,
      income: { declared_lei: i.net_income_lei, verified_lei: bankUsed ? i.bank_income_lei : null, used_lei: income },
      expenses: { declared_lei: i.monthly_expenses_lei, verified_lei: bankUsed ? i.bank_expenses_lei : null, used_lei: expenses },
      other_installments: { declared_lei: i.other_installments_declared_lei, bureau_lei: i.other_installments_bureau_lei, used_lei: other },
    },
    human_review_available: true,
    debt_advice: decision === 'rejected' ? DEBT_ADVICE : null,
    engine_version: ENGINE_VERSION,
  };
}

/** Facturile intarziate > 30 zile din ultimele 12 luni (fata de data de referinta). */
export function countLateBills12m(
  bills: { period: string; days_late: number }[],
  today: string,
): number {
  const [y, m] = today.split('-').map(Number);
  const from = `${y - 1}-${String(m).padStart(2, '0')}-01`;
  return bills.filter((b) => b.period >= from && b.period <= today && b.days_late > 30).length;
}
