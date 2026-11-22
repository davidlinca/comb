// Rutele clientului, partea 2a: revizuire umana, SECCI, OTP, semnare (rutele 7-11).
// Citiri prin `db` (RLS). Scrieri prin `admin` DOAR dupa myApplication (cererea e a clientului logat).
// OTP: `otp_challenges` nu are politici RLS (nimeni din browser), deci il citim cu `admin`, tot dupa myApplication.

import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../lib/auth.ts';
import { bad, conflict, onlyKeys, readJson, readJsonOptional, tooMany, unavailable } from '../lib/http.ts';
import { type ApplicationRow, catalog, myApplication, savedSecci, type SecciRow } from '../lib/data.ts';
import { admin } from '../lib/supabase.ts';
import { appendLedger } from '../lib/ledger.ts';
import { deliveredChannels, type Delivery, sendOtpEmail, sendOtpSms, showOnScreen, smsConfigured, smsDailyCap } from '../lib/notify.ts';
import {
  cleanMessage, isOtpFormat, isReviewable, newOtpCode, OPERATOR_NAME, OTP_MAX_ATTEMPTS, OTP_MAX_PER_WINDOW, OTP_TTL_S,
  OTP_WINDOW_MS, otpHash, otpState, REVIEW_ETA_TEXT, safeEqual, sameKeyFigures,
} from '../lib/flow.ts';
import {
  buildQuote, buildSecci, canonicalJson, localDate, reminderWindow, SECCI_VERSION, sha256Hex, withdrawalDeadline,
} from '../../_shared/engine/index.ts';

const r = new Hono<Env>();

/** Recalculeaza oferta cererii pentru o data de start (prima rata la o luna de la ea). */
async function offerAt(db: SupabaseClient, app: ApplicationRow, startDate: string) {
  const cat = await catalog(db);
  const device = cat.devices.find((d) => d.sku === app.sku);
  const product = cat.products.find((p) => p.id === app.product_id);
  if (!device || !product) throw conflict('OFFER_CHANGED', 'Oferta nu mai este disponibila.');
  const quote = buildQuote(device, product, app.term_months, startDate);
  if (!sameKeyFigures(app, quote)) throw conflict('OFFER_CHANGED', 'Cifrele ofertei s-au schimbat. Fa o cerere noua.');
  return { device, product, quote };
}

const notApproved = (status: string) => status === 'signed'
  ? conflict('ALREADY_SIGNED', 'Contractul este deja semnat.')
  : conflict('NOT_APPROVED', 'Cererea nu este aprobata.');

const requireSecci = async (db: SupabaseClient, appId: string): Promise<SecciRow> => {
  const s = await savedSecci(db, appId, SECCI_VERSION);
  if (!s) throw conflict('SECCI_NOT_SHOWN', 'Mai intai afiseaza formularul cu informatiile contractului.');
  return s;
};

// 7. POST /applications/:id/human-review  body: { message? }  (art. 18(8))
r.post('/applications/:id/human-review', async (c) => {
  const db = c.get('db');
  const { app } = await myApplication(db, c.get('userId'), c.req.param('id'));
  const body = await readJsonOptional(c.req.raw);
  onlyKeys(body, ['message']);
  const msg = cleanMessage(body.message);
  if (!msg.ok) throw bad('VALIDATION', 'Mesajul poate avea cel mult 1000 de caractere.', ['message']);

  if (!isReviewable(app.status)) {
    throw app.status === 'signed'
      ? conflict('ALREADY_SIGNED', 'Contractul este deja semnat.')
      : conflict('REVIEW_NOT_ALLOWED', 'Cererea nu are inca o decizie de revizuit.');
  }
  const { data: pending, error: pe } = await db.from('human_reviews').select('id')
    .eq('application_id', app.id).eq('status', 'pending').limit(1);
  if (pe) throw new Error(pe.message);
  if (pending?.length) throw conflict('REVIEW_PENDING', 'Ai deja o cerere de revizuire in lucru.');

  // Decizie 21.11: cererea intra in coada (manual_review) pana o rezolva operatorul.
  // Update conditionat de statusul citit -> doua click-uri simultane nu creeaza doua revizuiri.
  const { data: moved, error: ue } = await admin.from('applications').update({ status: 'manual_review' })
    .eq('id', app.id).eq('status', app.status).select('id');
  if (ue) throw new Error(ue.message);
  if (!moved?.length) throw conflict('REVIEW_PENDING', 'Ai deja o cerere de revizuire in lucru.');

  const { error: ie } = await admin.from('human_reviews').insert({
    application_id: app.id, requested_by: 'customer', customer_message: msg.value,
  });
  if (ie) throw new Error(ie.message);

  await appendLedger(app.id, [{
    event: 'human_review_requested', actor: 'customer',
    payload: { requested_by: 'customer', previous_status: app.status, has_message: msg.value !== null },
  }]);
  return c.json({ status: 'manual_review', eta_text: REVIEW_ETA_TEXT });
});

