import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, type Application, type Verification, type VerifiedLine } from '../lib/api';
import { lei, leiInt } from '../lib/format';
import { Btn, ErrorNote, Sheet, SheetHeader } from '../components/ui';
import { IconAlert, IconArrow, IconCheck, IconChevron, IconClock, IconInfo, IconParty } from '../components/Icons';
import Backdrop from '../components/Backdrop';

type View = 'approved' | 'review' | 'rejected';

// Iconita fiecarui motiv dupa codul din API (engine-v2): rosu doar ce a dus la respingere.
const REJECT_CODES = new Set(['INCOME_MISSING', 'DTI_HIGH', 'RESIDUAL_NEGATIVE']);
const REVIEW_CODES = new Set(['RESIDUAL_LOW', 'BILLS_LATE', 'INCOME_NOT_VERIFIED', 'BANK_DATA_UNAVAILABLE']);
const ADJUST_CODES = new Set(['INCOME_VERIFIED_LOWER', 'EXPENSES_VERIFIED_HIGHER', 'BUREAU_HIGHER']);

function ReasonIcon({ code }: { code: string }) {
  if (REJECT_CODES.has(code)) return <IconAlert className="mt-0.5 size-5 shrink-0 text-danger" />;
  if (REVIEW_CODES.has(code)) return <IconClock className="mt-0.5 size-5 shrink-0 text-brand" />;
  if (ADJUST_CODES.has(code)) return <IconInfo className="mt-0.5 size-5 shrink-0 text-muted" />;
  return <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-ink"><IconCheck className="size-3" /></span>;
}

