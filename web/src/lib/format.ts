const num = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });
export const lei = (v: number) => `${num.format(v)} lei`;
export const leiInt = (v: number) => `${int.format(v)} lei`;
export const pct = (v: number) => `${num.format(v).replace(/,00$/, '').replace(/(,\d)0$/, '$1')}%`;

export function parseLei(s: string): number | null {
  const t = s.replace(/\s|lei/gi, '').replace(/\./g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
/** 5200 -> "5.200" pe măsură ce se tastează (separator de mii românesc). */
export function groupDigits(s: string) {
  const [i, d] = s.replace(/[^\d,]/g, '').split(',');
  const g = (i ?? '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return d !== undefined ? `${g},${d.slice(0, 2)}` : g;
}

const asDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
const dShort = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
const dLong = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
const dDayMonth = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });
const dMonth = new Intl.DateTimeFormat('ro-RO', { month: 'short', year: 'numeric' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const date = (iso: string) => dShort.format(asDate(iso));               // 21 dec. 2026
export const dateLong = (iso: string) => dLong.format(asDate(iso));           // 21 decembrie 2026
export const dayMonth = (iso: string) => dDayMonth.format(asDate(iso));       // 21 dec.
export const monthYear = (iso: string) => cap(dMonth.format(asDate(iso)));    // Dec. 2026
export const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((asDate(toIso).getTime() - asDate(fromIso).getTime()) / 86400000);
export function addDays(iso: string, days: number) {
  const d = asDate(iso); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
