import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { IconX } from './Icons';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary'; loading?: boolean };
export function Btn({ variant = 'primary', loading, className = '', children, disabled, ...rest }: BtnProps) {
  const v = variant === 'primary'
    ? 'bg-paper text-ink hover:bg-cloud disabled:bg-graphite disabled:text-muted'
    : 'bg-field text-paper hover:bg-graphite disabled:text-muted';
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined}
      className={`h-12 rounded-full px-4 text-[16px] font-semibold transition-colors ${v} ${className}`}>
      {loading ? 'Se încarcă…' : children}
    </button>
  );
}

export const STEPS = ['Perioadă', 'Buget', 'Rezultat', 'Ofertă'] as const;

// Antet de sheet: numele pasului + bara de progres (pașii trecuți plini, cel curent pornit) + X.
export function SheetHeader({ step, onClose, hideClose }: { step: number; onClose?: () => void; hideClose?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-[70px] shrink-0 text-[13px] text-muted">{STEPS[step]}</span>
      <div className="grid flex-1 grid-cols-4 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1}
        aria-label={`Pasul ${step + 1} din 4: ${STEPS[step]}`}>
        {STEPS.map((_, i) => (
          <span key={i} className="h-1 overflow-hidden rounded-full bg-graphite">
            <span className="block h-full rounded-full bg-brand" style={{ width: i < step ? '100%' : i === step ? '28%' : '0%' }} />
          </span>
        ))}
      </div>
      {hideClose ? <span className="size-10" /> : (
        <button type="button" onClick={onClose} aria-label="Închide"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-paper hover:bg-field">
          <IconX />
        </button>
      )}
    </div>
  );
}

export function Sheet({ children, label, tall }: { children: ReactNode; label: string; tall?: boolean }) {
  return (
    <>
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={label}
        className={`sheet-in absolute inset-x-2 bottom-2 flex max-h-[calc(100%-16px)] flex-col gap-5 overflow-y-auto rounded-[32px] bg-sheet p-5 text-paper ${tall ? 'top-10' : ''}`}>
        {children}
      </div>
    </>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-2xl bg-danger-strong/15 px-4 py-3 text-[14px] text-danger">{children}</p>;
}
