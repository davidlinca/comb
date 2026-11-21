// Iconițe stroke (stil Hugeicons, ca în Figma), cu culoarea din currentColor.
import type { SVGProps } from 'react';

type P = { className?: string } & Omit<SVGProps<SVGSVGElement>, 'className'>;
const base = (sw = 1.6) => ({
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: sw,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const, focusable: 'false' as const,
});

export const IconX = ({ className = 'size-5', ...p }: P) => (<svg {...base(1.8)} className={className} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>);
export const IconArrowLeft = ({ className = 'size-5', ...p }: P) => (<svg {...base(1.8)} className={className} {...p}><path d="M4 12h16M9 17s-5-3.68-5-5 5-5 5-5" /></svg>);
export const IconArrowRight = ({ className = 'size-5', ...p }: P) => (<svg {...base(1.8)} className={className} {...p}><path d="M20 12H4M15 17s5-3.68 5-5-5-5-5-5" /></svg>);
export const IconChevronDown = ({ className = 'size-4', ...p }: P) => (<svg {...base(1.8)} className={className} {...p}><path d="M18 9s-4.42 6-6 6-6-6-6-6" /></svg>);
export const IconChevronRight = ({ className = 'size-4', ...p }: P) => (<svg {...base(1.8)} className={className} {...p}><path d="M9 6s6 4.42 6 6-6 6-6 6" /></svg>);
export const IconAlert = ({ className = 'size-[18px]', ...p }: P) => (<svg {...base(1.6)} className={className} {...p}><circle cx="12" cy="12" r="10" /><path d="M11.99 16h.01M12 13V8" /></svg>);
export const IconFile = ({ className = 'size-5', ...p }: P) => (<svg {...base(1.6)} className={className} {...p}><path d="M20 13V10.6c0-3.39 0-5.08-1.06-6.14C17.88 3.4 16.17 3.4 12.76 3.4h-1.52c-3.4 0-5.11 0-6.17 1.06C4 5.52 4 7.21 4 10.6v2.8c0 3.39 0 5.08 1.06 6.14 1.06 1.06 2.77 1.06 6.18 1.06H12" /><path d="M8 8.4h8M8 12.4h5" /><path d="m14.5 19.6 1.5 1.4 3.5-4" /></svg>);
export const IconUndo = ({ className = 'size-5', ...p }: P) => (<svg {...base(1.6)} className={className} {...p}><path d="M3.5 12a8.5 8.5 0 1 0 2.49-6.01" /><path d="M3.5 4v4h4" /></svg>);
export const IconMail = ({ className = 'size-5', ...p }: P) => (<svg {...base(1.6)} className={className} {...p}><path d="m2 6 6.91 3.92c2.55 1.44 3.63 1.44 6.18 0L22 6" /><path d="M2.02 13.48c.06 3.07.1 4.6 1.23 5.73 1.13 1.14 2.7 1.18 5.85 1.26 1.94.05 3.86.05 5.8 0 3.15-.08 4.72-.12 5.85-1.26 1.13-1.13 1.17-2.66 1.23-5.73.03-.99.03-1.97 0-2.96-.06-3.07-.1-4.6-1.23-5.73-1.13-1.14-2.7-1.18-5.85-1.26a110 110 0 0 0-5.8 0c-3.15.08-4.72.12-5.85 1.26C2.12 5.92 2.08 7.45 2.02 10.52a50 50 0 0 0 0 2.96Z" /></svg>);
export const IconParty = ({ className = 'size-[34px]', ...p }: P) => (<svg {...base(1.6)} className={className} {...p}><path d="M3.29 18.33 7.5 7.5l9 9-10.83 4.21c-1.6.62-3.01-.78-2.38-2.38Z" /><path d="m9 11.5 3.5 3.5M6 15l3 3" /><path d="M14 4.5c.5 1 .2 2.3-.5 3M19.5 10c-1-.5-2.3-.2-3 .5M17.5 3v.01M21 6.5v.01M20.5 14v.01M10 2.5v.01" /></svg>);
export const IconTick = ({ className = 'size-[34px]', animate = false, ...p }: P & { animate?: boolean }) => (
  <svg {...base(1.8)} className={className} {...p}>
    <path d="M5 14.5s1.5 0 3.5 3.5c0 0 5.56-9.17 10.5-11" className={animate ? 'draw-path' : undefined} style={animate ? ({ '--len': 24 } as React.CSSProperties) : undefined} />
  </svg>
);
export const IconUserQuestion = ({ className = 'size-[34px]', ...p }: P) => (<svg {...base(1.6)} className={className} {...p}><circle cx="10" cy="7" r="4" /><path d="M3 20.5c0-3.59 3.13-6.5 7-6.5 1.06 0 2.06.22 2.96.6" /><path d="M16.5 16.25a1.75 1.75 0 1 1 2.6 1.53c-.6.33-1.1.86-1.1 1.55v.17M18 21.5h.01" /></svg>);
export const IconLoading = ({ className = 'size-[34px]', ...p }: P) => (
  <svg {...base(1.6)} className={className} {...p}>
    <path d="M12 3v3" /><path d="M12 18v3" opacity=".45" /><path d="M21 12h-3" opacity=".75" /><path d="M6 12H3" opacity=".3" />
    <path d="m18.36 5.64-2.12 2.12" opacity=".9" /><path d="m7.76 16.24-2.12 2.12" opacity=".35" /><path d="m18.36 18.36-2.12-2.12" opacity=".6" /><path d="m7.76 7.76-2.12-2.12" opacity=".2" />
  </svg>
);
export const IconClock = ({ className = 'size-[30px]', ...p }: P) => (<svg {...base(1.6)} className={className} {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8v4l2 2" /></svg>);
export const IconBell = ({ className = 'size-5', ...p }: P) => (<svg {...base(1.6)} className={className} {...p}><path d="M2.53 14.77c-.21 1.39.73 2.35 1.88 2.83 4.41 1.83 10.77 1.83 15.18 0 1.15-.48 2.1-1.44 1.88-2.83-.13-.85-.77-1.56-1.25-2.25-.62-.92-.68-1.93-.68-3C19.54 5.4 16.2 2 12 2S4.46 5.4 4.46 9.52c0 1.07-.06 2.08-.68 3-.48.69-1.12 1.4-1.25 2.25Z" /><path d="M8 19c.46 1.73 2.08 3 4 3s3.54-1.27 4-3" /></svg>);
export const IconShield = ({ className = 'size-4', ...p }: P) => (<svg {...base(1.6)} className={className} {...p}><path d="M18.71 3.65A11.4 11.4 0 0 0 12 2c-2.47 0-4.78.62-6.71 1.65A2.4 2.4 0 0 0 4 5.79v4.86c0 4.75 3.47 8.68 8 10.35 4.53-1.67 8-5.6 8-10.35V5.8a2.4 2.4 0 0 0-1.29-2.15Z" /></svg>);
export const IconBag = ({ className = 'size-5', ...p }: P) => (<svg {...base(1.6)} className={className} {...p}><path d="M3.06 13.36c.36-2.6.54-3.9 1.4-4.68C5.33 7.9 6.65 7.9 9.3 7.9h5.4c2.65 0 3.97 0 4.84.78.86.78 1.04 2.08 1.4 4.68l.42 3.06c.47 3.39.7 5.08-.25 6.18-.94 1.1-2.66 1.1-6.1 1.1H9.3c-3.44 0-5.16 0-6.1-1.1-.95-1.1-.72-2.79-.25-6.18l.42-3.06Z" /><path d="M8 8V6.5a4 4 0 0 1 8 0V8" /></svg>);
export const IconCheckSmall = ({ className = 'size-3', ...p }: P) => (<svg {...base(3)} className={className} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);

/** Bifa galbenă din Figma (cerc #FFCE00 cu bifă închisă), 18px. */
export function CheckDot({ className = 'size-[18px]', pop = false }: { className?: string; pop?: boolean }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full bg-brand text-ink ${pop ? 'animate-pop' : ''} ${className}`}>
      <IconCheckSmall className="size-[11px]" />
    </span>
  );
}
