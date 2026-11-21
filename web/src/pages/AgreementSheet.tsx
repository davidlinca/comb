import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, api2, ApiError, type Agreement, type Application, type WithdrawResult } from '../lib/api';
import { date, daysBetween, lei } from '../lib/format';
import { Btn, ErrorNote, Sheet } from '../components/ui';
import { IconArrow, IconBell, IconCheck, IconChevron, IconParty, IconUndo, IconX } from '../components/Icons';
import Backdrop from '../components/Backdrop';

// Ecranul 6b: după semnare. Contractul, termenul de retragere, mementoul și retragerea.
export default function AgreementSheet() {
  const { aid = '' } = useParams();
  const nav = useNavigate();
  const [agr, setAgr] = useState<Agreement | null>(null);
  const [app, setApp] = useState<Application | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WithdrawResult | null>(null);

  const load = useCallback(async () => {
    try {
      const a = await api2.agreement(aid);
      setAgr(a);
      if (!app) setApp(await api.application(a.application_id));
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Contractul nu s-a putut încărca.'); }
  }, [aid, app]);
  useEffect(() => { void load(); }, [load]);

  async function jumpDay3() {
    setBusy(true);
    try { await api2.timeTravel(aid, 3); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Nu am putut sări în timp.'); }
    setBusy(false);
  }
  async function withdraw() {
    setBusy(true); setError(null);
    try { const r = await api2.withdraw(aid); setResult(r); setConfirm(false); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Retragerea nu a reușit.'); setConfirm(false); }
    setBusy(false);
  }

  const close = () => nav('/shop');
  if (!agr) {
    return (<><Backdrop /><Sheet label="Contract"><div className="flex justify-end"><CloseBtn onClick={close} /></div>
      {error ? <ErrorNote>{error}</ErrorNote> : <p className="py-10 text-center text-[15px] text-muted">Se încarcă contractul…</p>}</Sheet></>);
  }

  const o = app?.offer;
  const withdrawn = agr.status === 'withdrawn' || !!result;

  if (withdrawn) {
    const w = result ?? agr.withdrawal;
    return (
      <>
        <Backdrop />
        <Sheet label="Te-ai retras din contract">
          <div className="flex justify-end"><CloseBtn onClick={close} /></div>
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-field text-paper"><IconCheck className="size-7" /></span>
            <h2 className="text-[24px] font-bold">Te-ai retras din contract</h2>
            <p className="text-[15px] text-muted">Detaliile plății sunt în email (simulat).</p>
          </div>
          {w && (
            <dl className="rounded-2xl border border-line px-4 py-1 text-[15px]">
              <Row k="De returnat" v={lei(w.amount_to_return_lei)} strong />
              {result && <Row k="din care" v={`${lei(result.principal_lei)} + ${lei(result.interest_lei)} dobândă (${result.days_used} zile)`} small />}
              <Row k="Până la" v={date(w.return_by)} />
              <Row k="Status contract" v="Închis" last />
            </dl>
          )}
          {result?.text && <p className="text-[14px] text-muted">{result.text}</p>}
          <Btn className="mt-auto" onClick={close}>Înapoi la magazin</Btn>
        </Sheet>
      </>
    );
  }

  const daysLeft = Math.max(0, daysBetween(agr.today, agr.withdrawal_deadline));
  const reminder = agr.reminders[agr.reminders.length - 1];

  return (
    <>
      <Backdrop />
      <Sheet label="Contractul a fost semnat" tall={!!reminder}>
        <div className="flex justify-end"><CloseBtn onClick={close} /></div>
        <div className="-mt-6 flex flex-col items-center gap-2 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-field text-brand"><IconParty /></span>
          <h2 className="text-[24px] font-bold">Contractul a fost semnat!</h2>
          <p className="text-[15px] text-muted">O copie a contractului a fost trimisă pe email (simulat).</p>
        </div>

        {reminder && (
          <div role="status" className="flex gap-3 rounded-2xl border border-brand/70 p-4">
            <IconBell className="size-5 shrink-0 text-brand" />
            <div className="flex flex-col gap-1 text-[15px]">
              <b>Mai ai {daysLeft} {daysLeft === 1 ? 'zi' : 'zile'} să te retragi</b>
              <span className="text-muted">{reminder.text}</span>
            </div>
          </div>
        )}

        <dl className="rounded-2xl border border-line px-4 py-1 text-[15px]">
          {o && <Row k="Total de plată" v={lei(o.total_payable_lei)} strong />}
          {o && <Row k="Rată lunară" v={`${lei(o.installment_lei)} × ${o.installments}`} />}
          <Row k="Prima rată" v={date(agr.first_installment_due)} />
          <Row k="Te poți retrage până la" v={date(agr.withdrawal_deadline)} last />
        </dl>

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[15px] font-medium">
            <IconArrow className="size-4 text-brand" /><span className="flex-1">Detalii despre contract și retragere</span>
            <IconChevron className="size-4 rotate-90 text-muted transition-transform group-open:-rotate-90" />
          </summary>
          <div className="mt-2 flex flex-col gap-1.5 pl-6 text-[14px] text-muted">
            <span>Semnat pe {date(agr.signed_at)}.</span>
            <span>Dacă te retragi, returnezi suma primită și dobânda pentru zilele folosite, în cel mult 30 de zile.</span>
            {agr.reminder_window && <span>Îți trimitem un memento între {date(agr.reminder_window.from)} și {date(agr.reminder_window.to)}.</span>}
          </div>
        </details>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="mt-auto flex flex-col gap-2.5">
          <Btn onClick={close}>Înapoi la magazin</Btn>
          {agr.can_withdraw && <Btn variant="secondary" onClick={() => setConfirm(true)}>Retragere din contract</Btn>}
          {agr.demo_offset_days < 3 && agr.can_withdraw && (
            <button type="button" onClick={jumpDay3} disabled={busy} className="py-1 text-[13px] text-muted underline-offset-2 hover:underline">Sari la ziua 3 (demo)</button>
          )}
          {agr.demo_offset_days > 0 && <p className="text-center text-[12px] text-muted">Demo: ziua {agr.demo_offset_days} după semnare</p>}
        </div>
      </Sheet>

      {confirm && (
        <div className="absolute inset-0 z-20">
          <div className="absolute inset-0 bg-black/60" aria-hidden onClick={() => setConfirm(false)} />
          <div role="alertdialog" aria-modal="true" aria-labelledby="wd-title"
            className="sheet-in absolute inset-x-2 bottom-2 flex flex-col gap-5 rounded-[32px] bg-sheet p-5 text-paper">
            <span className="grid size-14 place-items-center rounded-full bg-field text-brand"><IconUndo className="size-6" /></span>
            <div className="flex flex-col gap-1.5">
              <h2 id="wd-title" className="text-[24px] font-bold">Te retragi din contract?</h2>
              <p className="text-[15px] text-muted">Contractul se închide. Returnezi suma primită{o ? ` (${lei(o.total_credit_lei)})` : ''} și dobânda pentru zilele folosite, în cel mult 30 de zile.</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Btn variant="secondary" onClick={() => setConfirm(false)} autoFocus>Renunț</Btn>
              <Btn onClick={withdraw} loading={busy}>Mă retrag</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label="Închide" className="grid size-10 place-items-center rounded-full border border-line hover:bg-field"><IconX /></button>;
}
function Row({ k, v, strong, small, last }: { k: string; v: string; strong?: boolean; small?: boolean; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-3 ${last ? '' : 'border-b border-line'} ${small ? 'text-[13px]' : ''}`}>
      <dt className="text-muted">{k}</dt><dd className={`text-right ${strong ? 'font-bold' : 'font-semibold'}`}>{v}</dd>
    </div>
  );
}
