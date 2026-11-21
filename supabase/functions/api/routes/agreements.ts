// Rutele clientului, partea 2b: contractul, reminderul, retragerea, "Sari la ziua N" (rutele 12-14)
// si rata ratata cu masurile de toleranta (art. 35, ruta 12b, contract v0.6).
// "Azi" pentru contract = data reala (Bucuresti) + demo_offset_days. Jurnalul pastreaza ora REALA;
// payload-ul spune cate zile s-au sarit in demo, ca sa fie transparent.

import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../lib/auth.ts';
import { bad, conflict, onlyKeys, readJson, readJsonOptional } from '../lib/http.ts';
import { type AgreementRow, myAgreement } from '../lib/data.ts';
import { admin } from '../lib/supabase.ts';
import { appendLedger } from '../lib/ledger.ts';
import {
  canWithdrawNow, demoToday, FORBEARANCE_TALK_MESSAGE, forbearanceText, isDemoDays, isForbearanceOption, type MeasureReview,
  type MeasureRow, measureJson, missedNoticeText, planJson, reminderDue, reminderText, REVIEW_ETA_TEXT,
} from '../lib/flow.ts';
import {
  type ContractTerms, deferOneMonth, forbearanceOptions, localDate, type MissedInstallment, missedInstallment, reschedule,
  withdrawalAmount,
} from '../../_shared/engine/index.ts';

const r = new Hono<Env>();
const CHANNEL = 'email (simulat)';

