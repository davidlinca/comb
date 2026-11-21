// Rata ratată (CCD2 art. 35): card blând cu 3 variante la fel de vizibile, cifrele înainte de alegere,
// apoi ecranul cu măsura aleasă. O singură măsură pe contract, fără comisioane.
import { useState } from 'react';
import type { Forbearance, ForbearanceOption, ForbearanceOptions, ForbearancePlan, MissedInstallment, MissedNotice, PlanRow } from '../lib/api';
import { date, lei } from '../lib/format';
import { IconBell, IconMail, IconTick, IconUserQuestion } from '../components/Icons';
import {
  Btn, Card, Collapse, ErrorNote, RoundBtn, Row, Rows, SheetBody, SheetFoot, SheetTop, StatusHead, cx,
} from '../components/ui';

const LABEL: Record<ForbearanceOption, string> = {
  defer: 'Amână rata o lună',
  reschedule: 'Reeșalonează',
  talk: 'Vorbește cu un om',
};

/** Cardul de la rata ratată: alegi o variantă, apoi confirmi (alegerea nu se poate schimba). */
export function MissedView({ missed, notice, options, busy, error, onChoose, onClose }: {
  missed: MissedInstallment; notice: MissedNotice | null | undefined; options: ForbearanceOptions;
  busy: boolean; error: string | null; onChoose: (o: ForbearanceOption) => void; onClose: () => void;
}) {
  const [pick, setPick] = useState<ForbearanceOption | null>(null);
  const plan = pick === 'defer' ? options.defer : pick === 'reschedule' ? options.reschedule : null;
  return (
    <>
      <SheetTop className="flex justify-end"><RoundBtn kind="close" onClick={onClose} /></SheetTop>
      <SheetBody className="pt-0">
        <StatusHead icon={<IconBell className="size-8" />} title={`Rata din ${date(missed.due_date)} nu a fost plătită`}
          sub="Te putem ajuta. Alege ce ți se potrivește, fără comisioane." />

        {notice && (
          <Card className="px-4 py-1 animate-fade-up [animation-delay:80ms]">
            <Collapse summary={<><IconMail className="size-[18px] text-brand" /><span>Mesajul trimis pe {notice.channel}</span></>}>
              <p className="pb-3 text-[14px] leading-snug text-muted">{notice.text}</p>
            </Collapse>
          </Card>
        )}

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-[15px] font-semibold">Ce vrei să faci cu rata {missed.n} ({lei(missed.amount_lei)})?</legend>
          <Choice value="defer" pick={pick} setPick={setPick} delay={120}
            title={LABEL.defer} amount={lei(options.defer.installment_lei)} amountSub="rata rămâne"
            lines={[`Plătești în plus doar ${lei(options.defer.extra_cost_lei)} dobândă, la ultima rată`, `Următoarea rată: ${date(options.defer.first_due_date)}`]} />
          <Choice value="reschedule" pick={pick} setPick={setPick} delay={170}
            title={LABEL.reschedule} amount={lei(options.reschedule.installment_lei)} amountSub={`× ${options.reschedule.installments} rate`}
            lines={[`Total ${lei(options.reschedule.total_payable_lei)} (+${lei(options.reschedule.extra_cost_lei)} dobândă)`, `Prima rată: ${date(options.reschedule.first_due_date)}`]} />
          <Choice value="talk" pick={pick} setPick={setPick} delay={220}
            title={LABEL.talk} lines={[options.talk.eta_text]} />
        </fieldset>

        <div className="reveal" data-open={!!plan} inert={!plan}>
          <div>{plan && <ScheduleCollapse plan={plan} />}</div>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </SheetBody>
      <SheetFoot className="flex flex-col gap-2.5">
        <p className="text-center text-[13px] text-muted">Fără comisioane. Poți alege o singură variantă.</p>
        <Btn className="w-full" disabled={!pick} loading={busy} onClick={() => pick && onChoose(pick)}>
          {pick ? `Confirmă: ${LABEL[pick].toLowerCase()}` : 'Alege o variantă'}
        </Btn>
      </SheetFoot>
    </>
  );
}

