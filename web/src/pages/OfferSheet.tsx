// Pasul 4 · Oferta: informațiile precontractuale (SECCI) pe un ecran. Fără cronometre, fără presiune.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLoaderData, useLocation, useNavigate, useNavigation, useOutletContext } from 'react-router-dom';
import { api2, ApiError, type Secci } from '../lib/api';
import { date, lei, monthYear, pct } from '../lib/format';
import { reducedMotion, useCountUp, useFocusOnMount, useMounted } from '../lib/motion';
import { useToast } from '../lib/toast';
import type { LoaderData, offerLoader } from '../loaders';
import type { SheetCtx } from '../components/SheetShell';
import { IconFile, IconMail, IconTick, IconUndo } from '../components/Icons';
import {
  Btn, Card, ErrorNote, Notice, RoundBtn, Row, Rows, SheetBody, SheetFoot, SheetHeader, SheetTitle, SheetTop, Spinner, TwoButtons, cx,
} from '../components/ui';

export default function OfferSheet() {
  const { app, secci } = useLoaderData() as LoaderData<typeof offerLoader>;
  const id = app.application_id;
  const { close } = useOutletContext<SheetCtx>();
  const nav = useNavigate();
  const navigation = useNavigation();
  const { pathname } = useLocation();
  const toast = useToast();
  const [full, setFull] = useState(false);
  const [mail, setMail] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const opened = useRef(false);
  const fullBtn = useRef<HTMLButtonElement>(null);
  const mounted = useMounted(120);

  // dovada pentru jurnal: cât a stat pe ecran și dacă a deschis formularul complet
  useEffect(() => {
    const shownAt = Date.now();
    return () => { api2.secciViewed(id, { time_on_screen_ms: Date.now() - shownAt, details_opened: opened.current }).catch(() => {}); };
  }, [id]);

  async function sendMail() {
    setMail('busy'); setError(null);
    try { await api2.secciEmail(id); setMail('sent'); toast('Formularul a fost trimis pe email (simulat).'); }
    catch (e) { setMail('idle'); setError(e instanceof ApiError ? e.message : 'Emailul nu a putut fi trimis.'); }
  }

  const k = secci.key;
  const total = useCountUp(k.total_payable_lei, 900);
  const first = secci.schedule[0]?.due_date, last = secci.schedule[secci.schedule.length - 1]?.due_date;
  const going = navigation.location?.pathname === `/a/${id}/confirma`;

  return (
    <>
      <SheetTop><SheetHeader step={3} progress={3.25} onClose={close} /></SheetTop>
      <SheetBody>
        <SheetTitle>Oferta ta</SheetTitle>

        <Card accent className="flex flex-col px-4 pb-4 pt-3.5">
          <span className="text-[14px] font-medium">Total de plată</span>
          <span className="tabular mt-0.5 text-[36px] font-bold leading-[1.1] tracking-[-0.02em] text-brand">
            <span aria-hidden>{lei(total)}</span><span className="sr-only">{lei(k.total_payable_lei)}</span>
          </span>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 text-[15px]">
            <span className="tabular font-semibold">{k.installments} × {lei(k.installment_lei)}</span>
            {k.last_installment_lei != null && k.last_installment_lei !== k.installment_lei && (
              <span className="tabular text-[14px] text-muted">Ultima rată: {lei(k.last_installment_lei)}</span>
            )}
          </div>
          {first && last && (<>
            <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-graphite" aria-hidden>
              <div className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-out-expo" style={{ width: mounted ? `${Math.max(4, 100 / k.installments)}%` : '0%' }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[13px] text-muted">
              <span><span className="sr-only">Prima rată: </span>{monthYear(first)}</span>
              <span><span className="sr-only">Ultima rată: </span>{monthYear(last)}</span>
            </div>
          </>)}
        </Card>

        <Rows className="-my-1 animate-fade-up [animation-delay:120ms]">
          <Row k="Suma finanțată" v={lei(k.total_credit_lei)} />
          <Row k="Costul total al creditului" v={lei(k.total_cost_lei)} />
          <Row k="DAE" v={pct(k.apr_pct)} />
          <Row k={`Dobândă anuală ${k.rate_type}`} v={pct(k.nominal_rate_pct)} />
        </Rows>

        <Notice accent icon={<IconUndo className="size-5" />} className="items-center animate-fade-up [animation-delay:180ms]">
          <p className="text-[15px]">Te poți retrage în {k.withdrawal_days} zile, fără motiv.</p>
        </Notice>

        <div className="grid grid-cols-2 gap-2 animate-fade-up [animation-delay:220ms]">
          <TileBtn ref={fullBtn} icon={<IconFile className="size-5" />} onClick={() => { opened.current = true; setFull(true); }}>Formular complet</TileBtn>
          <TileBtn icon={mail === 'sent' ? <IconTick className="size-5" animate /> : mail === 'busy' ? <Spinner className="size-5" /> : <IconMail className="size-5" />}
            onClick={sendMail} disabled={mail !== 'idle'} busy={mail === 'busy'}>
            {mail === 'sent' ? 'Trimis pe email' : 'Trimite pe email'}
          </TileBtn>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </SheetBody>
      <SheetFoot className="flex flex-col gap-3">
        <p className="text-center text-[14px] text-muted">Nu există limită de timp pentru decizie.</p>
        <TwoButtons>
          <Btn variant="secondary" onClick={close}>Nu acum</Btn>
          <Btn onClick={() => nav(`/a/${id}/confirma`, { viewTransition: true, state: { from: pathname } })} loading={going}>Continuă <span aria-hidden>→</span></Btn>
        </TwoButtons>
      </SheetFoot>

      {full && <SecciDialog s={secci} first={first} opener={fullBtn} onClose={() => setFull(false)} />}
    </>
  );
}

