// Pasul 2 · Buget. Trimitem DOAR cele trei sume + acordurile; apoi „Verificăm cererea” cu bife pe rând.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLoaderData, useNavigate, useOutletContext } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { groupDigits, parseLei } from '../lib/format';
import { useStepBack, withTransition } from '../lib/motion';
import type { budgetLoader, LoaderData } from '../loaders';
import type { SheetCtx } from '../components/SheetShell';
import { CheckDot, IconLoading, IconTick } from '../components/Icons';
import {
  Btn, Card, Checkbox, ErrorNote, MoneyField, Notice, SheetBody, SheetFoot, SheetHeader, SheetTitle, SheetTop, Spinner, TwoButtons, cx,
} from '../components/ui';

type FieldKey = 'net_income_lei' | 'monthly_expenses_lei' | 'other_installments_lei';
type Errors = Partial<Record<FieldKey | 'privacy', string>>;
const ORDER: FieldKey[] = ['net_income_lei', 'monthly_expenses_lei', 'other_installments_lei'];

export default function BudgetSheet() {
  const { app } = useLoaderData() as LoaderData<typeof budgetLoader>;
  const id = app.application_id;
  const { close } = useOutletContext<SheetCtx>();
  const nav = useNavigate();
  const back = useStepBack(app.offer ? `/shop/${app.offer.sku}` : '/shop');
  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [other, setOther] = useState('');
  const [billing, setBilling] = useState(false);
  const [bank, setBank] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [bankWhy, setBankWhy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [shake, setShake] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'form' | 'checking'>('form');
  const [apiDone, setApiDone] = useState(false);
  const refs = useRef<Partial<Record<FieldKey | 'privacy', HTMLInputElement | null>>>({});

  function validate() {
    const e: Errors = {};
    const i = parseLei(income), x = parseLei(expenses), o = parseLei(other);
    if (i === null || Number.isNaN(i) || i <= 0) e.net_income_lei = 'Introdu venitul net lunar.';
    if (x === null || Number.isNaN(x)) e.monthly_expenses_lei = 'Introdu cheltuielile lunare.';
    if (o !== null && Number.isNaN(o)) e.other_installments_lei = 'Introdu o sumă validă sau lasă gol.';
    if (!privacy) e.privacy = 'Bifează că ai citit nota de informare ca să continui.';
    return { e, i: i ?? 0, x: x ?? 0, o: o ?? 0 };
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const { e, i, x, o } = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setShake((s) => s + 1);
      const first = [...ORDER, 'privacy' as const].find((k) => e[k]);
      if (first) requestAnimationFrame(() => refs.current[first]?.focus());
      return;
    }
    setApiDone(false);
    withTransition(() => setPhase('checking'));
    try {
      await api.consents(id, { billing_history: billing, bank_data: bank, privacy_notice_read: privacy });
      try {
        await api.assessment(id, { net_income_lei: i, monthly_expenses_lei: x, other_installments_lei: o });
      } catch (err) {
        if (!(err instanceof ApiError && err.code === 'ALREADY_ASSESSED')) throw err; // dublu-click = succes
      }
      setApiDone(true);
    } catch (err) {
      const fe: Errors = {};
      if (err instanceof ApiError) err.fields.forEach((f) => { if ((ORDER as string[]).includes(f)) fe[f as FieldKey] = err.message; });
      withTransition(() => {
        setPhase('form');
        if (Object.keys(fe).length) setErrors(fe);
        else setFormError(err instanceof ApiError ? err.message : 'A apărut o eroare. Încearcă din nou.');
      });
    }
  }

  if (phase === 'checking') {
    return <Checking billing={billing} bank={bank} ready={apiDone}
      onFinished={() => nav(`/a/${id}/rezultat`, { replace: true, viewTransition: true })} />;
  }

  const filled = [income, expenses, other].filter(Boolean).length + (privacy ? 1 : 0);
  const money = (k: FieldKey, setter: (v: string) => void) => (v: string) => {
    setter(groupDigits(v));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  return (
    <>
      <SheetTop><SheetHeader step={1} progress={1.15 + filled * 0.1} onClose={close} /></SheetTop>
      <form id="budget" onSubmit={submit} noValidate className="contents">
        <SheetBody>
          <SheetTitle>Verificăm bugetul</SheetTitle>
          <div className="flex flex-col gap-4">
            <MoneyField id="inc" label="Venit net lunar" hint="După taxe." value={income} onChange={money('net_income_lei', setIncome)}
              placeholder="ex. 5.200" error={errors.net_income_lei} shakeKey={shake} inputRef={(el) => { refs.current.net_income_lei = el; }} />
            <MoneyField id="exp" label="Cheltuieli lunare" hint="Chirie, utilități, mâncare, transport." value={expenses} onChange={money('monthly_expenses_lei', setExpenses)}
              placeholder="ex. 2.100" error={errors.monthly_expenses_lei} shakeKey={shake} inputRef={(el) => { refs.current.monthly_expenses_lei = el; }} />
            <MoneyField id="oth" label="Rate pe care le plătești deja" value={other} onChange={money('other_installments_lei', setOther)}
              placeholder="0 dacă nu ai" error={errors.other_installments_lei} shakeKey={shake} inputRef={(el) => { refs.current.other_installments_lei = el; }} />
          </div>

          <fieldset className="flex flex-col gap-2 border-t border-stroke pt-5">
            <legend className="sr-only">Acorduri</legend>
            <Checkbox checked={billing} onChange={setBilling}>
              Folosiți istoricul facturilor mele Telvia în evaluare. <span className="text-muted">Opțional</span>
            </Checkbox>

            <Checkbox checked={bank} onChange={setBank}>
              Citiți veniturile și cheltuielile din contul meu bancar (Open Banking, simulat), doar pentru această evaluare.{' '}
              <span className="text-muted">Opțional</span>{' '}
              <InlineToggle open={bankWhy} onClick={() => setBankWhy((v) => !v)} controls="bank-why">De ce?</InlineToggle>
            </Checkbox>
            <div id="bank-why" className="reveal" data-open={bankWhy} inert={!bankWhy}>
              <div><p className="mb-1 ml-9 rounded-xl bg-card px-3 py-2.5 text-[14px] leading-snug text-muted">Legea ne cere să verificăm venitul. Dacă nu ești de acord, un coleg îți verifică venitul cu un alt document.</p></div>
            </div>

            <Checkbox checked={privacy} invalid={!!errors.privacy} describedBy={errors.privacy ? 'privacy-err' : undefined}
              inputRef={(el) => { refs.current.privacy = el; }}
              onChange={(v) => { setPrivacy(v); if (v) setErrors((e) => ({ ...e, privacy: undefined })); }}>
              Am citit <InlineToggle open={noteOpen} onClick={() => setNoteOpen((v) => !v)} controls="privacy-note" bold>nota de informare</InlineToggle> despre datele personale.
            </Checkbox>
            <div id="privacy-note" className="reveal" data-open={noteOpen} inert={!noteOpen}>
              <div>
                <div className="mb-1 ml-9 flex flex-col gap-1.5 rounded-xl bg-card px-3 py-2.5 text-[14px] leading-snug text-muted">
                  <p><span className="text-paper">Operator:</span> Credis IFN (demo), prin Telvia.</p>
                  <p><span className="text-paper">Scop:</span> evaluarea bonității pentru această cerere de credit.</p>
                  <p><span className="text-paper">Păstrare:</span> cât prevede legea; ai dreptul la acces, rectificare și opoziție.</p>
                </div>
              </div>
            </div>
            {errors.privacy && <p id="privacy-err" role="alert" className="ml-9 text-[13px] font-medium text-danger animate-fade-in">{errors.privacy}</p>}
          </fieldset>

          <Notice>
            <p>Folosim doar aceste date, istoricul facturilor{bank ? ', contul bancar' : ''} și Biroul de Credit, ca să vedem dacă îți permiți rata.</p>
            <p className="mt-1.5 text-muted">Nu folosim rețele sociale sau date despre sănătate.</p>
          </Notice>
          {formError && <ErrorNote>{formError}</ErrorNote>}
        </SheetBody>
        <SheetFoot>
          <TwoButtons>
            <Btn type="button" variant="secondary" onClick={back}>Înapoi</Btn>
            <Btn type="submit">Verifică</Btn>
          </TwoButtons>
        </SheetFoot>
      </form>
    </>
  );
}

/** Buton în textul unei etichete (nu bifează checkbox-ul). */
function InlineToggle({ open, onClick, controls, children, bold }: { open: boolean; onClick: () => void; controls: string; children: React.ReactNode; bold?: boolean }) {
  return (
    <button type="button" aria-expanded={open} aria-controls={controls}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={cx('rounded text-paper underline decoration-paper/40 underline-offset-4 hover:decoration-paper', bold ? 'font-bold' : 'font-semibold')}>
      {children}
    </button>
  );
}

/** „Verificăm cererea”: sursele se bifează pe rând; ultima doar după ce răspunde API-ul. */
function Checking({ billing, bank, ready, onFinished }: { billing: boolean; bank: boolean; ready: boolean; onFinished: () => void }) {
  const items = [
    'Venit și cheltuieli',
    bank ? 'Contul bancar · Open Banking (simulat)' : null,
    billing ? 'Istoricul facturilor Telvia' : null,
    'Rate existente · Biroul de Credit',
  ].filter(Boolean) as string[];
  const [done, setDone] = useState(0);
  const finish = useRef(onFinished);
  finish.current = onFinished;

  useEffect(() => {
    const limit = ready ? items.length : items.length - 1;
    if (done >= limit) return;
    const t = setTimeout(() => setDone((d) => d + 1), done === 0 ? 650 : 520);
    return () => clearTimeout(t);
  }, [done, ready, items.length]);

  useEffect(() => {
    if (done < items.length) return;
    const t = setTimeout(() => finish.current(), 450);
    return () => clearTimeout(t);
  }, [done, items.length]);

  const all = done >= items.length;
  return (
    <>
      <SheetTop><SheetHeader step={1} progress={1.55 + (done / items.length) * 0.45} /></SheetTop>
      <SheetBody className="pb-2">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span aria-hidden className="grid size-16 place-items-center rounded-full bg-brand text-ink animate-pop">
            {all ? <IconTick className="size-8" animate /> : <IconLoading className="size-8 animate-spin [animation-duration:1.6s]" />}
          </span>
          <div className="flex flex-col gap-1">
            <SheetTitle center>{all ? 'Gata, am verificat' : 'Verificăm cererea'}</SheetTitle>
            <p className="text-[15px] text-muted">Durează câteva secunde.</p>
          </div>
        </div>
        <Card className="px-4 py-2">
          <ul aria-label="Ce verificăm" className="flex flex-col">
            {items.map((it, i) => {
              const ok = i < done;
              return (
                <li key={it} className="flex min-h-11 items-center gap-3 text-[15px] animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="grid size-[22px] place-items-center">
                    {ok ? <CheckDot className="size-[22px]" pop /> : <Spinner className="size-[18px] text-brand" />}
                  </span>
                  <span className={cx('transition-colors duration-300', ok ? 'text-paper' : 'text-muted')}>{it}</span>
                  <span className="sr-only">{ok ? ': verificat' : ': în curs'}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <p className="sr-only" aria-live="polite">{all ? 'Verificarea s-a încheiat.' : `Verificat ${done} din ${items.length}.`}</p>
      </SheetBody>
      <SheetFoot><p className="text-center text-[13px] text-muted">Rezultatul apare imediat.</p></SheetFoot>
    </>
  );
}
