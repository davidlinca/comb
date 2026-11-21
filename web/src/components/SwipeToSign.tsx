import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { IconArrow } from './Icons';

// Glisare pentru semnare: un gest deliberat. Merge și din tastatură (Enter/Space) pentru accesibilitate.
export default function SwipeToSign({ onDone, label = 'Glisează ca să semnezi' }: { onDone: () => void; label?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [x, setX] = useState(0);
  const [hint, setHint] = useState(false);
  const THUMB = 56, PAD = 4;
  const max = () => (track.current?.clientWidth ?? 300) - THUMB - PAD * 2;

  const down = (e: PointerEvent) => { start.current = e.clientX - x; (e.target as Element).setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => { if (start.current == null) return; setX(Math.max(0, Math.min(max(), e.clientX - start.current))); };
  const up = () => {
    if (start.current == null) return;
    start.current = null;
    if (x > max() * 0.85) { setX(max()); onDone(); }
    else { if (x < 8) { setHint(true); setTimeout(() => setHint(false), 1800); } setX(0); }
  };
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setX(max()); onDone(); } };
  const pctDone = Math.min(1, x / Math.max(1, max()));

  return (
    <div>
      <div ref={track} className="relative h-16 select-none overflow-hidden rounded-full border border-brand/70 bg-field">
        <div aria-hidden className="absolute inset-y-0 left-0 rounded-full bg-brand/15" style={{ width: x + THUMB + PAD * 2 }} />
        <span aria-hidden className="absolute inset-0 grid place-items-center pl-12 text-[16px] font-semibold text-paper" style={{ opacity: 1 - pctDone }}>{label}</span>
        <button type="button" role="slider" aria-label={`${label}. Apasă Enter ca să semnezi.`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pctDone * 100)}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
          className={`absolute top-1 grid size-14 touch-none place-items-center rounded-full bg-brand text-ink ${start.current == null ? 'transition-[left] duration-200' : ''}`}
          style={{ left: PAD + x }}>
          <IconArrow className="size-5" />
        </button>
      </div>
      <p aria-live="polite" className="mt-2 h-4 text-center text-[13px] text-muted">{hint ? 'Trage butonul galben până la capăt.' : ''}</p>
    </div>
  );
}
