// Între ofertă și codul SMS: rezumatul, verificările și semnarea prin glisare.
import { useLoaderData, useLocation, useNavigate, useNavigation, useOutletContext } from 'react-router-dom';
import { useStepBack } from '../lib/motion';
import { dayMonth, lei } from '../lib/format';
import type { confirmLoader, LoaderData } from '../loaders';
import type { SheetCtx } from '../components/SheetShell';
import SwipeToSign from '../components/SwipeToSign';
import { CheckDot, IconTick } from '../components/Icons';
import { Btn, Collapse, RoundBtn, SheetBody, SheetFoot, SheetTitle, SheetTop } from '../components/ui';

export default function ConfirmSheet() {
  const { app, secci, device, lender } = useLoaderData() as LoaderData<typeof confirmLoader>;
  const id = app.application_id;
  const o = app.offer!;
  const { close } = useOutletContext<SheetCtx>();
  const nav = useNavigate();
  const navigation = useNavigation();
  const { pathname } = useLocation();
  const back = useStepBack(`/a/${id}/oferta`);
  const firstDue = secci.schedule[0]?.due_date;
  const months = o.term_months < 20 ? `${o.term_months} luni` : `${o.term_months} de luni`;

  const checks = [
    `Ai văzut costul total: ${lei(o.total_payable_lei)}`,
    `Ai ales perioada: ${months}`,
    'Evaluarea bugetului a ieșit pozitivă',
    'Ai primit formularul complet (SECCI)',
    `Te poți retrage în ${secci.key.withdrawal_days} zile, fără motiv`,
  ];

  return (
    <>
      <SheetTop>
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-[17px] font-extrabold text-ink">{lender[0]}</span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[15px] font-semibold">{lender}</span>
            <span className="text-[13px] text-muted">Contract de credit · prin Telvia</span>
          </span>
          <RoundBtn kind="close" onClick={close} />
        </div>
      </SheetTop>
      <SheetBody>
        <div className="flex flex-col gap-1.5">
          <SheetTitle className="text-[26px]">{device?.name ?? 'Telefonul'} în {o.installments} de rate</SheetTitle>
          <p className="tabular text-[15px] text-muted">
            <b className="font-semibold text-paper">{lei(o.total_payable_lei)}</b> · {lei(o.installment_lei)}/lună{firstDue ? ` · din ${dayMonth(firstDue)}` : ''}
          </p>
        </div>

        <ContractArt />

        <Collapse summary={<><CheckDot /><span>Totul în regulă · {checks.length} verificări</span></>}>
          <ul className="flex flex-col gap-2 pb-1 pl-[30px] pt-1 text-[14px] text-muted">
            {checks.map((c) => <li key={c} className="list-disc marker:text-graphite">{c}</li>)}
          </ul>
        </Collapse>
      </SheetBody>
      <SheetFoot className="flex flex-col gap-1.5">
        <SwipeToSign onDone={() => nav(`/a/${id}/semnare`, { viewTransition: true, state: { from: pathname } })}
          caption="Urmează codul din SMS, care confirmă semnătura." />
        <Btn variant="primary" onClick={back}
          loading={navigation.location?.pathname === `/a/${id}/oferta`}>
          Înapoi la ofertă
        </Btn>
      </SheetFoot>
    </>
  );
}

/** Ilustrația contractului: foaia plutește, inelul punctat se rotește încet, bifa așteaptă semnătura. */
function ContractArt() {
  return (
    <div aria-hidden className="relative h-[170px] shrink-0 overflow-hidden rounded-[22px] border border-stroke bg-card [@media(max-height:520px)]:hidden">
      <div className="absolute left-[27%] top-[22px] flex h-[170px] w-[136px] flex-col gap-2.5 rounded-[12px] bg-[linear-gradient(180deg,#5a5a5a,#2d2d2d_85%)] p-3.5 animate-float">
        <span className="h-[6px] w-[52px] origin-left rounded-full bg-brand animate-[grow_1s_var(--ease-out-expo)_0.2s_both]" />
        <span className="h-[5px] rounded-full bg-paper/85" />
        <span className="h-[5px] w-4/5 rounded-full bg-paper/85" />
        <span className="h-[30px] rounded-[6px] bg-paper/75" />
        <span className="h-[5px] w-11/12 rounded-full bg-paper/85" />
      </div>
      <div className="absolute left-[56%] top-[48px] grid size-[84px] place-items-center">
        <span className="absolute inset-0 rounded-full border-2 border-dashed border-paper/70 animate-spin-slow" />
        <span className="grid size-[64px] place-items-center rounded-full bg-brand text-ink shadow-[0_8px_24px_-6px_rgb(255_206_0/0.55)]">
          <IconTick className="size-8" animate />
        </span>
      </div>
    </div>
  );
}
