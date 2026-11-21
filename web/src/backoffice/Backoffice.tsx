// Back-office (desktop): jurnalul de dovezi + coada de revizuire. Componenta e independenta de restul
// aplicatiei: primeste URL-ul API-ului, cheia publishable si o functie care da tokenul operatorului logat.

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type BackofficeConfig, createBackofficeApi } from './api';
import LedgerView from './LedgerView';
import ReviewsView from './ReviewsView';
import { btnQuiet, focusRing } from './ui';

export type BackofficeProps = BackofficeConfig & {
  operatorName?: string;
  onLogout?: () => void;
};

type Tab = 'ledger' | 'reviews';

export default function Backoffice({ apiUrl, publishableKey, getAccessToken, operatorName, onLogout }: BackofficeProps) {
  // tokenul se citeste mereu prin ref, ca un parinte care re-randeaza sa nu reporneasca incarcarile
  const tokenFn = useRef(getAccessToken);
  useLayoutEffect(() => { tokenFn.current = getAccessToken; });
  const api = useMemo(
    () => createBackofficeApi({ apiUrl, publishableKey, getAccessToken: () => tokenFn.current() }),
    [apiUrl, publishableKey],
  );

  const [tab, setTab] = useState<Tab>('ledger');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);

  const openLedger = useCallback((applicationId: string) => {
    setSelectedId(applicationId);
    setTab('ledger');
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ledger', label: 'Jurnal de dovezi' },
    { id: 'reviews', label: 'Revizuiri' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Back-office rate</h1>
            <p className="text-sm text-slate-600">Dovezile pentru fiecare cerere si deciziile care au nevoie de un om.</p>
          </div>
          <div className="flex items-center gap-3">
            {operatorName && <span className="text-sm text-slate-600">{operatorName}</span>}
            {onLogout && <button type="button" className={btnQuiet} onClick={onLogout}>Iesi din cont</button>}
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-6" aria-label="Sectiuni back-office">
          <div role="tablist" className="flex gap-1">
            {tabs.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`bo-tab-${t.id}`}
                  aria-selected={active}
                  aria-controls={`bo-panel-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${focusRing} ${active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  {t.label}
                  {t.id === 'reviews' && pending !== null && pending > 0 && (
                    <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold text-white" aria-label={`${pending} in asteptare`}>
                      {pending}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Ambele sectiuni raman montate: coada se actualizeaza si cand esti pe jurnal. */}
        <div role="tabpanel" id="bo-panel-ledger" aria-labelledby="bo-tab-ledger" hidden={tab !== 'ledger'}>
          <LedgerView api={api} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div role="tabpanel" id="bo-panel-reviews" aria-labelledby="bo-tab-reviews" hidden={tab !== 'reviews'}>
          <ReviewsView api={api} onOpenLedger={openLedger} onPendingCount={setPending} />
        </div>
      </main>
    </div>
  );
}
