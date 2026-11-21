// După semnare: contractul, termenul de retragere, mementoul și retragerea (confirmare → închis).
import { useState } from 'react';
import { useLoaderData, useLocation, useNavigate, useNavigation, useOutletContext } from 'react-router-dom';
import { api2, ApiError, type WithdrawResult } from '../lib/api';
import { addDays, date, dateLong, daysBetween, lei, pct } from '../lib/format';
import { withTransition } from '../lib/motion';
import { useToast } from '../lib/toast';
import type { agreementLoader, LoaderData } from '../loaders';
import type { SheetCtx } from '../components/SheetShell';
import { IconBell, IconTick, IconUndo, IconUserQuestion } from '../components/Icons';
import {
  Btn, Card, Collapse, ErrorNote, Notice, RoundBtn, Row, Rows, SheetBody, SheetFoot, SheetTop, StatusHead, TwoButtons,
} from '../components/ui';

type View = 'signed' | 'confirm' | 'withdrawn';

export default function AgreementSheet() {
  const { agreement: agr, app, device } = useLoaderData() as LoaderData<typeof agreementLoader>;
  const aid = agr.agreement_id;
  const { close } = useOutletContext<SheetCtx>();
  const nav = useNavigate();
  const { pathname, state } = useLocation();
  const navigation = useNavigation();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<'withdraw' | 'jump' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WithdrawResult | null>(null);
  const justSigned = !!(state as { justSigned?: boolean } | null)?.justSigned;

  const withdrawn = agr.status === 'withdrawn' || !!result;
  const view: View = withdrawn ? 'withdrawn' : confirming ? 'confirm' : 'signed';
  const o = app.offer;
  const refresh = () => nav(pathname, { replace: true, viewTransition: true });
  const loading = navigation.state === 'loading' && navigation.location.pathname === pathname;

  async function jumpDay3() {
    setBusy('jump'); setError(null);
    try { await api2.timeTravel(aid, 3); refresh(); toast('Demo: ziua 3 după semnare.'); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Nu am putut sări în timp.'); }
    setBusy(null);
  }
  async function withdraw() {
    setBusy('withdraw'); setError(null);
    try {
      const r = await api2.withdraw(aid);
      withTransition(() => { setResult(r); setConfirming(false); });
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Retragerea nu a reușit.');
    }
    setBusy(null);
  }

  /* ---------- retras ---------- */
  if (view === 'withdrawn') {
    const w = result ?? agr.withdrawal;
    return (
      <>
        <SheetTop className="flex justify-end"><RoundBtn kind="close" onClick={close} /></SheetTop>
        <SheetBody className="pt-0">
          <StatusHead icon={<IconTick className="size-8" animate />} title="Te-ai retras din contract" sub="Detaliile plății sunt pe email (simulat)." />
          {w && (
            <Rows className="animate-fade-up [animation-delay:120ms]">
              <Row k="De returnat" v={lei(w.amount_to_return_lei)} strong
                sub={result ? `${lei(result.principal_lei)} + ${lei(result.interest_lei)} dobândă · ${result.days_used} ${result.days_used === 1 ? 'zi' : 'zile'}` : undefined} />
              <Row k="Până la" v={dateLong(w.return_by)} />
              <Row k="Status contract" v="Închis" />
            </Rows>
          )}
          {result?.text && <p className="text-[14px] leading-snug text-muted animate-fade-up [animation-delay:180ms]">{result.text}</p>}
        </SheetBody>
        <SheetFoot><Btn className="w-full" onClick={close}>Înapoi la magazin</Btn></SheetFoot>
      </>
    );
  }

  /* ---------- confirmarea retragerii ---------- */
  if (view === 'confirm') {
    return (
      <>
        <SheetTop className="flex justify-end"><RoundBtn kind="close" onClick={() => withTransition(() => setConfirming(false))} label="Renunț la retragere" /></SheetTop>
        <SheetBody className="pt-0">
          <StatusHead icon={<IconUserQuestion className="size-8" />} title="Te retragi din contract?"
            sub={`Contractul pentru ${device?.name ?? 'telefon'} se închide.`} />
          <Rows className="animate-fade-up [animation-delay:120ms]">
            {o && <Row k="De returnat" v={lei(o.total_credit_lei)} sub="+ dobânda pe zilele folosite" />}
            <Row k="Până la" v={dateLong(addDays(agr.today, 30))} />
          </Rows>
          <p className="text-center text-[14px] leading-snug text-muted animate-fade-up [animation-delay:180ms]">
            Telefonul rămâne al tău: plătești suma integral, fără alte costuri. Îți trimitem detaliile plății pe email (simulat).
          </p>
          {error && <ErrorNote>{error}</ErrorNote>}
        </SheetBody>
        <SheetFoot>
          <TwoButtons>
            <Btn variant="secondary" onClick={() => withTransition(() => setConfirming(false))}>Renunț</Btn>
            <Btn onClick={withdraw} loading={busy === 'withdraw' || loading}>Mă retrag</Btn>
          </TwoButtons>
        </SheetFoot>
      </>
    );
  }

  /* ---------- semnat ---------- */
  const daysLeft = Math.max(0, daysBetween(agr.today, agr.withdrawal_deadline));
  const reminder = agr.reminders[agr.reminders.length - 1];
  return (
    <>
      <SheetTop className="flex justify-end"><RoundBtn kind="close" onClick={close} /></SheetTop>
      <SheetBody className="pt-0">
        <StatusHead icon={<IconTick className="size-8" animate />} title="Contract semnat" pulse={justSigned}
          sub="Contractul și formularul SECCI sunt pe email (simulat)." />

        {reminder && (
          <Notice accent icon={<IconBell className="size-5" />} className="animate-fade-up">
            <p role="status" className="text-[15px]">
              <b className="font-semibold">Mai ai {daysLeft} {daysLeft === 1 ? 'zi' : 'zile'} să te retragi</b>
              <span className="mt-1 block text-[14px] text-muted">{reminder.text}</span>
            </p>
          </Notice>
        )}

        <Rows className="animate-fade-up [animation-delay:100ms]">
          {o && <Row k="Suma finanțată" v={lei(o.total_credit_lei)} />}
          {o && <Row k="Costul total al creditului" v={lei(o.total_cost_lei)} />}
          {o && <Row k="DAE" v={pct(o.apr_pct)} />}
          {o && <Row k="Dobânda anuală fixă" v={pct(o.nominal_rate_pct)} />}
        </Rows>

        {!reminder && agr.can_withdraw && (
          <Notice accent icon={<IconUndo className="size-5" />} className="items-center animate-fade-up [animation-delay:160ms]">
            <p className="text-[15px]">Te poți retrage până la <b className="font-semibold">{date(agr.withdrawal_deadline)}</b>
              <span className="text-muted"> · {daysLeft} {daysLeft === 1 ? 'zi' : 'zile'}</span></p>
          </Notice>
        )}

        <Card className="px-4 py-1 animate-fade-up [animation-delay:200ms]">
          <Collapse summary={<span>Detalii contract</span>}>
            <div className="pb-2">
              <Rows>
                {o && <Row k="Total de plată" v={lei(o.total_payable_lei)} strong />}
                {o && <Row k="Rată lunară" v={`${lei(o.installment_lei)} × ${o.installments}`} />}
                <Row k="Prima rată" v={date(agr.first_installment_due)} />
                <Row k="Semnat pe" v={date(agr.signed_at)} />
              </Rows>
              <p className="pt-2 text-[13px] leading-snug text-muted">
                Dacă te retragi, returnezi suma primită și dobânda pentru zilele folosite, în cel mult 30 de zile.
                {agr.reminder_window && ` Îți trimitem un memento între ${date(agr.reminder_window.from)} și ${date(agr.reminder_window.to)}.`}
              </p>
            </div>
          </Collapse>
        </Card>
        {error && <ErrorNote>{error}</ErrorNote>}
      </SheetBody>
      <SheetFoot className="flex flex-col gap-2">
        {agr.can_withdraw ? (
          <TwoButtons>
            <Btn variant="secondary" onClick={() => { setError(null); withTransition(() => setConfirming(true)); }}>Retragere</Btn>
            <Btn onClick={close}>Gata</Btn>
          </TwoButtons>
        ) : <Btn className="w-full" onClick={close}>Gata</Btn>}
        {agr.can_withdraw && (
          <div className="flex min-h-9 items-center justify-center gap-3 text-[12.5px] text-muted">
            {agr.demo_offset_days > 0 && <span>Demo: ziua {agr.demo_offset_days} după semnare</span>}
            {agr.demo_offset_days < 3 && (
              <button type="button" onClick={jumpDay3} disabled={!!busy || loading}
                className="min-h-9 rounded-md px-1 underline decoration-muted/50 underline-offset-4 hover:text-paper disabled:opacity-60">
                {busy === 'jump' || (loading && !busy) ? 'Se sare…' : 'Sari la ziua 3 (demo)'}
              </button>
            )}
          </div>
        )}
      </SheetFoot>
    </>
  );
}
