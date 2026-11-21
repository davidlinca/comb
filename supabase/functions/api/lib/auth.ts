// Verificarea tokenului la FIECARE cerere (verify_jwt = false pe platforma, deci o facem noi).
// getClaims verifica semnatura tokenului cu cheile publice ale proiectului (JWKS).

import { createMiddleware } from 'hono/factory';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authClient, userDb } from './supabase.ts';
import { forbidden, unauthorized } from './http.ts';

export type Env = {
  Variables: {
    userId: string;
    isOperator: boolean;
    db: SupabaseClient; // cu tokenul userului -> RLS
  };
};

export const requireUser = createMiddleware<Env>(async (c, next) => {
  const h = c.req.header('Authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token || token.startsWith('sb_')) throw unauthorized(); // cheile publishable/secret nu sunt tokenuri

  const { data, error } = await authClient.auth.getClaims(token);
  const claims = data?.claims as Record<string, unknown> | undefined;
  if (error || !claims?.sub || claims.role !== 'authenticated') throw unauthorized();

  const appMeta = (claims.app_metadata ?? {}) as Record<string, unknown>;
  c.set('userId', String(claims.sub));
  c.set('isOperator', appMeta.role === 'operator'); // doar app_metadata, setat de server
  c.set('db', userDb(token));
  await next();
});

export const requireOperator = createMiddleware<Env>(async (c, next) => {
  if (!c.get('isOperator')) throw forbidden('Doar operatorul are acces la back-office.');
  await next();
});
