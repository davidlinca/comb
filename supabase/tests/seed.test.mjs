import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const [mig, seed] = process.argv.slice(2).map((p) => readFileSync(p, 'utf8'));
const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_app_meta_data jsonb default '{}'::jsonb);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role; grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
insert into auth.users (email) values ('ana@demo.comb.ro'),('mihai@demo.comb.ro'),('ioana@demo.comb.ro'),('operator@demo.comb.ro');`);
await db.exec(mig);
try { await db.exec(seed); } catch (e) { console.log('EROARE SEED:', e.message); process.exit(1); }
const q = async (sql) => (await db.query(sql)).rows;
console.log(await q(`select (select count(*) from customers) clienti, (select count(*) from billing_history) facturi, (select count(*) from applications) cereri,
  (select count(*) from ledger_entries) jurnal, (select count(*) from agreements) contracte, (select count(*) from human_reviews where status='pending') coada,
  (select count(*) from secci_documents) secci, (select count(*) from notifications) notificari`));
console.log(await q(`select status, count(*)::int from applications group by 1 order by 1`));
const bad = await q(`select a.id, v.* from applications a cross join lateral ledger_verify(a.id) v where not v.valid`);
const tot = await q(`select count(*)::int n, sum(v.entries)::int e from applications a cross join lateral ledger_verify(a.id) v where v.valid`);
console.log('jurnale valide:', tot[0], 'invalide:', bad.length);
console.log(await q(`select count(*)::int as review_cu_operator from human_reviews where status <> 'pending' and operator_user_id is not null`));
console.log(await q(`select c.code, count(b.*)::int facturi, count(*) filter (where b.days_late > 30 and b.period >= '2025-11-01')::int intarziate_12l, r.other_installments_lei birou
  from customers c left join billing_history b on b.customer_id=c.id join credit_bureau_records r on r.customer_id=c.id where c.code in ('c_ana','c_mihai','c_ioana') group by c.code, r.other_installments_lei order by 1`));
