// Magazinul din aplicația Telvia. Rămâne afișat (inert) sub sheet-urile fluxului de rate.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLoaderData, useMatches, useNavigate, useNavigation, useRouteLoaderData } from 'react-router-dom';
import type { Catalog, CurrentApplication, Device } from '../lib/api';
import { lei } from '../lib/format';
import { signOut } from '../lib/session';
import { useToast } from '../lib/toast';
import { rememberOrigin } from '../lib/motion';
import type { currentLoader, LoaderData, shopLoader } from '../loaders';
import { IconAlert, IconArrowRight, IconBag, IconChevronDown } from '../components/Icons';
import { Spinner, cx } from '../components/ui';

export default function Shop() {
  const { me, catalog } = useLoaderData() as LoaderData<typeof shopLoader>;
  const nav = useNavigate();
  const navigation = useNavigation();
  const toast = useToast();
  const sheetOpen = useMatches().some((m) => typeof (m.handle as { step?: number } | undefined)?.step === 'number');
  const pendingSku = navigation.location?.pathname.match(/^\/shop\/([^/]+)$/)?.[1];
  const [whyOpen, setWhyOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(sheetOpen);

  // la închiderea sheet-ului, focusul revine pe butonul care l-a deschis (produsul sau cardul „Cererea ta”)
  useEffect(() => {
    if (wasOpen.current && !sheetOpen && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
    wasOpen.current = sheetOpen;
  }, [sheetOpen]);
  // cardul „Cererea ta”: se reîmprospătează la fiecare întoarcere în magazin, fără să întârzie închiderea
  // sheet-ului (loaderul nu așteaptă răspunsul); între timp rămâne afișată varianta anterioară
  const live = useRouteLoaderData('shop-home') as LoaderData<typeof currentLoader> | undefined;
  const [current, setCurrent] = useState<CurrentApplication | null>(live?.initial ?? null);
  useEffect(() => {
    if (!live) return;
    if (live.initial !== undefined) { setCurrent(live.initial); return; }
    let alive = true;
    void live.current.then((a) => { if (alive) setCurrent(a); });
    return () => { alive = false; };
  }, [live]);
  // cardul apare / dispare cu înălțime animată (produsele alunecă, nu sar); păstrăm ultimul conținut cât se strânge
  const [shown, setShown] = useState(current);
  if (current && current !== shown) setShown(current);
  // dacă locul cardului e deasupra zonei vizibile (ai derulat), conținutul rămâne pe loc: compensăm derularea
  const slot = useRef<HTMLDivElement>(null);
  const slotH = useRef(0);
  const hasCard = !!current;
  useLayoutEffect(() => {
    const el = slot.current, sc = el?.closest<HTMLElement>('.overflow-y-auto');
    if (!el || !sc) return;
    const before = slotH.current;
    const header = sc.querySelector('header')?.offsetHeight ?? 0;
    if (el.getBoundingClientRect().top < sc.getBoundingClientRect().top + header) {
      el.style.transition = 'none';
      const after = el.offsetHeight; // fără tranziție: înălțimea finală, imediat
      sc.scrollTop += after - before;
      requestAnimationFrame(() => { el.style.transition = ''; });
    }
    slotH.current = hasCard ? (el.firstElementChild as HTMLElement | null)?.scrollHeight ?? 0 : 0;
  }, [hasCard]);
  // deschiderea unui sheet: fără view transition (sheet-ul urcă prin CSS), cu punctul de întoarcere reținut
  const open = (to: string, from: HTMLElement) => { trigger.current = from; rememberOrigin(); nav(to); };
  const openTerms = (d: Device, from: HTMLElement) => open(`/shop/${d.sku}`, from);

  const personalised = catalog.personalised.is_personalised && !!catalog.personalised.text;
  const phones = catalog.devices.filter((d) => d.category === 'phone');
  const accessories = catalog.devices.filter((d) => d.category === 'accessory');
  const first = me.display_name?.split(' ')[0] ?? '';

  return (
    <>
      <div inert={sheetOpen} className="absolute inset-0 flex flex-col bg-paper">
        {/* fără ancorarea automată a browserului: o facem noi pentru cardul „Cererea ta” (vezi mai sus) */}
        <div className="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-paper/90 px-5 pb-3 pt-[calc(var(--safe-top)+10px)] backdrop-blur-md">
            <span className="text-[22px] font-extrabold tracking-[-0.04em]">telvia</span>
            <span className="flex items-center gap-2">
              <span aria-hidden className="grid size-9 place-items-center rounded-full bg-brand text-[15px] font-bold">{first[0]}</span>
              <button type="button" onClick={async () => { await signOut(); nav('/login', { replace: true, viewTransition: true }); }}
                className="h-11 rounded-full px-3.5 text-[14px] font-semibold text-ink transition-colors hover:bg-mist">
                Ieși <span className="sr-only">din contul {me.display_name}</span>
              </button>
            </span>
          </header>

          <main className="flex flex-col gap-5 px-5 pb-8 pt-2">
            <div className="flex flex-col gap-1 animate-fade-up">
              <p className="text-[15px] text-subtle">Bună, {first}</p>
              <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em]">Magazin</h1>
              {me.plan_name && <p className="text-[14px] text-subtle">{me.plan_name}{me.tenure_months ? ` · client de ${me.tenure_months} de luni` : ''}</p>}
            </div>

            {personalised && (
              <section aria-label="Ofertă personalizată" className="rounded-[20px] bg-brand-wash px-4 py-3.5 text-[14px] leading-snug animate-fade-up [animation-delay:60ms]">
                <p className="font-medium">{catalog.personalised.text}</p>
                <button type="button" onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen} aria-controls="why-personal"
                  className="-mx-1 mt-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 font-semibold underline underline-offset-4">
                  De ce văd asta?
                  <IconChevronDown className={cx('size-4 transition-transform duration-300', whyOpen && 'rotate-180')} />
                </button>
                <div id="why-personal" className="reveal" data-open={whyOpen} inert={!whyOpen}>
                  <div><p className="pt-1 text-subtle">Folosim istoricul plăților facturilor tale Telvia ca să-ți arătăm ratele pentru care ești eligibil. Poți cumpăra oricând și integral.</p></div>
                </div>
              </section>
            )}

            <div ref={slot} className="reveal -mt-5" data-open={hasCard} inert={!hasCard}>
              <div>{shown && <div className="pt-5"><CurrentCard a={shown} onOpen={open} pendingPath={navigation.location?.pathname} /></div>}</div>
            </div>

            <Section title="Telefoane" items={phones} catalog={catalog} pendingSku={pendingSku}
              onInstallments={openTerms}
              onBuy={() => toast('Plata integrală nu face parte din demo.')} />
            {accessories.length > 0 && (
              <Section title="Accesorii" items={accessories} catalog={catalog} pendingSku={pendingSku}
                onInstallments={openTerms}
                onBuy={() => toast('Plata integrală nu face parte din demo.')} />
            )}

            <p className="flex items-center gap-2 text-[13px] text-subtle">
              <IconAlert className="size-4 shrink-0" />{catalog.ad_warning}
            </p>
          </main>
        </div>
        <TabBar onOther={() => toast('În demo, doar Magazinul e activ.')} />
      </div>
      <Outlet />
    </>
  );
}

