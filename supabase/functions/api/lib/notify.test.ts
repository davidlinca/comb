// Teste pentru trimiterea reala a codului (lib/notify.ts), cu fetch simulat. Ruleaza in Node si in Deno:
//   node --test supabase/functions/api/lib/notify.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deliveredChannels, EMAIL_FROM, otpText, sendOtpEmail, sendOtpSms, showOnScreen, smsConfigured, smsDailyCap,
} from './notify.ts';

const CODE = '482913';
const ALL = {
  RESEND_API_KEY: 're_test_key', DEMO_EMAIL_TO: 'echipa@example.com',
  SMSGATE_USER: 'user1', SMSGATE_PASS: 'pass1', DEMO_SMS_TO: '+40700000000',
};
const envOf = (o: Record<string, string>) => (k: string) => o[k] ?? '';
type Call = { url: string; init: RequestInit };
const fakeFetch = (status: number, calls: Call[] = []) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response('{}', { status });
  }) as typeof fetch;
// Raspunde abia dupa 2 s; timeout-ul din notify (30 ms in test) il opreste inainte. Timer-ul tine bucla vie (Node) si e curatat (Deno).
const hangingFetch = ((_url: string | URL | Request, init?: RequestInit) =>
  new Promise<Response>((res, rej) => {
    const t = setTimeout(() => res(new Response('{}', { status: 200 })), 2000);
    init?.signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); });
  })) as typeof fetch;

/** Prinde tot ce merge in console.error, ca sa verificam ca nu apare codul. */
async function captureErrors<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string[] }> {
  const logs: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); };
  try { return { result: await fn(), logs }; } finally { console.error = orig; }
}

test('textul: fara diacritice, fara link, un singur segment SMS, cu expirarea din OTP_TTL_S', () => {
  const t = otpText(CODE);
  assert.equal(t, 'Comb: codul tau de semnare este 482913. Expira in 5 minute. Nu il da nimanui.');
  assert.ok(t.length <= 160);
  assert.match(t, /^[\x20-\x7E]+$/); // doar ASCII
  assert.doesNotMatch(t, /https?:|www\./);
});

test('secrete lipsa -> off (fara apel de retea)', async () => {
  const calls: Call[] = [];
  assert.equal(await sendOtpEmail(CODE, { env: envOf({}), fetch: fakeFetch(200, calls) }), 'off');
  assert.equal(await sendOtpSms(CODE, { env: envOf({ SMSGATE_USER: 'u', SMSGATE_PASS: 'p' }), fetch: fakeFetch(202, calls) }), 'off');
  assert.equal(calls.length, 0);
});

test('Resend 200 -> sent; cererea are Bearer, expeditorul de test si destinatia din secret', async () => {
  const calls: Call[] = [];
  assert.equal(await sendOtpEmail(CODE, { env: envOf(ALL), fetch: fakeFetch(200, calls) }), 'sent');
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer re_test_key');
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.from, EMAIL_FROM);
  assert.deepEqual(body.to, ['echipa@example.com']);
  assert.match(body.text, /482913/);
});

test('SMS Gateway 202 -> queued; Basic auth si corpul din documentatie', async () => {
  const calls: Call[] = [];
  assert.equal(await sendOtpSms(CODE, { env: envOf(ALL), fetch: fakeFetch(202, calls) }), 'queued');
  assert.equal(calls[0].url, 'https://api.sms-gate.app/3rdparty/v1/messages');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, `Basic ${btoa('user1:pass1')}`);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { phoneNumbers: ['+40700000000'], textMessage: { text: otpText(CODE) } });
});

test('500 -> failed, iar codul NU apare in console.error', async () => {
  const e = await captureErrors(() => sendOtpEmail(CODE, { env: envOf(ALL), fetch: fakeFetch(500) }));
  const s = await captureErrors(() => sendOtpSms(CODE, { env: envOf(ALL), fetch: fakeFetch(500) }));
  assert.equal(e.result, 'failed');
  assert.equal(s.result, 'failed');
  for (const l of [...e.logs, ...s.logs]) {
    assert.doesNotMatch(l, /482913/);
    assert.doesNotMatch(l, /re_test_key|pass1|echipa@|\+40700/);
  }
  assert.ok(e.logs.length === 1 && s.logs.length === 1);
});

test('timeout -> failed (nu arunca), codul NU apare in console.error', async () => {
  const e = await captureErrors(() => sendOtpEmail(CODE, { env: envOf(ALL), fetch: hangingFetch, timeoutMs: 30 }));
  const s = await captureErrors(() => sendOtpSms(CODE, { env: envOf(ALL), fetch: hangingFetch, timeoutMs: 30 }));
  assert.equal(e.result, 'failed');
  assert.equal(s.result, 'failed');
  for (const l of [...e.logs, ...s.logs]) assert.doesNotMatch(l, /482913/);
});

test('fetch care arunca (retea) -> failed', async () => {
  const boom = (async () => { throw new TypeError('network'); }) as typeof fetch;
  const r = await captureErrors(() => sendOtpSms(CODE, { env: envOf(ALL), fetch: boom }));
  assert.equal(r.result, 'failed');
});

test('plafon SMS: implicit 40, din secret daca e numar intreg >= 0', () => {
  assert.equal(smsDailyCap({ env: envOf({}) }), 40);
  assert.equal(smsDailyCap({ env: envOf({ SMS_DAILY_CAP: '10' }) }), 10);
  assert.equal(smsDailyCap({ env: envOf({ SMS_DAILY_CAP: '0' }) }), 0);
  assert.equal(smsDailyCap({ env: envOf({ SMS_DAILY_CAP: 'abc' }) }), 40);
  assert.equal(smsDailyCap({ env: envOf({ SMS_DAILY_CAP: '-3' }) }), 40);
});

test('codul pe ecran: implicit da; doar "false" il ascunde', () => {
  assert.equal(showOnScreen({ env: envOf({}) }), true);
  assert.equal(showOnScreen({ env: envOf({ OTP_SHOW_ON_SCREEN: 'true' }) }), true);
  assert.equal(showOnScreen({ env: envOf({ OTP_SHOW_ON_SCREEN: ' FALSE ' }) }), false);
});

test('SMS configurat doar cu user, parola si destinatie', () => {
  assert.equal(smsConfigured({ env: envOf(ALL) }), true);
  assert.equal(smsConfigured({ env: envOf({ SMSGATE_USER: 'u', SMSGATE_PASS: 'p' }) }), false);
});

test('canalele din jurnal: doar cele reusite, fara destinatie', () => {
  assert.deepEqual(deliveredChannels('sent', 'queued', true), ['email', 'sms', 'pe ecran (demo)']);
  assert.deepEqual(deliveredChannels('failed', 'limit', true), ['pe ecran (demo)']);
  assert.deepEqual(deliveredChannels('off', 'off', false), []);
  assert.deepEqual(deliveredChannels('sent', 'failed', false), ['email']);
});
