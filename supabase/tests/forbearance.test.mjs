// Test local pentru migrarea „forbearance” (PGlite): rata ratata, CCD2 art. 35.
// Ordinea de pe server: init -> arhivare -> bank_verification -> bank_installments -> forbearance.
// npm run test:forbearance
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
const sqls = files.map((p) => readFileSync(p, 'utf8'));
const newSql = sqls.pop();
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
const fails = async (name, sql, re) => {
  try { await db.exec(sql); ok(name, false, '(nu a dat eroare)'); }
  catch (e) { ok(name, re.test(e.message), e.message); }
  finally { await reset().catch(() => {}); }
};
const count = async (sql) => {
  const res = await db.query(sql);
  return Number(res.rows[0].n);
};

await db.exec(STUB);
for (const s of sqls) await db.exec(s);

const ANA = '00000000-0000-0000-0000-00000000000a', MIH = '00000000-0000-0000-0000-00000000000b', OP = '00000000-0000-0000-0000-0000000000ff';
const C_ANA = '10000000-0000-0000-0000-00000000000a', C_MIH = '10000000-0000-0000-0000-00000000000b';
const APP = '20000000-0000-0000-0000-00000000000a', APP2 = '20000000-0000-0000-0000-00000000000b';
const S1 = '30000000-0000-0000-0000-00000000000a', S2 = '30000000-0000-0000-0000-00000000000b';
const AG = '40000000-0000-0000-0000-00000000000a', AG2 = '40000000-0000-0000-0000-00000000000b';
const HR = '50000000-0000-0000-0000-00000000000b';
await db.exec(`
insert into auth.users values ('${ANA}','ana@demo'),('${MIH}','mihai@demo'),('${OP}','operator@demo');
insert into public.devices values ('PH-2','Nova 5','phone',2199.00,true,1);
insert into public.credit_products values ('RATE','Rate prin partener','phone',14.9,0,'{12,24}','Credis IFN (demo)','Str. Exemplu 1 (demo)',true);
insert into public.customers (id,user_id,code,display_name,segment,tenure_months,plan_name,monthly_bill_lei) values
  ('${C_ANA}','${ANA}','c_ana','Ana Popescu','postpaid',38,'Nelimitat 15',45),
  ('${C_MIH}','${MIH}','c_mihai','Mihai Ionescu','postpaid',14,'Nelimitat 10',35);
insert into public.applications (id,customer_id,sku,product_id,term_months,principal_lei,installment_lei,installments,total_payable_lei,total_cost_lei,nominal_rate_pct,apr_pct,status) values
  ('${APP}','${C_ANA}','PH-2','RATE',24,2199,106.52,24,2556.42,357.42,14.9,15.96,'signed'),
  ('${APP2}','${C_MIH}','PH-2','RATE',24,2199,106.52,24,2556.42,357.42,14.9,15.96,'signed');
insert into public.secci_documents (id,application_id,secci_version,content,content_sha256) values
  ('${S1}','${APP}','v1','{}','x'),('${S2}','${APP2}','v1','{}','y');
insert into public.agreements (id,application_id,secci_document_id,signed_at,info_received_at,first_installment_due,withdrawal_deadline,reminder_required) values
  ('${AG}','${APP}','${S1}','2026-11-21T10:00:00Z','2026-11-21T09:55:00Z','2026-12-21','2026-12-05',false),
  ('${AG2}','${APP2}','${S2}','2026-11-21T10:00:00Z','2026-11-21T09:55:00Z','2026-12-21','2026-12-05',false);
insert into public.notifications (application_id,kind,body) values ('${APP}','withdrawal_reminder','vechi');
`);

try { await db.exec(newSql); } catch (e) { console.log('EROARE MIGRARE:', e.message); process.exit(1); }
console.log('Migrarea forbearance a rulat fara erori.\n');

console.log('Jurnal:');
const ev = (await db.query(`select event, ccd2_ref from public.ledger_event_types where event in ('installment_missed','forbearance_offered','forbearance_chosen') order by event`)).rows;
ok('3 evenimente noi, toate art. 35', ev.length === 3 && ev.every((r) => r.ccd2_ref === 'art. 35'), JSON.stringify(ev));
await db.exec(`insert into public.ledger_entries (application_id, event, actor, payload) values
  ('${APP}','installment_missed','system','{"installment_n":1}'),
  ('${APP}','forbearance_offered','system','{}'),
  ('${APP}','forbearance_chosen','customer','{"option":"defer"}')`);
const lv = (await db.query(`select * from public.ledger_verify('${APP}')`)).rows[0];
ok('jurnalul cu evenimentele noi ramane valid (3 intrari)', lv.valid === true && lv.entries === 3, JSON.stringify(lv));
ok('ccd2_ref pus de trigger = art. 35', (await count(`select count(*) n from public.ledger_entries where ccd2_ref = 'art. 35'`)) === 3);

