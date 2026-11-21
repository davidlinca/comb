// Pasul 3 · Rezultat: aprobat / în analiză / respins, cu motivele din API afișate exact cum vin.
import { useEffect, useRef, useState } from 'react';
import { useLoaderData, useLocation, useNavigate, useNavigation, useOutletContext } from 'react-router-dom';
import { api, ApiError, type Verification, type VerifiedLine } from '../lib/api';
import { lei, leiInt } from '../lib/format';
import { useToast } from '../lib/toast';
import type { decisionLoader, LoaderData } from '../loaders';
import type { SheetCtx } from '../components/SheetShell';
import { CheckDot, IconAlert, IconClock, IconParty, IconUserQuestion } from '../components/Icons';
import {
  ArrowLink, Btn, Card, Collapse, ErrorNote, SheetBody, SheetFoot, SheetHeader, SheetTop, StatusHead, TwoButtons,
} from '../components/ui';

type View = 'approved' | 'review' | 'rejected';

// Iconița fiecărui motiv după codul din API (engine-v2): roșu doar ce a dus la respingere.
const REJECT_CODES = new Set(['INCOME_MISSING', 'DTI_HIGH', 'RESIDUAL_NEGATIVE']);
const REVIEW_CODES = new Set(['RESIDUAL_LOW', 'BILLS_LATE', 'INCOME_NOT_VERIFIED', 'BANK_DATA_UNAVAILABLE']);
const ADJUST_CODES = new Set(['INCOME_VERIFIED_LOWER', 'EXPENSES_VERIFIED_HIGHER', 'BUREAU_HIGHER', 'BANK_INSTALLMENTS_HIGHER']);

function ReasonIcon({ code }: { code: string }) {
  if (REJECT_CODES.has(code)) return <IconAlert className="size-5 text-danger" />;
  if (REVIEW_CODES.has(code)) return <IconClock className="size-5 text-brand" />;
  if (ADJUST_CODES.has(code)) return <IconAlert className="size-5 text-muted" />;
  return <CheckDot className="size-[18px]" />;
}

