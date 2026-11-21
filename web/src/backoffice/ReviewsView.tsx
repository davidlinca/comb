// Coada de revizuire umana (art. 18(8)): operatorul vede decizia automata, motivele si cifrele,
// apoi aproba sau respinge cu o nota. Coada se actualizeaza singura la 10 secunde (pentru demo).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackofficeApi, Review } from './api';
import { DECISION_LABEL, fmtDateShort, fmtLei, fmtPct, fmtTime, productLabel, STATUS_LABEL, statusTone } from './format';
import { ErrorNote } from './LedgerView';
import { btnBase, btnQuiet, chip, focusRing } from './ui';

const POLL_MS = 10_000;

type Props = {
  api: BackofficeApi;
  onOpenLedger: (applicationId: string) => void;
  onPendingCount: (n: number) => void;
};

export default function ReviewsView({ api, onOpenLedger, onPendingCount }: Props) {
  const [which, setWhich] = useState<'pending' | 'all'>('pending');
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(0); // rezolvari in curs: nu reincarcam peste ele

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const { reviews: r } = await api.reviews(which);
      setReviews(r);
      setError(null);
      setLoadedAt(new Date());
      onPendingCount(r.filter((x) => x.status === 'pending').length);
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : 'Coada nu s-a putut incarca.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [api, which, onPendingCount]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && busy.current === 0) void load(true);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const onResolved = useCallback(async (text: string) => {
    setNotice(text);
    await load(true);
  }, [load]);

  return (
    <section aria-labelledby="bo-reviews">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="bo-reviews" className="text-base font-semibold text-slate-900">
            {which === 'pending' ? 'Cereri care asteapta un om' : 'Toate revizuirile recente'}
          </h2>
          <p className="text-sm text-slate-600">
            Clientul a cerut revizuirea sau motorul a trimis cererea aici. Decizia ta inlocuieste decizia automata.
            {loadedAt && ` Actualizat la ${fmtTime(loadedAt)}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className={`h-4 w-4 rounded border-slate-400 ${focusRing}`}
              checked={which === 'all'}
              onChange={(e) => { setNotice(null); setWhich(e.target.checked ? 'all' : 'pending'); }}
            />
            Arata si revizuirile rezolvate
          </label>
          <button type="button" className={btnQuiet} onClick={() => void load()} disabled={loading}>
            {loading ? 'Se incarca…' : 'Reincarca'}
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>
      )}
      {error && <ErrorNote text={error} />}

      {reviews && reviews.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-sm text-slate-600">
          Nicio cerere nu asteapta revizuire. Cererile noi apar aici automat.
        </p>
      )}

      <div className="space-y-4">
        {reviews?.map((r) => (
          <ReviewCase
            key={r.review_id}
            review={r}
            api={api}
            busy={busy}
            onOpenLedger={onOpenLedger}
            onResolved={onResolved}
          />
        ))}
      </div>
    </section>
  );
}

type CaseProps = {
  review: Review;
  api: BackofficeApi;
  busy: { current: number };
  onOpenLedger: (applicationId: string) => void;
  onResolved: (text: string) => Promise<void>;
};

function ReviewCase({ review: r, api, busy, onOpenLedger, onResolved }: CaseProps) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const a = r.assessment;
  const name = r.customer?.display_name ?? 'Client necunoscut';
  const pending = r.status === 'pending';

  async function resolve(status: 'approved' | 'rejected') {
    setSending(status);
    setError(null);
    busy.current += 1;
    try {
      await api.resolveReview(r.review_id, status, note);
      await onResolved(`Cererea lui ${name} a fost ${status === 'approved' ? 'aprobata' : 'respinsa'}. Clientul vede decizia in aplicatie.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decizia nu s-a putut salva.');
    } finally {
      busy.current -= 1;
      setSending(null);
    }
  }

  return (
    <article className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-4">
        <header>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
            {r.customer && (
              <span className="text-sm text-slate-500">
                {r.customer.code}, {r.customer.segment === 'postpaid' ? `abonat de ${r.customer.tenure_months} luni` : 'prepaid, fara istoric de facturi'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600">
            {r.requested_by === 'customer' ? 'Clientul a cerut revizuirea' : 'Motorul a trimis cererea la revizuire'} pe {fmtDateShort(r.requested_at)}.
            {' '}{productLabel(r.application.sku, r.application.product_id, r.application.term_months)}: credit {fmtLei(r.application.principal_lei)}, rata {fmtLei(r.application.installment_lei)} pe luna.
          </p>
        </header>

        {a && (
          <div>
            <p className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className={`${chip} ${statusTone(a.decision === 'manual_review' ? 'manual_review' : a.decision)}`}>
                {DECISION_LABEL[a.decision] ?? a.decision}
              </span>
              {!a.billing_history_used && <span className="text-slate-500">Istoricul facturilor nu a fost folosit.</span>}
              {a.bank_data_used
                ? <span className="text-slate-500">Venit verificat prin Open Banking (simulat).</span>
                : <span className="font-medium text-amber-800">Venit neverificat: cere un document (fluturas, extras de cont).</span>}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
              {a.reasons.map((x) => <li key={x.code}>{x.text}</li>)}
            </ul>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Metric label="Grad de indatorare" value={fmtPct(a.dti_pct)} hint="limita 40%" />
              <Metric label="Ramane dupa rate" value={fmtLei(a.residual_lei)} hint="sub 500 lei: revizuire" />
              <Metric label="Facturi intarziate" value={a.late_bills_12m == null ? 'fara istoric' : String(a.late_bills_12m)} hint="peste 30 de zile, 12 luni" />
              <Metric
                label="Venit net folosit"
                value={fmtLei(a.income_used_lei ?? a.net_income_lei)}
                hint={`declarat ${fmtLei(a.net_income_lei)}, banca ${a.income_verified_lei == null ? 'neverificat' : fmtLei(a.income_verified_lei)}`}
              />
              <Metric
                label="Cheltuieli folosite"
                value={fmtLei(a.expenses_used_lei ?? a.monthly_expenses_lei)}
                hint={`declarat ${fmtLei(a.monthly_expenses_lei)}, banca ${a.expenses_verified_lei == null ? 'neverificat' : fmtLei(a.expenses_verified_lei)}`}
              />
              <Metric
                label="Alte rate folosite"
                value={fmtLei(a.other_installments_used_lei)}
                hint={`declarat ${fmtLei(a.other_installments_declared_lei)}, Birou ${fmtLei(a.other_installments_bureau_lei)}${a.other_installments_bank_lei == null ? '' : `, banca ${fmtLei(a.other_installments_bank_lei)}`}`}
              />
            </dl>
          </div>
        )}

        {r.customer_message && (
          <figure className="rounded-xl bg-slate-50 px-4 py-3">
            <figcaption className="text-xs text-slate-500">Mesajul clientului</figcaption>
            <blockquote className="text-sm text-slate-900">„{r.customer_message}”</blockquote>
          </figure>
        )}

        <button
          type="button"
          onClick={() => onOpenLedger(r.application.application_id)}
          className={`text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900 ${focusRing}`}
        >
          Vezi jurnalul cererii
        </button>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        {pending ? (
          <>
            <label htmlFor={`note-${r.review_id}`} className="text-sm font-medium text-slate-800">Nota pentru dosar (optional)</label>
            <textarea
              id={`note-${r.review_id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="De ce ai decis asa"
              className={`w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 ${focusRing}`}
            />
            <p className="text-xs text-slate-500">{note.length}/1000. Nota ramane intern; in jurnal se salveaza doar ca exista.</p>
            {error && <ErrorNote text={error} />}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={sending !== null}
                onClick={() => void resolve('approved')}
                className={`${btnBase} bg-emerald-700 text-white hover:bg-emerald-800`}
              >
                {sending === 'approved' ? 'Se salveaza…' : 'Aproba'}
              </button>
              <button
                type="button"
                disabled={sending !== null}
                onClick={() => void resolve('rejected')}
                className={`${btnBase} border-2 border-red-700 bg-white text-red-800 hover:bg-red-50`}
              >
                {sending === 'rejected' ? 'Se salveaza…' : 'Respinge'}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2 text-sm">
            <span className={`${chip} ${statusTone(r.status)}`}>
              {r.status === 'approved' ? 'Aprobata de operator' : 'Respinsa de operator'}
            </span>
            {r.resolved_at && <p className="text-slate-600">Rezolvata pe {fmtDateShort(r.resolved_at)}.</p>}
            <p className="text-slate-600">Cererea e acum: {STATUS_LABEL[r.application.status] ?? r.application.status}.</p>
            {r.operator_note && <p className="text-slate-800">Nota: {r.operator_note}</p>}
          </div>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
      {hint && <dd className="text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}
