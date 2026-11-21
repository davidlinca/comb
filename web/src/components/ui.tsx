// Componentele de bază ale sheet-urilor Comb (tokenii din Figma: sheet #202020, card #242424, contur #323232, galben #FFCE00).
import {
  useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref,
} from 'react';
import { IconAlert, IconArrowLeft, IconChevronDown, IconX } from './Icons';
import { useFocusOnMount } from '../lib/motion';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

/* ---------------- butoane ---------------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

/** Buton pill de 46px (ținta de atingere ≥44px). Se apasă vizibil; în încărcare arată un spinner, păstrând lățimea. */
export function Btn({ variant = 'primary', loading, className, children, disabled, ref, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-paper text-ink hover:bg-cloud disabled:bg-graphite disabled:text-muted',
    secondary: 'border border-stroke bg-card text-paper hover:bg-card-hover hover:border-graphite disabled:text-muted',
    ghost: 'text-paper hover:bg-card',
  }[variant];
  return (
    <button
      ref={ref}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'relative inline-flex h-[46px] select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[16px] font-semibold',
        'transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.97] disabled:active:scale-100',
        loading && variant === 'primary' && 'disabled:bg-paper disabled:text-ink',
        loading && variant !== 'primary' && 'disabled:text-paper',
        v, className,
      )}
    >
      <span className={cx('inline-flex items-center gap-1.5 transition-opacity', loading && 'opacity-0')}>{children}</span>
      {loading && <Spinner className="absolute size-5" />}
    </button>
  );
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx('animate-spin', className)} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Buton rotund (X, înapoi): cerc vizual de 36px, țintă de 44px. */
export function RoundBtn({ kind, onClick, label }: { kind: 'close' | 'back'; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label ?? (kind === 'close' ? 'Închide' : 'Înapoi')}
      className="group -m-1 grid size-11 shrink-0 place-items-center rounded-full">
      <span className="grid size-9 place-items-center rounded-full border border-stroke bg-card text-paper transition-[background-color,transform] duration-200 group-hover:bg-card-hover group-active:scale-90">
        {kind === 'close' ? <IconX className="size-[18px]" /> : <IconArrowLeft className="size-[18px]" />}
      </span>
    </button>
  );
}

/** Link text cu săgeată galbenă (→ Cere analiză umană, → Retrimite codul). */
export function ArrowLink({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="group -mx-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-[15px] font-semibold text-paper disabled:opacity-50">
      <span aria-hidden className="text-brand transition-transform duration-200 group-hover:translate-x-0.5">→</span>
      <span className="underline-offset-4 group-hover:underline">{children}</span>
    </button>
  );
}

/* ---------------- structura sheet-ului ---------------- */

export const STEPS = ['Perioada', 'Buget', 'Rezultat', 'Oferta'] as const;
let lastProgress = 0; // de unde pornește bara la ecranul următor (animație continuă între pași)

/**
 * Antetul pașilor: eticheta pasului, 4 segmente (cele trecute pline, cel curent pornit) și X.
 * `progress` = pasul curent + cât din el e gata (ex. 1.6 în timpul verificării).
 */
export function SheetHeader({ step, progress, onClose }: { step: number; progress?: number; onClose?: () => void }) {
  const target = progress ?? step + 0.18;
  const [p, setP] = useState(lastProgress);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setP(target));
    lastProgress = target;
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return (
    <div className="flex items-center gap-4">
      <span className="w-[62px] shrink-0 text-[13px] text-muted">{STEPS[step]}</span>
      <div role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} aria-valuetext={`Pasul ${step + 1} din 4: ${STEPS[step]}`}
        aria-label="Progres" className="grid flex-1 grid-cols-4 gap-[3px]">
        {STEPS.map((_, i) => (
          <span key={i} className="h-1 overflow-hidden rounded-full bg-graphite">
            <span className="block h-full origin-left rounded-full bg-brand transition-transform duration-700 ease-out-expo"
              style={{ transform: `scaleX(${Math.max(0, Math.min(1, p - i))})` }} />
          </span>
        ))}
      </div>
      {onClose ? <RoundBtn kind="close" onClick={onClose} /> : <span className="size-9" aria-hidden />}
    </div>
  );
}