/** Cardul „Cererea ta”: ultima cerere neîncheiată și drumul înapoi la pasul potrivit (contract v0.5, ruta 6c). */
function CurrentCard({ a, onOpen, pendingPath }: { a: CurrentApplication; onOpen: (to: string, from: HTMLElement) => void; pendingPath?: string }) {
  const id = a.application_id;
  const v = ({
    consents: { chip: 'Neterminată', cta: 'Continuă', to: `/a/${id}/buget`, tone: 'quiet' },
    assessment: { chip: 'Neterminată', cta: 'Continuă', to: `/a/${id}/buget`, tone: 'quiet' },
    wait_review: { chip: 'În analiză', cta: 'Vezi stadiul', to: `/a/${id}/rezultat`, tone: 'outline' },
    secci: { chip: 'Aprobată', cta: 'Vezi oferta', to: `/a/${id}/oferta`, tone: 'brand' },
    sign: { chip: 'Aprobată', cta: 'Vezi oferta', to: `/a/${id}/oferta`, tone: 'brand' },
    agreement: a.agreement_id ? { chip: 'Contract activ', cta: 'Vezi contractul', to: `/c/${a.agreement_id}`, tone: 'brand' } : null,
  } as Record<string, { chip: string; cta: string; to: string; tone: string } | null>)[a.next_step];
  if (!v) return null;
  const pending = pendingPath === v.to;
  return (
    <section aria-labelledby="current-title" className="on-dark flex flex-col gap-3.5 rounded-[22px] bg-ink p-4 text-paper animate-fade-up [animation-delay:80ms]">
      <div className="flex items-center justify-between gap-3">
        <h2 id="current-title" className="text-[14px] font-medium text-muted">Cererea ta</h2>
        <span className={cx('rounded-full px-2.5 py-1 text-[12px] font-semibold',
          v.tone === 'brand' ? 'bg-brand text-ink' : v.tone === 'outline' ? 'border border-brand/70 text-brand' : 'bg-graphite text-paper')}>
          {v.chip}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[18px] font-semibold leading-tight">{a.device_name}</p>
        <p className="tabular text-[14px] text-muted">{a.installments} × {lei(a.installment_lei)} · total {lei(a.total_payable_lei)}</p>
      </div>
      <button type="button" onClick={(e) => onOpen(v.to, e.currentTarget)} aria-busy={pending || undefined}
        className="group relative flex h-[46px] items-center justify-center gap-1.5 rounded-full bg-paper text-[15px] font-semibold text-ink transition-[background-color,transform] duration-200 hover:bg-cloud active:scale-[0.98]">
        <span className={cx('inline-flex items-center gap-1.5 transition-opacity', pending && 'opacity-0')}>
          {v.cta}<IconArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
        {pending && <Spinner className="absolute inset-0 m-auto size-5" />}
      </button>
    </section>
  );
}

