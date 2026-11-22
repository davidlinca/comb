// Trimiterea reala a codului de semnare (OTP), decis 22.11, 10:30: email prin Resend + SMS prin SMS Gateway for Android (cloud).
// Clientii sunt sintetici, deci codul pleaca la telefonul si inboxul ECHIPEI, luate din secrete (nimic in baza de date).
// Reguli: codul nu apare NICIODATA in loguri, in jurnal sau in `notifications`; functiile nu arunca niciodata
// (un canal picat nu blocheaza semnarea); text fara diacritice si fara link (un singur segment SMS).

import { OTP_TTL_S } from './flow.ts';

export type Delivery = 'sent' | 'queued' | 'failed' | 'off' | 'limit';
export type NotifyDeps = { env?: (k: string) => string; fetch?: typeof fetch; timeoutMs?: number };

const RESEND_URL = 'https://api.resend.com/emails';
const SMSGATE_URL = 'https://api.sms-gate.app/3rdparty/v1/messages';
export const EMAIL_FROM = 'Comb <onboarding@resend.dev>'; // fara domeniu verificat: Resend trimite doar la adresa contului
export const SMS_DAILY_CAP_DEFAULT = 40;

const denoEnv = (k: string): string => (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k) ?? '';
const deps = (d: NotifyDeps = {}) => ({ env: d.env ?? denoEnv, fetch: d.fetch ?? fetch, timeoutMs: d.timeoutMs ?? 5000 });

/** Textul codului: fara diacritice, fara link, sub 160 de caractere (un singur segment GSM-7). */
export const otpText = (code: string) =>
  `Comb: codul tau de semnare este ${code}. Expira in ${Math.round(OTP_TTL_S / 60)} minute. Nu il da nimanui.`;

/** Plafonul zilnic de SMS (secretul SMS_DAILY_CAP, implicit 40). */
export function smsDailyCap(d: NotifyDeps = {}): number {
  const raw = deps(d).env('SMS_DAILY_CAP').trim();
  const n = Number(raw);
  return raw !== '' && Number.isInteger(n) && n >= 0 ? n : SMS_DAILY_CAP_DEFAULT; // gol (nesetat) -> 40, nu 0
}

/** Codul apare si pe ecran (demo), cat timp OTP_SHOW_ON_SCREEN nu e "false". */
export const showOnScreen = (d: NotifyDeps = {}) => deps(d).env('OTP_SHOW_ON_SCREEN').trim().toLowerCase() !== 'false';

/** SMS-ul e configurat (altfel nu are rost sa numaram plafonul). */
export const smsConfigured = (d: NotifyDeps = {}) => {
  const { env } = deps(d);
  return !!(env('SMSGATE_USER') && env('SMSGATE_PASS') && env('DEMO_SMS_TO'));
};

export async function sendOtpEmail(code: string, d: NotifyDeps = {}): Promise<Delivery> {
  const { env, fetch: f, timeoutMs } = deps(d);
  const key = env('RESEND_API_KEY'), to = env('DEMO_EMAIL_TO');
  if (!key || !to) return 'off';
  try {
    const r = await f(RESEND_URL, {
      method: 'POST', signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM, to: [to], subject: 'Codul tau de semnare Comb',
        text: `${otpText(code)}\nDaca nu ai cerut tu codul, ignora acest mesaj.`,
      }),
    });
    if (!r.ok) { console.error('[notify] resend', r.status); return 'failed'; }
    return 'sent';
  } catch {
    console.error('[notify] resend: timeout sau eroare de retea');
    return 'failed';
  }
}

export async function sendOtpSms(code: string, d: NotifyDeps = {}): Promise<Delivery> {
  const { env, fetch: f, timeoutMs } = deps(d);
  const u = env('SMSGATE_USER'), p = env('SMSGATE_PASS'), to = env('DEMO_SMS_TO');
  if (!u || !p || !to) return 'off';
  try {
    const r = await f(SMSGATE_URL, {
      method: 'POST', signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Basic ${btoa(`${u}:${p}`)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumbers: [to], textMessage: { text: otpText(code) } }),
    });
    if (!r.ok) { console.error('[notify] sms-gate', r.status); return 'failed'; }
    return 'queued'; // 202: preluat de serverul cloud, telefonul il trimite in cateva secunde
  } catch {
    console.error('[notify] sms-gate: timeout sau eroare de retea');
    return 'failed';
  }
}

/** Canalele trecute in jurnal: doar cele reusite, fara destinatie si fara cod. */
export function deliveredChannels(email: Delivery, sms: Delivery, onScreen: boolean): string[] {
  const ch: string[] = [];
  if (email === 'sent') ch.push('email');
  if (sms === 'queued' || sms === 'sent') ch.push('sms');
  if (onScreen) ch.push('pe ecran (demo)');
  return ch;
}
