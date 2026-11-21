// Date calendaristice in ora Romaniei, ca text YYYY-MM-DD.

export const TZ = 'Europe/Bucharest';

/** Data locala (Bucuresti) a unui moment: 2026-11-21T23:30Z -> "2026-11-22" */
export function localDate(at: Date, tz: string = TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

function parse(d: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Data invalida: ${d}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const fmt = (y: number, m: number, d: number): string =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Adauga n luni; daca ziua nu exista (31 -> feb.), ia ultima zi a lunii. */
export function addMonths(d: string, n: number): string {
  const [y, m, day] = parse(d);
  const idx = (m - 1) + n;
  const ny = y + Math.floor(idx / 12);
  const nm = ((idx % 12) + 12) % 12 + 1;
  return fmt(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}

export function addDays(d: string, n: number): string {
  const [y, m, day] = parse(d);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Numarul de zile calendaristice de la a la b (b - a). */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = parse(a);
  const [y2, m2, d2] = parse(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