/** Titlul sheet-ului: primește focus la montare, ca cititorul de ecran să anunțe ecranul nou. */
export function SheetTitle({ children, className, center }: { children: ReactNode; className?: string; center?: boolean }) {
  const ref = useFocusOnMount<HTMLHeadingElement>();
  return (
    <h2 id="sheet-title" ref={ref} tabIndex={-1}
      className={cx('text-[24px] font-bold leading-tight tracking-[-0.01em] outline-none', center && 'text-center', className)}>
      {children}
    </h2>
  );
}

/** Partea fixă de sus (antetul pașilor sau butoanele X / înapoi). */
export function SheetTop({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('shrink-0 px-5 pt-5', className)}>{children}</div>;
}

/** Zona derulabilă a sheet-ului. */
export function SheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pb-1 pt-4', className)}>{children}</div>;
}

/** Butoanele de jos: rămân pe loc când sheet-ul își schimbă înălțimea (view-transition separat). */
export function SheetFoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('shrink-0 px-5 pb-5 pt-4', className)} style={{ viewTransitionName: 'sheet-foot' }}>
      {children}
    </div>
  );
}

/** Două butoane egale; dacă o etichetă e lungă, butonul ei se lărgește în loc să treacă pe două rânduri. */
export function TwoButtons({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 [&>*]:min-w-fit [&>*]:flex-1">{children}</div>;
}

/** Cercul galben de 64px cu iconiță (aprobat, semnat, retras). */
export function StatusIcon({ children, tone = 'brand', pulse }: { children: ReactNode; tone?: 'brand' | 'card'; pulse?: boolean }) {
  return (
    <span aria-hidden className="grid animate-pop">
      <span className={cx(
        'grid size-16 shrink-0 place-items-center rounded-full',
        tone === 'brand' ? 'bg-brand text-ink' : 'border border-stroke bg-card text-brand',
        pulse && 'animate-pulse-ring',
      )}>
        {children}
      </span>
    </span>
  );
}

/** Antet centrat: iconiță, titlu, subtitlu. */
export function StatusHead({ icon, title, sub, tone, pulse }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; tone?: 'brand' | 'card'; pulse?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2.5 pt-1 text-center">
      <StatusIcon tone={tone} pulse={pulse}>{icon}</StatusIcon>
      <div className="flex flex-col gap-1 animate-fade-up [animation-delay:80ms]">
        <SheetTitle center>{title}</SheetTitle>
        {sub && <p className="text-[15px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

/* ---------------- conținut ---------------- */

export function Card({ children, className, accent }: { children: ReactNode; className?: string; accent?: boolean }) {
  return (
    <div className={cx('rounded-[18px] border bg-card', accent ? 'border-brand/80' : 'border-stroke', className)}>{children}</div>
  );
}

/** Rânduri cheie–valoare cu separatori (dl). */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cx('flex flex-col', className)}>{children}</dl>;
}
export function Row({ k, v, sub, strong }: { k: ReactNode; v: ReactNode; sub?: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-stroke py-3 text-[15px] last:border-b-0">
      <dt className={strong ? 'font-semibold' : 'text-paper/90'}>{k}</dt>
      <dd className="text-right">
        <span className={cx('tabular', strong ? 'font-bold' : 'font-medium')}>{v}</span>
        {sub && <span className="mt-0.5 block text-[13px] text-muted">{sub}</span>}
      </dd>
    </div>
  );
}

/** Notă cu iconiță (avertismentul, informări). */
export function Notice({ icon, children, accent, className }: { icon?: ReactNode; children: ReactNode; accent?: boolean; className?: string }) {
  return (
    <Card accent={accent} className={cx('flex gap-3 px-4 py-3.5 text-[14px] leading-snug', className)}>
      <span className={cx('mt-px shrink-0', accent ? 'text-brand' : 'text-paper')}>{icon ?? <IconAlert />}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </Card>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[14px] leading-snug text-danger animate-fade-up">
      <IconAlert className="mt-px size-[18px] shrink-0" />{children}
    </p>
  );
}

/** Secțiune care se deschide cu înălțime animată (fără <details>, ca să putem anima). */
export function Collapse({ summary, children, defaultOpen = false, onToggle, className }: {
  summary: ReactNode; children: ReactNode; defaultOpen?: boolean; onToggle?: (open: boolean) => void; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} aria-controls={id}
        onClick={() => { setOpen((o) => !o); onToggle?.(!open); }}
        className="group flex min-h-11 w-full items-center gap-2.5 rounded-xl text-left text-[15px] font-medium">
        <span className="flex flex-1 items-center gap-2.5">{summary}</span>
        <IconChevronDown className={cx('size-4 text-muted transition-transform duration-300 ease-out-expo', open && 'rotate-180')} />
      </button>
      <div id={id} className="reveal" data-open={open} inert={!open}>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx('skeleton block', className)} />;
}

