import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { parseLei } from '../lib/format';
import { Btn, ErrorNote, Sheet, SheetHeader } from '../components/ui';
import { IconCheck, IconHourglass, IconInfo } from '../components/Icons';
import Backdrop from '../components/Backdrop';

type FieldKey = 'net_income_lei' | 'monthly_expenses_lei' | 'other_installments_lei';

export default function BudgetSheet() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [other, setOther] = useState('');
  const [billing, setBilling] = useState(false);
  const [bank, setBank] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [bankWhy, setBankWhy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey | 'privacy', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const firstInvalid = useRef<HTMLInputElement | null>(null);

  // dacă cererea e deja evaluată (refresh, înapoi), mergem direct la rezultat
  useEffect(() => {
    api.application(id).then((a) => {
      if (a.next_step !== 'consents' && a.next_step !== 'assessment') nav(`/a/${id}/rezultat`, { replace: true });
    }).catch(() => {});
  }, [id, nav]);

  function validate() {
    const e: typeof errors = {};
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
    if (Object.keys(e).length) { requestAnimationFrame(() => firstInvalid.current?.focus()); return; }
    setChecking(true);
    const started = Date.now();
    try {
      await api.consents(id, { billing_history: billing, bank_data: bank, privacy_notice_read: privacy });
      try {
        await api.assessment(id, { net_income_lei: i, monthly_expenses_lei: x, other_installments_lei: o });
      } catch (err) {
        if (!(err instanceof ApiError && err.code === 'ALREADY_ASSESSED')) throw err; // dublu-click = succes
      }
      const wait = Math.max(0, 1600 - (Date.now() - started)); // timp să se citească pașii verificării
      setTimeout(() => nav(`/a/${id}/rezultat`, { replace: true }), wait);
    } catch (err) {
      setChecking(false);
      if (err instanceof ApiError) {
        const fe: typeof errors = {};
        err.fields.forEach((f) => { if (f === 'net_income_lei' || f === 'monthly_expenses_lei' || f === 'other_installments_lei') fe[f] = err.message; });
        if (Object.keys(fe).length) setErrors(fe); else setFormError(err.message);
      } else setFormError('A apărut o eroare. Încearcă din nou.');
    }
  }

  const refFor = (k: FieldKey) => (el: HTMLInputElement | null) => {
    if (!el) return;
    const order: FieldKey[] = ['net_income_lei', 'monthly_expenses_lei', 'other_installments_lei'];
    const first = order.find((f) => errors[f]);
    if (first === k) firstInvalid.current = el;
  };

  if (checking) return <><Backdrop /><Checking billing={billing} bank={bank} /></>;

  return (
    <>
      <Backdrop />
      <Sheet label="Verificăm bugetul" tall>
        <SheetHeader step={1} onClose={() => nav('/shop')} />
        <h2 className="text-[26px] font-bold tracking-tight">Verificăm bugetul</h2>
        <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-4">
            <Money id="inc" label="Venit net lunar" hint="După taxe." value={income} onChange={setIncome} placeholder="ex. 5.200" error={errors.net_income_lei} inputRef={refFor('net_income_lei')} />
            <Money id="exp" label="Cheltuieli lunare" hint="Chirie, utilități, mâncare, transport." value={expenses} onChange={setExpenses} placeholder="ex. 2.100" error={errors.monthly_expenses_lei} inputRef={refFor('monthly_expenses_lei')} />
            <Money id="oth" label="Rate pe care le plătești deja" value={other} onChange={setOther} placeholder="0 dacă nu ai" error={errors.other_installments_lei} inputRef={refFor('other_installments_lei')} />
          </div>

          <fieldset className="flex flex-col gap-3.5 border-t border-line pt-5">
            <legend className="sr-only">Acorduri</legend>
            <Check checked={billing} onChange={setBilling}>Folosiți istoricul facturilor mele Telvia în evaluare. <span className="text-muted">Opțional</span></Check>
            <div className="flex flex-col gap-2">
              <Check checked={bank} onChange={setBank}>
                Sunt de acord să fie citite veniturile și cheltuielile din contul meu bancar (Open Banking, simulat), doar pentru această evaluare.{' '}
                <button type="button" onClick={(e) => { e.preventDefault(); setBankWhy((v) => !v); }} aria-expanded={bankWhy}
                  className="font-semibold text-paper underline underline-offset-2">De ce?</button>
              </Check>
              {bankWhy && <p className="ml-9 rounded-xl bg-field px-3 py-2.5 text-[14px] text-muted">Legea ne cere să verificăm venitul. Dacă nu ești de acord, un coleg îți verifică venitul cu un alt document.</p>}
            </div>
            <Check checked={privacy} onChange={(v) => { setPrivacy(v); if (v) setErrors((e) => ({ ...e, privacy: undefined })); }} invalid={!!errors.privacy}>
              Am citit <a href="#nota" onClick={(e) => e.preventDefault()} className="font-semibold text-paper underline underline-offset-2">nota de informare</a> despre datele personale.
            </Check>
            {errors.privacy && <p role="alert" className="ml-9 text-[14px] font-medium text-danger">{errors.privacy}</p>}
          </fieldset>

          <p className="flex gap-2.5 rounded-2xl border border-line px-4 py-3 text-[14px] leading-snug text-muted">
            <IconInfo className="mt-0.5 size-4 shrink-0 text-paper" />
            <span><span className="text-paper">Folosim doar aceste date, istoricul facturilor, contul bancar (dacă ești de acord) și Biroul de Credit, ca să vedem dacă îți permiți rata.</span> Nu folosim rețele sociale sau date despre sănătate.</span>
          </p>

          {formError && <ErrorNote>{formError}</ErrorNote>}
          <div className="mt-auto grid grid-cols-2 gap-2.5">
            <Btn type="button" variant="secondary" onClick={() => nav(-1)}>Înapoi</Btn>
            <Btn type="submit">Verifică</Btn>
          </div>
        </form>
      </Sheet>
    </>
  );
}

