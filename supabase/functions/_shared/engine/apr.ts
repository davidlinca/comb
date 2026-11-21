// DAE dupa Anexa I CCD2: rata X pentru care valoarea actualizata a creditului primit
// = valoarea actualizata a tuturor platilor clientului (rate + costuri).
//
//   credit = costuri_la_t0 + SUMA( plata_k * (1 + X)^(-t_k) )
//
// Ipoteza din Anexa I: un an are 12 luni egale, deci t_k = k / 12 ani.
// Rezolvam numeric (bisectie), apoi rotunjim la 2 zecimale.

/**
 * @param creditLei   suma primita de client la t = 0
 * @param paymentsLei platile lunare, in ordine (prima la o luna)
 * @param upfrontFeesLei costuri platite la t = 0 (0 in demo)
 * @returns DAE in procente, ex. 15.96
 */
export function aprPct(creditLei: number, paymentsLei: number[], upfrontFeesLei = 0): number {
  if (creditLei <= 0 || paymentsLei.length === 0) throw new Error('Date invalide pentru DAE');

  const pv = (x: number): number =>
    upfrontFeesLei + paymentsLei.reduce((s, a, i) => s + a * Math.pow(1 + x, -(i + 1) / 12), 0);

  const totalPaid = upfrontFeesLei + paymentsLei.reduce((s, a) => s + a, 0);
  if (Math.abs(totalPaid - creditLei) < 0.005) return 0; // fara dobanda si fara costuri: DAE = 0

  // pv(x) scade cand x creste; cautam x cu pv(x) = credit
  let lo = -0.99;
  let hi = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > creditLei) lo = mid;
    else hi = mid;
  }
  const x = (lo + hi) / 2;
  return Math.round(x * 100 * 100) / 100;
}
