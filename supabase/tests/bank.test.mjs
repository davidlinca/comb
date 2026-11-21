// Test local pentru migrarea „bank_verification” (PGlite), peste schema initiala + arhivare, plus data/bank_insights.sql.
// node bank.test.mjs ../migrations/<init>.sql ../migrations/<archive>.sql ../migrations/<bank>.sql ../../data/bank_insights.sql
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const [initSql, archiveSql, bankSql, insightsSql] = process.argv.slice(2).map((p) => readFileSync(p, 'utf8'));
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
try { await db.exec(bankSql); } catch (e) { console.log('EROARE MIGRARE:', e.message); process.exit(1); }
console.log('Cele 3 migrari au rulat fara erori.\n');

const ANA = '00000000-0000-0000-0000-00000000000a';
const MIH = '00000000-0000-0000-0000-00000000000b';
const OPS = '00000000-0000-0000-0000-0000000000ff';
const C_ANA = '10000000-0000-0000-0000-00000000000a', C_MIH = '10000000-0000-0000-0000-00000000000b', C_X = '10000000-0000-0000-0000-0000000000cc';
const APP = '20000000-0000-0000-0000-00000000000a', APP2 = '20000000-0000-0000-0000-00000000000b';
await db.exec(`
insert into auth.users values ('${ANA}','ana@demo'),('${MIH}','mihai@demo'),('${OPS}','operator@demo');
insert into public.devices values ('PH-2','Nova 5','phone',2199.00,true,1);
insert into public.credit_products values ('RATE','Rate prin partener','phone',14.9,0,'{12,24}','Credis IFN (demo)','Str. Exemplu 1 (demo)',true);
insert into public.customers (id,user_id,code,display_name,segment,tenure_months,plan_name,monthly_bill_lei) values
  ('${C_ANA}','${ANA}','c_ana','Ana Popescu','postpaid',38,'Nelimitat 15',45),
  ('${C_MIH}','${MIH}','c_mihai','Mihai Ionescu','postpaid',14,'Nelimitat 10',35),
  ('${C_X}',null,'c_x','Client Sintetic','prepaid',0,'Cartela',0);
insert into public.applications (id,customer_id,sku,product_id,term_months,principal_lei,installment_lei,installments,total_payable_lei,total_cost_lei,nominal_rate_pct,apr_pct) values
  ('${APP}','${C_ANA}','PH-2','RATE',24,2199,106.52,24,2556.42,357.42,14.9,15.96),
  ('${APP2}','${C_MIH}','PH-2','RATE',24,2199,106.52,24,2556.42,357.42,14.9,15.96);
`);

console.log('Acordul nou:');
await db.exec(`insert into public.consents (application_id,purpose,granted) values ('${APP}','bank_data',true)`);
ok('acordul bank_data e acceptat', true);
await fails('alt scop decat cele 3 e respins', `insert into public.consents (application_id,purpose,granted) values ('${APP}','social_media',true)`, /check constraint/);

console.log('\nDatele bancare (data/bank_insights.sql):');
await db.exec(insightsSql);
const rows = (await db.query(`select c.code, i.net_income_lei::float n, i.essential_expenses_lei::float e, i.source from public.bank_account_insights i join public.customers c on c.id=i.customer_id order by c.code`)).rows;
ok('toti cei 3 clienti au date bancare', rows.length === 3, JSON.stringify(rows));
const a = rows.find((r) => r.code === 'c_ana');
ok('Ana: 5.200 venit / 2.100 cheltuieli, sursa Open Banking (simulat)', a?.n === 5200 && a?.e === 2100 && a?.source === 'Open Banking (simulat)', JSON.stringify(a));
const x = rows.find((r) => r.code === 'c_x');
ok('clientul fara evaluare primeste valori sintetice > 0', x?.n > 0 && x?.e > 0 && x?.e < x?.n, JSON.stringify(x));
await db.exec(insightsSql);
ok('a doua rulare nu dubleaza', Number((await db.query(`select count(*) n from public.bank_account_insights`)).rows[0].n) === 3);

console.log('\nRLS si drepturi pe bank_account_insights:');
await db.exec(as('authenticated', ANA));
const own = (await db.query(`select customer_id from public.bank_account_insights`)).rows;
await reset();
ok('Ana vede doar randul ei', own.length === 1 && own[0].customer_id === C_ANA, JSON.stringify(own));
await db.exec(as('authenticated', OPS, { app_metadata: { role: 'operator' } }));
const all = Number((await db.query(`select count(*) n from public.bank_account_insights`)).rows[0].n);
await reset();
ok('operatorul vede tot', all === 3);
await fails('Ana NU poate scrie in datele bancare', `${as('authenticated', ANA)} update public.bank_account_insights set net_income_lei = 99999`, /permission denied/);
await fails('anon NU vede nimic', `${as('anon', ANA)} select * from public.bank_account_insights`, /permission denied/);

console.log('\nEvaluarea salveaza verificarea:');
const ins = (app, extra) => `insert into public.assessments (application_id,net_income_lei,monthly_expenses_lei,other_installments_declared_lei,other_installments_bureau_lei,other_installments_used_lei,new_installment_lei,billing_history_used,residual_lei,decision,engine_version${extra.cols}) values ('${app}',9000,1000,300,300,300,106.52,true,0,'approved','engine-v2'${extra.vals})`;
await fails('venit folosit gresit (nu e minimul) -> respins', ins(APP, { cols: ',bank_data_used,income_verified_lei,income_used_lei,expenses_verified_lei,expenses_used_lei', vals: ',true,5200,9000,2100,2100' }), /assessments_income_used_check/);
await fails('cheltuieli folosite gresit (nu e maximul) -> respins', ins(APP, { cols: ',bank_data_used,income_verified_lei,income_used_lei,expenses_verified_lei,expenses_used_lei', vals: ',true,5200,5200,2100,1000' }), /assessments_expenses_used_check/);
await fails('bank_data_used fara cifre verificate -> respins', ins(APP, { cols: ',bank_data_used,income_used_lei,expenses_used_lei', vals: ',true,9000,1000' }), /assessments_bank_used_check/);
await db.exec(ins(APP, { cols: ',bank_data_used,income_verified_lei,income_used_lei,expenses_verified_lei,expenses_used_lei', vals: ',true,5200,5200,2100,2100' }));
ok('evaluare corecta cu banca (9.000 declarat -> 5.200 folosit) se salveaza', true);
await db.exec(ins(APP2, { cols: ',income_used_lei,expenses_used_lei', vals: ',9000,1000' }));
ok('evaluare fara acord bancar (folosit = declarat) se salveaza', true);
const old = (await db.query(`select bank_data_used from public.assessments where application_id='${APP2}'`)).rows[0];
ok('bank_data_used implicit false', old.bank_data_used === false);

console.log(`\nRezultat: ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
