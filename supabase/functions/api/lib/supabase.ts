// Doi clienti Supabase:
//  - userDb(token): cu tokenul userului -> RLS se aplica (CITIRI)
//  - admin:         cu cheia secret     -> ocoleste RLS (SCRIERI, doar dupa ce am verificat cine e userul)
// Cheile noi vin din mediul Edge Function: SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS (JSON, cheia "default").

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = Deno.env.get('SUPABASE_URL')!;

function keyFrom(envName: string): string {
  const raw = Deno.env.get(envName);
  if (!raw) throw new Error(`Lipseste ${envName}`);
  const k = JSON.parse(raw)['default'];
  if (!k) throw new Error(`${envName} nu are cheia "default"`);
  return k;
}

export const PUBLISHABLE_KEY = keyFrom('SUPABASE_PUBLISHABLE_KEYS');
const SECRET_KEY = keyFrom('SUPABASE_SECRET_KEYS');

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/** Folosit doar ca sa verificam tokenuri (getClaims). */
export const authClient = createClient(URL, PUBLISHABLE_KEY, { auth: noSession });

/** Scrieri; ocoleste RLS. Nu-l folosi pentru citiri cerute de client. */
export const admin = createClient(URL, SECRET_KEY, { auth: noSession });

export const userDb = (token: string): SupabaseClient =>
  createClient(URL, PUBLISHABLE_KEY, {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
