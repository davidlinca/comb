// Clase Tailwind comune pentru back-office (focus vizibil, butoane, etichete).

export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';

export const btnBase =
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const btnQuiet = `${btnBase} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100`;

export const chip = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset';
