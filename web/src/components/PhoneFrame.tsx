import type { ReactNode } from 'react';

// Pe desktop: ramă de telefon 390×844 (pentru proiector). Pe telefon: ecran complet.
export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full sm:flex sm:items-center sm:justify-center sm:py-8">
      <div className="relative min-h-dvh w-full overflow-hidden bg-paper sm:min-h-0 sm:h-[844px] sm:w-[390px] sm:rounded-[48px] sm:border-[10px] sm:border-ink sm:shadow-2xl">
        {children}
      </div>
    </div>
  );
}
