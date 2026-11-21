import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, type Catalog, type Device, type Quote } from '../lib/api';
import { lei, pct } from '../lib/format';
import { Btn, ErrorNote, Sheet, SheetHeader } from '../components/ui';
import { IconInfo } from '../components/Icons';

type Props = { catalog: Catalog; device: Device; personalisedShown: boolean; onClose: () => void };

export default function TermSheet({ catalog, device, personalisedShown, onClose }: Props) {
  const nav = useNavigate();
  const product = catalog.products.find((p) => p.applies_to === device.category)!;
  const [quotes, setQuotes] = useState<Record<number, Quote>>({});
  const [term, setTerm] = useState<number | null>(null); // nimic preselectat
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(product.terms.map((t) => api.quote({ sku: device.sku, product_id: product.id, term_months: t }).then((q) => [t, q] as const)))
      .then((pairs) => { if (alive) setQuotes(Object.fromEntries(pairs)); })
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Nu am putut calcula ratele.'));
    return () => { alive = false; };
  }, [device.sku, product.id]);

  const q = term ? quotes[term] : null;

  async function next() {
    if (!term) return;
    setBusy(true); setError(null);
    try {
      const res = await api.createApplication({
        sku: device.sku, product_id: product.id, term_months: term,
        // dovezi pentru jurnal: true doar pentru ce chiar s-a afișat pe ecran (art. 8 și 13)
        shown: { ad_warning: true, personalised_label: personalisedShown },
      });
      nav(`/a/${res.application_id}/buget`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Cererea nu a putut fi creată.');
      setBusy(false);
    }
  }

  return (
    <Sheet label="Alege perioada">
      <SheetHeader step={0} onClose={onClose} />
      <div className="flex flex-col gap-1">
        <h2 className="text-[26px] font-bold tracking-tight">Alege perioada</h2>
        <p className="text-[15px] text-muted">{device.name} · {lei(device.price_lei)}</p>
      </div>

      <div role="radiogroup" aria-label="Numărul de rate" className="flex flex-col gap-2.5">
        {product.terms.map((t) => {
          const tq = quotes[t];
          const on = term === t;
          return (
            <button key={t} type="button" role="radio" aria-checked={on} onClick={() => setTerm(t)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${on ? 'border-paper bg-paper text-ink' : 'border-line bg-field hover:border-muted'}`}>
              <span className="flex flex-1 flex-col">
                <span className="text-[16px] font-semibold">{t} {t === 1 ? 'rată' : t < 20 ? 'rate' : 'de rate'}</span>
                <span className={`text-[14px] ${on ? 'text-subtle' : 'text-muted'}`}>{tq ? `Total ${lei(tq.total_payable_lei)}` : 'Se calculează…'}</span>
              </span>
              {tq && <span className="text-right"><span className="block text-[18px] font-bold">{lei(tq.installment_lei)}</span><span className={`text-[13px] ${on ? 'text-subtle' : 'text-muted'}`}>pe lună</span></span>}
            </button>
          );
        })}
      </div>

      {q ? (
        <dl className="rounded-2xl bg-field px-4 py-1 text-[15px]">
          <Row k="Rată lunară" v={`${lei(q.installment_lei)} × ${q.installments}`} />
          <Row k="Costul creditului" v={lei(q.total_cost_lei)} />
          <Row k="DAE · dobândă fixă" v={`${pct(q.apr_pct)} · ${pct(q.nominal_rate_pct)}`} />
          <Row k="Total de plată" v={lei(q.total_payable_lei)} strong last />
        </dl>
      ) : (
        <p className="text-[14px] text-muted">Alege o variantă ca să vezi costul complet.</p>
      )}

      <p className="flex gap-2.5 text-[14px] leading-snug">
        <IconInfo className="mt-0.5 size-4 shrink-0" />
        <span><b>{catalog.ad_warning}</b><span className="block text-muted">Credit acordat de {product.lender}, prin Telvia.</span></span>
      </p>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="mt-auto grid grid-cols-2 gap-2.5">
        <Btn variant="secondary" onClick={onClose}>Nu acum</Btn>
        <Btn onClick={next} disabled={!term || !q} loading={busy}>Continuă</Btn>
      </div>
    </Sheet>
  );
}

function Row({ k, v, strong, last }: { k: string; v: string; strong?: boolean; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-2.5 ${last ? '' : 'border-b border-line'}`}>
      <dt className={strong ? 'font-semibold' : 'text-muted'}>{k}</dt>
      <dd className={strong ? 'font-bold' : 'font-medium'}>{v}</dd>
    </div>
  );
}