// 8. GET /applications/:id/secci  (art. 10 + Anexa I/II)
r.get('/applications/:id/secci', async (c) => {
  const db = c.get('db');
  const { app } = await myApplication(db, c.get('userId'), c.req.param('id'));
  if (app.status !== 'approved' && app.status !== 'signed') throw notApproved(app.status);

  // Documentul afisat o data ramane acelasi (e dovada): il returnam pe cel salvat, fara eveniment nou.
  const saved = await savedSecci(db, app.id, SECCI_VERSION);
  if (saved) return c.json(saved.content);
  if (app.status === 'signed') throw conflict('SECCI_NOT_SHOWN', 'Formularul nu a fost afisat pentru aceasta cerere.');

  const { product, quote } = await offerAt(db, app, localDate(new Date()));
  const secci = buildSecci(quote, product, OPERATOR_NAME);
  const sha = await sha256Hex(canonicalJson(secci));

  const { error } = await admin.from('secci_documents').insert({
    application_id: app.id, secci_version: secci.secci_version, content: secci, content_sha256: sha,
  });
  if (error?.code === '23505') { // doua cereri simultane: a castigat cealalta, returnam ce s-a salvat
    const again = await savedSecci(db, app.id, SECCI_VERSION);
    if (again) return c.json(again.content);
  }
  if (error) throw new Error(error.message);

  await appendLedger(app.id, [{ event: 'secci_shown', actor: 'system', payload: { secci_version: secci.secci_version, content_sha256: sha } }]);
  return c.json(secci);
});

// 9. POST /applications/:id/secci/viewed  body: { time_on_screen_ms, details_opened }  (P1)
r.post('/applications/:id/secci/viewed', async (c) => {
  const db = c.get('db');
  const { app } = await myApplication(db, c.get('userId'), c.req.param('id'));
  const body = await readJson(c.req.raw);
  onlyKeys(body, ['time_on_screen_ms', 'details_opened']);
  const ms = body.time_on_screen_ms;
  if (typeof ms !== 'number' || !Number.isInteger(ms) || ms < 0 || ms > 86_400_000) {
    throw bad('VALIDATION', 'time_on_screen_ms trebuie sa fie un numar intreg de milisecunde.', ['time_on_screen_ms']);
  }
  if (typeof body.details_opened !== 'boolean') throw bad('VALIDATION', 'details_opened trebuie sa fie true sau false.', ['details_opened']);
  if (app.status !== 'approved' && app.status !== 'signed') throw notApproved(app.status);
  const s = await requireSecci(db, app.id);

  // Mai multe vizite: adunam timpul; "a deschis detaliile" ramane true daca a fost o data.
  const { error } = await admin.from('secci_documents').update({
    time_on_screen_ms: (s.time_on_screen_ms ?? 0) + ms,
    details_opened: Boolean(s.details_opened) || body.details_opened,
  }).eq('id', s.id);
  if (error) throw new Error(error.message);

  await appendLedger(app.id, [{
    event: 'secci_viewed', actor: 'customer',
    payload: { secci_version: s.secci_version, time_on_screen_ms: ms, details_opened: body.details_opened },
  }]);
  return c.json({ ok: true });
});