function Choice({ value, pick, setPick, title, amount, amountSub, lines, delay }: {
  value: ForbearanceOption; pick: ForbearanceOption | null; setPick: (v: ForbearanceOption) => void;
  title: string; amount?: string; amountSub?: string; lines: string[]; delay: number;
}) {
  const on = pick === value;
  return (
    <label style={{ animationDelay: `${delay}ms` }} className={cx(
      'group relative flex cursor-pointer gap-3 rounded-[18px] border px-4 py-3.5 animate-fade-up transition-[background-color,border-color,transform] duration-200 active:scale-[0.99]',
      on ? 'border-paper bg-card-hover' : 'border-stroke bg-card hover:border-graphite',
    )}>
      <input type="radio" name="forbearance" value={value} checked={on} onChange={() => setPick(value)} className="peer sr-only" />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[18px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
      <span aria-hidden className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors', on ? 'border-brand' : 'border-graphite')}>
        <span className={cx('size-2.5 rounded-full bg-brand transition-transform duration-300 ease-spring', on ? 'scale-100' : 'scale-0')} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[16px] font-semibold">{title}</span>
          {amount && (
            <span className="text-right">
              <span className="tabular block text-[17px] font-bold leading-tight">{amount}</span>
              {amountSub && <span className="block text-[12px] text-muted">{amountSub}</span>}
            </span>
          )}
        </span>
        {lines.map((l) => <span key={l} className="tabular text-[13.5px] leading-snug text-muted">{l}</span>)}
      </span>
    </label>
  );
}

/** Graficul noilor rate („Vezi detalii”). */
function ScheduleCollapse({ plan }: { plan: Pick<ForbearancePlan, 'schedule'> & { schedule: PlanRow[] | null } }) {
  if (!plan.schedule?.length) return null;
  return (
    <Card className="px-4 py-1">
      <Collapse summary={<span>Vezi detalii · graficul ratelor</span>}>
        <div className="max-h-64 overflow-y-auto pb-2" tabIndex={0} role="region" aria-label="Graficul noilor rate">
          <table className="tabular w-full text-[13.5px]">
            <caption className="sr-only">Graficul noilor rate</caption>
            <thead><tr className="text-left text-muted"><th scope="col" className="py-1.5 font-medium">Nr.</th><th scope="col" className="py-1.5 font-medium">Scadență</th><th scope="col" className="py-1.5 text-right font-medium">Suma</th></tr></thead>
            <tbody>{plan.schedule.map((r) => (
              <tr key={r.n} className="border-t border-stroke"><td className="py-1.5">{r.n}</td><td className="py-1.5">{date(r.due_date)}</td><td className="py-1.5 text-right">{lei(r.amount_lei)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Collapse>
    </Card>
  );
}

/** După alegere: măsura și textul din API, exact cum vine. */
export function ForbearanceResult({ f, text, onClose, details }: { f: Forbearance; text?: string; onClose: () => void; details?: React.ReactNode }) {
  const talk = f.option === 'talk';
  const contacted = f.review?.status === 'approved';
  const title = talk ? (contacted ? 'Un coleg te-a contactat' : 'Un coleg te va contacta')
    : f.option === 'defer' ? 'Rata a fost amânată' : 'Ratele au fost reeșalonate';
  const sub = talk ? (contacted ? 'Un coleg te-a contactat.' : 'Un coleg revine în 24 de ore.') : undefined;
  return (
    <>
      <SheetTop className="flex justify-end"><RoundBtn kind="close" onClick={onClose} /></SheetTop>
      <SheetBody className="pt-0">
        <StatusHead icon={talk ? <IconUserQuestion className="size-8" /> : <IconTick className="size-8" animate />} title={title} sub={sub} pulse />
        {!talk && (text ?? f.text) && <p className="text-center text-[15px] leading-snug animate-fade-up [animation-delay:100ms]">{text ?? f.text}</p>}
        {!talk && f.installment_lei != null && (
          <Rows className="animate-fade-up [animation-delay:150ms]">
            <Row k="Rată lunară" v={`${lei(f.installment_lei)} × ${f.installments}`}
              sub={f.last_installment_lei != null && f.last_installment_lei !== f.installment_lei ? `ultima: ${lei(f.last_installment_lei)}` : undefined} />
            {f.first_due_date && <Row k="Următoarea rată" v={date(f.first_due_date)} />}
            {f.last_due_date && <Row k="Ultima rată" v={date(f.last_due_date)} />}
            {f.total_payable_lei != null && <Row k="Total de plată" v={lei(f.total_payable_lei)} strong />}
            {f.extra_cost_lei != null && <Row k="Dobândă în plus" v={lei(f.extra_cost_lei)} sub="comisioane: 0 lei" />}
          </Rows>
        )}
        {!talk && f.schedule && <ScheduleCollapse plan={{ schedule: f.schedule }} />}
        {talk && (
          <Card className="flex flex-col gap-1 px-4 py-3.5 text-[14px] leading-snug text-muted animate-fade-up [animation-delay:120ms]">
            <p><span className="text-paper">Rata {f.installment_n}</span>, cu scadența pe {date(f.missed_due_date)}.</p>
            <p>Contractul semnat rămâne neschimbat.</p>
          </Card>
        )}
        {details}
      </SheetBody>
      <SheetFoot><Btn className="w-full" onClick={onClose}>Gata</Btn></SheetFoot>
    </>
  );
}
