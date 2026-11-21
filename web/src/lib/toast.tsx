import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Toast = { id: number; text: string };
const Ctx = createContext<(text: string) => void>(() => {});

/** Notificare scurtă, anunțată de cititoarele de ecran (role=status). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number>(0);
  const show = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text });
    timer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-4 top-[calc(var(--safe-top)+10px)] z-[70] flex justify-center">
        {toast && (
          <div key={toast.id} className="flex max-w-full items-center gap-2.5 rounded-2xl bg-ink/95 px-4 py-3 text-[14px] font-medium text-paper shadow-xl ring-1 ring-white/10 backdrop-blur animate-fade-up">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-brand" />
            {toast.text}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
