// Glisare pentru semnare: un gest deliberat, nu un tap accidental.
// Accesibil: butonul galben se poate activa și din tastatură (Enter/Space) sau din cititorul de ecran.
import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { IconArrowRight, IconTick } from './Icons';
import { cx } from './ui';
import { vibrate } from '../lib/motion';

const THUMB = 46, PAD = 4;

export default function SwipeToSign({ onDone, label = 'Glisează ca să semnezi', doneLabel = 'Confirmat', caption }: {
  onDone: () => void; label?: string; doneLabel?: string; caption?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; ratio: number; moved: boolean } | null>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const [hint, setHint] = useState(false);

  const max = () => (track.current?.clientWidth ?? 300) - THUMB - PAD * 2 - 2;

  function complete() {
    if (done) return;
    setX(max()); setDone(true); vibrate(18);
    setTimeout(onDone, 520);
  }

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (done) return;
    const el = track.current!;
    // raportul dintre pixelii ecranului și cei ai layoutului (rama de pe desktop e scalată)
    const ratio = el.getBoundingClientRect().width / el.clientWidth || 1;
    drag.current = { x0: e.clientX, ratio, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.x0) / d.ratio;
    if (Math.abs(dx) > 3) d.moved = true;
    setX(Math.max(0, Math.min(max(), dx)));
  };
  const up = () => {
    const d = drag.current; if (!d) return;
    drag.current = null; setDragging(false);
    if (x > max() * 0.82) complete();
    else {
      if (x < 12) { setHint(true); setTimeout(() => setHint(false), 2200); }
      setX(0);
    }
  };
  // click generat de tastatură / cititor de ecran (detail 0): semnează direct
  const click = (e: MouseEvent) => { if (e.detail === 0) complete(); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); complete(); } };

  const p = Math.min(1, x / Math.max(1, max()));
  return (
    <div>
      <div ref={track}
        className={cx('relative h-[54px] select-none overflow-hidden rounded-full border transition-colors duration-300',
          done ? 'border-brand bg-brand' : 'border-brand/80 bg-card')}>
        <div aria-hidden className={cx('absolute inset-y-0 left-0 rounded-full bg-brand/20', !dragging && 'transition-[width] duration-500 ease-spring')}
          style={{ width: x + THUMB + PAD * 2 }} />
        <span aria-hidden className={cx('absolute inset-0 grid place-items-center pl-12 pr-4 text-[16px] font-semibold transition-opacity duration-200', done && 'opacity-0')}
          style={{ opacity: done ? 0 : 1 - p * 1.4 }}>
          <span className="animate-shimmer bg-[linear-gradient(100deg,rgb(255_255_255/0.55)_20%,#fff_45%,rgb(255_255_255/0.55)_70%)] bg-[length:250%_100%] bg-clip-text text-transparent">{label}</span>
        </span>
        <span aria-hidden className={cx('absolute inset-0 grid place-items-center text-[16px] font-bold text-ink transition-opacity duration-300', done ? 'opacity-100 delay-150' : 'opacity-0')}>
          {doneLabel}
        </span>
        <button type="button" aria-label={`${label}. Sau apasă Enter.`} disabled={done}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click} onKeyDown={key}
          className={cx('absolute top-[3px] grid touch-none place-items-center rounded-full bg-brand text-ink shadow-[0_2px_10px_rgb(0_0_0/0.35)]',
            !dragging && 'transition-[left,background-color] duration-500 ease-spring',
            !done && x === 0 && !dragging && 'animate-nudge',
            done && 'bg-ink text-brand',
            'cursor-grab active:cursor-grabbing disabled:cursor-default')}
          style={{ left: PAD + x, width: THUMB, height: THUMB }}>
          {done ? <IconTick className="size-5" animate /> : <IconArrowRight className="size-5" />}
        </button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-[18px] text-center text-[13px] text-muted">{hint ? 'Trage butonul galben până la capăt.' : caption}</p>
    </div>
  );
}