function Section({ title, items, catalog, pendingSku, onInstallments, onBuy }: {
  title: string; items: Device[]; catalog: Catalog; pendingSku?: string; onInstallments: (d: Device, from: HTMLElement) => void; onBuy: () => void;
}) {
  return (
    <section aria-labelledby={`sec-${title}`} className="flex flex-col gap-3">
      <h2 id={`sec-${title}`} className="text-[18px] font-bold">{title}</h2>
      <div className="grid gap-3">
        {items.map((d, i) => (
          <ProductCard key={d.sku} d={d} i={i} catalog={catalog} pending={pendingSku === d.sku} onInstallments={(el) => onInstallments(d, el)} onBuy={onBuy} />
        ))}
      </div>
    </section>
  );
}

const TONES = ['#2b2b2e', '#d9d4cc', '#3a4a5c', '#e7d9c4'];

function ProductCard({ d, i, catalog, pending, onInstallments, onBuy }: {
  d: Device; i: number; catalog: Catalog; pending: boolean; onInstallments: (from: HTMLElement) => void; onBuy: () => void;
}) {
  const product = catalog.products.find((p) => p.applies_to === d.category);
  const terms = product?.terms ?? [];
  const tone = TONES[i % TONES.length];
  return (
    <article aria-labelledby={`p-${d.sku}`} style={{ animationDelay: `${100 + i * 70}ms` }}
      className="flex flex-col gap-4 rounded-[24px] border border-cloud p-4 animate-fade-up">
      <div className="flex items-center gap-4">
        <div aria-hidden className="grid h-[104px] w-[88px] shrink-0 place-items-center rounded-[18px] bg-mist">
          {d.category === 'phone' ? <PhoneArt tone={tone} /> : <AccessoryArt />}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={`p-${d.sku}`} className="text-[18px] font-semibold leading-tight">{d.name}</h3>
          <p className="tabular text-[20px] font-bold">{lei(d.price_lei)}</p>
          {product && (
            <p className="text-[14px] text-subtle">
              {product.nominal_rate_pct === 0 ? `sau în ${terms[0]} rate fără dobândă` : `sau în rate, pe ${terms.join(' ori ')} luni`}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onBuy}
          className="h-[46px] rounded-full bg-ink text-[15px] font-semibold text-paper transition-[background-color,transform] duration-200 hover:bg-graphite active:scale-[0.97]">
          Cumpără integral
        </button>
        <button type="button" onClick={(e) => onInstallments(e.currentTarget)} disabled={!product} aria-busy={pending || undefined} data-installments={d.sku}
          className="relative h-[46px] rounded-full bg-mist text-[15px] font-semibold transition-[background-color,transform] duration-200 hover:bg-cloud active:scale-[0.97] disabled:opacity-50">
          <span className={cx('transition-opacity', pending && 'opacity-0')}>Plătește în rate</span>
          {pending && <Spinner className="absolute inset-0 m-auto size-5" />}
        </button>
      </div>
    </article>
  );
}

function PhoneArt({ tone }: { tone: string }) {
  return (
    <span className="relative block h-[80px] w-[40px] rounded-[11px] p-[3px] shadow-[0_6px_14px_-6px_rgb(0_0_0/0.45)]" style={{ background: tone }}>
      <span className="block h-full w-full rounded-[8px] bg-[linear-gradient(160deg,#ffe36b_0%,#ffce00_35%,#f2a900_100%)]" />
      <span className="absolute left-1/2 top-[6px] h-[4px] w-[12px] -translate-x-1/2 rounded-full bg-black/80" />
    </span>
  );
}
function AccessoryArt() {
  return (
    <span className="relative block size-[54px] rounded-[18px] bg-paper shadow-[0_6px_14px_-6px_rgb(0_0_0/0.35)]">
      <span className="absolute inset-x-[14px] top-[10px] h-[3px] rounded-full bg-cloud" />
      <span className="absolute bottom-[10px] left-1/2 size-[8px] -translate-x-1/2 rounded-full bg-brand" />
    </span>
  );
}

/** Bara de jos a aplicației operatorului (contextul în care trăiește Comb). */
function TabBar({ onOther }: { onOther: () => void }) {
  const tabs = [
    { t: 'Acasă', d: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z' },
    { t: 'Magazin', active: true },
    { t: 'Facturi', d: 'M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 8h6M9 12h6' },
    { t: 'Cont', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0' },
  ];
  return (
    <nav aria-label="Aplicația Telvia" className="shrink-0 border-t border-cloud bg-paper/95 pb-[calc(var(--safe-bottom)+2px)] backdrop-blur-md">
      <ul className="grid grid-cols-4">
        {tabs.map((t) => (
          <li key={t.t}>
            <button type="button" aria-current={t.active ? 'page' : undefined} onClick={t.active ? undefined : onOther}
              className={cx('flex h-[56px] w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold', t.active ? 'text-ink' : 'text-subtle')}>
              {t.active ? <IconBag className="size-[22px]" /> : (
                <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={t.d} /></svg>
              )}
              {t.t}
              <span aria-hidden className={cx('h-[3px] w-5 rounded-full transition-colors', t.active ? 'bg-brand' : 'bg-transparent')} />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
