// Jurnalul de dovezi: lista ultimelor cereri (cu verificarea lantului) si, pentru cererea aleasa,
// lantul de intrari: fiecare hash include intrarea anterioara, deci o modificare ascunsa rupe lantul.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackofficeApi, LedgerDetail, LedgerEntry, LedgerList } from './api';
import {
  ACTOR_LABEL, fmtDateShort, fmtDateTime, fmtTime, legalRef, productLabel, shortHash, STATUS_LABEL, statusTone,
} from './format';
import { btnQuiet, chip, focusRing } from './ui';

const GENESIS = '0'.repeat(64);

type Props = { api: BackofficeApi; selectedId: string | null; onSelect: (applicationId: string) => void };

export default function LedgerView({ api, selectedId, onSelect }: Props) {
  const [list, setList] = useState<LedgerList | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detail, setDetail] = useState<LedgerDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const lastRequest = useRef(0);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      setList(await api.ledgerList());
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Lista nu s-a putut incarca.');
    } finally {
      setListLoading(false);
    }
  }, [api]);

  const loadDetail = useCallback(async (applicationId: string) => {
    const req = ++lastRequest.current;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const d = await api.ledgerDetail(applicationId);
      if (req !== lastRequest.current) return; // a fost aleasa intre timp alta cerere
      setDetail(d);
      setCheckedAt(new Date());
    } catch (e) {
      if (req !== lastRequest.current) return;
      setDetail(null);
      setDetailError(e instanceof Error ? e.message : 'Jurnalul nu s-a putut incarca.');
    } finally {
      if (req === lastRequest.current) setDetailLoading(false);
    }
  }, [api]);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => {
    if (!selectedId && list?.applications.length) onSelect(list.applications[0].application_id);
  }, [list, selectedId, onSelect]);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId, loadDetail]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
      <section aria-labelledby="bo-ledger-list" className="min-w-0">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="bo-ledger-list" className="text-base font-semibold text-slate-900">Ultimele cereri</h2>
            {list && (
              <p className={`text-sm ${list.all_valid ? 'text-emerald-800' : 'text-red-700'}`}>
                {list.all_valid
                  ? `Toate cele ${list.count} jurnale sunt intacte.`
                  : `${list.applications.filter((a) => !a.ledger.valid).length} din ${list.count} jurnale au lantul rupt.`}
              </p>
            )}
          </div>
          <button type="button" className={btnQuiet} onClick={() => void loadList()} disabled={listLoading}>
            {listLoading ? 'Se incarca…' : 'Reincarca'}
          </button>
        </div>

        {listError && <ErrorNote text={listError} />}
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {list?.applications.map((a) => {
            const selected = a.application_id === selectedId;
            return (
              <li key={a.application_id}>
                <button
                  type="button"
                  onClick={() => onSelect(a.application_id)}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left ${focusRing} ${selected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                >
                  <span
                    aria-label={a.ledger.valid ? 'Jurnal intact' : 'Jurnal rupt'}
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${a.ledger.valid ? 'bg-emerald-700' : 'bg-red-700'}`}
                  >
                    {a.ledger.valid ? '✓' : '!'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-900">{a.customer?.display_name ?? 'Client necunoscut'}</span>
                      <span className={`${chip} ${statusTone(a.status)}`}>{STATUS_LABEL[a.status] ?? a.status}</span>
                    </span>
                    <span className="block text-sm text-slate-600">
                      {productLabel(a.sku, a.product_id, a.term_months)}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {fmtDateShort(a.created_at)}, {a.ledger.entries} {a.ledger.entries === 1 ? 'intrare' : 'intrari'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {list && list.applications.length === 0 && (
            <li className="px-4 py-6 text-sm text-slate-600">Inca nu exista cereri. Ele apar aici dupa primul „Vreau in rate”.</li>
          )}
        </ul>
      </section>

      <section aria-labelledby="bo-ledger-detail" className="min-w-0">
        <h2 id="bo-ledger-detail" className="sr-only">Jurnalul cererii alese</h2>
        {detailError && <ErrorNote text={detailError} />}
        {!detail && !detailError && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-sm text-slate-600">
            {detailLoading ? 'Se verifica jurnalul…' : 'Alege o cerere din lista ca sa vezi dovezile ei.'}
          </p>
        )}
        {detail && (
          <div className={detailLoading ? 'opacity-60 transition-opacity' : undefined}>
            <ApplicationHeader detail={detail} />
            <Seal detail={detail} checkedAt={checkedAt} busy={detailLoading} onRecheck={() => void loadDetail(detail.application.application_id)} />
            <Chain entries={detail.entries} firstInvalid={detail.first_invalid_seq} />
          </div>
        )}
      </section>
    </div>
  );
}

function ApplicationHeader({ detail }: { detail: LedgerDetail }) {
  const a = detail.application;
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <p className="text-xl font-semibold text-slate-900">
          {a.customer?.display_name ?? 'Client necunoscut'}
          {a.customer && <span className="ml-2 text-sm font-normal text-slate-500">{a.customer.code}</span>}
        </p>
        <p className="text-sm text-slate-600">
          {productLabel(a.sku, a.product_id, a.term_months)}. Cerere din {fmtDateTime(a.created_at)}.
        </p>
      </div>
      <span className={`${chip} ${statusTone(a.status)}`}>{STATUS_LABEL[a.status] ?? a.status}</span>
    </div>
  );
}

function Seal({ detail, checkedAt, busy, onRecheck }: { detail: LedgerDetail; checkedAt: Date | null; busy: boolean; onRecheck: () => void }) {
  const ok = detail.valid;
  return (
    <div
      role="status"
      className={`mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-2 p-5 ${ok ? 'border-emerald-700 bg-emerald-50' : 'border-red-700 bg-red-50'}`}
    >
      <span
        aria-hidden="true"
        className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 border-double text-2xl font-bold ${ok ? 'border-emerald-700 text-emerald-800' : 'border-red-700 text-red-800'}`}
      >
        {ok ? '✓' : '!'}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-lg font-semibold ${ok ? 'text-emerald-900' : 'text-red-900'}`}>
          {ok ? 'Jurnal verificat' : 'Jurnal compromis'}
        </p>
        <p className={`text-sm ${ok ? 'text-emerald-900' : 'text-red-900'}`}>
          {ok
            ? `${detail.entries_count} ${detail.entries_count === 1 ? 'intrare' : 'intrari'}. Fiecare hash SHA-256 include intrarea anterioara, iar lantul e intact.`
            : `Lantul se rupe la intrarea #${detail.first_invalid_seq}: continutul nu mai corespunde cu ce s-a scris initial.`}
          {checkedAt && ` Verificat de server la ${fmtTime(checkedAt)}.`}
        </p>
      </div>
      <button type="button" className={btnQuiet} onClick={onRecheck} disabled={busy}>
        {busy ? 'Se verifica…' : 'Verifica din nou'}
      </button>
    </div>
  );
}

function Chain({ entries, firstInvalid }: { entries: LedgerEntry[]; firstInvalid: number | null }) {
  if (!entries.length) return <p className="text-sm text-slate-600">Cererea nu are inca intrari in jurnal.</p>;
  return (
    <ol className="relative">
      {entries.map((e, i) => {
        const expectedPrev = i === 0 ? GENESIS : entries[i - 1].hash;
        const broken = (firstInvalid !== null && e.seq >= firstInvalid) || e.prev_hash !== expectedPrev;
        return <ChainItem key={e.seq} entry={e} first={i === 0} last={i === entries.length - 1} broken={broken} />;
      })}
    </ol>
  );
}

function ChainItem({ entry: e, first, last, broken }: { entry: LedgerEntry; first: boolean; last: boolean; broken: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = legalRef(e.ccd2_ref);
  const hasPayload = Object.keys(e.payload ?? {}).length > 0;
  return (
    <li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 pb-3">
      {!last && (
        <span aria-hidden="true" className={`absolute left-[1.2rem] top-9 bottom-0 w-0.5 ${broken ? 'bg-red-300' : 'bg-emerald-300'}`} />
      )}
      <span
        className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 bg-white text-sm font-semibold tabular-nums ${broken ? 'border-red-600 text-red-700' : 'border-emerald-700 text-emerald-800'}`}
        aria-label={`Intrarea ${e.seq}`}
      >
        {e.seq}
      </span>
      <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-medium text-slate-900">{e.description ?? e.event}</p>
          <span className="flex items-center gap-2">
            {ref && <span className={`${chip} bg-sky-50 text-sky-900 ring-sky-200`}>{ref}</span>}
            <span className="text-xs text-slate-600">{ACTOR_LABEL[e.actor] ?? e.actor}</span>
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{fmtDateTime(e.at)}</span>
            <span>hash <span className="font-mono text-slate-900" title={e.hash}>{shortHash(e.hash)}</span></span>
            <span className={broken ? 'font-semibold text-red-700' : undefined}>
              {first
                ? 'inceputul lantului'
                : <>legat de <span className="font-mono" title={e.prev_hash}>{shortHash(e.prev_hash)}</span>{broken && ' (nu se potriveste)'}</>}
            </span>
          </span>
          {hasPayload && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={`rounded px-1 text-slate-600 underline underline-offset-2 hover:text-slate-900 ${focusRing}`}
            >
              {open ? 'Ascunde ce s-a salvat' : 'Ce s-a salvat'}
            </button>
          )}
        </div>
        {open && (
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-[0.75rem] leading-relaxed text-slate-800">
            <span className="text-slate-500">{e.event}</span>{'\n'}{JSON.stringify(e.payload, null, 2)}
          </pre>
        )}
      </div>
    </li>
  );
}

export function ErrorNote({ text }: { text: string }) {
  return <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{text}</p>;
}
