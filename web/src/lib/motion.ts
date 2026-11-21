import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type DocVT = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

/** Schimbare de stare în același ecran, animată cu View Transitions când browserul o suportă. */
export function withTransition(update: () => void) {
  const doc = document as DocVT;
  if (!doc.startViewTransition || reducedMotion()) { update(); return; }
  doc.startViewTransition(() => flushSync(update));
}

/** Numără de la 0 la valoare (ease-out), pentru sume. Fără animație la reduced motion. */
export function useCountUp(target: number, ms = 750) {
  const [v, setV] = useState(() => (reducedMotion() ? target : 0));
  useEffect(() => {
    if (reducedMotion()) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** true după primul frame: pentru tranziții CSS care pornesc de la starea inițială. */
export function useMounted(delay = 30) {
  const [m, setM] = useState(false);
  useEffect(() => { const t = setTimeout(() => setM(true), delay); return () => clearTimeout(t); }, [delay]);
  return m;
}

/** Mută focusul pe element la montare (titlul unui ecran nou), ca cititoarele de ecran să-l anunțe. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return ref;
}

export const vibrate = (ms = 12) => { try { navigator.vibrate?.(ms); } catch { /* nu e suportat */ } };

/** Marchează tipul următoarei tranziții (deschidere / închidere de sheet) pentru CSS-ul view-transition. */
export function markTransition(kind: 'open' | 'close') {
  const el = document.documentElement;
  el.dataset.vt = kind;
  window.setTimeout(() => { if (el.dataset.vt === kind) delete el.dataset.vt; }, 4000); // plasă de siguranță
}
/** Șterge marcajul după ce tranziția s-a terminat (apelat când navigarea revine la idle). */
export function clearTransitionMark() {
  window.setTimeout(() => { delete document.documentElement.dataset.vt; }, 650);
}