// 9b. POST /applications/:id/secci/email  (fara body; simulat - suport durabil, art. 10)  (P1)
r.post('/applications/:id/secci/email', async (c) => {
  const db = c.get('db');
  const { app } = await myApplication(db, c.get('userId'), c.req.param('id'));
  onlyKeys(await readJsonOptional(c.req.raw), []);
  if (app.status !== 'approved' && app.status !== 'signed') throw notApproved(app.status);
  const s = await requireSecci(db, app.id);

  const sentAt = new Date().toISOString();
  const channel = 'email (simulat)';
  const { error: ne } = await admin.from('notifications').insert({
    application_id: app.id, kind: 'secci_email', channel, sent_at: sentAt,
    body: `Formularul de informare (SECCI ${s.secci_version}) pentru cererea ta de rate.`,
  });
  if (ne) throw new Error(ne.message);
  const { error: ue } = await admin.from('secci_documents').update({ emailed_at: sentAt }).eq('id', s.id);
  if (ue) throw new Error(ue.message);

  await appendLedger(app.id, [{
    event: 'secci_emailed', actor: 'system', payload: { secci_version: s.secci_version, content_sha256: s.content_sha256, channel },
  }]);
  return c.json({ ok: true, sent_at: sentAt, channel });
});

// 10. POST /applications/:id/otp  (fara body)
r.post('/applications/:id/otp', async (c) => {
  const db = c.get('db');
  const { app } = await myApplication(db, c.get('userId'), c.req.param('id'));
  onlyKeys(await readJsonOptional(c.req.raw), []);
  if (app.status !== 'approved') throw notApproved(app.status);
  await requireSecci(db, app.id);

  const pepper = Deno.env.get('OTP_PEPPER') ?? '';
  if (pepper.length < 16) {
    console.error('[api] OTP_PEPPER lipseste sau e prea scurt');
    throw unavailable('OTP_NOT_CONFIGURED', 'Semnarea nu este disponibila momentan.');
  }

  const since = new Date(Date.now() - OTP_WINDOW_MS).toISOString();
  const { count, error: ce } = await admin.from('otp_challenges').select('id', { count: 'exact', head: true })
    .eq('application_id', app.id).gte('created_at', since);
  if (ce) throw new Error(ce.message);
  if ((count ?? 0) >= OTP_MAX_PER_WINDOW) {
    throw tooMany('OTP_RATE_LIMIT', 'Ai cerut prea multe coduri. Incearca din nou peste cateva minute.');
  }

  const code = newOtpCode();
  const { error } = await admin.from('otp_challenges').insert({
    application_id: app.id, code_hash: await otpHash(app.id, code, pepper),
    expires_at: new Date(Date.now() + OTP_TTL_S * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);

  // Trimitere reala (decis 22.11): email + SMS in paralel, catre echipa; functiile nu arunca, un canal picat nu blocheaza.
  const smsAllowed = smsConfigured() ? (await smsSentLast24h()) < smsDailyCap() : true; // nefolosit => sendOtpSms da 'off'
  const [email, sms] = await Promise.all([
    sendOtpEmail(code),
    smsAllowed ? sendOtpSms(code) : Promise.resolve<Delivery>('limit'),
  ]);
  // Codul ramane pe ecran (demo: juriul intra ca Ana si nu primeste SMS-ul). Daca n-a plecat pe niciun canal, il aratam oricum.
  const onScreen = showOnScreen() || (email !== 'sent' && sms !== 'queued');
  await appendLedger(app.id, [{
    event: 'otp_sent', actor: 'system', payload: { expires_in_s: OTP_TTL_S, channels: deliveredChannels(email, sms, onScreen) },
  }]);
  return c.json({ ...(onScreen ? { otp_demo_code: code } : {}), expires_in_s: OTP_TTL_S, delivery: { email, sms } });
});

/** SMS-uri trimise in ultimele 24 de ore, pe toate cererile (din jurnal: otp_sent cu canalul „sms”). */
async function smsSentLast24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error } = await admin.from('ledger_entries').select('id', { count: 'exact', head: true })
    .eq('event', 'otp_sent').gte('occurred_at', since).contains('payload', { channels: ['sms'] });
  if (error) {
    console.error('[api] numararea SMS-urilor a esuat');
    return Number.MAX_SAFE_INTEGER; // in caz de dubiu, nu trimitem SMS
  }
  return count ?? 0;
}

