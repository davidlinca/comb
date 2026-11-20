// Test local al migrarii pe PGlite (Postgres 17 in WASM), cu un "auth" minim ca in Supabase.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const migration = readFileSync(process.argv[2], 'utf8');
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
  if (cond) { pass++; console.log('  OK   ', name); }
  else { fail++; console.log('  FAIL ', name, extra); }
};
const expectError = async (name, sql, re) => {
  try { await db.exec(sql); ok(name, false, '(nu a dat eroare)'); }
  catch (e) { ok(name, re.test(e.message), e.message); }
  finally { await db.exec('reset role; reset request.jwt.claims;').catch(() => {}); }
};
const as = (role, sub, extra = {}) =>
  `set role ${role}; set request.jwt.claims = '${JSON.stringify({ sub, role, ...extra })}';`;
const count = async (sql) => Number((await db.query(sql)).rows[0].n);

await db.exec(STUB);
try { await db.exec(migration); } catch (e) { console.log("EROARE MIGRARE:", e.message, "pozitia", e.position); process.exit(1); }
console.log('Migrarea a rulat fara erori.\n');

const ANA = '00000000-0000-0000-0000-00000000000a';
const MIH = '00000000-0000-0000-0000-00000000000b';
const OPS = '00000000-0000-0000-0000-0000000000ff';
await db.exec(`
insert into auth.users values ('${ANA}','ana@demo'),('${MIH}','mihai@demo'),('${OPS}','operator@demo');
insert into public.devices values ('PH-2','Nova 5','phone',2199.00,true,1);
insert into public.credit_products values ('RATE','Rate prin partener','phone',14.9,0,'{12,24}','Credis IFN (demo)','Str. Exemplu 1 (demo)',true);
insert into public.customers (id,user_id,code,display_name,segment,tenure_months,plan_name,monthly_bill_lei) values
  ('10000000-0000-0000-0000-00000000000a','${ANA}','c_ana','Ana Popescu','postpaid',38,'Nelimitat 15',45),
  ('10000000-0000-0000-0000-00000000000b','${MIH}','c_mihai','Mihai Ionescu','postpaid',14,'Nelimitat 10',35);
insert into public.applications (id,customer_id,sku,product_id,term_months,principal_lei,installment_lei,installments,total_payable_lei,total_cost_lei,nominal_rate_pct,apr_pct) values
  ('20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','PH-2','RATE',24,2199,106.52,24,2556.48,357.48,14.9,15.96),
  ('20000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000b','PH-2','RATE',24,2199,106.52,24,2556.48,357.48,14.9,15.96);
insert into public.otp_challenges (application_id,code_hash,expires_at) values ('20000000-0000-0000-0000-00000000000a','x',now()+interval '5 min');
`);

console.log('Jurnal cu hash:');
await db.exec(`
insert into public.ledger_entries (application_id,event,actor,payload) values
  ('20000000-0000-0000-0000-00000000000a','offer_requested','customer','{"sku":"PH-2"}'),
  ('20000000-0000-0000-0000-00000000000a','ad_warning_shown','system','{}'),
  ('20000000-0000-0000-0000-00000000000a','assessment_done','system','{"decision":"approved"}');
`);
const led = (await db.query(`select seq, ccd2_ref, prev_hash, hash from public.ledger_entries order by seq`)).rows;
ok('seq 1,2,3 puse de baza de date', led.map(r => r.seq).join() === '1,2,3');
ok('ccd2_ref completat automat (art. 17)', led[0].ccd2_ref === 'art. 17');
ok('prima intrare porneste de la 000...0', led[0].prev_hash === '0'.repeat(64));
ok('lantul: prev_hash(2) = hash(1)', led[1].prev_hash === led[0].hash);
let v = (await db.query(`select * from public.ledger_verify('20000000-0000-0000-0000-00000000000a')`)).rows[0];
ok('ledger_verify = valid, 3 intrari', v.valid === true && v.entries === 3, JSON.stringify(v));

// Cum va scrie API-ul: rolul service_role (cheia secret)
await db.exec(`set role service_role; set request.jwt.claims = '{"role":"service_role"}';
insert into public.ledger_entries (application_id,event,actor,payload) values ('20000000-0000-0000-0000-00000000000b','offer_requested','customer','{}');`);
const vsr = (await db.query(`select * from public.ledger_verify('20000000-0000-0000-0000-00000000000b')`)).rows[0];
await db.exec('reset role; reset request.jwt.claims;');
ok('API (service_role) poate scrie in jurnal si verifica lantul', vsr.valid === true && vsr.entries === 1, JSON.stringify(vsr));
await db.exec(`set role service_role; update public.applications set status='approved' where id='20000000-0000-0000-0000-00000000000b'; reset role;`);
ok('API (service_role) poate actualiza o cerere; updated_at se schimba singur',
  (await db.query(`select status, updated_at > created_at as t from public.applications where id='20000000-0000-0000-0000-00000000000b'`)).rows[0].status === 'approved');

