// Test rapid pe API-ul publicat (ruleaza de pe laptop: node supabase/tests/api_smoke.mjs)
// ATENTIE: creeaza cereri reale pentru Ana, Mihai si Ioana (jurnalul nu se poate sterge). E ok pentru demo.
// Back-office (optional): parola operatorului NU e in fisier. In PowerShell:
//   $env:OPERATOR_PASSWORD="..." ; node supabase/tests/api_smoke.mjs
// Fara variabila, testele de operator sunt sarite (SKIP).
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
ok('/consents fara nota de informare -> 400', (await call(ana, 'POST', `/applications/${id}/consents`, { billing_history: true, bank_data: true, privacy_notice_read: false })).status === 400);
ok('/consents fara bank_data -> 400 (camp obligatoriu)', (await call(ana, 'POST', `/applications/${id}/consents`, { billing_history: true, privacy_notice_read: true })).json?.error?.fields?.[0] === 'bank_data');
ok('/consents -> ok', (await call(ana, 'POST', `/applications/${id}/consents`, { billing_history: true, bank_data: true, privacy_notice_read: true })).json?.ok === true);
const forb = await call(ana, 'POST', `/applications/${id}/assessment`, { net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_lei: 300, health_status: 'x' });
ok('camp interzis (health_status) -> 400 FORBIDDEN_FIELD', forb.json?.error?.code === 'FORBIDDEN_FIELD', JSON.stringify(forb.json));
ok('Mihai NU vede cererea Anei -> 404', (await call(mihai, 'POST', `/applications/${id}/consents`, { billing_history: true, bank_data: true, privacy_notice_read: true })).status === 404);
const as = await call(ana, 'POST', `/applications/${id}/assessment`, { net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_lei: 300 });
ok('/assessment Ana -> approved', as.json?.decision === 'approved', JSON.stringify(as.json));
ok('Ana: venit verificat (Open Banking simulat) 5.200 = folosit', as.json?.verification?.bank_data_used === true && as.json?.verification?.source === 'Open Banking (simulat)' &&
  as.json?.verification?.income?.verified_lei === 5200 && as.json?.verification?.income?.used_lei === 5200 && as.json?.reasons?.[0]?.code === 'INCOME_VERIFIED', JSON.stringify(as.json?.verification));
ok('a doua evaluare -> 409', (await call(ana, 'POST', `/applications/${id}/assessment`, { net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_lei: 300 })).status === 409);

console.log('Mihai -> revizuire umana:');
const appM = await call(mihai, 'POST', '/applications', { sku: 'PH-3', product_id: 'RATE', term_months: 24, shown: { ad_warning: true, personalised_label: true } });
await call(mihai, 'POST', `/applications/${appM.json?.application_id}/consents`, { billing_history: true, bank_data: true, privacy_notice_read: true });
const asM = await call(mihai, 'POST', `/applications/${appM.json?.application_id}/assessment`, { net_income_lei: 3900, monthly_expenses_lei: 1800, other_installments_lei: 650 });
ok('/assessment Mihai -> manual_review (BILLS_LATE)', asM.json?.decision === 'manual_review' && asM.json?.reasons?.[0]?.code === 'BILLS_LATE', JSON.stringify(asM.json));
ok('Mihai: banca vede 750 lei rate (BNPL +100) -> folosit 750, motivul BANK_INSTALLMENTS_HIGHER', asM.json?.reasons?.[1]?.code === 'BANK_INSTALLMENTS_HIGHER' &&
  asM.json?.verification?.other_installments?.bank_lei === 750 && asM.json?.verification?.other_installments?.used_lei === 750, JSON.stringify(asM.json?.verification));

// ---------------- Partea 2 ----------------
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
const plusDays = (d, n) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const ioana = await login('ioana@demo.comb.ro', 'Demo2026!');
const idM = appM.json?.application_id;

console.log('Ana, starea cererii:');
const st = await call(ana, 'GET', `/applications/${id}`);
ok('GET /applications/:id -> approved, pasul urmator secci', st.json?.status === 'approved' && st.json?.next_step === 'secci' &&
  st.json?.decision?.decision === 'approved' && st.json?.offer?.installment_lei === 106.52 && st.json?.agreement_id === null, JSON.stringify(st.json));
