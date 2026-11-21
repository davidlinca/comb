// Lista alba pentru evaluare (art. 18(3) CCD2).
// Acceptam DOAR aceste 3 campuri. Orice alt camp -> eroare, iar campurile interzise
// (sanatate, social media, etnie etc.) sunt numite explicit in raspuns.

export const ASSESSMENT_FIELDS = ['net_income_lei', 'monthly_expenses_lei', 'other_installments_lei'] as const;

/** Exemple de categorii interzise; folosite in test si in mesajul de eroare. */
export const FORBIDDEN_PATTERNS: RegExp[] = [
  /health|sanatate|medical|diagnos/i,
  /social|facebook|tiktok|instagram|linkedin/i,
  /ethnic|etnie|race|rasa|religio|politic|orient|gender|gen_/i,
  /biometric|genetic/i,
];

export type AssessmentInput = {
  net_income_lei: number;
  monthly_expenses_lei: number;
  other_installments_lei: number;
};

export type ValidationResult =
  | { ok: true; value: AssessmentInput }
  | { ok: false; code: 'VALIDATION' | 'FORBIDDEN_FIELD'; message: string; fields: string[] };

const MAX_LEI = 1_000_000;

export function validateAssessmentInput(body: unknown): ValidationResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'VALIDATION', message: 'Datele trimise nu sunt valide.', fields: [] };
  }
  const keys = Object.keys(body as Record<string, unknown>);
  const allowed = new Set<string>(ASSESSMENT_FIELDS);

  const forbidden = keys.filter((k) => FORBIDDEN_PATTERNS.some((p) => p.test(k)));
  if (forbidden.length) {
    return {
      ok: false,
      code: 'FORBIDDEN_FIELD',
      message: 'Nu folosim date despre sanatate, social media sau alte date sensibile la evaluare.',
      fields: forbidden,
    };
  }
  const unknown = keys.filter((k) => !allowed.has(k));
  if (unknown.length) {
    return { ok: false, code: 'VALIDATION', message: 'Am primit campuri pe care nu le folosim.', fields: unknown };
  }

  const out: Record<string, number> = {};
  const bad: string[] = [];
  for (const f of ASSESSMENT_FIELDS) {
    const v = (body as Record<string, unknown>)[f];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > MAX_LEI) bad.push(f);
    else out[f] = Math.round(v * 100) / 100;
  }
  if (bad.length) {
    return { ok: false, code: 'VALIDATION', message: 'Completeaza sume valide, in lei (0 sau mai mult).', fields: bad };
  }
  return { ok: true, value: out as AssessmentInput };
}