export default function DecisionSheet() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await api.application(id);
      if (a.next_step === 'consents' || a.next_step === 'assessment') { nav(`/a/${id}/buget`, { replace: true }); return; }
      setApp(a); setError(null);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Nu am putut încărca rezultatul.'); }
  }, [id, nav]);
  useEffect(() => { void load(); }, [load]);

  async function askHuman() {
    setBusy(true); setError(null);
    try { await api.humanReview(id); await load(); }
    catch (e) {
      if (e instanceof ApiError && e.code === 'REVIEW_PENDING') await load();
      else setError(e instanceof ApiError ? e.message : 'Cererea nu a putut fi trimisă.');
    } finally { setBusy(false); }
  }

  if (!app) {
    return (<><Backdrop /><Sheet label="Rezultat"><SheetHeader step={2} onClose={() => nav('/shop')} />
      {error ? <ErrorNote>{error}</ErrorNote> : <p className="py-10 text-center text-[15px] text-muted">Se încarcă rezultatul…</p>}</Sheet></>);
  }

  const view: View = app.next_step === 'wait_review' ? 'review' : app.next_step === 'rejected' ? 'rejected' : 'approved';
  const d = app.decision;
  const reasons = d?.reasons ?? [];
  const offer = app.offer;

  const head = {
    approved: { icon: <IconParty />, badge: 'bg-brand text-ink', title: 'Cerere aprobată', sub: offer ? `${offer.installments} × ${lei(offer.installment_lei)} · total ${lei(offer.total_payable_lei)}` : '' },
    review: { icon: <IconClock />, badge: 'bg-field text-brand', title: 'Cerere în analiză', sub: 'Primești răspunsul în 24 de ore.' },
    rejected: { icon: <IconAlert />, badge: 'bg-field text-danger', title: 'Nu putem aproba acum', sub: '' },
  }[view];
  // Dupa revizuirea umana, decizia finala e a specialistului; motivele raman cele ale evaluarii automate.
  const byHuman = app.review?.status === 'approved' || app.review?.status === 'rejected';

  return (
    <>
      <Backdrop />
      <Sheet label={head.title} tall={reasons.length > 3 || !!d?.verification}>
        <SheetHeader step={2} onClose={() => nav('/shop')} />
        <div className="flex flex-col items-center gap-2 text-center">
          <span className={`grid size-16 place-items-center rounded-full ${head.badge}`}>{head.icon}</span>
          <h2 className="text-[24px] font-bold">{head.title}</h2>
          {head.sub && <p className="text-[15px] text-muted">{head.sub}</p>}
        </div>

        {reasons.length > 0 && (
          <section className="rounded-2xl border border-line p-4" aria-labelledby="why">
            <h3 id="why" className="mb-3 text-[15px] font-semibold">{byHuman ? 'Ce a găsit evaluarea automată' : 'De ce?'}</h3>
            <ul className="flex flex-col gap-3 text-[15px] leading-snug">
              {reasons.map((r) => <li key={r.code} className="flex gap-2.5"><ReasonIcon code={r.code} /><span>{r.text}</span></li>)}
            </ul>
          </section>
        )}

        {d?.verification && <Verified v={d.verification} />}

        {view === 'rejected' && app.debt_advice && (
          <a href="#consiliere" onClick={(e) => e.preventDefault()} className="flex items-center gap-3 rounded-2xl bg-field p-4 hover:bg-graphite">
            <span className="flex flex-1 flex-col"><span className="text-[16px] font-semibold">{app.debt_advice.text}</span><span className="text-[14px] text-muted">{app.debt_advice.contact}</span></span>
            <IconChevron className="size-5 text-muted" />
          </a>
        )}

        {view === 'approved' && byHuman && <p className="text-[14px] text-muted">Decizie luată de un specialist, după analiza cererii tale.</p>}
        {view === 'approved' && !byHuman && d?.automated && (
          <p className="flex items-center justify-between gap-3 text-[14px] text-muted">
            <span>Decizie automată.</span>
            <button type="button" onClick={askHuman} disabled={busy} className="flex items-center gap-1.5 font-semibold text-paper hover:underline">
              <IconArrow className="size-4 text-brand" />Cere analiză umană
            </button>
          </p>
        )}
        {view === 'rejected' && <p className="text-[14px] text-muted">{byHuman || !d?.automated ? 'Decizie luată de un specialist, după analiza cererii tale.' : 'Decizie automată.'}</p>}
        {view === 'review' && <p className="text-[14px] text-muted">Te anunțăm prin SMS și în aplicație.</p>}

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="mt-auto grid grid-cols-2 gap-2.5">
          {view === 'approved' && (<><Btn variant="secondary" onClick={() => nav('/shop')}>Nu acum</Btn><Btn onClick={() => nav(`/a/${id}/oferta`)}>Vezi oferta</Btn></>)}
          {view === 'review' && (<><Btn variant="secondary" onClick={() => void load()}>Verifică din nou</Btn><Btn onClick={() => nav('/shop')}>Am înțeles</Btn></>)}
          {view === 'rejected' && (<><Btn variant="secondary" onClick={askHuman} loading={busy}>Cere analiză umană</Btn><Btn onClick={() => nav('/shop')}>Înapoi</Btn></>)}
        </div>
      </Sheet>
    </>
  );
}

function Verified({ v }: { v: Verification }) {
  const line = (label: string, l: VerifiedLine, kind: 'bank' | 'bureau') => {
    const checked = kind === 'bank' ? l.verified_lei : l.bureau_lei;
    const src = kind === 'bank' ? (v.source ?? 'Open Banking (simulat)') : 'Biroul de Credit';
    return (
      <div className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-0">
        <div className="flex justify-between gap-3 text-[15px]"><span>{label}</span><span className="font-semibold">{leiInt(l.used_lei)}</span></div>
        <p className="text-[13px] text-muted">
          declarat {leiInt(l.declared_lei)} · {checked == null ? <span className="text-brand">neverificat, un coleg verifică</span> : <>verificat {leiInt(checked)} ({src})</>}
        </p>
      </div>
    );
  };
  return (
    <details className="group rounded-2xl bg-field px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
        Ce am verificat
        <IconChevron className="size-4 rotate-90 text-muted transition-transform group-open:-rotate-90" />
      </summary>
      <div className="mt-1">
        {line('Venit', v.income, 'bank')}
        {line('Cheltuieli', v.expenses, 'bank')}
        {line('Alte rate', v.other_installments, 'bureau')}
        <p className="pt-2 text-[12px] text-muted">Cifra din dreapta e cea folosită în decizie.</p>
      </div>
    </details>
  );
}
