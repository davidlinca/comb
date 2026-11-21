// Test local pentru migrarea „archived_at” (PGlite), rulata peste schema initiala.
// node archive.test.mjs ../migrations/20261120231817_init_schema.sql ../migrations/<versiune>_application_archive.sql
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const [initSql, archiveSql] = process.argv.slice(2).map((p) => readFileSync(p, 'utf8'));
const db = new PGlite();

const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  OK   ', name); } else { fail++; console.log('  FAIL ', name, extra); }
};
const as = (role, sub, extra = {}) => `set role ${role}; set request.jwt.claims = '${JSON.stringify({ sub, role, ...extra })}';`;
const reset = () => db.exec('reset role; reset request.jwt.claims;');

await db.exec(STUB);
await db.exec(initSql);
try { await db.exec(archiveSql); } catch (e) { console.log('EROARE MIGRARE:', e.message); process.exit(1); }
console.log('Ambele migrari au rulat fara erori.\n');

const ANA = '00000000-0000-0000-0000-00000000000a';
const OPS = '00000000-0000-0000-0000-0000000000ff';
const APP_T = '20000000-0000-0000-0000-00000000000a'; // cerere „de test”, o arhivam
const APP_L = '20000000-0000-0000-0000-00000000000c'; // cerere „live”, ramane
await db.exec(`
insert into auth.users values ('${ANA}','ana@demo'),('${OPS}','operator@demo');
insert into public.devices values ('PH-2','Nova 5','phone',2199.00,true,1);
insert into public.credit_products values ('RATE','Rate prin partener','phone',14.9,0,'{12,24}','Credis IFN (demo)','Str. Exemplu 1 (demo)',true);
insert into public.customers (id,user_id,code,display_name,segment,tenure_months,plan_name,monthly_bill_lei) values
  ('10000000-0000-0000-0000-00000000000a','${ANA}','c_ana','Ana Popescu','postpaid',38,'Nelimitat 15',45);
insert into public.applications (id,customer_id,sku,product_id,term_months,principal_lei,installment_lei,installments,total_payable_lei,total_cost_lei,nominal_rate_pct,apr_pct) values
  ('${APP_T}','10000000-0000-0000-0000-00000000000a','PH-2','RATE',24,2199,106.52,24,2556.42,357.42,14.9,15.96),
  ('${APP_L}','10000000-0000-0000-0000-00000000000a','PH-2','RATE',24,2199,106.52,24,2556.42,357.42,14.9,15.96);
insert into public.ledger_entries (application_id,event,actor,payload) values
  ('${APP_T}','offer_requested','customer','{"sku":"PH-2"}'),
  ('${APP_T}','ad_warning_shown','system','{}');
`);

const cols = (await db.query(`select data_type, is_nullable from information_schema.columns where table_name='applications' and column_name='archived_at'`)).rows[0];
ok('coloana archived_at exista, timestamptz, poate fi null', cols?.data_type === 'timestamp with time zone' && cols?.is_nullable === 'YES', JSON.stringify(cols));
ok('cererile existente pornesc nearhivate', Number((await db.query(`select count(*) n from public.applications where archived_at is null`)).rows[0].n) === 2);
ok('indexul partial exista', (await db.query(`select 1 from pg_indexes where indexname='applications_active_created_idx'`)).rows.length === 1);

// Clientul (authenticated) nu poate arhiva
try {
  await db.exec(`${as('authenticated', ANA)} update public.applications set archived_at = now() where id='${APP_L}';`);
  ok('clientul NU poate arhiva (fara UPDATE)', false, '(nu a dat eroare)');
} catch (e) { ok('clientul NU poate arhiva (fara UPDATE)', /permission denied/.test(e.message), e.message); }
await reset();

// Arhivarea, cum o face SQL-ul de curatare (service_role / SQL Editor)
await db.exec(`set role service_role; update public.applications set archived_at = now() where id='${APP_T}'; reset role;`);
const t = (await db.query(`select archived_at is not null a, updated_at >= created_at u from public.applications where id='${APP_T}'`)).rows[0];
ok('service_role arhiveaza cererea de test', t.a === true);

const v = (await db.query(`select * from public.ledger_verify('${APP_T}')`)).rows[0];
ok('jurnalul cererii arhivate ramane valid (2 intrari)', v.valid === true && v.entries === 2, JSON.stringify(v));

// Operatorul vede coloana (RLS: vede tot) si poate filtra
await db.exec(as('authenticated', OPS, { app_metadata: { role: 'operator' } }));
const vis = (await db.query(`select id from public.applications where archived_at is null order by created_at desc`)).rows.map((r) => r.id);
await reset();
ok('operatorul, cu filtrul archived_at is null, vede doar cererea live', vis.length === 1 && vis[0] === APP_L, JSON.stringify(vis));

// Clientul isi vede in continuare cererea arhivata (RLS neschimbat; nu exista lista de cereri in API)
await db.exec(as('authenticated', ANA));
const own = Number((await db.query(`select count(*) n from public.applications`)).rows[0].n);
await reset();
ok('RLS neschimbat: Ana vede ambele cereri ale ei', own === 2, String(own));

console.log(`\nRezultat: ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
