import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';

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

/* ---------------- deschiderea și închiderea sheet-urilor ----------------
   Între pași folosim View Transitions (sheet-ul își schimbă înălțimea, conținutul se schimbă în el).
   La deschidere și la închidere NU: acolo sheet-ul urcă / coboară opac prin CSS, tăiat de marginea
   ecranului (în rama de pe desktop, imaginile unei view transition nu sunt tăiate de ramă). */

const SHEET_PATH = /^\/(shop\/[^/]+|a\/|c\/)/;
export const hasSheet = (pathname: string) => SHEET_PATH.test(pathname);

type RouterLike = { state: { location: { pathname: string } }; subscribe: (fn: (s: { location: { pathname: string } }) => void) => () => void };

/**
 * Plasă de siguranță: routerul poate porni singur o view transition la Înapoi / Înainte în browser
 * (dacă navigarea inițială a avut una). Când asta deschide sau închide un sheet, marcăm <html data-vt>,
 * iar CSS-ul face tranziția invizibilă: animația o dau sheet-ul (sheet-up) și copia lui care coboară.
 * Rulează înaintea abonamentului RouterProvider, deci marcajul există când pornește tranziția.
 */
let committed = typeof window !== 'undefined' ? window.location.pathname : '/';
/** Ruta afișată acum (nu cea spre care se navighează; la Înapoi, URL-ul se schimbă înainte de randare). */
export const committedPath = () => committed;

export function installTransitionMarks(router: RouterLike) {
  let last = router.state.location.pathname;
  committed = last;
  let token = 0;
  return router.subscribe((s) => {
    const p = s.location.pathname;
    if (p === last) return;
    const kind = hasSheet(last) && !hasSheet(p) ? 'close' : !hasSheet(last) && hasSheet(p) ? 'open' : null;
    last = p;
    committed = p;
    const el = document.documentElement;
    const t = ++token;
    if (kind) el.dataset.vt = kind; else delete el.dataset.vt;
    window.setTimeout(() => { if (t === token) delete el.dataset.vt; }, 700);
  });
}

/**
 * Animația de ieșire pentru un element care tocmai e scos din pagină (sheet-ul care se închide):
 * o copie statică, inertă, rămâne pe loc cât rulează animația CSS a clasei `className`, apoi dispare.
 * Merge la fel pentru X, „Nu acum”, Înapoi în browser sau back pe Android. Se apelează din cleanup-ul
 * unui useLayoutEffect, care rulează înainte ca React să scoată nodul din DOM.
 */
export function ghostExit(node: HTMLElement, className: string) {
  const parent = node.parentNode;
  if (!parent || !node.isConnected || reducedMotion()) return;
  const ghost = node.cloneNode(true) as HTMLElement;
  const src = node.querySelectorAll<HTMLElement>('*');
  const dst = ghost.querySelectorAll<HTMLElement>('*');
  for (const el of [ghost, ...dst]) { el.removeAttribute('id'); el.style.viewTransitionName = ''; }
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.classList.add(className);
  parent.insertBefore(ghost, node.nextSibling);
  // copia pornește cu derularea și valorile originalului
  src.forEach((el, i) => {
    if (el.scrollTop) dst[i].scrollTop = el.scrollTop;
    if (el instanceof HTMLInputElement) (dst[i] as HTMLInputElement).value = el.value;
  });
  const remove = () => ghost.remove();
  ghost.addEventListener('animationend', (e) => { if ((e.target as HTMLElement).dataset.ghostEnd !== undefined) remove(); });
  window.setTimeout(remove, 700);
  // StrictMode (dev) simulează un unmount fără să scoată nodul: atunci copia nu e necesară
  queueMicrotask(() => { if (node.isConnected) remove(); });
}

/* ---------------- istoricul fluxului ---------------- */

const histIdx = () => (window.history.state as { idx?: number } | null)?.idx ?? null;
let origin: number | null = null; // poziția din istoric a magazinului din care s-a deschis fluxul

/** Ținem minte de unde s-a deschis fluxul, ca închiderea să ne întoarcă exact acolo în istoric. */
export function rememberOrigin() { origin = histIdx(); }

/**
 * Închiderea fluxului: ne întoarcem în istoric la magazinul din care am plecat (Înapoi nu mai
 * redeschide sheet-ul închis). Fără un punct de plecare cunoscut (link direct, refresh), înlocuim
 * intrarea curentă cu magazinul.
 */
export function closeTo(nav: NavigateFunction) {
  const idx = histIdx();
  if (origin != null && idx != null && idx > origin) { const d = origin - idx; origin = null; nav(d); }
  else { origin = null; nav('/shop', { replace: true }); }
}

/**
 * „Înapoi” la pasul anterior: dacă am ajuns aici chiar de acolo (state.from), ne întoarcem în istoric,
 * deci Înainte / Înapoi din browser rămân coerente și nu se adună bucle; altfel (link direct, refresh)
 * înlocuim pasul curent cu ținta. Ambele variante au tranziție.
 */
export function useStepBack(target: string) {
  const nav = useNavigate();
  const { state } = useLocation();
  return () => {
    if ((state as { from?: string } | null)?.from === target) nav(-1);
    else nav(target, { replace: true, viewTransition: true });
  };
}
