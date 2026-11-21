import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, api2, ApiError, type Secci } from '../lib/api';
import { date, lei, monthYear, pct } from '../lib/format';
import { Btn, ErrorNote, Sheet, SheetHeader } from '../components/ui';
import { IconArrow, IconDoc, IconMail, IconUndo, IconX } from '../components/Icons';
import Backdrop from '../components/Backdrop';

// Ecranul 5: informațiile precontractuale (SECCI) pe un ecran. Fără cronometre, fără presiune.
export default function OfferSheet() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [secci, setSecci] = useState<Secci | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [mail, setMail] = useState<'idle' | 'busy' | 'sent'>('idle');
  const opened = useRef(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await api.application(id);
        if (a.agreement_id) { nav(`/c/${a.agreement_id}`, { replace: true }); return; }
        if (a.next_step !== 'secci' && a.next_step !== 'sign') { nav(`/a/${id}/rezultat`, { replace: true }); return; }
        const s = await api2.secci(id);
        if (!alive) return;
        setSecci(s); shownAt.current = Date.now();
      } catch (e) { if (alive) setError(e instanceof ApiError ? e.message : 'Oferta nu s-a putut încărca.'); }
    })();
    return () => {
      alive = false;
      // dovada pentru jurnal: cât a stat pe ecran și dacă a deschis formularul complet
      if (shownAt.current) {
        const ms = Date.now() - shownAt.current; shownAt.current = null;
        api2.secciViewed(id, { time_on_screen_ms: ms, details_opened: opened.current }).catch(() => {});
      }
    };
  }, [id, nav]);

  async function sendMail() {
    setMail('busy');
    try { await api2.secciEmail(id); setMail('sent'); } catch (e) { setMail('idle'); setError(e instanceof ApiError ? e.message : 'Emailul nu a putut fi trimis.'); }
  }

  if (!secci) {
    return (<><Backdrop /><Sheet label="Oferta ta"><SheetHeader step={3} onClose={() => nav('/shop')} />
      {error ? <ErrorNote>{error}</ErrorNote> : <p className="py-10 text-center text-[15px] text-muted">Se încarcă oferta…</p>}</Sheet></>);
  }
  const k = secci.key;
  const first = secci.schedule[0]?.due_date, last = secci.schedule[secci.schedule.length - 1]?.due_date;

  return (
    <>
      <Backdrop />
      <Sheet label="Oferta ta" tall>
        <SheetHeader step={3} onClose={() => nav('/shop')} />
        <h2 className="text-[26px] font-bold tracking-tight">Oferta ta</h2>

        <section className="flex flex-col gap-3 rounded-3xl border border-brand/70 p-4" aria-label="Total de plată">
          <span className="text-[14px] text-muted">Total de plată</span>
          <span className="text-[38px] font-bold leading-none tracking-tight text-brand">{lei(k.total_payable_lei)}</span>
          <div className="mt-2 flex items-baseline justify-between gap-3 text-[15px]">
            <span className="font-semibold">{k.installments} × {lei(k.installment_lei)}</span>
            {k.last_installment_lei != null && k.last_installment_lei !== k.installment_lei && <span className="text-[13px] text-muted">Ultima rată: {lei(k.last_installment_lei)}</span>}
          </div>
          {first && last && (<>
            <div className="h-1.5 rounded-full bg-graphite" aria-hidden><div className="h-full w-[6%] rounded-full bg-brand" /></div>
            <div className="flex justify-between text-[13px] text-muted"><span>{monthYear(first)}</span><span>{monthYear(last)}</span></div>
          </>)}
        </section>

        <dl className="px-1 text-[15px]">
          <Row k="Suma finanțată" v={lei(k.total_credit_lei)} />
          <Row k="Costul total al creditului" v={lei(k.total_cost_lei)} />
          <Row k="DAE" v={pct(k.apr_pct)} />
          <Row k={`Dobândă anuală ${k.rate_type}`} v={pct(k.nominal_rate_pct)} last />
        </dl>

        <p className="flex items-center gap-3 rounded-2xl border border-brand/70 px-4 py-3.5 text-[15px]">
          <IconUndo className="size-5 shrink-0 text-brand" />Te poți retrage în {k.withdrawal_days} zile, fără motiv.
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => { opened.current = true; setFull(true); }}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line text-[15px] font-semibold hover:bg-field">
            <IconDoc className="size-5 text-brand" />Formular complet
          </button>
          <button type="button" onClick={sendMail} disabled={mail !== 'idle'} aria-live="polite"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line text-[15px] font-semibold hover:bg-field disabled:opacity-80">
            <IconMail className="size-5 text-brand" />{mail === 'sent' ? 'Trimis pe email' : mail === 'busy' ? 'Se trimite…' : 'Trimite pe email'}
          </button>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
        <p className="mt-auto text-center text-[14px] text-muted">Nu există limită de timp pentru decizie.</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Btn variant="secondary" onClick={() => nav('/shop')}>Nu acum</Btn>
          <Btn onClick={() => nav(`/a/${id}/confirma`)}><span className="inline-flex items-center gap-1.5">Continuă <IconArrow /></span></Btn>
        </div>
      </Sheet>

      {full && <FullSecci s={secci} onClose={() => setFull(false)} first={first} />}
    </>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-3 ${last ? '' : 'border-b border-line'}`}>
      <dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd>
    </div>
  );
}

function FullSecci({ s, onClose, first }: { s: Secci; onClose: () => void; first?: string }) {
  const k = s.key;
  return (
    <div className="absolute inset-0 z-20">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Formularul complet de informare (SECCI)"
        className="sheet-in absolute inset-x-2 bottom-2 top-10 flex flex-col overflow-hidden rounded-[32px] bg-sheet text-paper">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[18px] font-bold">Formular complet (SECCI)</h2>
          <button type="button" onClick={onClose} aria-label="Închide" className="grid size-10 place-items-center rounded-full border border-line hover:bg-field"><IconX /></button>
        </div>
        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4 text-[15px]">
          <Block title="Creditor">{s.creditor.name}<br /><span className="text-muted">{s.creditor.address}</span></Block>
          <Block title="Intermediar">{s.intermediary.name}</Block>
          <Block title="Creditul">
            <dl>
              <Row k="Suma finanțată" v={lei(k.total_credit_lei)} />
              <Row k="Număr de rate" v={String(k.installments)} />
              <Row k="Rată lunară" v={lei(k.installment_lei)} />
              {k.last_installment_lei != null && <Row k="Ultima rată" v={lei(k.last_installment_lei)} />}
              <Row k="Costul total al creditului" v={lei(k.total_cost_lei)} />
              <Row k="Total de plată" v={lei(k.total_payable_lei)} />
              <Row k="DAE" v={pct(k.apr_pct)} />
              <Row k={`Dobândă anuală (${k.rate_type})`} v={pct(k.nominal_rate_pct)} />
              {first && <Row k="Prima rată" v={date(first)} last />}
            </dl>
          </Block>
          <Block title="Dreptul de retragere">Te poți retrage în {k.withdrawal_days} zile de la semnare, fără să dai un motiv.</Block>
          <Block title="Întârzieri la plată">{s.late_payment}</Block>
          <Block title="Rambursare anticipată">{s.early_repayment}</Block>
          <Block title="Graficul de rate">
            <table className="w-full text-[14px]">
              <thead><tr className="text-left text-muted"><th className="py-1.5 font-medium">Nr.</th><th className="py-1.5 font-medium">Scadență</th><th className="py-1.5 text-right font-medium">Suma</th></tr></thead>
              <tbody>{s.schedule.map((r) => (
                <tr key={r.n} className="border-t border-line"><td className="py-1.5">{r.n}</td><td className="py-1.5">{date(r.due_date)}</td><td className="py-1.5 text-right">{lei(r.amount_lei)}</td></tr>
              ))}</tbody>
            </table>
          </Block>
          <p className="text-[13px] text-muted">Versiunea formularului: {s.secci_version}</p>
        </div>
      </div>
    </div>
  );
}
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h3><div>{children}</div></section>;
}
