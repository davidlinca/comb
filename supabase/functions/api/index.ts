// Edge Function "api": toate rutele, sub /functions/v1/api/...
// verify_jwt = false pe platforma (cheile noi nu sunt JWT); tokenul il verificam noi in requireUser.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireUser, type Env } from './lib/auth.ts';
import { ApiError } from './lib/http.ts';
import customer from './routes/customer.ts';

// CORS: doar originile permise. ALLOWED_ORIGINS = lista separata prin virgula (secret al functiei).
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);

const app = new Hono<Env>().basePath('/api');

app.use('*', cors({
  origin: (origin) => (ALLOWED.includes(origin) ? origin : null),
  allowHeaders: ['authorization', 'apikey', 'content-type', 'x-client-info'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  maxAge: 600,
}));

app.get('/health', (c) => c.json({ ok: true }));

app.use('*', requireUser);
app.route('/', customer);

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Ruta nu exista.' } }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } }, err.status as 400);
  }
  // Fara date personale in loguri: doar un id de eroare si mesajul tehnic
  const id = crypto.randomUUID();
  console.error(`[api] ${id} ${c.req.method} ${new URL(c.req.url).pathname}: ${err.message}`);
  return c.json({ error: { code: 'INTERNAL', message: 'A aparut o eroare. Incearca din nou.', id } }, 500);
});

Deno.serve(app.fetch);
