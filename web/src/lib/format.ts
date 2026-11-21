const num = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });
export const lei = (v: number) => `${num.format(v)} lei`;
export const leiInt = (v: number) => `${int.format(v)} lei`;
export const pct = (v: number) => `${num.format(v)}%`;
export function parseLei(s: string): number | null {
  const t = s.replace(/\s|lei/gi, '').replace(/\./g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
const dShort = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
const dMonth = new Intl.DateTimeFormat('ro-RO', { month: 'short', year: 'numeric' });
const asDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
export const date = (iso: string) => dShort.format(asDate(iso));            // 21 dec. 2026
export const monthYear = (iso: string) => dMonth.format(asDate(iso));       // dec. 2026
export const daysBetween = (fromIso: string, toIso: string) => Math.round((asDate(toIso).getTime() - asDate(fromIso).getTime()) / 86400000);