function Money({ id, label, hint, value, onChange, placeholder, error, inputRef }: {
  id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder: string; error?: string; inputRef: (el: HTMLInputElement | null) => void;
}) {
  const desc = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-semibold">{label}</label>
      <div className={`flex h-13 items-center gap-2 rounded-2xl border bg-field px-4 ${error ? 'border-danger' : 'border-field focus-within:border-muted'}`}>
        <input id={id} ref={inputRef} inputMode="decimal" autoComplete="off" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={desc}
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-paper outline-none placeholder:text-subtle" />
        <span className="text-[15px] text-muted">lei</span>
      </div>
      {error
        ? <p id={`${id}-err`} className="flex items-center gap-1.5 text-[14px] font-medium text-danger"><IconInfo className="size-4" />{error}</p>
        : hint && <p id={`${id}-hint`} className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

function Check({ checked, onChange, children, invalid }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; invalid?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={invalid || undefined} className="peer sr-only" />
      <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand ${checked ? 'border-brand bg-brand text-ink' : invalid ? 'border-danger bg-field' : 'border-graphite bg-field'}`}>
        {checked && <IconCheck className="size-4" />}
      </span>
      <span>{children}</span>
    </label>
  );
}

function Checking({ billing, bank }: { billing: boolean; bank: boolean }) {
  const items = [
    'Venit și cheltuieli',
    bank ? 'Contul bancar · Open Banking (simulat)' : null,
    billing ? 'Istoricul facturilor Telvia' : null,
    'Rate existente · Biroul de Credit',
  ].filter(Boolean) as string[];
  const [done, setDone] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDone((d) => Math.min(d + 1, items.length - 1)), 450);
    return () => clearInterval(t);
  }, [items.length]);
  return (
    <Sheet label="Verificăm cererea">
      <SheetHeader step={1} hideClose />
      <div className="flex flex-col items-center gap-3 pt-2 text-center" aria-live="polite">
        <span className="grid size-16 place-items-center rounded-full bg-field text-brand"><IconHourglass /></span>
        <h2 className="text-[24px] font-bold">Verificăm cererea</h2>
        <p className="text-[15px] text-muted">Durează câteva secunde.</p>
      </div>
      <ul className="flex flex-col gap-3 rounded-2xl border border-line p-4 text-[15px]">
        {items.map((it, i) => (
          <li key={it} className="flex items-center gap-3">
            {i < done
              ? <span className="grid size-6 place-items-center rounded-full bg-brand text-ink"><IconCheck className="size-3.5" /></span>
              : <span className="size-6 animate-spin rounded-full border-[3px] border-graphite border-t-brand motion-reduce:animate-none" />}
            {it}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
