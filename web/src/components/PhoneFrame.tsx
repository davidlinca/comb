// Scena aplicației, adaptată dispozitivului:
//  - pe telefon: ecran complet, cu zonele sigure (notch, bara de jos) din env(safe-area-inset-*);
//  - pe tabletă / laptop / desktop: rama unui telefon de 402×874 (ca în Figma), scalată să încapă în fereastră,
//    iar pe ecrane late, în stânga, pașii fluxului și ce obligație CCD2 acoperă fiecare (pentru demo și juriu).
import { useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useMatches } from 'react-router-dom';
import { cx } from './ui';
import { CheckDot } from './Icons';

const W = 402, H = 874, BEZEL = 11;
const FW = W + BEZEL * 2, FH = H + BEZEL * 2;

const editing = () => !!document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable]');
function subscribe(cb: () => void) {
  window.addEventListener('resize', cb);
  window.visualViewport?.addEventListener('resize', cb);
  document.addEventListener('focusin', cb);
  document.addEventListener('focusout', cb);
  return () => {
    window.removeEventListener('resize', cb); window.visualViewport?.removeEventListener('resize', cb);
    document.removeEventListener('focusin', cb); document.removeEventListener('focusout', cb);
  };
}
const snap = () => `${window.innerWidth}x${window.innerHeight}x${editing() ? 1 : 0}`;
/**
 * Dimensiunea ferestrei. Cât scrii într-un câmp, înălțimea nu scade: pe tabletele Android tastatura
 * micșorează fereastra, iar rama nu trebuie să se micșoreze sau să dispară sub degete.
 */
function useViewport() {
  const s = useSyncExternalStore(subscribe, snap, () => '390x844x0');
  const [w, h, typing] = s.split('x').map(Number);
  const steady = useRef(h);
  if (!typing) steady.current = h;
  return { w, h: typing ? Math.max(h, steady.current) : h };
}

/** ?clean ascunde coloana din stânga (pentru înregistrarea video); ?clean=0 o readuce. Se păstrează în sesiune. */
function isClean(search: string) {
  const q = new URLSearchParams(search);
  try {
    if (q.has('clean')) sessionStorage.setItem('comb-clean', q.get('clean') === '0' ? '0' : '1');
    return sessionStorage.getItem('comb-clean') === '1';
  } catch { return q.has('clean') && q.get('clean') !== '0'; }
}