async function reminders(db: SupabaseClient, applicationId: string) {
  const { data, error } = await db.from('notifications').select('sent_at, channel, body')
    .eq('application_id', applicationId).eq('kind', 'withdrawal_reminder').order('sent_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((n) => ({ sent_at: n.sent_at, channel: n.channel, text: n.body }));
}

// ---------- Rata ratata (art. 35) ----------

const terms = (a: AgreementRow): ContractTerms => ({
  principal_lei: a.app.principal_lei, nominal_rate_pct: a.app.nominal_rate_pct, installments: a.app.installments,
  signed_date: localDate(new Date(a.signed_at)),
});

/** In demo, prima rata e neplatita cand „azi” trece de scadenta (doar pe contract activ). */
const missedFor = (a: AgreementRow, today: string): MissedInstallment | null =>
  a.status === 'active' ? missedInstallment(terms(a), today) : null;

async function missedNotice(db: SupabaseClient, applicationId: string) {
  const { data, error } = await db.from('notifications').select('sent_at, channel, body')
    .eq('application_id', applicationId).eq('kind', 'installment_missed').maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { sent_at: data.sent_at, channel: data.channel, text: data.body } : null;
}

async function measure(db: SupabaseClient, agreementId: string) {
  const { data, error } = await db.from('forbearance_measures')
    .select('option, installment_n, missed_due_date, created_at, extra_cost_lei, new_installment_lei, new_installments, new_total_payable_lei, schedule, human_reviews(status, resolved_at)')
    .eq('agreement_id', agreementId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const hr = data.human_reviews as unknown as MeasureReview | MeasureReview[];
  const review = Array.isArray(hr) ? (hr[0] ?? null) : (hr ?? null);
  return measureJson(data as unknown as MeasureRow, review);
}

/**
 * Prima detectare a ratei ratate: mesajul simulat + jurnalul (installment_missed, forbearance_offered), o singura data.
 * Indexul unic pe notificari (o rata ratata pe cerere) face pasul sigur si la doua cereri simultane.
 */
async function recordMissed(a: AgreementRow, m: MissedInstallment) {
  const { error } = await admin.from('notifications').insert({
    application_id: a.application_id, kind: 'installment_missed', channel: CHANNEL, body: missedNoticeText(m),
  });
  if (error) {
    if (error.code === '23505') return; // deja inregistrata
    throw new Error(error.message);
  }
  const o = forbearanceOptions(terms(a), m.n);
  await appendLedger(a.application_id, [
    {
      event: 'installment_missed', actor: 'system',
      payload: { agreement_id: a.id, installment_n: m.n, due_date: m.due_date, days_late: m.days_late, channel: CHANNEL, demo_offset_days: a.demo_offset_days },
    },
    {
      event: 'forbearance_offered', actor: 'system',
      payload: {
        agreement_id: a.id, installment_n: m.n, options: ['defer', 'reschedule', 'talk'], fees_lei: 0,
        defer_extra_cost_lei: o.defer.extra_cost_lei,
        reschedule_installment_lei: o.reschedule.installment_lei, reschedule_installments: o.reschedule.installments,
        reschedule_extra_cost_lei: o.reschedule.extra_cost_lei,
      },
    },
  ]);
}

function agreementJson(
  a: AgreementRow, today: string, rem: Awaited<ReturnType<typeof reminders>>,
  art35: {
    missed: MissedInstallment | null;
    notice: Awaited<ReturnType<typeof missedNotice>>;
    chosen: Awaited<ReturnType<typeof measure>>;
  },
) {
  const options = art35.missed && !art35.chosen ? forbearanceOptions(terms(a), art35.missed.n) : null;
  return {
    agreement_id: a.id,
    application_id: a.application_id,
    status: a.status,
    signed_at: a.signed_at,
    first_installment_due: a.first_installment_due,
    withdrawal_deadline: a.withdrawal_deadline,
    can_withdraw: canWithdrawNow(a, today),
    today,
    demo_offset_days: a.demo_offset_days,
    reminder_window: a.reminder_required ? { from: a.reminder_from, to: a.reminder_to } : null,
    reminders: rem,
    withdrawal: a.status === 'withdrawn'
      ? { withdrawn_at: a.withdrawn_at, amount_to_return_lei: a.amount_to_return_lei, return_by: a.return_by }
      : null,
    // art. 35 (v0.6): cardul se arata cand missed_installment != null si forbearance == null
    missed_installment: art35.missed,
    missed_notice: art35.notice,
    forbearance_options: options
      ? { defer: planJson(options.defer), reschedule: planJson(options.reschedule), talk: { eta_text: REVIEW_ETA_TEXT } }
      : null,
    forbearance: art35.chosen,
  };
}

/** Starea art. 35 a contractului; la prima detectare inregistreaza rata ratata (lazy, fara cron). */
async function art35State(db: SupabaseClient, a: AgreementRow, today: string) {
  const missed = missedFor(a, today);
  let chosen = await measure(db, a.id);
  let notice = await missedNotice(db, a.application_id);
  if (missed && !chosen && !notice) {
    await recordMissed(a, missed);
    [notice, chosen] = await Promise.all([missedNotice(db, a.application_id), measure(db, a.id)]);
  }
  return { missed, notice, chosen };
}

// 12. GET /agreements/:id  (trimite reminderul "lazy", fara cron, cand "azi" intra in zilele 1-7)
r.get('/agreements/:id', async (c) => {
  const db = c.get('db');
  const a = await myAgreement(db, c.get('userId'), c.req.param('id'));
  const today = demoToday(new Date(), a.demo_offset_days);
  let rem = await reminders(db, a.application_id);

  if (reminderDue(a, today, rem.length > 0)) {
    const { error } = await admin.from('notifications').insert({
      application_id: a.application_id, kind: 'withdrawal_reminder', channel: CHANNEL, body: reminderText(a.withdrawal_deadline),
    });
    if (error) throw new Error(error.message);
    await appendLedger(a.application_id, [{
      event: 'withdrawal_reminder_sent', actor: 'system',
      payload: { channel: CHANNEL, window_from: a.reminder_from, window_to: a.reminder_to, demo_offset_days: a.demo_offset_days },
    }]);
    rem = await reminders(db, a.application_id);
  }
  return c.json(agreementJson(a, today, rem, await art35State(db, a, today)));
});

// 12b. POST /agreements/:id/forbearance  body: { option: 'defer' | 'reschedule' | 'talk' }  (art. 35, contract v0.6)
// O singura masura pe contract, aleasa de client. „talk” intra in coada din back-office.
r.post('/agreements/:id/forbearance', async (c) => {
  const db = c.get('db');
  const body = await readJson(c.req.raw);
  onlyKeys(body, ['option']);
  const option = body.option;
  if (!isForbearanceOption(option)) throw bad('VALIDATION', 'option poate fi defer, reschedule sau talk.', ['option']);
  const a = await myAgreement(db, c.get('userId'), c.req.param('id'));
  if (a.status === 'withdrawn') throw conflict('ALREADY_WITHDRAWN', 'Te-ai retras din acest contract.');
  const today = demoToday(new Date(), a.demo_offset_days);
  const st = await art35State(db, a, today); // inregistreaza rata ratata inainte de alegere, daca nu s-a facut
  if (!st.missed) throw conflict('NO_MISSED_INSTALLMENT', 'Nu ai nicio rata restanta.');
  if (st.chosen) throw conflict('FORBEARANCE_ALREADY_CHOSEN', 'Ai ales deja o varianta pentru aceasta rata.');
  const m = st.missed;
  const base = { agreement_id: a.id, installment_n: m.n, missed_due_date: m.due_date, option };
  const alreadyChosen = () => conflict('FORBEARANCE_ALREADY_CHOSEN', 'Ai ales deja o varianta pentru aceasta rata.');

  if (option === 'talk') {
    const { data: pend, error: pe } = await db.from('human_reviews').select('id')
      .eq('application_id', a.application_id).eq('status', 'pending').limit(1);
    if (pe) throw new Error(pe.message);
    if (pend?.length) throw conflict('REVIEW_PENDING', 'Un coleg se uita deja la cererea ta.');

    const { data: fm, error: fe } = await admin.from('forbearance_measures').insert(base).select('id').single();
    if (fe) throw fe.code === '23505' ? alreadyChosen() : new Error(fe.message);
    const { data: hr, error: he } = await admin.from('human_reviews').insert({
      application_id: a.application_id, requested_by: 'customer', customer_message: FORBEARANCE_TALK_MESSAGE,
    }).select('id').single();
    if (he) {
      await admin.from('forbearance_measures').delete().eq('id', fm.id); // nu lasam o masura fara cerere in coada
      throw he.code === '23505' ? conflict('REVIEW_PENDING', 'Un coleg se uita deja la cererea ta.') : new Error(he.message);
    }
    const { error: ue } = await admin.from('forbearance_measures').update({ human_review_id: hr.id }).eq('id', fm.id);
    if (ue) throw new Error(ue.message);
    await appendLedger(a.application_id, [
      { event: 'forbearance_chosen', actor: 'customer', payload: { agreement_id: a.id, installment_n: m.n, option, demo_offset_days: a.demo_offset_days } },
      { event: 'human_review_requested', actor: 'customer', payload: { requested_by: 'customer', topic: 'forbearance', previous_status: 'signed', has_message: true } },
    ]);
  } else {
    const p = option === 'defer' ? deferOneMonth(terms(a), m.n) : reschedule(terms(a), m.n);
    const { error: fe } = await admin.from('forbearance_measures').insert({
      ...base, extra_cost_lei: p.extra_cost_lei, new_installment_lei: p.installment_lei, new_installments: p.installments,
      new_total_payable_lei: p.total_payable_lei, schedule: p.schedule,
    });
    if (fe) throw fe.code === '23505' ? alreadyChosen() : new Error(fe.message);
    await appendLedger(a.application_id, [{
      event: 'forbearance_chosen', actor: 'customer',
      payload: {
        agreement_id: a.id, installment_n: m.n, option, extra_cost_lei: p.extra_cost_lei, fees_lei: 0,
        new_installment_lei: p.installment_lei, new_installments: p.installments, new_total_payable_lei: p.total_payable_lei,
        demo_offset_days: a.demo_offset_days,
      },
    }]);
  }

  const chosen = await measure(db, a.id);
  return c.json({ forbearance: chosen, text: chosen?.text ?? forbearanceText(option, null) });
});

// 13. POST /agreements/:id/withdraw  (fara body; art. 26)
r.post('/agreements/:id/withdraw', async (c) => {
  const db = c.get('db');
  const a = await myAgreement(db, c.get('userId'), c.req.param('id'));
  onlyKeys(await readJsonOptional(c.req.raw), []);
  if (a.status === 'withdrawn') throw conflict('ALREADY_WITHDRAWN', 'Te-ai retras deja din acest contract.');
  const today = demoToday(new Date(), a.demo_offset_days);
  if (!canWithdrawNow(a, today)) throw conflict('WITHDRAWAL_EXPIRED', 'Termenul de retragere de 14 zile a trecut.');

  const signedDate = localDate(new Date(a.signed_at));
  const w = withdrawalAmount(a.app.principal_lei, a.app.nominal_rate_pct, signedDate, today);
  const withdrawnAt = new Date().toISOString();

  const { data: upd, error } = await admin.from('agreements').update({
    status: 'withdrawn', withdrawn_at: withdrawnAt, amount_to_return_lei: w.amount_to_return_lei, return_by: w.return_by,
  }).eq('id', a.id).eq('status', 'active').select('id');
  if (error) throw new Error(error.message);
  if (!upd?.length) throw conflict('ALREADY_WITHDRAWN', 'Te-ai retras deja din acest contract.');

  await appendLedger(a.application_id, [{
    event: 'withdrawn', actor: 'customer',
    payload: {
      agreement_id: a.id, days_used: w.days_used, amount_to_return_lei: w.amount_to_return_lei, return_by: w.return_by,
      demo_offset_days: a.demo_offset_days,
    },
  }]);
  return c.json({
    status: 'withdrawn', withdrawn_at: withdrawnAt, amount_to_return_lei: w.amount_to_return_lei,
    principal_lei: w.principal_lei, interest_lei: w.interest_lei, days_used: w.days_used, return_by: w.return_by, text: w.text,
  });
});

// 14. POST /demo/time-travel  body: { agreement_id, days }  (P1, doar pentru demo; "Sari la ziua 3")
r.post('/demo/time-travel', async (c) => {
  const db = c.get('db');
  const body = await readJson(c.req.raw);
  onlyKeys(body, ['agreement_id', 'days']);
  if (typeof body.agreement_id !== 'string') throw bad('VALIDATION', 'Trimite agreement_id.', ['agreement_id']);
  if (!isDemoDays(body.days)) throw bad('VALIDATION', 'days trebuie sa fie un numar intreg intre 0 si 60.', ['days']);
  const a = await myAgreement(db, c.get('userId'), body.agreement_id);

  const { error } = await admin.from('agreements').update({ demo_offset_days: body.days }).eq('id', a.id);
  if (error) throw new Error(error.message);
  return c.json({ agreement_id: a.id, demo_offset_days: body.days, today: demoToday(new Date(), body.days) });
});

export default r;
