import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, type Catalog, type Device } from '../lib/api';
import { lei } from '../lib/format';
import { useSession } from '../lib/session';
import { IconInfo } from '../components/Icons';
import TermSheet from './TermSheet';

export default function Shop() {
  const nav = useNavigate();
  const { sku } = useParams();
  const { me, logout } = useSession();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  useEffect(() => {
    api.catalog().then(setCatalog).catch((e) => setError(e instanceof ApiError ? e.message : 'Catalogul nu s-a putut încărca.'));
  }, []);

  const device = catalog?.devices.find((d) => d.sku === sku) ?? null;
  const personalised = !!catalog?.personalised.is_personalised && !!catalog?.personalised.text;

  return (
    <div className="absolute inset-0 overflow-y-auto bg-paper">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-paper/95 px-5 pb-3 pt-12 backdrop-blur">
        <span className="text-[22px] font-extrabold tracking-tight">telvia</span>
        <span className="flex items-center gap-3 text-[14px] text-subtle">
          {me?.display_name}
          <button type="button" onClick={async () => { await logout(); nav('/login', { replace: true }); }}
            className="rounded-full bg-mist px-3 py-2 text-[14px] font-medium text-ink hover:bg-cloud">Ieși</button>
        </span>
      </header>

      <main className="flex flex-col gap-4 px-5 pb-10">
        <h1 className="text-[28px] font-bold tracking-tight">Telefoane</h1>

        {catalog && (
          <p className="flex items-center gap-2 rounded-2xl bg-mist px-4 py-3 text-[14px] font-semibold">
            <IconInfo className="size-4 shrink-0" />{catalog.ad_warning}
          </p>
        )}
        {personalised && (
          <div className="rounded-2xl bg-brand-soft px-4 py-3 text-[14px]">
            <div className="flex items-start justify-between gap-3">
              <span>{catalog!.personalised.text}</span>
              <button type="button" onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen}
                className="shrink-0 font-semibold underline underline-offset-2">De ce văd asta?</button>
            </div>
            {whyOpen && <p className="mt-2 text-[14px]">Folosim istoricul plăților facturilor tale Telvia ca să-ți arătăm ratele pentru care ești eligibil. Poți cumpăra oricând și integral.</p>}
          </div>
        )}

        {error && <p role="alert" className="rounded-2xl bg-danger-strong/10 px-4 py-3 text-[14px] text-danger-strong">{error}</p>}
        {!catalog && !error && <p className="text-[15px] text-subtle">Se încarcă produsele…</p>}

        {catalog?.devices.map((d) => <ProductCard key={d.sku} d={d} catalog={catalog} onInstallments={() => nav(`/shop/${d.sku}`)} />)}
      </main>

      {catalog && device && (
        <TermSheet catalog={catalog} device={device} personalisedShown={personalised} onClose={() => nav('/shop')} />
      )}
    </div>
  );
}

function ProductCard({ d, catalog, onInstallments }: { d: Device; catalog: Catalog; onInstallments: () => void }) {
  const product = catalog.products.find((p) => p.applies_to === d.category);
  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-cloud p-4">
      <div className="flex items-center gap-4">
        <div aria-hidden className="grid size-20 shrink-0 place-items-center rounded-2xl bg-mist">
          {d.category === 'phone'
            ? <div className="h-14 w-7 rounded-lg border-[3px] border-ink bg-[#2a2a2a]" />
            : <div className="size-9 rounded-full border-[3px] border-ink" />}
        </div>
        <div className="flex flex-col">
          <h2 className="text-[18px] font-semibold">{d.name}</h2>
          <p className="text-[20px] font-bold">{lei(d.price_lei)}</p>
          {product && <p className="text-[14px] text-subtle">{product.nominal_rate_pct === 0 ? `și în ${product.terms[0]} rate fără dobândă` : `sau în ${product.terms.join(' / ')} rate`}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="h-12 rounded-full bg-ink text-[15px] font-semibold text-paper hover:bg-graphite">Cumpără integral</button>
        <button type="button" onClick={onInstallments} disabled={!product}
          className="h-12 rounded-full bg-mist text-[15px] font-semibold hover:bg-cloud disabled:opacity-50">Plătește în rate</button>
      </div>
    </article>
  );
}
