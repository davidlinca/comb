// Test local pentru migrarea „bank_installments” (PGlite): rate vazute in contul bancar (engine-v3).
// Ordinea de pe server: init -> arhivare -> bank_verification -> data/bank_insights.sql -> bank_installments.
// npm run test:bankinst
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const [initSql, archiveSql, bankSql, insightsSql, instSql] = process.argv.slice(2).map((p) => readFileSync(p, 'utf8'));
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

await db.exec(STUB);
await db.exec(initSql);
await db.exec(archiveSql);
await db.exec(bankSql);

const ANA = '00000000-0000-0000-0000-00000000000a', MIH = '00000000-0000-0000-0000-00000000000b', IOA = '00000000-0000-0000-0000-00000000000c';
const C_ANA = '10000000-0000-0000-0000-00000000000a', C_MIH = '10000000-0000-0000-0000-00000000000b', C_IOA = '10000000-0000-0000-0000-00000000000c';
const APP = '20000000-0000-0000-0000-00000000000a', APP2 = '20000000-0000-0000-0000-00000000000b', APP3 = '20000000-0000-0000-0000-00000000000c';
await db.exec(`
insert into auth.users values ('${ANA}','ana@demo'),('${MIH}','mihai@demo'),('${IOA}','ioana@demo');
insert into public.devices values ('PH-2','Nova 5','phone',2199.00,true,1);
insert into public.credit_products values ('RATE','Rate prin partener','phone',14.9,0,'{12,24}','Credis IFN (demo)','Str. Exemplu 1 (demo)',true);
insert into public.customers (id,user_id,code,display_name,segment,tenure_months,plan_name,monthly_bill_lei) values
  ('${C_ANA}','${ANA}','c_ana','Ana Popescu','postpaid',38,'Nelimitat 15',45),
  ('${C_MIH}','${MIH}','c_mihai','Mihai Ionescu','postpaid',14,'Nelimitat 10',35),
  ('${C_IOA}','${IOA}','c_ioana','Ioana Marin','prepaid',0,'Cartela',0);
insert into public.credit_bureau_records (customer_id, other_installments_lei, active_credits) values
  ('${C_ANA}',300,1),('${C_MIH}',650,2),('${C_IOA}',900,2);
insert into public.applications (id,customer_id,sku,product_id,term_months,principal_lei,installment_lei,installments,total_payable_lei,total_cost_lei,nominal_rate_pct,apr_pct) values
  ('${APP}','${C_ANA}','PH-2','RATE',24,2199,106.52,24,2556.42,357.42,14.9,15.96),
  ('${APP2}','${C_MIH}','PH-2','RATE',24,2199,106.52,24,2556.42,357.42,14.9,15.96),
  ('${APP3}','${C_IOA}','PH-2','RATE',24,2199,106.52,24,2556.42,357.42,14.9,15.96);
`);
await db.exec(insightsSql);
// o evaluare veche (engine-v2), salvata inainte de migrare: trebuie sa ramana valida
await db.exec(`insert into public.assessments (application_id,net_income_lei,monthly_expenses_lei,other_installments_declared_lei,other_installments_bureau_lei,other_installments_used_lei,new_installment_lei,billing_history_used,residual_lei,decision,engine_version,bank_data_used,income_verified_lei,income_used_lei,expenses_verified_lei,expenses_used_lei) values ('${APP3}',2600,1700,900,900,900,106.52,false,0,'rejected','engine-v2',true,2600,2600,1700,1700)`);

try { await db.exec(instSql); } catch (e) { console.log('EROARE MIGRARE:', e.message); process.exit(1); }
console.log('Migrarea bank_installments a rulat fara erori.\n');

console.log('Datele bancare:');
const rows = Object.fromEntries((await db.query(`select c.code, i.installments_seen_lei::float v from public.bank_account_insights i join public.customers c on c.id=i.customer_id`)).rows.map((r) => [r.code, r.v]));
ok('Ana: banca vede 300 (= Birou)', rows.c_ana === 300, JSON.stringify(rows));
ok('Mihai: banca vede 750 (Birou 650 + 100 BNPL)', rows.c_mihai === 750, JSON.stringify(rows));
ok('Ioana: banca vede 900 (= Birou)', rows.c_ioana === 900, JSON.stringify(rows));
const old = (await db.query(`select net_income_lei::float n from public.bank_account_insights i join public.customers c on c.id=i.customer_id where c.code='c_ana'`)).rows[0];
ok('venitul existent nu s-a schimbat (Ana 5.200)', old.n === 5200);
await fails('Ana NU poate scrie in datele bancare', `${as('authenticated', ANA)} update public.bank_account_insights set installments_seen_lei = 0`, /permission denied/);

console.log('\nEvaluarea:');
ok('evaluarea veche (fara banca la rate) ramane valida', Number((await db.query(`select count(*) n from public.assessments`)).rows[0].n) === 1);
const ins = (app, used, bank, bankUsed = true) => `insert into public.assessments (application_id,net_income_lei,monthly_expenses_lei,other_installments_declared_lei,other_installments_bureau_lei,other_installments_used_lei,other_installments_bank_lei,new_installment_lei,billing_history_used,residual_lei,decision,engine_version,bank_data_used,income_verified_lei,income_used_lei,expenses_verified_lei,expenses_used_lei) values ('${app}',3900,1800,650,650,${used},${bank},169.49,true,0,'manual_review','engine-v3',${bankUsed},${bankUsed ? 3900 : 'null'},3900,${bankUsed ? 1800 : 'null'},1800)`;
await fails('folosit 650 cand banca arata 750 -> respins', ins(APP2, 650, 750), /assessments_other_installments_used_check/);
await fails('rate din banca fara acord bancar -> respins', ins(APP2, 750, 750, false), /assessments_bank_installments_check/);
await fails('rate din banca negative -> respins', ins(APP2, 650, -1), /check/);
await db.exec(ins(APP2, 750, 750));
ok('Mihai: folosit 750 (maximul cu banca) se salveaza', true);
await db.exec(ins(APP, 650, 'null', false));
ok('fara acord bancar: banca null, folosit = max(declarat, Birou)', true);

console.log(`\nRezultat: ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
