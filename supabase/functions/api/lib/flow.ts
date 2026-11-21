// Reguli pure pentru partea 2 (revizuire, OTP, contract, retragere). Fara DB si fara retea -> testate in flow.test.ts.

import { addDays, canWithdraw, localDate, sha256Hex } from '../../_shared/engine/index.ts';

export const OPERATOR_NAME = 'Telvia (demo)'; // numele operatorului fictiv ales de David (21.11, 14:20); seed-ul vechi are 'Operatorul demo'
export const REVIEW_ETA_TEXT = 'Un coleg revine in 24 de ore.';

// ---------- Revizuire umana (art. 18(8)) ----------

/** Statusurile din care clientul poate cere revizuire: orice decizie automata, inainte de semnare. */
export const REVIEWABLE_STATUSES = ['approved', 'rejected', 'manual_review'] as const;
export const isReviewable = (status: string) => (REVIEWABLE_STATUSES as readonly string[]).includes(status);

/** Mesajul optional al clientului: text, max 1000 caractere; gol -> null. */
export function cleanMessage(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== 'string') return { ok: false };
  const t = v.trim();
  if (t.length > 1000) return { ok: false };
  return { ok: true, value: t.length ? t : null };
}

// ---------- Starea cererii pentru aplicatia clientului (GET /applications/:id) ----------

export type NextStep = 'consents' | 'assessment' | 'wait_review' | 'rejected' | 'secci' | 'sign' | 'agreement' | 'none';

/** Pasul la care trebuie sa revina aplicatia (dupa refresh sau dupa revizuire). */
export function nextStep(status: string, f: { consents_given: boolean; secci_shown: boolean }): NextStep {
  switch (status) {
    case 'draft': return f.consents_given ? 'assessment' : 'consents';
    case 'manual_review': return 'wait_review';
    case 'rejected': return 'rejected';
    case 'approved': return f.secci_shown ? 'sign' : 'secci';
    case 'signed': return 'agreement';
    default: return 'none';
  }
}

// ---------- OTP (simulat, dar tratat ca un secret real) ----------

export const OTP_TTL_S = 300;            // expira in 5 minute
export const OTP_MAX_PER_WINDOW = 3;     // maximum 3 coduri ...
export const OTP_WINDOW_MS = 10 * 60_000; // ... in 10 minute
export const OTP_MAX_ATTEMPTS = 5;       // maximum 5 incercari pe cod

/** Cod de 6 cifre, uniform (fara bias de modulo), din generatorul criptografic. */
export function newOtpCode(): string {
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return String(buf[0] % 1_000_000).padStart(6, '0');
  }
}

/** Salvam doar hash-ul: sha256(appId|cod|pepper). Pepper-ul e secret al functiei (OTP_PEPPER). */
export const otpHash = (applicationId: string, code: string, pepper: string) =>
  sha256Hex(`${applicationId}|${code}|${pepper}`);

/** Comparatie in timp constant (nu dezvaluie prin timp cate caractere se potrivesc). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const isOtpFormat = (v: unknown): v is string => typeof v === 'string' && /^\d{6}$/.test(v);

export type OtpChallenge = { expires_at: string; attempts: number; consumed_at: string | null };

/** Starea ultimului cod, inainte de comparatie. */
export function otpState(ch: OtpChallenge | null, now: Date): 'missing' | 'expired' | 'locked' | 'usable' {
  if (!ch || ch.consumed_at) return 'missing';
  if (new Date(ch.expires_at).getTime() <= now.getTime()) return 'expired';
  if (ch.attempts >= OTP_MAX_ATTEMPTS) return 'locked';
  return 'usable';
}

// ---------- Contract: "azi" in demo, retragere, reminder ----------

/** "Azi" pentru contract = data reala (Bucuresti) + zilele sarite in demo. */
export const demoToday = (now: Date, offsetDays: number) => addDays(localDate(now), offsetDays);

export type AgreementLike = {
  status: 'active' | 'withdrawn';
  withdrawal_deadline: string;
  reminder_required: boolean;
  reminder_from: string | null;
  reminder_to: string | null;
};

export const canWithdrawNow = (a: AgreementLike, today: string) => a.status === 'active' && canWithdraw(today, a.withdrawal_deadline);

/** Reminderul (art. 10) se trimite o singura data, cand "azi" intra in fereastra zilelor 1-7. */
export function reminderDue(a: AgreementLike, today: string, alreadySent: boolean): boolean {
  if (alreadySent || a.status !== 'active' || !a.reminder_required || !a.reminder_from || !a.reminder_to) return false;
  return today >= a.reminder_from && today <= a.reminder_to;
}

export const reminderText = (deadline: string) =>
  `Iti amintim ca te poti retrage din contract pana la ${deadline}, fara motiv.`;

export const isDemoDays = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 60;

// ---------- Oferta salvata vs recalculata ----------

type KeyFigures = {
  installment_lei: number; installments: number; total_payable_lei: number;
  total_cost_lei: number; nominal_rate_pct: number; apr_pct: number;
};
type SnapshotFigures = KeyFigures & { principal_lei: number };

/** Cifrele cheie recalculate trebuie sa fie identice cu cele salvate la cerere (altfel nu afisam SECCI). */
export function sameKeyFigures(snap: SnapshotFigures, q: KeyFigures & { total_credit_lei: number }): boolean {
  return snap.principal_lei === q.total_credit_lei && snap.installment_lei === q.installment_lei &&
    snap.installments === q.installments && snap.total_payable_lei === q.total_payable_lei &&
    snap.total_cost_lei === q.total_cost_lei && snap.nominal_rate_pct === q.nominal_rate_pct && snap.apr_pct === q.apr_pct;
}
