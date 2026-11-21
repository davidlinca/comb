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
