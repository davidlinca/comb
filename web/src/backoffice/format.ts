// Formatari ro-RO pentru back-office (ora Romaniei, lei, procente) si etichete in limbaj simplu.

const TZ = 'Europe/Bucharest';

const dateTime = new Intl.DateTimeFormat('ro-RO', {
  timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const dateShort = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeOnly = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const lei2 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 });

export const fmtDateTime = (iso: string) => dateTime.format(new Date(iso));
export const fmtDateShort = (iso: string) => dateShort.format(new Date(iso));
export const fmtTime = (d: Date) => timeOnly.format(d);
export const fmtLei = (v: number | null | undefined) => (v == null ? '–' : `${lei2.format(v)} lei`); // 1.234,56 lei
export const fmtPct = (v: number | null | undefined) => (v == null ? '–' : `${pct.format(v)}%`);

export const shortHash = (h: string, n = 10) => h.slice(0, n);

/** Articolul din jurnal: "art. 17" e din CCD2; altele (ex. "GDPR art. 7") raman cum sunt; "-" = fara articol. */
export const legalRef = (ref: string) => (ref === '-' ? null : ref.startsWith('art.') ? `CCD2 ${ref}` : ref);

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Ciorna',
  approved: 'Aprobata',
  manual_review: 'In revizuire',
  rejected: 'Respinsa',
  signed: 'Semnata',
  cancelled: 'Anulata',
};

export const DECISION_LABEL: Record<string, string> = {
  approved: 'Aprobat automat',
  manual_review: 'Trimis automat la revizuire',
  rejected: 'Respins automat',
};

export const ACTOR_LABEL: Record<string, string> = { customer: 'Client', system: 'Sistem', operator: 'Operator' };

/** Clase Tailwind pentru eticheta de status (culoare = sens, nu decor). */
export function statusTone(status: string): string {
  switch (status) {
    case 'signed':
    case 'approved':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'manual_review':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    case 'rejected':
    case 'cancelled':
      return 'bg-red-50 text-red-800 ring-red-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

export const productLabel = (sku: string, productId: string, term: number) =>
  `${sku}, ${productId === 'ZERO4' ? '4 rate fara dobanda' : `${term} luni`}`;