ok('Mihai NU vede starea cererii Anei -> 404', (await call(mihai, 'GET', `/applications/${id}`)).status === 404);

console.log('Ana, SECCI:');
ok('OTP inainte de SECCI -> 409 SECCI_NOT_SHOWN', (await call(ana, 'POST', `/applications/${id}/otp`)).json?.error?.code === 'SECCI_NOT_SHOWN');
const sc = await call(ana, 'GET', `/applications/${id}/secci`);
ok('/secci -> v1, 106,52, DAE 15,96, 14 zile', sc.json?.secci_version === 'v1' && sc.json?.key?.installment_lei === 106.52 &&
  sc.json?.key?.apr_pct === 15.96 && sc.json?.key?.withdrawal_days === 14 && sc.json?.schedule?.length === 24, JSON.stringify(sc.json?.key));
const sc2 = await call(ana, 'GET', `/applications/${id}/secci`);
// jsonb din Postgres reordoneaza cheile -> comparam continutul cu cheile sortate
const canon = (v) => v === null || typeof v !== 'object' ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(canon).join(',')}]` : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
ok('/secci a doua oara -> acelasi document', canon(sc2.json) === canon(sc.json));
ok('Mihai NU vede SECCI-ul Anei -> 404', (await call(mihai, 'GET', `/applications/${id}/secci`)).status === 404);
ok('/secci/viewed -> ok', (await call(ana, 'POST', `/applications/${id}/secci/viewed`, { time_on_screen_ms: 42000, details_opened: false })).json?.ok === true);
ok('/secci/viewed camp in plus -> 400', (await call(ana, 'POST', `/applications/${id}/secci/viewed`, { time_on_screen_ms: 1, details_opened: true, x: 1 })).status === 400);
ok('/secci/email -> ok (simulat)', (await call(ana, 'POST', `/applications/${id}/secci/email`)).json?.ok === true);

console.log('Ana, OTP + semnare:');
ok('semnare fara cod cerut -> 400 OTP_NOT_REQUESTED', (await call(ana, 'POST', `/applications/${id}/sign`, { otp: '000000' })).json?.error?.code === 'OTP_NOT_REQUESTED');
const otp = await call(ana, 'POST', `/applications/${id}/otp`);
ok('/otp -> cod de 6 cifre, 300 s', /^\d{6}$/.test(otp.json?.otp_demo_code ?? '') && otp.json?.expires_in_s === 300, JSON.stringify(otp.json));
const wrong = otp.json?.otp_demo_code === '000000' ? '111111' : '000000';
const bad1 = await call(ana, 'POST', `/applications/${id}/sign`, { otp: wrong });
ok('cod gresit -> 400 OTP_INVALID (mai ai 4)', bad1.json?.error?.code === 'OTP_INVALID' && bad1.json?.error?.message.includes('4'), JSON.stringify(bad1.json));
ok('cod cu 5 cifre -> 400 VALIDATION', (await call(ana, 'POST', `/applications/${id}/sign`, { otp: '12345' })).json?.error?.code === 'VALIDATION');
const sg = await call(ana, 'POST', `/applications/${id}/sign`, { otp: otp.json?.otp_demo_code });
ok('/sign -> contract, termen azi+14, reminder zilele 1-7', !!sg.json?.agreement_id && sg.json?.withdrawal_deadline === plusDays(today, 14) &&
  sg.json?.reminder_window?.from === plusDays(today, 1) && sg.json?.reminder_window?.to === plusDays(today, 7), JSON.stringify(sg.json));
ok('a doua semnare -> 409 ALREADY_SIGNED', (await call(ana, 'POST', `/applications/${id}/sign`, { otp: otp.json?.otp_demo_code })).json?.error?.code === 'ALREADY_SIGNED');
ok('revizuire pe cerere semnata -> 409', (await call(ana, 'POST', `/applications/${id}/human-review`, {})).status === 409);
const agrId = sg.json?.agreement_id;
const st2 = await call(ana, 'GET', `/applications/${id}`);
ok('starea dupa semnare -> signed, pasul agreement, are agreement_id', st2.json?.status === 'signed' && st2.json?.next_step === 'agreement' && st2.json?.agreement_id === agrId, JSON.stringify(st2.json));

console.log('Ana, contract + "Sari la ziua 3" + retragere:');
const ag0 = await call(ana, 'GET', `/agreements/${agrId}`);
ok('/agreements -> active, se poate retrage, fara reminder in ziua 0', ag0.json?.status === 'active' && ag0.json?.can_withdraw === true && ag0.json?.reminders?.length === 0, JSON.stringify(ag0.json));
ok('Mihai NU vede contractul Anei -> 404', (await call(mihai, 'GET', `/agreements/${agrId}`)).status === 404);
ok('time-travel 61 zile -> 400', (await call(ana, 'POST', '/demo/time-travel', { agreement_id: agrId, days: 61 })).status === 400);
const tt = await call(ana, 'POST', '/demo/time-travel', { agreement_id: agrId, days: 3 });
ok('/demo/time-travel 3 -> azi+3', tt.json?.today === plusDays(today, 3), JSON.stringify(tt.json));
const ag3 = await call(ana, 'GET', `/agreements/${agrId}`);
ok('ziua 3 -> reminder trimis', ag3.json?.reminders?.length === 1 && ag3.json?.today === plusDays(today, 3), JSON.stringify(ag3.json));
ok('ziua 3 din nou -> tot 1 reminder', (await call(ana, 'GET', `/agreements/${agrId}`)).json?.reminders?.length === 1);
const wd = await call(ana, 'POST', `/agreements/${agrId}/withdraw`);
ok('/withdraw ziua 3 -> 2.201,69 lei, 3 zile', wd.json?.status === 'withdrawn' && wd.json?.amount_to_return_lei === 2201.69 && wd.json?.days_used === 3, JSON.stringify(wd.json));
ok('a doua retragere -> 409 ALREADY_WITHDRAWN', (await call(ana, 'POST', `/agreements/${agrId}/withdraw`)).json?.error?.code === 'ALREADY_WITHDRAWN');

console.log('Revizuire umana (client):');
ok('Mihai, deja in revizuire -> 409 REVIEW_PENDING', (await call(mihai, 'POST', `/applications/${idM}/human-review`, {})).json?.error?.code === 'REVIEW_PENDING');
const appI = await call(ioana, 'POST', '/applications', { sku: 'PH-2', product_id: 'RATE', term_months: 24, shown: { ad_warning: true } });
const idI = appI.json?.application_id;
await call(ioana, 'POST', `/applications/${idI}/consents`, { billing_history: false, bank_data: true, privacy_notice_read: true });
const asI = await call(ioana, 'POST', `/applications/${idI}/assessment`, { net_income_lei: 2600, monthly_expenses_lei: 1700, other_installments_lei: 900 });
ok('Ioana -> rejected + consiliere', asI.json?.decision === 'rejected' && !!asI.json?.debt_advice, JSON.stringify(asI.json));
ok('mesaj > 1000 caractere -> 400', (await call(ioana, 'POST', `/applications/${idI}/human-review`, { message: 'x'.repeat(1001) })).status === 400);
const hrI = await call(ioana, 'POST', `/applications/${idI}/human-review`, { message: 'Am un venit nou din ianuarie.' });
ok('Ioana cere revizuire -> manual_review + eta', hrI.json?.status === 'manual_review' && !!hrI.json?.eta_text, JSON.stringify(hrI.json));
const stI = await call(ioana, 'GET', `/applications/${idI}`);
ok('starea Ioanei -> wait_review, revizuire pending ceruta de client', stI.json?.next_step === 'wait_review' && stI.json?.review?.status === 'pending' &&
  stI.json?.review?.requested_by === 'customer' && stI.json?.decision?.decision === 'rejected', JSON.stringify(stI.json));
ok('a doua cerere de revizuire -> 409 REVIEW_PENDING', (await call(ioana, 'POST', `/applications/${idI}/human-review`)).json?.error?.code === 'REVIEW_PENDING');
ok('SECCI pe cerere in revizuire -> 409 NOT_APPROVED', (await call(ioana, 'GET', `/applications/${idI}/secci`)).json?.error?.code === 'NOT_APPROVED');
ok('Ana NU are back-office -> 403', (await call(ana, 'GET', '/backoffice/ledger')).status === 403);
ok('Ana NU vede coada -> 403', (await call(ana, 'GET', '/backoffice/reviews')).status === 403);

const OP_PASS = process.env.OPERATOR_PASSWORD;
if (!OP_PASS) {
  console.log('Operator: SKIP (seteaza OPERATOR_PASSWORD ca sa rulezi testele de back-office)');
} else {
  console.log('Operator, back-office:');
  const op = await login('operator@demo.comb.ro', OP_PASS);
  ok('operatorul NU poate da acorduri in numele clientului -> 403',
    (await call(op, 'POST', `/applications/${idI}/consents`, { billing_history: true, bank_data: true, privacy_notice_read: true })).status === 403);
  const lg = await call(op, 'GET', `/backoffice/ledger?application_id=${id}`);
  const evs = (lg.json?.entries ?? []).map((e) => e.event);
  const expected = ['offer_requested', 'ad_warning_shown', 'personalised_offer_disclosed', 'consent_given', 'consent_given', 'consent_given', 'assessment_done',
    'secci_shown', 'secci_viewed', 'secci_emailed', 'otp_sent', 'agreement_signed', 'withdrawal_reminder_sent', 'withdrawn'];
  ok('jurnalul Anei -> valid, 14 evenimente in ordine (3 acorduri)', lg.json?.valid === true && JSON.stringify(evs) === JSON.stringify(expected), JSON.stringify({ valid: lg.json?.valid, evs }));
  ok('jurnalul are articol CCD2 si hash pe fiecare rand', (lg.json?.entries ?? []).every((e) => e.ccd2_ref && /^[0-9a-f]{64}$/.test(e.hash)));
  const list = await call(op, 'GET', '/backoffice/ledger');
  ok('lista jurnalelor -> ultimele 25, toate valide', list.json?.all_valid === true && list.json?.count > 0 && list.json?.count <= 25, JSON.stringify({ all: list.json?.all_valid, n: list.json?.count }));
  ok('application_id invalid -> 400', (await call(op, 'GET', '/backoffice/ledger?application_id=abc')).status === 400);
  const rv = await call(op, 'GET', '/backoffice/reviews');
  const revI = rv.json?.reviews?.find((x) => x.application?.application_id === idI);
  const revM = rv.json?.reviews?.find((x) => x.application?.application_id === idM);
  ok('coada -> contine Ioana (client, cu mesaj) si Mihai (motor)', revI?.requested_by === 'customer' && !!revI?.customer_message && revM?.requested_by === 'engine', JSON.stringify(rv.json?.reviews?.length));
  const rsI = await call(op, 'POST', '/backoffice/reviews', { review_id: revI?.review_id, status: 'rejected', note: 'Venitul nou nu e dovedit inca.' });
  ok('respinge Ioana -> cererea rejected', rsI.json?.application_status === 'rejected', JSON.stringify(rsI.json));
  ok('a doua rezolvare -> 409', (await call(op, 'POST', '/backoffice/reviews', { review_id: revI?.review_id, status: 'approved' })).status === 409);
  const rsM = await call(op, 'POST', '/backoffice/reviews', { review_id: revM?.review_id, status: 'approved', note: 'Intarzieri izolate.' });
  ok('aproba Mihai -> cererea approved', rsM.json?.application_status === 'approved', JSON.stringify(rsM.json));
  const stM = await call(mihai, 'GET', `/applications/${idM}`);
  ok('starea lui Mihai dupa aprobare -> approved, pasul secci, revizuire approved', stM.json?.status === 'approved' && stM.json?.next_step === 'secci' && stM.json?.review?.status === 'approved', JSON.stringify(stM.json));
  const stI2 = await call(ioana, 'GET', `/applications/${idI}`);
  ok('starea Ioanei dupa respingere -> rejected + consiliere', stI2.json?.next_step === 'rejected' && !!stI2.json?.debt_advice, JSON.stringify(stI2.json));
  ok('Mihai vede acum SECCI -> 200', (await call(mihai, 'GET', `/applications/${idM}/secci`)).status === 200);
  for (let i = 0; i < 3; i++) await call(mihai, 'POST', `/applications/${idM}/otp`);
  ok('al 4-lea cod in 10 minute -> 429 OTP_RATE_LIMIT', (await call(mihai, 'POST', `/applications/${idM}/otp`)).json?.error?.code === 'OTP_RATE_LIMIT');
  const lgM = await call(op, 'GET', `/backoffice/ledger?application_id=${idM}`);
  ok('jurnalul lui Mihai -> valid, are human_review_resolved', lgM.json?.valid === true && lgM.json?.entries?.some((e) => e.event === 'human_review_resolved'));
}

// ---------------- ZERO4: casti in 4 rate fara dobanda (credit 0% de la un creditor tert -> tot sub CCD2) ----------------
console.log('Ana, ZERO4 (casti AC-1):');
const qz = await call(ana, 'POST', '/quotes', { sku: 'AC-1', product_id: 'ZERO4', term_months: 4 });
ok('/quotes AC-1 ZERO4 -> 4 x 99,75, total 399, cost 0, DAE 0', qz.json?.installment_lei === 99.75 && qz.json?.installments === 4 &&
  qz.json?.total_payable_lei === 399 && qz.json?.total_cost_lei === 0 && qz.json?.apr_pct === 0, JSON.stringify(qz.json));
ok('ZERO4 pe 12 luni -> 400 TERM_NOT_ALLOWED', (await call(ana, 'POST', '/quotes', { sku: 'AC-1', product_id: 'ZERO4', term_months: 12 })).json?.error?.code === 'TERM_NOT_ALLOWED');
ok('ZERO4 pe telefon -> 400 PRODUCT_NOT_APPLICABLE', (await call(ana, 'POST', '/quotes', { sku: 'PH-2', product_id: 'ZERO4', term_months: 4 })).json?.error?.code === 'PRODUCT_NOT_APPLICABLE');
const az = await call(ana, 'POST', '/applications', { sku: 'AC-1', product_id: 'ZERO4', term_months: 4, shown: { ad_warning: true, personalised_label: true } });
const idZ = az.json?.application_id;
ok('/applications ZERO4 -> 201 draft', az.status === 201 && !!idZ, JSON.stringify(az.json));
await call(ana, 'POST', `/applications/${idZ}/consents`, { billing_history: true, bank_data: true, privacy_notice_read: true });
const asZ = await call(ana, 'POST', `/applications/${idZ}/assessment`, { net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_lei: 300 });
ok('evaluare ZERO4 -> approved', asZ.json?.decision === 'approved', JSON.stringify(asZ.json?.decision));
const scZ = await call(ana, 'GET', `/applications/${idZ}/secci`);
ok('SECCI ZERO4 -> DAE 0, cost 0, 4 rate, 14 zile', scZ.json?.key?.apr_pct === 0 && scZ.json?.key?.total_cost_lei === 0 &&
  scZ.json?.schedule?.length === 4 && scZ.json?.key?.withdrawal_days === 14, JSON.stringify(scZ.json?.key));
const otpZ = await call(ana, 'POST', `/applications/${idZ}/otp`);
const sgZ = await call(ana, 'POST', `/applications/${idZ}/sign`, { otp: otpZ.json?.otp_demo_code });
ok('semnare ZERO4 -> contract, termen azi+14', !!sgZ.json?.agreement_id && sgZ.json?.withdrawal_deadline === plusDays(today, 14), JSON.stringify(sgZ.json));
await call(ana, 'POST', '/demo/time-travel', { agreement_id: sgZ.json?.agreement_id, days: 3 });
const wdZ = await call(ana, 'POST', `/agreements/${sgZ.json?.agreement_id}/withdraw`);
ok('retragere ZERO4 ziua 3 -> 399 lei, dobanda 0, text fara dobanda', wdZ.json?.amount_to_return_lei === 399 && wdZ.json?.interest_lei === 0 &&
  wdZ.json?.text === 'Returnezi suma primita, fara dobanda, in maximum 30 de zile.', JSON.stringify(wdZ.json));

console.log('Verificarea venitului (Open Banking, simulat):');
const aV = await call(ana, 'POST', '/applications', { sku: 'PH-1', product_id: 'RATE', term_months: 12, shown: { ad_warning: true, personalised_label: true } });
await call(ana, 'POST', `/applications/${aV.json?.application_id}/consents`, { billing_history: true, bank_data: true, privacy_notice_read: true });
const asV = await call(ana, 'POST', `/applications/${aV.json?.application_id}/assessment`, { net_income_lei: 9000, monthly_expenses_lei: 2100, other_installments_lei: 300 });
ok('Ana declara 9.000 -> se foloseste 5.200 din banca, motivul INCOME_VERIFIED_LOWER', asV.json?.verification?.income?.declared_lei === 9000 &&
  asV.json?.verification?.income?.used_lei === 5200 && asV.json?.reasons?.some((x) => x.code === 'INCOME_VERIFIED_LOWER'), JSON.stringify(asV.json));
const stV = await call(ana, 'GET', `/applications/${aV.json?.application_id}`);
ok('GET /applications/:id -> decision.verification salvat', stV.json?.decision?.verification?.income?.used_lei === 5200 &&
  stV.json?.decision?.verification?.income?.verified_lei === 5200, JSON.stringify(stV.json?.decision?.verification));
const aN = await call(ana, 'POST', '/applications', { sku: 'PH-1', product_id: 'RATE', term_months: 12, shown: { ad_warning: true, personalised_label: true } });
await call(ana, 'POST', `/applications/${aN.json?.application_id}/consents`, { billing_history: true, bank_data: false, privacy_notice_read: true });
const asN = await call(ana, 'POST', `/applications/${aN.json?.application_id}/assessment`, { net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_lei: 300 });
ok('fara acord bancar -> manual_review INCOME_NOT_VERIFIED (nu aprobare automata)', asN.json?.decision === 'manual_review' &&
  asN.json?.reasons?.[0]?.code === 'INCOME_NOT_VERIFIED' && asN.json?.verification?.bank_data_used === false && asN.json?.verification?.income?.verified_lei === null, JSON.stringify(asN.json));
ok('fara acord bancar -> ratele din banca nu se folosesc (bank_lei null)', asN.json?.verification?.other_installments?.bank_lei === null &&
  asN.json?.verification?.other_installments?.used_lei === 300, JSON.stringify(asN.json?.verification?.other_installments));
const stM2 = await call(mihai, 'GET', `/applications/${appM.json?.application_id}`);
ok('GET /applications/:id Mihai -> bank_lei 750 salvat', stM2.json?.decision?.verification?.other_installments?.bank_lei === 750, JSON.stringify(stM2.json?.decision?.verification?.other_installments));

console.log('Cardul „Cererea ta” (GET /applications/current):');
const curA = await call(ana, 'GET', '/applications/current');
ok('Ana -> ultima cerere in curs (cea fara acord bancar, in analiza)', curA.json?.application?.application_id === aN.json?.application_id &&
  curA.json?.application?.next_step === 'wait_review' && curA.json?.application?.device_name === 'Nova 3', JSON.stringify(curA.json));
if (OP_PASS) ok('Ioana -> respinsa dupa revizuire nu e „in curs”', (await call(ioana, 'GET', '/applications/current')).json?.application?.application_id !== idI);

console.log('Rata ratata (art. 35):');
const plusMonths = (d, n) => {
  const [y, m, day] = d.split('-').map(Number); const idx = m - 1 + n; const ny = y + Math.floor(idx / 12); const nm = idx % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
};
const daysDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
async function signNew(token, sku, product_id, term_months) {
  const a = await call(token, 'POST', '/applications', { sku, product_id, term_months, shown: { ad_warning: true, personalised_label: true } });
  const aid = a.json?.application_id;
  await call(token, 'POST', `/applications/${aid}/consents`, { billing_history: true, bank_data: true, privacy_notice_read: true });
  await call(token, 'POST', `/applications/${aid}/assessment`, { net_income_lei: 5200, monthly_expenses_lei: 2100, other_installments_lei: 300 });
  await call(token, 'GET', `/applications/${aid}/secci`);
  const o = await call(token, 'POST', `/applications/${aid}/otp`);
  const s = await call(token, 'POST', `/applications/${aid}/sign`, { otp: o.json?.otp_demo_code });
  return { aid, agr: s.json?.agreement_id };
}
const F = await signNew(ana, 'PH-2', 'RATE', 24);
ok('contract nou PH-2 pentru scena art. 35', !!F.agr, JSON.stringify(F));
const f0 = await call(ana, 'GET', `/agreements/${F.agr}`);
ok('ziua 0 -> nicio rata ratata, fara variante', f0.json?.missed_installment === null && f0.json?.forbearance_options === null &&
  f0.json?.forbearance === null && f0.json?.missed_notice === null, JSON.stringify(f0.json));
ok('alegere inainte de scadenta -> 409 NO_MISSED_INSTALLMENT',
  (await call(ana, 'POST', `/agreements/${F.agr}/forbearance`, { option: 'defer' })).json?.error?.code === 'NO_MISSED_INSTALLMENT');
await call(ana, 'POST', '/demo/time-travel', { agreement_id: F.agr, days: 35 });
const f35 = await call(ana, 'GET', `/agreements/${F.agr}`);
const due1 = plusMonths(today, 1);
const mi = f35.json?.missed_installment;
ok('ziua 35 -> rata 1 ratata (106,52, scadenta azi+1 luna)', mi?.n === 1 && mi?.amount_lei === 106.52 && mi?.due_date === due1 &&
  mi?.days_late === daysDiff(due1, plusDays(today, 35)), JSON.stringify(mi));
ok('ziua 35 -> mesaj simulat pe email', f35.json?.missed_notice?.channel === 'email (simulat)' && /nu a fost platita/.test(f35.json?.missed_notice?.text ?? ''), JSON.stringify(f35.json?.missed_notice));
const fo = f35.json?.forbearance_options;
ok('amanare -> aceeasi rata, +27,30 lei, total 2.583,72, 24 de rate', fo?.defer?.installment_lei === 106.52 && fo?.defer?.extra_cost_lei === 27.3 &&
  fo?.defer?.total_payable_lei === 2583.72 && fo?.defer?.installments === 24 && fo?.defer?.first_due_date === plusMonths(today, 2), JSON.stringify(fo?.defer && { ...fo.defer, schedule: undefined }));
ok('reesalonare -> 29 de rate de 91,89, total 2.664,80, +108,38 lei', fo?.reschedule?.installment_lei === 91.89 && fo?.reschedule?.installments === 29 &&
  fo?.reschedule?.total_payable_lei === 2664.8 && fo?.reschedule?.extra_cost_lei === 108.38 && fo?.reschedule?.schedule?.length === 29 &&
  fo?.reschedule?.last_due_date === plusMonths(today, 30), JSON.stringify(fo?.reschedule && { ...fo.reschedule, schedule: undefined }));
ok('„vorbeste cu un om” -> eta 24 de ore', fo?.talk?.eta_text === 'Un coleg revine in 24 de ore.', JSON.stringify(fo?.talk));
ok('ziua 35 din nou -> acelasi mesaj (o singura notificare)', (await call(ana, 'GET', `/agreements/${F.agr}`)).json?.missed_notice?.sent_at === f35.json?.missed_notice?.sent_at);
ok('Mihai NU poate alege pentru contractul Anei -> 404', (await call(mihai, 'POST', `/agreements/${F.agr}/forbearance`, { option: 'defer' })).status === 404);
ok('optiune necunoscuta -> 400', (await call(ana, 'POST', `/agreements/${F.agr}/forbearance`, { option: 'forgive' })).status === 400);
ok('camp in plus -> 400', (await call(ana, 'POST', `/agreements/${F.agr}/forbearance`, { option: 'defer', x: 1 })).status === 400);
const fd = await call(ana, 'POST', `/agreements/${F.agr}/forbearance`, { option: 'defer' });
ok('Ana alege amanarea -> salvata, +27,30 lei, text cu „Fara comisioane”', fd.json?.forbearance?.option === 'defer' && fd.json?.forbearance?.extra_cost_lei === 27.3 &&
  fd.json?.forbearance?.schedule?.length === 24 && /Fara comisioane\.$/.test(fd.json?.text ?? ''), JSON.stringify(fd.json && { ...fd.json, forbearance: { ...fd.json.forbearance, schedule: undefined } }));
ok('a doua alegere -> 409 FORBEARANCE_ALREADY_CHOSEN',
  (await call(ana, 'POST', `/agreements/${F.agr}/forbearance`, { option: 'reschedule' })).json?.error?.code === 'FORBEARANCE_ALREADY_CHOSEN');
const fAfter = await call(ana, 'GET', `/agreements/${F.agr}`);
ok('dupa alegere -> fara variante, masura vizibila', fAfter.json?.forbearance_options === null && fAfter.json?.forbearance?.option === 'defer', JSON.stringify(fAfter.json?.forbearance?.option));

const T = await signNew(ana, 'AC-1', 'ZERO4', 4);
await call(ana, 'POST', '/demo/time-travel', { agreement_id: T.agr, days: 35 });
const t35 = await call(ana, 'GET', `/agreements/${T.agr}`);
ok('ZERO4 ziua 35 -> amanarea costa 0 lei', t35.json?.forbearance_options?.defer?.extra_cost_lei === 0 && t35.json?.forbearance_options?.reschedule?.installments === 9, JSON.stringify(t35.json?.forbearance_options?.defer?.extra_cost_lei));
const tt35 = await call(ana, 'POST', `/agreements/${T.agr}/forbearance`, { option: 'talk' });
ok('„vorbeste cu un om” -> revizuire in coada (pending)', tt35.json?.forbearance?.option === 'talk' && tt35.json?.forbearance?.review?.status === 'pending' &&
  tt35.json?.text === 'Un coleg revine in 24 de ore.', JSON.stringify(tt35.json));
if (OP_PASS) {
  const op2 = await login('operator@demo.comb.ro', OP_PASS);
  const rvF = await call(op2, 'GET', '/backoffice/reviews');
  const revT = rvF.json?.reviews?.find((x) => x.application?.application_id === T.aid);
  ok('coada -> cererea art. 35 cu eticheta forbearance', revT?.topic === 'forbearance' && revT?.forbearance?.option === 'talk' && revT?.application?.status === 'signed', JSON.stringify(revT && { topic: revT.topic, f: revT.forbearance }));
  const rsT = await call(op2, 'POST', '/backoffice/reviews', { review_id: revT?.review_id, status: 'approved', note: 'Am vorbit cu clienta; plateste pe 30.' });
  ok('„Am contactat clientul” -> contractul ramane semnat', rsT.json?.application_status === 'signed', JSON.stringify(rsT.json));
  ok('clientul vede revizuirea rezolvata', (await call(ana, 'GET', `/agreements/${T.agr}`)).json?.forbearance?.review?.status === 'approved');
  const lgF = await call(op2, 'GET', `/backoffice/ledger?application_id=${F.aid}`);
  const evF = (lgF.json?.entries ?? []).map((e) => e.event);
  ok('jurnal amanare -> valid, installment_missed + forbearance_offered + forbearance_chosen (art. 35)', lgF.json?.valid === true &&
    JSON.stringify(evF.slice(-3)) === JSON.stringify(['installment_missed', 'forbearance_offered', 'forbearance_chosen']) &&
    (lgF.json?.entries ?? []).slice(-3).every((e) => e.ccd2_ref === 'art. 35'), JSON.stringify({ valid: lgF.json?.valid, last: evF.slice(-3) }));
  const lgT = await call(op2, 'GET', `/backoffice/ledger?application_id=${T.aid}`);
  const evT = (lgT.json?.entries ?? []).map((e) => e.event);
  ok('jurnal „om” -> valid, ...forbearance_chosen, human_review_requested, human_review_resolved', lgT.json?.valid === true &&
    JSON.stringify(evT.slice(-5)) === JSON.stringify(['installment_missed', 'forbearance_offered', 'forbearance_chosen', 'human_review_requested', 'human_review_resolved']),
    JSON.stringify({ valid: lgT.json?.valid, last: evT.slice(-5) }));
}

console.log(`\nRezultat: ${pass} OK, ${fail} FAIL`);
console.log(`Cererea Anei: ${id} | contract: ${agrId}`);
