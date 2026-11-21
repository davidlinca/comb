// Sheet-ul persistent al fluxului: rămâne montat între pași, iar conținutul se schimbă în el
// (view transition „sheet”: înălțimea se ajustează lin, conținutul vechi dispare, cel nou urcă ușor).
import { useCallback, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { markTransition } from '../lib/motion';

export type SheetCtx = { close: () => void };

export default function SheetShell() {
  const nav = useNavigate();
  const close = useCallback(() => { markTransition('close'); nav('/shop', { viewTransition: true }); }, [nav]);

  // Escape închide sheet-ul (dialogurile suprapuse, ca formularul SECCI, opresc evenimentul înainte)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div aria-hidden onClick={close} className="absolute inset-0 bg-ink/45 animate-fade-in" />
      <div
        role="dialog" aria-modal="true" aria-labelledby="sheet-title"
        className="on-dark relative mx-2.5 mb-[max(10px,var(--safe-bottom))] mt-[calc(var(--safe-top)+12px)] flex min-h-0 flex-col overflow-hidden rounded-[36px] bg-sheet text-paper shadow-[0_-8px_40px_rgb(0_0_0/0.25)] animate-sheet-up"
        style={{ viewTransitionName: 'sheet' }}
      >
        <Outlet context={{ close } satisfies SheetCtx} />
      </div>
    </div>
  );
}