console.log('\nNotificari:');
ok('notificarea veche (reminder) a ramas', (await count(`select count(*) n from public.notifications where kind = 'withdrawal_reminder'`)) === 1);
await db.exec(`insert into public.notifications (application_id,kind,body) values ('${APP}','installment_missed','Rata din 21 dec. 2026 nu a fost platita.')`);
ok('tip nou installment_missed acceptat', (await count(`select count(*) n from public.notifications where kind = 'installment_missed'`)) === 1);
await fails('a doua notificare installment_missed pe aceeasi cerere e refuzata', `insert into public.notifications (application_id,kind,body) values ('${APP}','installment_missed','dublura')`, /duplicate key|unique/);
await fails('un tip necunoscut de notificare e refuzat', `insert into public.notifications (application_id,kind,body) values ('${APP}','spam','x')`, /notifications_kind_check/);

console.log('\nMasuri:');
await db.exec(`insert into public.forbearance_measures (agreement_id,installment_n,missed_due_date,option,extra_cost_lei,new_installment_lei,new_installments,new_total_payable_lei,schedule)
  values ('${AG}',1,'2026-12-21','defer',27.30,106.52,24,2583.72,'[{"n":1,"due_date":"2027-01-21","amount_lei":106.52}]')`);
ok('amanarea Anei salvata', (await count(`select count(*) n from public.forbearance_measures`)) === 1);
await fails('a doua masura pe acelasi contract e refuzata', `insert into public.forbearance_measures (agreement_id,installment_n,missed_due_date,option,extra_cost_lei,new_installment_lei,new_installments,new_total_payable_lei,schedule)
  values ('${AG}',1,'2026-12-21','reschedule',108.38,91.89,29,2664.80,'[]')`, /duplicate key|unique/);
await fails('amanare fara grafic e refuzata', `insert into public.forbearance_measures (agreement_id,installment_n,missed_due_date,option,extra_cost_lei,new_installment_lei,new_installments,new_total_payable_lei)
  values ('${AG2}',1,'2026-12-21','defer',27.30,106.52,24,2583.72)`, /check/);
await fails('„vorbeste cu un om” cu cifre e refuzat', `insert into public.forbearance_measures (agreement_id,installment_n,missed_due_date,option,extra_cost_lei)
  values ('${AG2}',1,'2026-12-21','talk',0)`, /check/);
await fails('optiune necunoscuta e refuzata', `insert into public.forbearance_measures (agreement_id,installment_n,missed_due_date,option)
  values ('${AG2}',1,'2026-12-21','forgive')`, /check/);
await db.exec(`insert into public.human_reviews (id,application_id,requested_by,customer_message) values ('${HR}','${APP2}','customer','Rata ratata: vreau sa vorbesc cu un om')`);
await db.exec(`insert into public.forbearance_measures (agreement_id,installment_n,missed_due_date,option,human_review_id) values ('${AG2}',1,'2026-12-21','talk','${HR}')`);
ok('„vorbeste cu un om” al lui Mihai salvat, legat de revizuire', (await count(`select count(*) n from public.forbearance_measures where option = 'talk' and human_review_id = '${HR}'`)) === 1);

console.log('\nRLS si drepturi:');
await db.exec(as('authenticated', ANA));
ok('Ana vede doar masura ei (1)', (await count(`select count(*) n from public.forbearance_measures`)) === 1);
ok('Ana vede doar notificarile ei (2)', (await count(`select count(*) n from public.notifications`)) === 2);
await reset();
await db.exec(as('authenticated', MIH));
ok('Mihai vede doar masura lui (talk)', (await count(`select count(*) n from public.forbearance_measures where option = 'talk'`)) === 1
  && (await count(`select count(*) n from public.forbearance_measures`)) === 1);
await reset();
await db.exec(as('authenticated', OP, { app_metadata: { role: 'operator' } }));
ok('operatorul vede toate masurile (2)', (await count(`select count(*) n from public.forbearance_measures`)) === 2);
await reset();
await fails('Ana NU poate scrie masuri', `${as('authenticated', ANA)} insert into public.forbearance_measures (agreement_id,installment_n,missed_due_date,option) values ('${AG}',1,'2026-12-21','talk')`, /permission denied/);
await fails('Ana NU poate modifica masura', `${as('authenticated', ANA)} update public.forbearance_measures set extra_cost_lei = 0`, /permission denied/);
await fails('anon NU vede masurile', `${as('anon', null)} select count(*) from public.forbearance_measures`, /permission denied/);
await fails('jurnalul ramane append-only', `delete from public.ledger_entries where application_id = '${APP}'`, /interzis|not allowed|append/i);

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