// 11. POST /applications/:id/sign  body: { otp }
r.post('/applications/:id/sign', async (c) => {
  const db = c.get('db');
  const { app } = await myApplication(db, c.get('userId'), c.req.param('id'));
  const body = await readJson(c.req.raw);
  onlyKeys(body, ['otp']);
  if (!isOtpFormat(body.otp)) throw bad('VALIDATION', 'Codul are 6 cifre.', ['otp']);
  if (app.status !== 'approved') throw notApproved(app.status);
  const secci = await requireSecci(db, app.id);
  const pepper = Deno.env.get('OTP_PEPPER') ?? '';
  if (pepper.length < 16) throw unavailable('OTP_NOT_CONFIGURED', 'Semnarea nu este disponibila momentan.');

  // Ultimul cod cerut (un cod nou il inlocuieste pe cel vechi)
  const { data: ch, error: ce } = await admin.from('otp_challenges')
    .select('id, code_hash, expires_at, attempts, consumed_at')
    .eq('application_id', app.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (ce) throw new Error(ce.message);

  const now = new Date();
  const state = otpState(ch, now);
  if (state === 'missing') throw bad('OTP_NOT_REQUESTED', 'Cere mai intai un cod.', ['otp']);
  if (state === 'expired') throw bad('OTP_EXPIRED', 'Codul a expirat. Cere un cod nou.', ['otp']);
  if (state === 'locked') throw bad('OTP_LOCKED', 'Ai gresit codul de prea multe ori. Cere un cod nou.', ['otp']);

  const hash = await otpHash(app.id, body.otp, pepper);
  if (!safeEqual(hash, ch!.code_hash)) {
    const attempts = ch!.attempts + 1;
    // conditionat de valoarea citita: doua incercari simultane nu pot sari peste limita
    await admin.from('otp_challenges').update({ attempts }).eq('id', ch!.id).eq('attempts', ch!.attempts);
    const left = OTP_MAX_ATTEMPTS - attempts;
    throw left > 0
      ? bad('OTP_INVALID', `Cod gresit. Mai ai ${left} ${left === 1 ? 'incercare' : 'incercari'}.`, ['otp'])
      : bad('OTP_LOCKED', 'Ai gresit codul de prea multe ori. Cere un cod nou.', ['otp']);
  }

  // Consumam codul o singura data (update conditionat)
  const { data: used, error: ue } = await admin.from('otp_challenges').update({ consumed_at: now.toISOString() })
    .eq('id', ch!.id).is('consumed_at', null).select('id');
  if (ue) throw new Error(ue.message);
  if (!used?.length) throw conflict('OTP_ALREADY_USED', 'Codul a fost deja folosit.');

  // Graficul real porneste de la data semnarii; cifrele cheie trebuie sa fie aceleasi ca in SECCI.
  const signedDate = localDate(now);
  const { quote } = await offerAt(db, app, signedDate);
  const deadline = withdrawalDeadline(signedDate);
  const rem = reminderWindow(new Date(secci.first_shown_at), now, signedDate);

  const { data: agr, error: ae } = await admin.from('agreements').insert({
    application_id: app.id, secci_document_id: secci.id, signed_at: now.toISOString(),
    info_received_at: secci.first_shown_at, first_installment_due: quote.schedule[0].due_date,
    withdrawal_deadline: deadline, reminder_required: rem.required, reminder_from: rem.from, reminder_to: rem.to,
  }).select('id').single();
  if (ae?.code === '23505') throw conflict('ALREADY_SIGNED', 'Contractul este deja semnat.');
  if (ae) throw new Error(ae.message);

  const { error: se } = await admin.from('applications').update({ status: 'signed' }).eq('id', app.id).eq('status', 'approved');
  if (se) throw new Error(se.message);

  await appendLedger(app.id, [{
    event: 'agreement_signed', actor: 'customer',
    payload: {
      agreement_id: agr.id, first_installment_due: quote.schedule[0].due_date, withdrawal_deadline: deadline,
      secci_content_sha256: secci.content_sha256, reminder_required: rem.required,
    },
  }]);

  return c.json({
    agreement_id: agr.id, signed_at: now.toISOString(), first_installment_due: quote.schedule[0].due_date,
    withdrawal_deadline: deadline, reminder_window: rem.required ? { from: rem.from, to: rem.to } : null,
  });
});

export default r;