function TileBtn({ icon, children, onClick, disabled, busy, ref }: {
  icon: React.ReactNode; children: React.ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={ref} type="button" onClick={onClick} disabled={disabled} aria-busy={busy || undefined}
      className="flex h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-[16px] border border-stroke bg-card px-2.5 text-[14px] font-semibold transition-[background-color,border-color,transform] duration-200 hover:border-graphite hover:bg-card-hover active:scale-[0.97] disabled:hover:bg-card">
      <span className="text-brand">{icon}</span>{children}
    </button>
  );
}

/** Formularul complet (SECCI), peste tot ecranul. Escape și X îl închid; restul ecranului devine inert. */
function SecciDialog({ s, first, opener, onClose }: { s: Secci; first?: string; opener: React.RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const k = s.key;
  const title = useFocusOnMount<HTMLHeadingElement>();
  const [closing, setClosing] = useState(false);
  const done = () => { if (closing) return; setClosing(true); setTimeout(onClose, reducedMotion() ? 0 : 260); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); done(); } };
    window.addEventListener('keydown', onKey, true);
    const sheet = document.querySelector<HTMLElement>('[aria-labelledby="sheet-title"]');
    sheet?.setAttribute('inert', '');
    return () => {
      window.removeEventListener('keydown', onKey, true);
      sheet?.removeAttribute('inert');
      opener.current?.focus({ preventScroll: true }); // focusul revine pe „Formular complet”
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const host = document.querySelector('[data-screen]') ?? document.body;
  return createPortal(
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div aria-hidden onClick={done} className={cx('absolute inset-0 bg-black/55', closing ? 'animate-fade-out' : 'animate-fade-in')} />
      <div role="dialog" aria-modal="true" aria-labelledby="secci-title"
        className={cx('on-dark relative mx-2.5 mb-[max(10px,var(--safe-bottom))] mt-[calc(var(--safe-top)+8px)] flex min-h-0 flex-1 flex-col overflow-hidden rounded-[36px] bg-sheet text-paper',
          closing ? 'animate-sheet-down' : 'animate-sheet-up')}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stroke px-5 py-3.5">
          <h2 id="secci-title" ref={title} tabIndex={-1} className="text-[18px] font-bold outline-none">Formular complet (SECCI)</h2>
          <RoundBtn kind="close" onClick={done} />
        </div>
        <div tabIndex={0} role="region" aria-label="Conținutul formularului SECCI" className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-5 text-[15px] focus-visible:outline-offset-[-4px]">
          <Block title="Creditor">{s.creditor.name}<br /><span className="text-muted">{s.creditor.address}</span></Block>
          <Block title="Intermediar">{s.intermediary.name}</Block>
          <Block title="Creditul">
            <Rows>
              <Row k="Suma finanțată" v={lei(k.total_credit_lei)} />
              <Row k="Număr de rate" v={String(k.installments)} />
              <Row k="Rată lunară" v={lei(k.installment_lei)} />
              {k.last_installment_lei != null && <Row k="Ultima rată" v={lei(k.last_installment_lei)} />}
              <Row k="Costul total al creditului" v={lei(k.total_cost_lei)} />
              <Row k="Total de plată" v={lei(k.total_payable_lei)} strong />
              <Row k="DAE" v={pct(k.apr_pct)} />
              <Row k={`Dobândă anuală (${k.rate_type})`} v={pct(k.nominal_rate_pct)} />
              {first && <Row k="Prima rată" v={date(first)} />}
            </Rows>
          </Block>
          <Block title="Dreptul de retragere">Te poți retrage în {k.withdrawal_days} zile de la semnare, fără să dai un motiv.</Block>
          <Block title="Întârzieri la plată">{s.late_payment}</Block>
          <Block title="Rambursare anticipată">{s.early_repayment}</Block>
          <Block title="Graficul de rate">
            <table className="tabular w-full text-[14px]">
              <caption className="sr-only">Graficul de rate</caption>
              <thead><tr className="text-left text-muted"><th scope="col" className="py-1.5 font-medium">Nr.</th><th scope="col" className="py-1.5 font-medium">Scadență</th><th scope="col" className="py-1.5 text-right font-medium">Suma</th></tr></thead>
              <tbody>{s.schedule.map((r) => (
                <tr key={r.n} className="border-t border-stroke"><td className="py-2">{r.n}</td><td className="py-2">{date(r.due_date)}</td><td className="py-2 text-right">{lei(r.amount_lei)}</td></tr>
              ))}</tbody>
            </table>
          </Block>
          <p className="text-[13px] text-muted">Versiunea formularului: {s.secci_version}</p>
        </div>
      </div>
    </div>,
    host,
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</h3>
      <div>{children}</div>
    </section>
  );
}