export default function DecisionSheet() {
  const { app } = useLoaderData() as LoaderData<typeof decisionLoader>;
  const id = app.application_id;
  const { close } = useOutletContext<SheetCtx>();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = useRef<'recheck' | 'human' | 'decided' | null>(null);

  const view: View = app.next_step === 'wait_review' ? 'review' : app.next_step === 'rejected' ? 'rejected' : 'approved';
  const d = app.decision;
  const reasons = d?.reasons ?? [];
  const offer = app.offer;
  // După revizuirea umană, decizia finală e a specialistului; motivele rămân cele ale evaluării automate.
  const byHuman = app.review?.status === 'approved' || app.review?.status === 'rejected';
  const refreshing = navigation.state === 'loading' && navigation.location.pathname === pathname;

  // reîncarcă rezultatul cu tranziție (aceeași rută → loaderul rulează din nou)
  const refresh = () => nav(pathname, { replace: true, viewTransition: true });

  useEffect(() => {
    if (action.current === 'recheck' && view === 'review') toast('Încă în analiză. Te anunțăm prin SMS.');
    if (action.current === 'human' && view === 'review') toast('Cererea a ajuns la un specialist.');
    if (action.current === 'decided' && view !== 'review') toast('Un specialist a analizat cererea ta.');
    action.current = null;
  }, [app, view, toast]);

  // În analiză: verificăm singuri, la câteva secunde, dacă specialistul a decis (ca și coada din back-office),
  // ca rezultatul să apară fără să apese clientul. Doar cât ecranul e vizibil.
  useEffect(() => {
    if (view !== 'review') return;
    let checking = false;
    const t = window.setInterval(async () => {
      if (checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const a = await api.application(id);
        if (a.next_step !== 'wait_review') { action.current = 'decided'; nav(pathname, { replace: true, viewTransition: true }); }
      } catch { /* reîncercăm la pasul următor */ }
      checking = false;
    }, 8000);
    return () => window.clearInterval(t);
  }, [view, id, nav, pathname]);

  async function askHuman() {
    setBusy(true); setError(null);
    try { await api.humanReview(id); action.current = 'human'; refresh(); }
    catch (e) {
      if (e instanceof ApiError && e.code === 'REVIEW_PENDING') { action.current = 'human'; refresh(); }
      else setError(e instanceof ApiError ? e.message : 'Cererea nu a putut fi trimisă.');
    } finally { setBusy(false); }
  }

  const head = {
    approved: { icon: <IconParty className="size-[30px]" />, title: 'Cerere aprobată', sub: offer ? `${offer.installments} × ${lei(offer.installment_lei)} · total ${lei(offer.total_payable_lei)}` : undefined },
    review: { icon: <IconClock className="size-[30px]" />, title: 'Cerere în analiză', sub: 'Primești răspunsul în 24 de ore.' },
    rejected: { icon: <IconAlert className="size-[30px]" />, title: 'Nu putem aproba acum', sub: undefined },
  }[view];

  return (
    <>
      <SheetTop><SheetHeader step={2} progress={view === 'approved' ? 2.35 : 2.18} onClose={close} /></SheetTop>
      <SheetBody>
        <StatusHead icon={head.icon} title={head.title} sub={head.sub} pulse={view === 'approved'} />

        {reasons.length > 0 && (
          <Card className="px-4 py-3.5 animate-fade-up [animation-delay:120ms]">
            <section aria-labelledby="why">
              <h3 id="why" className="mb-2.5 text-[15px] font-semibold">{byHuman ? 'Ce a găsit evaluarea automată' : 'De ce?'}</h3>
              <ul className="flex flex-col gap-3 text-[15px] leading-snug">
                {reasons.map((r, i) => (
                  <li key={r.code} className="flex gap-2.5 animate-fade-up" style={{ animationDelay: `${180 + i * 70}ms` }}>
                    <span className="mt-px grid size-5 shrink-0 place-items-center"><ReasonIcon code={r.code} /></span>
                    <span>{r.text}</span>
                  </li>
                ))}
                {view === 'review' && (
                  <li className="flex gap-2.5 animate-fade-up" style={{ animationDelay: `${180 + reasons.length * 70}ms` }}>
                    <span className="mt-px grid size-5 shrink-0 place-items-center text-paper"><IconUserQuestion className="size-5" /></span>
                    <span>Nu e un refuz. Un specialist se uită mai atent.</span>
                  </li>
                )}
              </ul>
            </section>
          </Card>
        )}

        {d?.verification && <Verified v={d.verification} />}

        {view === 'rejected' && app.debt_advice && (
          <Card className="flex flex-col gap-1 px-4 py-3.5 animate-fade-up [animation-delay:240ms]">
            <p className="text-[15px] font-semibold">{app.debt_advice.text}</p>
            <p className="text-[14px] text-muted">{app.debt_advice.contact}</p>
          </Card>
        )}

        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 text-[14px] text-muted">
          {view === 'approved' && byHuman && <span>Decizie luată de un specialist, după analiza cererii tale.</span>}
          {view === 'approved' && !byHuman && d?.automated && (<>
            <span>Decizie automată.</span>
            <ArrowLink onClick={askHuman} disabled={busy || refreshing}>Cere analiză umană</ArrowLink>
          </>)}
          {view === 'rejected' && <span>{byHuman || !d?.automated ? 'Decizie luată de un specialist, după analiza cererii tale.' : 'Decizie automată.'}</span>}
          {view === 'review' && <span>Te anunțăm prin SMS și în aplicație.</span>}
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </SheetBody>
      <SheetFoot>
        <TwoButtons>
          {view === 'approved' && (<>
            <Btn variant="secondary" onClick={close}>Nu acum</Btn>
            <Btn onClick={() => nav(`/a/${id}/oferta`, { viewTransition: true })} loading={navigation.location?.pathname === `/a/${id}/oferta`}>Vezi oferta</Btn>
          </>)}
          {view === 'review' && (<>
            <Btn variant="secondary" onClick={() => { action.current = 'recheck'; refresh(); }} loading={refreshing}>Verifică din nou</Btn>
            <Btn onClick={close}>Am înțeles</Btn>
          </>)}
          {view === 'rejected' && (<>
            <Btn variant="secondary" onClick={askHuman} loading={busy || refreshing}>Cere analiză umană</Btn>
            <Btn onClick={close}>Înapoi</Btn>
          </>)}
        </TwoButtons>
      </SheetFoot>
    </>
  );
}

function Verified({ v }: { v: Verification }) {
  const line = (label: string, l: VerifiedLine, kind: 'bank' | 'bureau') => {
    const checked = kind === 'bank' ? l.verified_lei : l.bureau_lei;
    const src = kind === 'bank' ? (v.source ?? 'Open Banking (simulat)') : 'Biroul de Credit';
    return (
      <div className="flex flex-col gap-0.5 border-b border-stroke py-2.5 last:border-b-0">
        <div className="flex justify-between gap-3 text-[15px]"><span>{label}</span><span className="tabular font-semibold">{leiInt(l.used_lei)}</span></div>
        <p className="text-[13px] text-muted">
          declarat {leiInt(l.declared_lei)} · {checked == null ? <span className="text-brand">neverificat, un coleg verifică</span> : <>verificat {leiInt(checked)} ({src})</>}
          {kind === 'bureau' && l.bank_lei != null && <> · în cont {leiInt(l.bank_lei)} ({v.source ?? 'Open Banking (simulat)'})</>}
        </p>
      </div>
    );
  };
  return (
    <Card className="px-4 py-1 animate-fade-up [animation-delay:200ms]">
      <Collapse summary={<span className="font-semibold">Ce am verificat</span>}>
        <div className="pb-2">
          {line('Venit', v.income, 'bank')}
          {line('Cheltuieli', v.expenses, 'bank')}
          {line('Alte rate', v.other_installments, 'bureau')}
          <p className="pt-2 text-[12px] text-muted">Cifra din dreapta e cea folosită în decizie.</p>
        </div>
      </Collapse>
    </Card>
  );
}