export default function PhoneFrame({ children }: { children: ReactNode }) {
  const { w, h } = useViewport();
  const { search } = useLocation();
  const framed = Math.min(w, h) >= 600;           // telefoanele (și în landscape) primesc ecran complet
  const rail = framed && w >= 1180 && !isClean(search);

  const RAIL_W = 290, GAP = Math.round(Math.min(112, Math.max(48, w * 0.07)));
  const room = rail ? w - 64 - RAIL_W - GAP : w - 32;
  const scale = Math.min(1, (h - 48) / FH, room / FW);
  const screenVars = { '--safe-top': '54px', '--safe-bottom': '20px' } as CSSProperties;

  // Aceeași structură de elemente în ambele moduri (doar clasele diferă), ca trecerea peste prag
  // (fereastră redimensionată, tabletă rotită) să nu remonteze aplicația și să nu piardă ce ai completat.
  return (
    <div className={framed ? 'stage flex min-h-dvh items-center justify-center overflow-hidden px-4 py-6' : 'fixed inset-0 bg-[#e9e8e4]'}
      style={framed ? { gap: GAP } : undefined}>
      {rail && <Rail />}
      <div className={framed ? 'relative shrink-0' : 'contents'} style={framed ? { width: FW * scale, height: FH * scale } : undefined}>
        <div
          className={framed ? 'absolute left-0 top-0 rounded-[60px] bg-[#0d0d0d] shadow-[0_40px_80px_-20px_rgb(0_0_0/0.35),0_0_0_1.5px_#2a2a2a_inset,0_0_0_1px_rgb(0_0_0/0.25)]' : 'contents'}
          style={framed ? { width: FW, height: FH, padding: BEZEL, transform: `scale(${scale})`, transformOrigin: 'top left' } : undefined}
        >
          <div data-screen style={framed ? screenVars : undefined}
            className={framed ? 'relative h-full w-full overflow-hidden rounded-[50px] bg-paper' : 'relative mx-auto h-full w-full max-w-[540px] overflow-hidden bg-paper shadow-[0_0_0_1px_rgb(0_0_0/0.04)]'}>
            {children}
            {framed && <StatusBar />}
            {framed && <span aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 z-[60] h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-white mix-blend-difference" />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bara de stare iOS, decorativă (aria-hidden), doar în ramă. */
function StatusBar() {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-[11px] z-[61] h-[35px] w-[124px] -translate-x-1/2 rounded-full bg-black" />
      {/* blend pe elementul cu z-index (contextul lui de stivuire), ca textul să fie închis pe alb și alb pe închis */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex h-[54px] items-center justify-between px-9 pt-1 text-[16px] font-semibold text-white mix-blend-difference">
      <svg viewBox="0 0 56 20" className="h-5 w-14"><text x="28" y="15" textAnchor="middle" fill="currentColor" fontSize="16" fontWeight="600" letterSpacing="-0.3">9:41</text></svg>
      <span className="flex w-14 items-center justify-end gap-1.5">
        <svg viewBox="0 0 18 12" className="h-3 w-[18px]" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg viewBox="0 0 16 12" className="h-3 w-4" fill="currentColor"><path d="M8 2.6c2.1 0 4 .8 5.5 2.1l1.1-1.2A9.6 9.6 0 0 0 8 1 9.6 9.6 0 0 0 1.4 3.5l1.1 1.2A8 8 0 0 1 8 2.6Zm0 3.2c1.2 0 2.4.5 3.3 1.3l1.1-1.2A6.4 6.4 0 0 0 8 4.2c-1.7 0-3.2.6-4.4 1.7l1.1 1.2c.9-.8 2-1.3 3.3-1.3Zm0 3.2c-.5 0-1 .2-1.3.5L8 11l1.3-1.5c-.3-.3-.8-.5-1.3-.5Z" /></svg>
        <svg viewBox="0 0 27 13" className="h-[13px] w-[27px]"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor" /><path d="M25 4.5v4a2 2 0 0 0 0-4Z" fill="currentColor" opacity=".45" /></svg>
      </span>
      </div>
    </>
  );
}

const FLOW = [
  { t: 'Perioada', d: 'Costul total, înainte de orice decizie', law: 'art. 8' },
  { t: 'Buget', d: 'Evaluare cu date relevante, cu acord explicit', law: 'art. 18' },
  { t: 'Rezultat', d: 'Motive clare și analiză umană la cerere', law: 'art. 18' },
  { t: 'Oferta', d: 'Formularul SECCI pe un ecran, fără presiune', law: 'art. 10' },
  { t: 'Semnare', d: 'Glisare deliberată și cod SMS', law: '' },
  { t: 'Contract', d: '14 zile de retragere cu memento; ajutor la rata ratată', law: 'art. 26 · 35' },
];

/** Coloana din stânga pe ecrane late: unde se află demo-ul în flux. */
function Rail() {
  const matches = useMatches();
  const step = matches.reduce<number>((s, m) => {
    const h = m.handle as { step?: number } | undefined;
    return typeof h?.step === 'number' ? h.step : s;
  }, -1);
  return (
    <aside aria-label="Despre demo" className="flex w-[290px] shrink-0 flex-col gap-9 text-ink animate-fade-in">
      <div className="flex flex-col gap-3">
        <span className="flex items-center gap-2.5">
          <CombMark />
          <span className="text-[26px] font-extrabold tracking-[-0.03em]">comb</span>
        </span>
        <p className="text-[15px] leading-snug text-subtle">Rate de telefon în aplicația operatorului, conforme cu CCD2 din prima zi.</p>
      </div>
      <ol className="flex flex-col">
        {FLOW.map((f, i) => {
          const done = i < step, now = i === step;
          return (
            <li key={f.t} aria-current={now ? 'step' : undefined}
              className={cx('relative flex gap-3.5 pb-5 transition-opacity duration-500 last:pb-0', !now && !done && 'opacity-55')}>
              {i < FLOW.length - 1 && <span aria-hidden className={cx('absolute left-[11px] top-7 h-[calc(100%-30px)] w-px transition-colors duration-500', done ? 'bg-ink' : 'bg-ink/15')} />}
              <span aria-hidden className="relative mt-0.5 grid size-6 shrink-0 place-items-center">
                {done ? <CheckDot className="size-6" /> : (
                  <span className={cx('grid size-6 place-items-center rounded-full border text-[12px] font-bold transition-all duration-500',
                    now ? 'border-ink bg-ink text-brand shadow-[0_0_0_5px_rgb(255_206_0/0.35)]' : 'border-ink/25 text-ink/60')}>{i + 1}</span>
                )}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="flex items-baseline gap-2 text-[15px] font-semibold">
                  {f.t}
                  {f.law && <span className="rounded-md bg-ink/[0.06] px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide text-subtle">CCD2 {f.law}</span>}
                </span>
                <span className="text-[14px] leading-snug text-subtle">{f.d}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] text-subtle">Demo · clienți și date fictive · Credis IFN (demo)</p>
    </aside>
  );
}

export function CombMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25Z" fill="#FFCE00" />
      <path d="M16 9.6 21.5 12.8v6.4L16 22.4l-5.5-3.2v-6.4Z" fill="#121212" />
    </svg>
  );
}
