// Rutele clientului, partea 2b: contractul, reminderul, retragerea, "Sari la ziua N" (rutele 12-14).
// "Azi" pentru contract = data reala (Bucuresti) + demo_offset_days. Jurnalul pastreaza ora REALA;
// payload-ul spune cate zile s-au sarit in demo, ca sa fie transparent.

import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../lib/auth.ts';
import { bad, conflict, onlyKeys, readJson, readJsonOptional } from '../lib/http.ts';
import { type AgreementRow, myAgreement } from '../lib/data.ts';
import { admin } from '../lib/supabase.ts';
import { appendLedger } from '../lib/ledger.ts';
import { canWithdrawNow, demoToday, isDemoDays, reminderDue, reminderText } from '../lib/flow.ts';
import { localDate, withdrawalAmount } from '../../_shared/engine/index.ts';

const r = new Hono<Env>();
const CHANNEL = 'email (simulat)';

async function reminders(db: SupabaseClient, applicationId: string) {
  const { data, error } = await db.from('notifications').select('sent_at, channel, body')
    .eq('application_id', applicationId).eq('kind', 'withdrawal_reminder').order('sent_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((n) => ({ sent_at: n.sent_at, channel: n.channel, text: n.body }));
}

function agreementJson(a: AgreementRow, today: string, rem: Awaited<ReturnType<typeof reminders>>) {
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
  };
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
  return c.json(agreementJson(a, today, rem));
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
