// Bani: calculam in BANI (numere intregi), ca sa nu avem erori de float.
// 106,52 lei = 10652 bani.

export const toBani = (lei: number): number => Math.round(lei * 100);
export const toLei = (bani: number): number => Math.round(bani) / 100;
export const round2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;

const fmtLei0 = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0, useGrouping: 'always' });
const fmtLei2 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const fmtPct0 = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });

/** 2693.48 -> "2.693" (pentru texte in limbaj simplu) */
export const leiRotunjit = (lei: number): string => fmtLei0.format(lei);
/** 2693.48 -> "2.693,48" */
export const leiExact = (lei: number): string => fmtLei2.format(lei);
/** 7.8 -> "8" */
export const pctRotunjit = (pct: number): string => fmtPct0.format(pct);
