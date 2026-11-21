import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, api2, ApiError, type Application } from '../lib/api';
import { date, lei } from '../lib/format';
import { Btn, ErrorNote, Sheet } from '../components/ui';
import { IconCheck, IconChevron, IconX } from '../components/Icons';
import SwipeToSign from '../components/SwipeToSign';
import Backdrop from '../components/Backdrop';

// Între ofertă și codul SMS: rezumatul și verificările, apoi semnarea prin glisare.
export default function ConfirmSheet() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [name, setName] = useState<string>('');
  const [lender, setLender] = useState<string>('');
  const [firstDue, setFirstDue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const a = await api.application(id);
        if (a.agreement_id) { nav(`/c/${a.agreement_id}`, { replace: true }); return; }
        if (a.next_step !== 'secci' && a.next_step !== 'sign') { nav(`/a/${id}/rezultat`, { replace: true }); return; }
        setApp(a);
        const cat = await api.catalog();
        setName(cat.devices.find((d) => d.sku === a.offer?.sku)?.name ?? '');
        setLender(cat.products.find((p) => p.id === a.offer?.product_id)?.lender ?? '');
      } catch (e) { setError(e instanceof ApiError ? e.message : 'Nu am putut încărca rezumatul.'); }
    })();
    api2.secci(id).then((s) => setFirstDue(s.schedule[0]?.due_date ?? null)).catch(() => {});
  }, [id, nav]);

  const o = app?.offer;
  const checks = o ? [
    `Ai văzut costul total: ${lei(o.total_payable_lei)}`,
    `Ai ales perioada: ${o.term_months} ${o.term_months < 20 ? 'luni' : 'de luni'}`,
    'Evaluarea bugetului a ieșit pozitivă',
    'Ai primit formularul complet (SECCI)',
    'Te poți retrage în 14 zile, fără motiv',
  ] : [];

  return (
    <>
      <Backdrop />
      <Sheet label="Confirmă semnarea" tall>
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-[18px] font-extrabold text-ink">{(lender || 'C')[0]}</span>
          <span className="flex flex-1 flex-col"><span className="text-[16px] font-semibold">{lender || 'Creditor'}</span><span className="text-[13px] text-muted">Contract de credit · prin Telvia</span></span>
          <button type="button" onClick={() => nav('/shop')} aria-label="Închide" className="grid size-10 place-items-center rounded-full border border-line hover:bg-field"><IconX /></button>
        </div>

        {!o ? (error ? <ErrorNote>{error}</ErrorNote> : <p className="py-10 text-center text-[15px] text-muted">Se încarcă…</p>) : (<>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[28px] font-bold leading-tight tracking-tight">{name} în {o.installments} de rate</h2>
            <p className="text-[15px] text-muted"><b className="text-paper">{lei(o.total_payable_lei)}</b> · {lei(o.installment_lei)}/lună{firstDue ? ` · din ${date(firstDue).replace(/ \d{4}$/, '')}` : ''}</p>
          </div>

          <div aria-hidden className="relative h-48 overflow-hidden rounded-3xl bg-field">
            <div className="absolute left-[24%] top-8 flex h-44 w-36 flex-col gap-2.5 rounded-xl bg-graphite p-4">
              <span className="h-2 w-14 rounded-full bg-brand" />
              <span className="h-2 rounded-full bg-paper/80" /><span className="h-2 w-4/5 rounded-full bg-paper/80" />
              <span className="h-8 rounded-md bg-paper/80" /><span className="h-2 w-11/12 rounded-full bg-paper/80" />
            </div>
            <div className="absolute left-[56%] top-[72px] grid size-24 place-items-center rounded-full border-2 border-dashed border-paper/70">
              <span className="grid size-[72px] place-items-center rounded-full bg-brand text-ink"><IconCheck className="size-8" /></span>
            </div>
          </div>

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 text-[15px] font-medium">
              <span className="grid size-5 place-items-center rounded-full bg-brand text-ink"><IconCheck className="size-3" /></span>
              <span className="flex-1">Totul e în regulă · {checks.length} verificări</span>
              <IconChevron className="size-4 rotate-90 text-muted transition-transform group-open:-rotate-90" />
            </summary>
            <ul className="mt-3 flex flex-col gap-2 pl-7 text-[14px] text-muted">{checks.map((c) => <li key={c}>{c}</li>)}</ul>
          </details>

          <div className="mt-auto flex flex-col gap-2.5">
            <SwipeToSign onDone={() => nav(`/a/${id}/semnare`)} />
            <Btn variant="primary" onClick={() => nav(`/a/${id}/oferta`)}>Înapoi la ofertă</Btn>
            <p className="text-center text-[13px] text-muted">Urmează codul din SMS, care confirmă semnătura.</p>
          </div>
        </>)}
      </Sheet>
    </>
  );
}