/* ---------------- formulare ---------------- */

/** Câmp de sumă în lei: separator de mii la tastare, eroare cu iconiță și tremur. */
export function MoneyField({ id, label, hint, value, onChange, placeholder, error, inputRef, shakeKey }: {
  id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder: string;
  error?: string; inputRef?: Ref<HTMLInputElement>; shakeKey?: number;
}) {
  const desc = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-semibold">{label}</label>
      <div key={error ? shakeKey : undefined}
        className={cx(
          'flex h-[54px] items-center gap-2 rounded-2xl border bg-card px-4 transition-colors duration-200',
          error ? 'border-danger animate-shake' : 'border-stroke hover:border-graphite focus-within:border-muted',
        )}>
        <input id={id} ref={inputRef} inputMode="decimal" autoComplete="off" enterKeyHint="next" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined} aria-describedby={desc}
          className="tabular h-full min-w-0 flex-1 bg-transparent text-[18px] font-medium text-paper outline-none focus-visible:outline-none" />
        <span aria-hidden className="text-[15px] text-muted">lei</span>
      </div>
      {error
        ? <p id={`${id}-err`} className="flex items-center gap-1.5 text-[13px] font-medium text-danger animate-fade-in"><IconAlert className="size-4" />{error}</p>
        : hint && <p id={`${id}-hint`} className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

/** Checkbox nativ (accesibil din tastatură), cu pătrat desenat și bifă animată. */
export function Checkbox({ checked, onChange, children, invalid, describedBy, inputRef }: {
  checked: boolean; onChange: (v: boolean) => void; children: ReactNode; invalid?: boolean; describedBy?: string; inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <label className="group relative flex cursor-pointer items-start gap-3 py-1 text-[15px] leading-snug">
      <input ref={inputRef} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined} aria-describedby={describedBy} className="peer sr-only" />
      <span aria-hidden className={cx(
        'mt-px grid size-6 shrink-0 place-items-center rounded-[7px] border transition-[background-color,border-color,transform] duration-200',
        'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand group-active:scale-90',
        checked ? 'border-brand bg-brand text-ink' : invalid ? 'border-danger bg-card' : 'border-graphite bg-card group-hover:border-muted',
      )}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" style={{ strokeDasharray: 22, strokeDashoffset: checked ? 0 : 22, transition: 'stroke-dashoffset .28s cubic-bezier(.16,1,.3,1)' }} />
        </svg>
      </span>
      <span className="flex-1">{children}</span>
    </label>
  );
}

/** Variantă selectabilă (radio nativ ascuns), ca în Figma: card cu titlu, subtitlu și suma în dreapta. */
export function RadioCard({ name, value, checked, onChange, title, sub, amount, amountSub, disabled }: {
  name: string; value: string; checked: boolean; onChange: () => void; title: ReactNode; sub?: ReactNode;
  amount?: ReactNode; amountSub?: ReactNode; disabled?: boolean;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'disabled'>) {
  return (
    <label className={cx(
      'group relative flex cursor-pointer items-center gap-3 rounded-[18px] border px-4 py-3.5 transition-[background-color,border-color,transform] duration-200 active:scale-[0.99]',
      checked ? 'border-paper bg-card-hover' : 'border-stroke bg-card hover:border-graphite',
      disabled && 'pointer-events-none opacity-60',
    )}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="peer sr-only" />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[18px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
      <span aria-hidden className={cx('grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors', checked ? 'border-brand' : 'border-graphite')}>
        <span className={cx('size-2.5 rounded-full bg-brand transition-transform duration-300 ease-spring', checked ? 'scale-100' : 'scale-0')} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">{title}</span>
        {sub && <span className="tabular text-[13px] text-muted">{sub}</span>}
      </span>
      {amount && (
        <span className="text-right">
          <span className="tabular block text-[18px] font-bold leading-tight">{amount}</span>
          {amountSub && <span className="text-[13px] text-muted">{amountSub}</span>}
        </span>
      )}
    </label>
  );
}

/** Hook: o valoare care pornește o animație o singură dată când devine true. */
export function useOnce(flag: boolean) {
  const seen = useRef(false);
  if (flag) seen.current = true;
  return seen.current;
}
