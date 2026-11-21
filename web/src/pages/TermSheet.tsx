// Pasul 1 · Perioada. Nimic preselectat; costul complet apare imediat după alegere.
import { useState } from 'react';
import { useLoaderData, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { lei, pct } from '../lib/format';
import type { LoaderData, termLoader } from '../loaders';
import type { SheetCtx } from '../components/SheetShell';
import {
  Btn, ErrorNote, Notice, RadioCard, Row, Rows, SheetBody, SheetFoot, SheetHeader, SheetTitle, SheetTop, TwoButtons,
} from '../components/ui';

const months = (t: number) => `${t} ${t === 1 ? 'lună' : t < 20 ? 'luni' : 'de luni'}`;

export default function TermSheet() {
  const { catalog, device, product, quotes } = useLoaderData() as LoaderData<typeof termLoader>;
  const { close } = useOutletContext<SheetCtx>();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [term, setTerm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = term ? quotes[term] : null;
  const personalisedShown = catalog.personalised.is_personalised && !!catalog.personalised.text;

  async function next() {
    if (!term) return;
    setBusy(true); setError(null);
    try {
      const res = await api.createApplication({
        sku: device.sku, product_id: product.id, term_months: term,
        // dovezi pentru jurnal: true doar pentru ce chiar s-a afișat pe ecran
        shown: { ad_warning: true, personalised_label: personalisedShown },
      });
      nav(`/a/${res.application_id}/buget`, { viewTransition: true, state: { from: pathname } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Cererea nu a putut fi creată.');
      setBusy(false);
    }
  }

  return (
    <>
      <SheetTop><SheetHeader step={0} progress={term ? 0.55 : 0.18} onClose={close} /></SheetTop>
      <SheetBody>
        <div className="flex flex-col gap-1">
          <SheetTitle>Alege perioada</SheetTitle>
          <p className="tabular text-[15px] text-muted">{device.name} · {lei(device.price_lei)}</p>
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="sr-only">În câte luni plătești</legend>
          {product.terms.map((t, i) => {
            const tq = quotes[t];
            return (
              <div key={t} className="animate-fade-up" style={{ animationDelay: `${60 + i * 50}ms` }}>
                <RadioCard name="term" value={String(t)} checked={term === t} onChange={() => setTerm(t)}
                  title={months(t)} sub={`Total ${lei(tq.total_payable_lei)}`}
                  amount={lei(tq.installment_lei)} amountSub="pe lună" />
              </div>
            );
          })}
        </fieldset>

        <div className="reveal" data-open={!!q} aria-live="polite">
          <div>
            {q && (
              <div className="rounded-[18px] border border-stroke bg-card px-4 py-1">
                <Rows>
                  <Row k="Rată lunară" v={`${lei(q.installment_lei)} × ${q.installments}`}
                    sub={q.last_installment_lei != null && q.last_installment_lei !== q.installment_lei ? `ultima: ${lei(q.last_installment_lei)}` : undefined} />
                  <Row k="Costul creditului" v={lei(q.total_cost_lei)} />
                  <Row k="DAE · dobândă fixă" v={`${pct(q.apr_pct)} · ${pct(q.nominal_rate_pct)}`} />
                  <Row k="Total de plată" v={lei(q.total_payable_lei)} strong />
                </Rows>
              </div>
            )}
          </div>
        </div>

        <Notice>
          <p className="font-semibold">{catalog.ad_warning}</p>
          <p className="mt-1 text-muted">Credit acordat de {product.lender}, prin Telvia.</p>
        </Notice>
        {error && <ErrorNote>{error}</ErrorNote>}
      </SheetBody>
      <SheetFoot>
        <TwoButtons>
          <Btn variant="secondary" onClick={close}>Nu acum</Btn>
          <Btn onClick={next} disabled={!q} loading={busy}>Continuă</Btn>
        </TwoButtons>
      </SheetFoot>
    </>
  );
}
