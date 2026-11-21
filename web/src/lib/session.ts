// Sesiunea: Supabase doar pentru login/logout/token; rolul vine din GET /me (cache în memorie).
import { redirect } from 'react-router-dom';
import { supabase } from './supabase';
import { api, ApiError, type Catalog, type Me, type Quote } from './api';

let cached: { uid: string; me: Promise<Me> } | null = null;
let catalogCache: Promise<Catalog> | null = null;
const quoteCache = new Map<string, Promise<Quote>>();

export async function currentMe(): Promise<Me | null> {
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  if (!s) { cached = null; return null; }
  if (cached?.uid !== s.user.id) {
    const me = api.me();
    cached = { uid: s.user.id, me };
    me.catch(() => { if (cached?.me === me) cached = null; }); // la eroare, reîncercăm data viitoare
  }
  return cached.me;
}

/** Catalogul nu se schimbă în timpul sesiunii: îl cerem o dată. */
export function catalog(): Promise<Catalog> {
  if (!catalogCache) {
    catalogCache = api.catalog();
    catalogCache.catch(() => { catalogCache = null; });
  }
  return catalogCache;
}

/** Costul pentru o perioadă: același produs dă mereu aceeași cifră, deci Înapoi la Perioada e instant. */
export function quote(b: { sku: string; product_id: string; term_months: number }): Promise<Quote> {
  const k = `${b.sku}|${b.product_id}|${b.term_months}`;
  let q = quoteCache.get(k);
  if (!q) {
    q = api.quote(b);
    quoteCache.set(k, q);
    q.catch(() => { if (quoteCache.get(k) === q) quoteCache.delete(k); });
  }
  return q;
}

export async function signIn(email: string, password: string): Promise<Me> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const offline = /fetch|network/i.test(error.message);
    throw offline
      ? new ApiError(0, 'NETWORK', 'Nu ne putem conecta la server. Încearcă din nou.')
      : new ApiError(401, 'AUTH', 'Email sau parolă greșite.');
  }
  try {
    const me = await currentMe();
    if (!me) throw new Error();
    return me;
  } catch (e) {
    if (e instanceof ApiError && e.status !== 0) throw e;
    throw new ApiError(0, 'NETWORK', 'Nu ne putem conecta la server. Încearcă din nou.');
  }
}

export async function signOut() {
  cached = null; catalogCache = null; quoteCache.clear();
  await supabase.auth.signOut();
}

/** Loader pentru zona clientului: fără sesiune -> /login; operatorul -> /backoffice. */
export async function requireCustomer() {
  let me: Me | null;
  try { me = await currentMe(); } catch (e) {
    if (e instanceof ApiError && e.status === 401) { await signOut(); throw redirect('/login'); }
    throw e;
  }
  if (!me) throw redirect('/login');
  if (me.role === 'operator') throw redirect('/backoffice');
  return me;
}

export async function requireOperator() {
  const me = await currentMe().catch(() => null);
  if (!me) throw redirect('/login');
  if (me.role !== 'operator') throw redirect('/shop');
  return me;
}