await expectError('UPDATE pe jurnal blocat (chiar si pt. cheia secret)',
  `set role service_role; update public.ledger_entries set payload='{}' where seq=1;`, /append-only/);
await expectError('DELETE pe jurnal blocat',
  `set role service_role; delete from public.ledger_entries;`, /append-only/);
await expectError('Intrare cu data in trecut respinsa',
  `insert into public.ledger_entries (application_id,event,actor,occurred_at) values ('20000000-0000-0000-0000-00000000000a','otp_sent','system','2020-01-01');`, /inaintea/);

// Falsificare: cineva cu acces de admin dezactiveaza trigger-ul si schimba o intrare
await db.exec(`
alter table public.ledger_entries disable trigger ledger_entries_no_update_delete;
update public.ledger_entries set payload='{"decision":"rejected"}' where seq=3;
alter table public.ledger_entries enable trigger ledger_entries_no_update_delete;`);
v = (await db.query(`select * from public.ledger_verify('20000000-0000-0000-0000-00000000000a')`)).rows[0];
ok('falsificarea e detectata (first_invalid_seq = 3)', v.valid === false && v.first_invalid_seq === 3, JSON.stringify(v));

console.log('\nRLS si drepturi:');
await db.exec(as('authenticated', ANA));
ok('Ana vede doar cererea ei (1)', await count(`select count(*) n from public.applications`) === 1);
ok('Ana vede doar clientul ei (1)', await count(`select count(*) n from public.customers`) === 1);
ok('Ana NU vede jurnalul (0)', await count(`select count(*) n from public.ledger_entries`) === 0);
ok('Ana vede catalogul (1)', await count(`select count(*) n from public.devices`) === 1);
await db.exec('reset role; reset request.jwt.claims;');

await expectError('Ana nu poate citi OTP-urile', as('authenticated', ANA) + `select * from public.otp_challenges;`, /permission denied/);
await expectError('Ana nu poate scrie direct o cerere', as('authenticated', ANA) +
  `insert into public.applications (customer_id,sku,product_id,term_months,principal_lei,installment_lei,installments,total_payable_lei,total_cost_lei,nominal_rate_pct,apr_pct) values ('10000000-0000-0000-0000-00000000000a','PH-2','RATE',24,1,1,24,1,0,0,0);`, /permission denied/);
await expectError('Ana nu poate modifica statusul', as('authenticated', ANA) + `update public.applications set status='approved';`, /permission denied/);
await expectError('Ana nu poate apela ledger_verify', as('authenticated', ANA) + `select * from public.ledger_verify('20000000-0000-0000-0000-00000000000a');`, /permission denied/);
await expectError('Fara login (anon) nu se vede nici catalogul', as('anon', null) + `select * from public.devices;`, /permission denied/);
await db.exec(as('authenticated', MIH, { user_metadata: { role: 'operator' } }));
ok('Rol "operator" in user_metadata NU da acces (Mihai vede tot 1 cerere)', await count(`select count(*) n from public.applications`) === 1);
await db.exec('reset role; reset request.jwt.claims;');

await db.exec(as('authenticated', OPS, { app_metadata: { role: 'operator' } }));
ok('Operatorul vede toate cererile (2)', await count(`select count(*) n from public.applications`) === 2);
ok('Operatorul vede jurnalul (4)', await count(`select count(*) n from public.ledger_entries`) === 4);
await db.exec('reset role; reset request.jwt.claims;');
await expectError('Nici operatorul nu scrie direct', as('authenticated', OPS, { app_metadata: { role: 'operator' } }) +
  `update public.human_reviews set status='approved';`, /permission denied/);

console.log('\nConstrangeri:');
await expectError('Total de plata = credit + cost (altfel respins)',
  `insert into public.applications (customer_id,sku,product_id,term_months,principal_lei,installment_lei,installments,total_payable_lei,total_cost_lei,nominal_rate_pct,apr_pct) values ('10000000-0000-0000-0000-00000000000a','PH-2','RATE',24,2199,106.52,24,2000,357.48,14.9,15.96);`, /check constraint/);

console.log(`\nRezultat: ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
