// Datele fiecărui ecran se cer înainte de navigare (route loaders), deci sheet-ul nou apare complet,
// fără „Se încarcă…”. Tot aici sunt redirecționările după starea cererii (refresh, înapoi, link vechi).
import { redirect, type LoaderFunctionArgs } from 'react-router-dom';
import { api, api2, ApiError, type Application, type Quote } from './lib/api';
import { catalog, currentMe, requireCustomer, signOut } from './lib/session';

type Args = LoaderFunctionArgs;

/** Rulează loaderul doar pentru un client logat; un 401 trimite la login. */
function authed<T>(fn: (a: Args) => Promise<T>) {
  return async (a: Args): Promise<T> => {
    await requireCustomer();
    try { return await fn(a); } catch (e) {
      if (e instanceof ApiError && e.status === 401) { await signOut(); throw redirect('/login'); }
      throw e;
    }
  };
}

const assessed = (a: Application) => a.next_step !== 'consents' && a.next_step !== 'assessment';
const canSign = (a: Application) => a.next_step === 'secci' || a.next_step === 'sign';

/** /login: cine are deja sesiune merge direct unde îi e locul. */
export async function loginLoader() {
  const me = await currentMe().catch(() => null);
  if (me) throw redirect(me.role === 'operator' ? '/backoffice' : '/shop');
  return null;
}

export const shopLoader = authed(async () => ({ me: await requireCustomer(), catalog: await catalog() }));

/** Cardul „Cererea ta”: rulează la fiecare întoarcere în magazin. O eroare nu strică magazinul (cardul lipsește). */
export const currentLoader = authed(async () => {
  try { return (await api.current()).application; } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw e;
    return null;
  }
});

export const termLoader = authed(async ({ params }) => {
  const cat = await catalog();
  const device = cat.devices.find((d) => d.sku === params.sku);
  const product = device && cat.products.find((p) => p.applies_to === device.category);
  if (!device || !product) throw redirect('/shop');
  const pairs = await Promise.all(product.terms.map((t) =>
    api.quote({ sku: device.sku, product_id: product.id, term_months: t }).then((q) => [t, q] as const)));
  return { catalog: cat, device, product, quotes: Object.fromEntries(pairs) as Record<number, Quote> };
});

export const budgetLoader = authed(async ({ params }) => {
  const app = await api.application(params.id!);
  if (assessed(app)) throw redirect(`/a/${params.id}/rezultat`);
  return { app };
});

export const decisionLoader = authed(async ({ params }) => {
  const app = await api.application(params.id!);
  if (!assessed(app)) throw redirect(`/a/${params.id}/buget`);
  if (app.agreement_id) throw redirect(`/c/${app.agreement_id}`);
  return { app };
});

async function signable(id: string) {
  const app = await api.application(id);
  if (app.agreement_id) throw redirect(`/c/${app.agreement_id}`);
  if (!canSign(app)) throw redirect(`/a/${id}/rezultat`);
  return app;
}
async function deviceAndLender(app: Application) {
  const cat = await catalog();
  return {
    device: cat.devices.find((d) => d.sku === app.offer?.sku) ?? null,
    lender: cat.products.find((p) => p.id === app.offer?.product_id)?.lender ?? 'Credis IFN (demo)',
  };
}

export const offerLoader = authed(async ({ params }) => {
  const app = await signable(params.id!);
  const [secci, extra] = await Promise.all([api2.secci(params.id!), deviceAndLender(app)]);
  return { app, secci, ...extra };
});

export const confirmLoader = offerLoader;

export const otpLoader = authed(async ({ params }) => {
  const app = await signable(params.id!);
  return { app, ...(await deviceAndLender(app)) };
});

export const agreementLoader = authed(async ({ params }) => {
  const agreement = await api2.agreement(params.aid!);
  const app = await api.application(agreement.application_id);
  return { agreement, app, ...(await deviceAndLender(app)) };
});

export type LoaderData<T extends (...a: never[]) => unknown> = Awaited<ReturnType<T>>;
