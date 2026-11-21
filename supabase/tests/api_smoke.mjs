// Test rapid pe API-ul publicat (ruleaza de pe laptop: node supabase/tests/api_smoke.mjs)
// ATENTIE: creeaza cereri reale pentru Ana si Mihai (jurnalul nu se poate sterge). E ok pentru demo.
const URL = 'https://ezynswlvqqrzahpblkxu.supabase.co';
const KEY = 'sb_publishable_LJBH2tJNlXCXEZCh9ujE2g_IBeMHh2f';
const API = `${URL}/functions/v1/api`;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? '  OK  ' : '  FAIL'} ${name}`, cond ? '' : extra); };

async function login(email, password) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`login ${email}: ${JSON.stringify(j)}`);
  return j.access_token;
}
const call = async (token, method, path, body) => {
  const r = await fetch(`${API}${path}`, {
    method, headers: { apikey: KEY, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

const ana = await login('ana@demo.comb.ro', 'Demo2026!');
const mihai = await login('mihai@demo.comb.ro', 'Demo2026!');

console.log('Securitate:');
ok('fara token -> 401', (await call(null, 'GET', '/me')).status === 401);
ok('cheia publishable in Authorization -> 401', (await call(KEY, 'GET', '/me')).status === 401);

console.log('Ana, fluxul pana la decizie:');
const me = await call(ana, 'GET', '/me');
ok('/me -> Ana Popescu', me.json?.display_name === 'Ana Popescu', JSON.stringify(me.json));
const cat = await call(ana, 'GET', '/catalog');
ok('/catalog -> 5 produse + avertisment', cat.json?.devices?.length === 5 && cat.json?.ad_warning?.startsWith('Atentie'), JSON.stringify(cat.json));
const q = await call(ana, 'POST', '/quotes', { sku: 'PH-2', product_id: 'RATE', term_months: 24 });
ok('/quotes PH-2 24 luni -> 106,52 / DAE 15,96', q.json?.installment_lei === 106.52 && q.json?.apr_pct === 15.96, JSON.stringify(q.json));
ok('/quotes termen gresit -> 400', (await call(ana, 'POST', '/quotes', { sku: 'PH-2', product_id: 'RATE', term_months: 36 })).status === 400);
ok('/applications fara avertisment afisat -> 400', (await call(ana, 'POST', '/applications', { sku: 'PH-2', product_id: 'RATE', term_months: 24 })).json?.error?.code === 'AD_WARNING_NOT_SHOWN');
const app = await call(ana, 'POST', '/applications', { sku: 'PH-2', product_id: 'RATE', term_months: 24, shown: { ad_warning: true, personalised_label: true } });
ok('/applications -> 201 draft', app.status === 201 && app.json?.status === 'draft', JSON.stringify(app.json));
const id = app.json?.application_id;
ok('/consents fara nota de informare -> 400', (await call(ana, 'POST', `/applications/${id}/consents`, { billing_history: true, privacy_notice_read: false })).status === 400);
ok('/consents -> ok', (await call(ana, 'POST', `/applications/${id}/consents`, { billing_history: true, privacy_notice_read: true })).json?.ok === true);
const forb = await call(ana, 'POST', `/applications/${id}/assessment`, { net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_lei: 300, health_status: 'x' });
ok('camp interzis (health_status) -> 400 FORBIDDEN_FIELD', forb.json?.error?.code === 'FORBIDDEN_FIELD', JSON.stringify(forb.json));
ok('Mihai NU vede cererea Anei -> 404', (await call(mihai, 'POST', `/applications/${id}/consents`, { billing_history: true, privacy_notice_read: true })).status === 404);
const as = await call(ana, 'POST', `/applications/${id}/assessment`, { net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_lei: 300 });
ok('/assessment Ana -> approved', as.json?.decision === 'approved', JSON.stringify(as.json));
ok('a doua evaluare -> 409', (await call(ana, 'POST', `/applications/${id}/assessment`, { net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_lei: 300 })).status === 409);

console.log('Mihai -> revizuire umana:');
const appM = await call(mihai, 'POST', '/applications', { sku: 'PH-3', product_id: 'RATE', term_months: 24, shown: { ad_warning: true, personalised_label: true } });
await call(mihai, 'POST', `/applications/${appM.json?.application_id}/consents`, { billing_history: true, privacy_notice_read: true });
const asM = await call(mihai, 'POST', `/applications/${appM.json?.application_id}/assessment`, { net_income_lei: 3900, monthly_expenses_lei: 1800, other_installments_lei: 650 });
ok('/assessment Mihai -> manual_review (BILLS_LATE)', asM.json?.decision === 'manual_review' && asM.json?.reasons?.[0]?.code === 'BILLS_LATE', JSON.stringify(asM.json));

console.log(`\nRezultat: ${pass} OK, ${fail} FAIL`);
console.log(`Cererea Anei: ${id}`);
