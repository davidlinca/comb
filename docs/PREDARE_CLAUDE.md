# Predare pentru Claude – conversatia urmatoare

Versiune: sambata 21.11.2026, 16:40 (**scena art. 35 SCRISA**: migratia `20261121143024 forbearance` APLICATA (MD5 verificat); engine `forbearance.ts` + ruta 12b + coada din back-office + teste (engine 45/45, flow 20/20 Node + Deno, PGlite 21/21, `deno check` ok, build web ok); **de comis (branch `feat/backend-forbearance`) + deploy v12 + smoke**; contract v0.6 trimis lui David. Urmeaza: QA pe Vercel, apoi continutul de business + Q&A in engleza). Versiunea 16:30 (**predare catre conversatia noua.** Cardul „Cererea ta” PUBLICAT: PR #21, api v11, smoke 81/81. Urmeaza la cod DOAR scena art. 35 – specificatia in 5.5, intrebarile deschise in 5.5.4; apoi QA final. David face interfata, prezentarea si video-ul; noi dam continutul de business + Q&A). Versiunea 16:15 (cardul „Cererea ta”: ruta `GET /applications/current` scrisa + teste, de comis + deploy; urmeaza scena art. 35 – reguli in DECIZII 1; extra ales: doar QR). Versiunea 16:00 (alte rate din banca PUBLICAT: PR #19, api v10, smoke 79/79; testat pe Vercel: Mihai cu „in cont 750”, ZERO4 cap-coada, Ioana cere analiza umana; `README.md` in engleza scris – de comis). Versiunea 15:40 (alte rate vazute in contul bancar: migratia `20261121132131 bank_installments` APLICATA, engine-v3 + API + ecranul 4 + back-office scrise, de comis + deploy – pasul 11 din 5.0). Versiunea 15:00 (**formatul prezentarii s-a schimbat (organizatori, 13:34): 3 min business + 1 min demo INREGISTRAT + 2 min Q&A, fara laptop propriu** – DECIZII 1 si 10; reminderul cu data in romana publicat (PR #17, api v9); lista 5.0 refacuta). Versiunea 14:50 (Vercel live https://comb-sigma.vercel.app, testat cap-coada: Ana pana la retragere, Ioana, Mihai aprobat de operator; „Telvia (demo)” publicat (api v7); reminder cu data in romana – scris, de publicat). Versiunea 14:20 (pasii 1–3 din 5.0 facuti: ecranele 0–4 si `feat/backend-web-fixes` in `main` la `e106624`, arhivarea rulata la 14:11; urmeaza Vercel). Versiunea 13:55: ecranele 0–4 ale lui David testate live pe API-ul real; lista de lucru noua in 5.0. Versiunea 12:15: verificarea venitului prin Open Banking simulat: migratie + date + engine-v2 + API v0.3; inainte: arhivare cereri demo + `docs/ARHITECTURA.md`; pitch in engleza 3–5 min, aplicatia ramane in romana; urmeaza integrarea cu David – vezi 5.0). Scris pentru conversatia noua (Opus 5.5, effort extra).
Sursa de adevar pentru DECIZII ramane `DECIZII_HACKATHON.md`. Fisierul asta spune CUM lucram, UNDE e totul, CE e gata si CE urmeaza exact.

---

## 0. Primii pasi in conversatia noua (in ordinea asta)

1. Citeste COMPLET, din proiectul claude.ai „HACKATHON”: `HACKATHON/DECIZII_HACKATHON.md` si `HACKATHON/PREDARE_CLAUDE.md` (fisierul asta). Brieful (`Telco_Embedded_Financing_Challenge_Nov_2026.pdf`) si cele 2 poze cu notite de pitch le citesti doar daca ai nevoie.
2. Ataseaza repo-ul: `add_repo` owner `davidlinca`, repo `comb`, apoi `git clone --depth 1 https://github.com/davidlinca/comb /home/claude/comb`. Push-ul din sesiune e refuzat (aplicatia Claude nu e instalata pe contul lui David) – nu e nevoie: Bogdan da commit-urile. (Repo-ul e public: `add_repo` poate raspunde ca citirea merge direct si propune clona in `/home/claude/davidlinca/comb` – e ok.)
3. Cere acces la folderul lui Bogdan: `device_request_folder_access` cu `D:\HACKATHON\comb`. Acolo scrii fisierele (vezi sectiunea 6). Daca raspunde ca fereastra desktop nu e disponibila, Bogdan deschide aplicatia Claude desktop si reincerci.
4. Verifica starea pe server (doar citire): `list_migrations`, `list_edge_functions`, numaratori din tabele, `ledger_verify` pe toate cererile.
5. Da-i lui Bogdan un rezumat de maximum 6 randuri, apoi incepi cu sectiunea 5.4 (comenzile git in asteptare) si continui cu lista din 5.0, de la primul pas nefacut.

---

## 1. Reguli de lucru (cerute de Bogdan – respecta-le strict)

- **Raspunsuri scurte, pas cu pas, in romana.** Textele pe care Bogdan le da altora (titlu/descriere PR, mesaje WhatsApp catre David) sunt **fara diacritice**, scurte.
- **Orice decizie o luati impreuna:** intrebi cu variante + recomandare (unealta AskUserQuestion), inclusiv decizii mici care schimba contractul API, datele sau comportamentul vizibil. Nu decizi singur.
- **Baza de date:** inainte de orice aplicare (migratii, RLS, date, update-uri) arati exact ce rulezi si astepti aprobarea. Nu stergi si nu suprascrii nimic fara confirmare. Citirile (select, advisors, logs) sunt ok fara aprobare.
- **Inainte de aplicare: testezi local** (vezi 4.4 – PGlite pentru SQL, Node + Deno pentru motor, `deno check` pentru API).
- **`web/` e al lui David.** Nu-l modifici fara sa intrebi. Back-office-ul il facem noi in `web/src/backoffice/` (decis 21.11, 03:00); **ii spunem lui David doar cand e gata** (el lucreaza la ecrane). Linia din router-ul lui o adaugam doar cu acordul lui.
- **Orele din planul din DECIZII sunt orientative:** cand un pas e gata, trecem la urmatorul.
- **Git:** lucrezi pe branch-uri `feat/backend-<ce>`. Tu scrii fisierele in `D:\HACKATHON\comb`, **Bogdan da commit, push, PR si merge** (fiecare face merge la PR-urile lui, fara review). La final de pas ii dai comenzile git exacte + titlu si descriere PR (fara diacritice).
- **Dupa fiecare pas terminat:** raport exact – ce fisiere, ce s-a aplicat, ce teste au trecut, cum verifica el, ce urmeaza.
- **Schimbari pentru David:** orice schimbare de contract API → (1) mesaj WhatsApp pentru David si Claude-ul lui, prin cardul de mesaj, fara diacritice, **din timp**; (2) actualizezi sectiunea 6 din DECIZII.
- **`DECIZII_HACKATHON.md` se tine la zi in AMBELE locuri:** in proiect (`project_write` pe `HACKATHON/DECIZII_HACKATHON.md`) si in repo (`docs/DECIZII_HACKATHON.md`, scris in folderul lui Bogdan). Spui exact ce ai schimbat. La fel pentru fisierul asta.
- **Effort:** spune-i cand sa schimbe. Extra pentru portile complicate (securitate, OTP/semnare, retragere, jurnal), high pentru restul, medium pentru lucruri simple. Sonnet doar pentru ceva foarte usor (nu recomandat). Are reset de tokenuri; sesiunea curenta conteaza doar pentru proiectul asta.
- **Daca ceva poate fi depasit** (Supabase, Vercel, CCD2): cauti in documentatia oficiala (Supabase `search_docs`, web) inainte sa implementezi.
- **Nu inventa cifre pentru pitch.** Datele sintetice nu sunt dovezi; cifra „inainte/dupa” vine doar din testul lui David cu oameni.

---

## 2. Unde e totul

| Ce | Valoare |
|---|---|
| Repo | https://github.com/davidlinca/comb (public). La 16:30 `main` la `c0db138` (PR #21 ruta „Cererea ta”; #20 README; #19 alte rate din banca; #18 David „(simulat)”; #17 reminder cu data in romana; #16 ecranele 5–6 ale lui David). Folderul lui Bogdan e pe `main`; dupa commit-ul de docs de la 16:30 trebuie sa fie curat. Verifica cu `git ls-remote` |
| Folder local Bogdan | `D:\HACKATHON\comb` (Windows, PowerShell). Montat in device_bash la `$HOME/mnt/comb` |
| Supabase | proiect `comb`, ref `ezynswlvqqrzahpblkxu`, org „MareBogdan's Org” (Free), regiunea eu-central-1 |
| URL | `https://ezynswlvqqrzahpblkxu.supabase.co` |
| Cheia publishable | `sb_publishable_LJBH2tJNlXCXEZCh9ujE2g_IBeMHh2f` (publica, merge in front, doar in headerul `apikey`) |
| Cheia secret | DOAR in mediul Edge Function (`SUPABASE_SECRET_KEYS`). Niciodata in chat, fisiere sau front |
| API | `https://ezynswlvqqrzahpblkxu.supabase.co/functions/v1/api` – Edge Function `api` **versiunea 11** (engine-v3: alte rate din banca; ruta 6c `GET /applications/current`), deploy de Bogdan cu CLI la 16:25, smoke 81/81; `verify_jwt = false` |
| Migratii aplicate | `20261120231817 init_schema`, `20261121091630 application_archive` (coloana `applications.archived_at` + index partial; 21.11, 11:16), `20261121094520 bank_verification` (acord `bank_data`, tabel `bank_account_insights`, 5 coloane in `assessments`; 21.11, 11:45), `20261121132131 bank_installments` (coloana `bank_account_insights.installments_seen_lei` completata – banca = Birou, Mihai 750; `assessments.other_installments_bank_lei`; regula „folosit = max(declarat, Birou, banca)”; 21.11, 15:21, MD5 verificat), `20261121143024 forbearance` (art. 35: 3 evenimente noi, `notifications.kind` += `installment_missed` cu index unic pe cerere, tabel `forbearance_measures` – una pe contract, RLS ca la contracte; 21.11, 16:30, MD5 verificat, advisors fara nimic nou). Date: `data/bank_insights.sql` rulat (63 de randuri) |
| Secrete Edge Function | `OTP_PEPPER` (setat de Bogdan cu `npx supabase secrets set` pe 21.11, valoarea nu apare nicaieri), `ALLOWED_ORIGINS` (de setat cu domeniul Vercel) |
| Conturi demo | `ana@`, `mihai@`, `ioana@demo.comb.ro` – parola `Demo2026!` (publica, in front). `operator@demo.comb.ro` – parola doar la Bogdan, `app_metadata.role = operator` |
| Vercel | **Live: https://comb-sigma.vercel.app** (proiect pe contul lui David, root `web`, se republica singur la fiecare merge in `main`). `ALLOWED_ORIGINS` = `https://comb-sigma.vercel.app,http://localhost:5173,http://127.0.0.1:5173` (setat de Bogdan la 14:35). Conectorul Vercel din claude.ai e pe contul lui Bogdan si nu vede proiectul |
| Proiect claude.ai | „HACKATHON”: `DECIZII_HACKATHON.md`, `PREDARE_CLAUDE.md`, brieful PDF, 2 poze cu notite de pitch |
| Doc de invatare pentru Bogdan | https://claude.ai/artifact/Gppawttr1LQRGWbNVNb36b (Docs) |

**Starea datelor pe server (21.11, 14:20):** 63 clienti, 67 cereri (42 vizibile, 25 arhivate – toate cererile conturilor demo, ultima arhivare 14:11), 567 intrari in jurnal, 0 jurnale invalide, 22 contracte, 63 randuri bancare. Edge Function `api` versiunea 6 (engine-v2).

---

## 3. Ce e gata

| Pas | Stare | Unde | Teste |
|---|---|---|---|
| Schema + RLS (15 tabele) | aplicat pe server | `supabase/migrations/20261120231817_init_schema.sql` | `supabase/tests/schema.test.mjs` – 25/25 (PGlite) |
| Motorul (DAE, rate, decizie, lista alba, retragere, SECCI) | in repo | `supabase/functions/_shared/engine/` | `engine.test.ts` – 25/25 in Node si Deno |
| Date demo | aplicat pe server (rulat de Bogdan in SQL Editor) + conturi legate | `data/generate_seed.ts` → `data/seed_demo.sql`, `data/link_accounts.sql` | `supabase/tests/seed.test.mjs` |
| API partea 1 (rutele 1–6) | publicat (CLI), testat pe server | `supabase/functions/api/` | `supabase/tests/api_smoke.mjs` – 15/15 |
| API partea 2 (rutele 6b, 7–16) | publicat (CLI, v3), testat pe server 62/63 (FAIL-ul era in test: ordinea cheilor din jsonb; reparat) | `routes/signing.ts`, `routes/agreements.ts`, `routes/backoffice.ts`, `lib/flow.ts`, `GET /applications/:id` in `routes/customer.ts` | `lib/flow.test.ts` 12/12 (Node + Deno), `deno check` ok; `api_smoke.mjs` extins la 71 verificari (cu ZERO4), 71/71 pe server la 10:40 |
| Back-office | scris, testat pe server cu operatorul (pagina de proba) | `web/src/backoffice/` (Backoffice, LedgerView, ReviewsView, api, format, ui, README) + `tools/backoffice-dev/` | `npm run build` (tsc strict + vite) ok; verificat in Chrome: 25/25 jurnale intacte, coada cu 7 cereri, „Vezi jurnalul” merge |
| Checklist CCD2 + securitate | in DECIZII, sectiunile 13–14 | `docs/` | – |
| Rata ratata (art. 35) | migratie aplicata; cod scris, **de comis + deploy v12** | `supabase/migrations/20261121143024_forbearance.sql`, `_shared/engine/forbearance.ts` (+ `amortize` comun in `loan.ts`), `routes/agreements.ts` (12 + 12b), `routes/backoffice.ts` (`topic`), `lib/flow.ts`, `web/src/backoffice/ReviewsView.tsx` | engine 45/45 si flow 20/20 (Node + Deno), `npm run test:forbearance` 21/21 (PGlite), `buildQuote` identic cu `main` pe 110 combinatii, `deno check` ok, `npm run build` ok; `api_smoke.mjs` extins (+22 verificari, 6 cu operator) |

### 3.1 Schema (rezumat)
Tabele: `customers`, `billing_history`, `credit_bureau_records`, `devices`, `credit_products`, `applications` (oferta salvata ca snapshot), `consents`, `assessments`, `human_reviews`, `secci_documents`, `otp_challenges`, `agreements` (are `demo_offset_days` pentru „sari la ziua 3”), `notifications`, `ledger_event_types`, `ledger_entries`.
- Schema `private`: `is_operator()` (din `auth.jwt()->app_metadata->role`), `my_customer_id()` (security definer), `ledger_hash(...)`, trigger-ele jurnalului. `public.ledger_verify(uuid)` – executabila doar de `service_role`.
- RLS: clientul citeste doar ale lui; operatorul citeste tot; `ledger_entries` doar operatorul; `otp_challenges` fara politici (nimeni din browser).
- Drepturi: `anon` nu are nimic; `authenticated` doar SELECT; toate scrierile prin API cu cheia secret.
- Jurnal: trigger BEFORE INSERT pune `seq`, `prev_hash`, `ccd2_ref` (din `ledger_event_types`), `hash` (SHA-256), lock per cerere, `occurred_at` nu poate scadea. UPDATE/DELETE/TRUNCATE blocate pentru oricine.
- Evenimente existente: `offer_requested`, `ad_warning_shown`, `personalised_offer_disclosed`, `consent_given`, `assessment_done`, `debt_advice_shown`, `human_review_requested`, `human_review_resolved`, `secci_shown`, `secci_viewed`, `secci_emailed`, `otp_sent`, `agreement_signed`, `withdrawal_reminder_sent`, `withdrawn`. Un eveniment NOU cere migrare (insert in `ledger_event_types`).
- Statusuri `applications.status`: `draft`, `approved`, `manual_review`, `rejected`, `signed`, `cancelled`. `agreements.status`: `active`, `withdrawn`.

### 3.2 Motorul (`supabase/functions/_shared/engine/`)
Pur TypeScript, fara DB/retea, aceleasi teste in Node si Deno. Exporta din `index.ts`: `buildQuote`, `aprPct`, `assessAffordability`, `countLateBills12m`, `validateAssessmentInput`, `withdrawalDeadline`, `reminderWindow`, `withdrawalAmount`, `canWithdraw`, `buildSecci`, `canonicalJson`, `sha256Hex`, `localDate`, `addDays`, `addMonths`, `daysBetween`, formatari ro-RO. `ENGINE_VERSION = 'engine-v1'`.
`ENGINE_VERSION = 'engine-v3'` (21.11, 15:40): input nou `bank_installments_lei`; alte rate = max(declarat, Birou, banca – doar cu acord); `verification.other_installments.bank_lei`; motiv nou `BANK_INSTALLMENTS_HIGHER`; teste 38/38 Node + Deno; PGlite `npm run test:bankinst` 11/11.
`ENGINE_VERSION = 'engine-v2'` (21.11, 11:45): input nou `bank_income_lei`, `bank_expenses_lei`, `bank_status` (`used`/`no_consent`/`unavailable`); rezultat nou `verification` + `metrics.income_used_lei/expenses_used_lei`; `MAX_REASONS = 4`; motivele de respingere primele. Reguli decise (DECIZII sectiunea 5): venit = min(declarat, banca), cheltuieli = max(declarat, banca), fara acord bancar → revizuire umana; DAE cu 12 luni egale; rata rotunjita la ban, ultima ajustata; prima rata la o luna de la semnare; alte rate = max(declarat, Birou); praguri 40% / 0 / 500 lei / 2 facturi > 30 zile; retragere 14 zile, suma = credit + dobanda zilnica (rata/365), returnare 30 zile; reminder zilele 1–7 daca semnat la < 24h de la SECCI.
Valori Ana (PH-2, 24 luni): 106,52 lei/luna, ultima 106,46, total 2.556,42, cost 357,42, DAE 15,96%.

### 3.3 API partea 1 (`supabase/functions/api/`)
- `index.ts`: Hono, `basePath('/api')`, CORS din secretul `ALLOWED_ORIGINS` (implicit `http://localhost:5173,http://127.0.0.1:5173`), `/health` fara auth, apoi `requireUser` pe tot, `onError` → `{ error: { code, message, fields? } }`, erorile 500 logheaza doar un id (fara date personale).
- `lib/auth.ts`: `requireUser` – tokenul din `Authorization: Bearer`, respinge `sb_...`, verifica cu `authClient.auth.getClaims(token)`; pune in context `userId`, `isOperator` (doar `app_metadata.role`), `db` (client cu tokenul userului → RLS). `requireOperator` pentru back-office.
- `lib/supabase.ts`: cheile din `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` (JSON, cheia `default`); `admin` = cheia secret, DOAR pentru scrieri dupa verificare.
- `lib/data.ts`: `myCustomer` (403 pentru operator pe rutele de client), `visibleApplication` (citeste prin RLS → 404 daca nu e a lui), `catalog`.
- `lib/ledger.ts`: `appendLedger(appId, events[])` – un singur insert, in ordine.
- `lib/http.ts`: `ApiError`, `bad`, `forbidden`, `notFound`, `conflict`, `readJson`, `onlyKeys`, `isUuid`.
- `routes/customer.ts`: rutele 1–6 (`/me`, `/catalog`, `/quotes`, `/applications`, `/applications/:id/consents`, `/applications/:id/assessment`). `POST /applications` cere `shown.ad_warning = true` si, pentru postpaid, `shown.personalised_label = true`. La `manual_review` motorul creeaza automat un rand in `human_reviews` (requested_by `engine`).
- `deno.json`: `hono@4.13.19`, `@supabase/supabase-js@2.119.2` (import map; `hono/cors`, `hono/factory` mapate explicit).
- Contractul cu schimbarile v0.1 e in DECIZII, sectiunea 6. Mesajul cu schimbarile i-a fost trimis lui David.

### 3.4 API partea 2 (`supabase/functions/api/`, 21.11, 03:25)
- `routes/customer.ts`: in plus `GET /applications/:id` (6b) – doar citire prin RLS, fara jurnal; `next_step` vine din `nextStep()` (`lib/flow.ts`). `DEBT_ADVICE` e acum exportat din motor (`affordability.ts`), acelasi text.
- `lib/data.ts`: `myApplication(db, userId, id)` = `myCustomer` + `visibleApplication` + proprietar (operator → 403, altcineva → 404) – folosit acum si de rutele 5–6 (inchide gaura prin care operatorul putea da acorduri in numele clientului). `myAgreement`, `savedSecci`.
- `lib/flow.ts` (pur, testat): `newOtpCode` (fara bias), `otpHash` = sha256(appId|cod|OTP_PEPPER), `safeEqual`, `otpState`, `demoToday`, `reminderDue`, `canWithdrawNow`, `sameKeyFigures`, `OPERATOR_NAME = 'Operatorul demo'`.
- `routes/signing.ts` (7–11): revizuirea muta cererea in `manual_review` (update conditionat de statusul citit); SECCI salvat o data (unic pe cerere + versiune, fara eveniment dublu); OTP citit/scris cu `admin` (tabelul nu are politici), max 3/10 min, 5 incercari, codul consumat cu update conditionat; la semnare graficul porneste de la data semnarii si cifrele cheie trebuie sa fie identice cu snapshot-ul.
- `routes/agreements.ts` (12–14): „azi” = data reala + `demo_offset_days`; reminderul se creeaza lazy la `GET`; retragerea calculeaza cu „azi” din demo; jurnalul pastreaza ora reala, payload-ul are `demo_offset_days`. Cererea ramane `signed` dupa retragere (ca in seed); doar contractul devine `withdrawn`.
- `routes/backoffice.ts` (15–16): montat la `/backoffice` (ATENTIE: un `use('*')` intr-un router montat la `/` s-ar aplica pe toate rutele); lista = ultimele 25 de cereri, `ledger_verify` in paralel prin `admin.rpc`; rezolvarea revizuirii schimba statusul cererii doar din `manual_review`/`approved`/`rejected`.
- Jurnal: payload-urile noi nu au date personale (`has_message`, `has_note`, nu textul).

### 3.5 Back-office (`web/src/backoffice/`, 21.11, 04:00)
- Decuplat: doar `react` + clase Tailwind (fara shadcn, fara cod de-al lui David). Props: `apiUrl`, `publishableKey`, `getAccessToken()`, optional `operatorName`, `onLogout`. Integrarea = o ruta `/backoffice` in router-ul lui David (exemplu in `README.md`), cu acordul lui.
- `LedgerView`: lista ultimelor 25 de cereri cu verificarea lantului + detaliul cu sigiliul „Jurnal verificat” / „Jurnal compromis” si lantul (fiecare intrare „legata de” hash-ul anterior, payload la cerere). `ReviewsView`: coada `pending` (sau toate), motive + cifre + mesajul clientului, nota + Aproba/Respinge, se actualizeaza singura la 10 s, „Vezi jurnalul cererii”.
- Formatari: lei `1.234,56 lei`, ora Romaniei; „CCD2” doar pentru referintele `art. ...` (`GDPR art. 7` ramane asa).
- `tools/backoffice-dev/`: Vite 8 + React 19 + Tailwind 4, login de operator, randeaza aceeasi componenta; `npm install`, `npm run dev` (port 5173 fix, permis de CORS). `resolve.dedupe` + `server.fs.allow` + `@source` pentru fisierele din `web/`; `tsconfig.paths` pentru tipurile React.
- Capcana: Aproba/Respinge scrie in baza si in jurnal (ireversibil) – nu testa pe cererile demo ale lui Mihai/Ioana.

---

## 4. Cum lucram tehnic (capcane deja descoperite – nu le repeta)

### 4.1 Retea
- **Nici sandbox-ul cloud, nici VM-ul `device_bash` nu ajung la `*.supabase.co`.** Testele pe API-ul publicat le ruleaza Bogdan pe laptop: `node supabase/tests/api_smoke.mjs`. Logurile functiei le citesti cu `query_logs` (Supabase MCP).
- Supabase MCP merge: `execute_sql`, `apply_migration`, `get_advisors`, `list_*`, `search_docs`, `query_logs`.

### 4.2 SQL mare si deploy
- **Nu retranscrie fisiere SQL mari prin `execute_sql`/`apply_migration`** (seed-ul are 270 KB). Bogdan le ruleaza in Supabase → SQL Editor (Ctrl+A din fisier, Run). Migratiile mici le aplici tu cu `apply_migration`, dupa aprobare, apoi compari MD5-ul din `supabase_migrations.schema_migrations.statements` cu fisierul si redenumesti fisierul local cu versiunea data de server.
- **Deploy-ul API-ului il face Bogdan cu CLI** (publica exact ce e in git, include `_shared/` singur):
  `npx supabase@latest functions deploy api --project-ref ezynswlvqqrzahpblkxu --use-api --no-verify-jwt`
  (CLI 3.2 avertizeaza ca `--project-ref` e depreciat in favoarea `--remote=<ref>` – merge oricum). Bogdan e deja logat in CLI. Nu face deploy prin MCP (ar trebui retranscrise toate fisierele).
- `supabase/config.toml` are `[functions.api] verify_jwt = false`.

### 4.3 Folderul lui Bogdan si git
- Scrii fisierele asa: le copiezi in `/mnt/user-data/outputs/comb/<cale>` si apoi `device_commit_files` cu `D:\HACKATHON\comb\<cale cu \>`. Inainte sa suprascrii un fisier existent, verifici ca Bogdan nu l-a modificat (compara cu versiunea din `main`).
- **Capcane la copiere:** (1) nu trimite `cp` si `device_commit_files` in acelasi bloc paralel – commit-ul poate pleca inainte de copiere; (2) cand retrimiti acelasi fisier, fa `touch` pe copia din outputs inainte – altfel poate ajunge versiunea veche desi raspunsul zice „written”. Dupa scriere verifici mereu: `tr -d '\r' < fisier | md5sum` in `device_bash` vs `md5sum` la tine.
- `npm install` pe Windows rescrie `package-lock.json` (scoate dependinte optionale de alta platforma). Normal; se comite versiunea lui Bogdan.
- **NU rula comenzi git care scriu in `D:\HACKATHON\comb` prin `device_bash`** (fetch, pull, commit, checkout, status cu refresh): stergerea e blocata acolo, git lasa fisiere `.lock` si blocheaza git-ul lui Bogdan. Un `git fetch` a lasat deja `.git/objects/maintenance.lock` (mutat in `.git/stale-maintenance-lock-claude`). Citire cu `git log`/`git diff` e ok.
- In VM, git arata aproape toate fisierele ca modificate din cauza CRLF (Windows, autocrlf). E normal. Foloseste `git diff --ignore-cr-at-eol`.
- Clona ta din `/home/claude/comb` e doar pentru lucru si teste; adevarul e GitHub `main` + folderul lui Bogdan.

### 4.4 Teste locale
- **Motor:** `node --test supabase/functions/_shared/engine/engine.test.ts` (Node 22 cu type stripping: fara `enum`, fara parameter properties in constructori) si `deno test`.
- **Reguli API partea 2:** `node --test supabase/functions/api/lib/flow.test.ts` (si `deno test` pe acelasi fisier).
- **Deno:** nu e instalat implicit; `cd /tmp/denotest && npm i deno` → `/tmp/denotest/node_modules/.bin/deno`. Pentru API: `cd supabase/functions/api && deno check --config deno.json index.ts`. Nu pune `deno.lock` in repo (lockfile-ul Deno 2.9 poate sa nu fie acceptat de runtime-ul Edge).
- **SQL:** PGlite (`npm i @electric-sql/pglite`) + stub-urile din `supabase/tests/schema.test.mjs` (roluri anon/authenticated/service_role, `auth.users`, `auth.uid()`, `auth.jwt()`). Ruleaza migrarea NOUA peste cea existenta inainte de aplicare. Atentie: functiile SQL `language sql` se valideaza la creare → tabelele trebuie sa existe inainte.
- Dupa orice DDL: `get_advisors` security + performance. Normale acum: INFO `otp_challenges` fara politici (intentionat), WARN „leaked password protection” (setare Auth, ignorata pentru demo), INFO „unused index”.

### 4.5 Conventii de cod
- Citiri prin `c.get('db')` (RLS). Scrieri prin `admin` DOAR dupa `myApplication`/`myAgreement` (adica dupa ce RLS a confirmat proprietarul si ca userul e client); in back-office, dupa `requireOperator`.
- Fiecare pas al clientului scrie in jurnal prin `appendLedger`. Payload fara date personale in clar (coduri, id-uri, sume ale ofertei, hash-uri; inputurile evaluarii doar ca `inputs_sha256`).
- Body-uri validate cu `onlyKeys` (lista alba) + tipuri; erori cu coduri stabile (David le foloseste).
- Bani `numeric(12,2)` in DB, `Number(...)` la citire; calcule in motor.
- Datele in ora Romaniei (`localDate`), format `YYYY-MM-DD`.

---

## 5. Ce urmeaza (exact)

### 5.1 API partea 2 – SCRIS (21.11, 03:25)
Implementat dupa specificatia de mai jos, cu deciziile din 5.3. Contractul final e in DECIZII, sectiunea 6 („Schimbari v0.2”). **Publicat** (v3, `OTP_PEPPER` setat, smoke 62/63 – FAIL-ul era in test, reparat) si in `main` (PR #6). Atentie la teste: jsonb reordoneaza cheile, deci documentele salvate se compara cu cheile sortate. Specificatia initiala (pastrata ca referinta):
- **7. `POST /applications/:id/human-review`** `{ message? }` (max 1000 caractere): permis pentru decizie `approved`/`rejected`/`manual_review` daca nu exista deja o revizuire `pending`; insert `human_reviews` (`requested_by: 'customer'`), jurnal `human_review_requested`. Raspuns `{ status: 'manual_review', eta_text: 'Un coleg revine in 24 de ore.' }`. **Decis:** devine `manual_review` (in seed, o cerere respinsa cu revizuire ceruta a ramas `rejected` – coada citeste din `human_reviews`, deci merge).
- **8. `GET /applications/:id/secci`**: doar pentru `approved`. Recalculeaza oferta cu `buildQuote(..., localDate(now))` si verifica ca cifrele cheie = snapshot-ul din `applications`; `buildSecci(quote, product, numeOperator)`; insert `secci_documents` (unic pe cerere + versiune; daca exista, il returnezi pe cel salvat si NU dublezi evenimentul); jurnal `secci_shown { secci_version, content_sha256 }`. Numele operatorului e provizoriu („Operatorul demo”) pana alege David.
- **9. `POST /applications/:id/secci/viewed`** (P1) `{ time_on_screen_ms, details_opened }` → update `secci_documents`, jurnal `secci_viewed`. „Trimite-mi pe email” = ruta separata `POST /applications/:id/secci/email` (decis) → `notifications` (`secci_email`) + `secci_emailed`.
- **10. `POST /applications/:id/otp`**: doar daca SECCI a fost afisat si statusul e `approved`; maximum 3 coduri / 10 minute; cod de 6 cifre din `crypto.getRandomValues`; salvezi doar `sha256(appId|cod|OTP_PEPPER)`, expira in 5 minute; jurnal `otp_sent { expires_in_s: 300 }`; raspuns `{ otp_demo_code, expires_in_s }`. **Decis:** `OTP_PEPPER` il seteaza Bogdan cu CLI.
- **11. `POST /applications/:id/sign`** `{ otp }`: ultimul cod neconsumat si neexpirat; la cod gresit cresti `attempts` (max 5); la succes `consumed_at`, creezi `agreements` (`signed_at`, `info_received_at = secci.first_shown_at`, `first_installment_due = schedule[0]`, `withdrawal_deadline = withdrawalDeadline(azi)`, reminder cu `reminderWindow`), cererea → `signed`, jurnal `agreement_signed`. Raspuns ca in contract.
- **12. `GET /agreements/:id`**: „azi” = data reala + `demo_offset_days`; `can_withdraw`; daca azi e in fereastra reminderului si nu s-a trimis → creezi notificarea + `withdrawal_reminder_sent` (lazy, fara cron); `reminders[]`.
- **13. `POST /agreements/:id/withdraw`**: doar daca `can_withdraw`; `withdrawalAmount(principal, rata, dataSemnarii, azi)`; update agreement; jurnal `withdrawn`. Raspuns ca in contract (+ `interest_lei`, `days_used`).
- **14. `POST /demo/time-travel`** (P1) `{ agreement_id, days }` → `demo_offset_days` (0–60), doar pe contractul userului.
- **15. `GET /backoffice/ledger`** (operator): `?application_id=` → intrarile + `ledger_verify` (prin `admin.rpc`); fara parametru → ultimele 25 de cereri, verificate in paralel, fara migrare (decis).
- **16. `GET/POST /backoffice/reviews`** (operator): coada `pending`; `POST { review_id, status: approved|rejected, note }` → update `human_reviews` (`operator_user_id`, `resolved_at`), statusul cererii, jurnal `human_review_resolved` (actor `operator`).
- Dupa rute: extinzi `api_smoke.mjs` (SECCI → OTP → semnare → contract → „sari la ziua 3” → retragere; operator: coada + jurnal verificat; Ana nu are acces la back-office → 403). Bogdan face deploy si ruleaza testul.

### 5.0 Ce mai e de facut (21.11, 14:20) – lista de lucru
Gata: schema, motor (engine-v2), date demo + date bancare, API 1–16, back-office, ZERO4, arhivare, verificarea venitului (deploy + smoke 75/76, FAIL-ul era in test si e reparat), ghid `docs/GHID_PROIECT.html`, ecranele 0–4 ale lui David testate live (Ana aprobata, Ioana respinsa, zero erori).

| # | Ce | Cine | Cand (tinta) | Nivel |
|---|---|---|---|---|
| 1 | ~~David da merge la `feat/david-web`~~ – FACUT (PR #13) | David | – | – |
| 2 | ~~Comenzile git din 5.4 → PR → merge~~ – FACUT (PR #14, `main` la `e106624`, 14:10) | Bogdan | – | – |
| 3 | ~~`data/archive_demo.sql` in SQL Editor~~ – FACUT (14:11, 0 cereri demo vizibile, 0 jurnale invalide) | Bogdan | – | – |
| 4 | ~~Vercel + CORS + test pe URL-ul public~~ – FACUT (14:50): Ana aprobata → SECCI cu „Telvia (demo)” → email → OTP → semnare → ziua 3 (reminder) → retragere 2.201,69 lei; Ioana respinsa cu consiliere; Mihai in revizuire → aprobat din back-office (Bogdan a introdus parola) → ecranul lui arata „Decizie luata de un specialist” + „Vezi oferta”; jurnale valide | – | – | – |
| 5 | ~~„Telvia (demo)” in SECCI~~ – FACUT (PR #15, deploy v7, vazut pe Vercel). In plus: `reminderText` cu data in romana („5 dec. 2026”, `dataRo` in `lib/flow.ts`, flow 13/13 Node + Deno, `deno check` ok) – SCRIS 14:50, de comis + redeploy | Bogdan | acum | – |
| 6 | ~~Ecranele 5–6~~ – FACUT de David (PR #16, rutele `/a/:id/oferta`, `/confirma`, `/semnare`, `/c/:aid`), verificate fata de contract | David | – | – |
| 7 | ~~Integrare 5–6 + test cap-coada~~ – FACUT pe Vercel (14:50), fara ZERO4 (testat pe server la 10:40; de refacut o data pe Vercel) | – | – | – |
| 8 | Testul SECCI cu 3–5 oameni (cifra inainte/dupa) | David | 19:30 | – |
| 9 | **Continut pentru pitch-ul de business (3 min, EN)**, pe care David il pune in slide-uri: model de business, competitie + diferentiator, piata tinta (cu surse), echipa – decizii impreuna cu Bogdan, cifre doar cu sursa. Plus diagrama de arhitectura pentru Q&A | noi (→ David) | dupa art. 35 | high |
| 10 | Deck (EN, 3 min) + **video demo de 1 minut** (inregistrat de pe Vercel la marime de telefon, montat) – **le face David** (decis 21.11, 16:05); noi dam scriptul cadru cu cadru daca il vrea | David | 22:00 | – |
| 11 | ~~A 3-a cifra din banca~~ – FACUT (PR #19, migratia `20261121132131`, api v10, smoke 79/79, verificat pe Vercel 15:50) | – | – | – |
| 15 | ~~Cardul „Cererea ta”: ruta 6c~~ – FACUT (PR #21, api v11, smoke 81/81, 16:25). David face cardul in magazin (mesaj trimis) | David | – | – |
| 16 | Scena „rata ratata” (art. 35) – **SCRISA 16:40** (migratie aplicata; cod + teste in folderul lui Bogdan). Ramane: Bogdan comite `feat/backend-forbearance` → PR → merge → deploy v12 → smoke cu operator; David: butonul „Sari la ziua 35” + cardul (mesaj v0.6 trimis) | Bogdan → David | acum | – |
| 17 | QR spre https://comb-sigma.vercel.app pe ultimul slide | David | cu deck-ul | – |
| 12 | Dum 07:00: a aparut OUG-ul? Video-ul final verificat (durata ≤ 60 s, lizibil pe proiector), buguri | noi | 09:30 freeze | medium |
| 13 | Dum 09:30–12:00: 3 repetitii cronometrate (3 min business + video 1 min) + Q&A tehnic de 2 min (raspunsuri EN in ghid, cap. 13) | ambii | 12:00 | – |
| 14 | Arhivare (`archive_demo.sql`) inainte de inregistrarea video-ului; trimitere (format de aflat) | ambii | tinta 12:45, limita 13:30 | – |

**Formatul nou (13:34) schimba prioritatile:** demo-ul nu mai e live, deci problemele de ecran scund si „drumul lui Mihai inapoi” conteaza doar cat sa arate bine in video (se poate inregistra la 390 px si monta). Observatii din testul pe Vercel (14:50), trimise lui David: (1) pe ecran scund de laptop (674–730 px) sheet-ul „Alege perioada” se deruleaza cu pagina si se taie sus; (2) dupa semnare scrie „O copie a contractului a fost trimisa pe email” – trebuie „(simulat)”; (3) Mihai nu are din magazin drum inapoi la cererea aprobata – in demo tinem tab-ul lui deschis pe `/a/<id>/rezultat` si apasam „Verifica din nou” dupa aprobare (sau un card „Cererea ta” in magazin, care ar cere o ruta noua `GET /applications` – nedecis). Observatii din testul live (13:45): pe un ecran scund de laptop sheet-ul de la „Alege perioada” se taie sus – pe telefon (844 px) e ok; de verificat pe Vercel. Mihai → back-office nu a fost testat live (cere parola operatorului).

### 5.5 Scena „rata ratata” (art. 35) – SCRISA (16:40), de comis + deploy

#### 5.5.0 Ce s-a facut (16:40)
- Raspunsurile la 5.5.4 (Bogdan, 16:20): **o singura masura** (la „om” operatorul doar noteaza); reesalonarea arata **rata + total + nr. de rate** (graficul la „Vezi detalii”); **da**, mesaj „email (simulat)”; calculul **Varianta A** (amanare: +dobanda pe o luna la ultima rata; reesalonare: sold + dobanda lunii ratate pe rate ramase + 6). Contractul v0.6 si back-office-ul cu „Am contactat clientul” – aprobate de Bogdan.
- Migratia `20261121143024 forbearance` aplicata (vezi sectiunea 2).
- Motor: `forbearance.ts` – `contractSchedule`, `missedInstallment` (doar DUPA scadenta), `deferOneMonth`, `reschedule`, `forbearanceOptions`; `loan.ts` are acum `amortize` + `annuityPaymentBani`, folosite si de `buildQuote` (rezultate identice cu `main`).
- API: `GET /agreements/:id` are `missed_installment`, `missed_notice`, `forbearance_options`, `forbearance`; la prima detectare (lazy, sigur la cereri simultane prin indexul unic) → notificare + jurnal `installment_missed` + `forbearance_offered`. `POST /agreements/:id/forbearance` → masura + `forbearance_chosen`; `talk` → `human_reviews` (`customer`, mesaj fix) + `human_review_requested { topic: 'forbearance' }`. `myAgreement` citeste si `installments`.
- Back-office: `GET /backoffice/reviews` are `topic` + `forbearance`; `ReviewsView` arata eticheta „Rata ratata · CCD2 art. 35”, ascunde evaluarea de credit si are un singur buton „Am contactat clientul” (trimite `approved`; cererea semnata ramane `signed`).
- Smoke (`api_smoke.mjs`): contract nou PH-2 → ziua 0 fara rata ratata → 409 inainte de scadenta → ziua 35: rata 1, mesaj, variantele 27,30 / 91,89 × 29 → amanare → 409 la a doua alegere; ZERO4 → amanare 0 lei → „om” → coada (operator) → „Am contactat clientul” → jurnale valide cu evenimentele art. 35.

Decis (DECIZII 1, 21.11, 15:55): se face. „Amana rata o luna” costa DOAR dobanda pe luna in plus (afisata exact, fara comisioane); „Reesaloneaza” = restul de plata pe ratele ramase + 6 luni, aceeasi dobanda, fara comision; „Vorbeste cu un om” intra in coada din back-office. In demo prima rata e considerata neplatita (aplicatia nu tine evidenta platilor).

#### 5.5.1 Ce exista deja (verificat in cod la 16:30)
- `agreements`: `first_installment_due` (o luna dupa semnare), `demo_offset_days` (0–60, deci „ziua 35” incape), `status` `active`/`withdrawn`. Graficul de rate nu e salvat separat: il recalculezi cu `buildQuote` (ca la SECCI) sau il iei din `secci_documents.content.schedule`.
- „Azi” in demo = data reala + `demo_offset_days` (`demoToday` in `lib/flow.ts`); reminderul e creat „lazy” la `GET /agreements/:id` – acelasi model pentru rata ratata.
- `human_reviews`: un singur `pending` pe cerere (index unic); `requested_by` are check (`engine`/`customer`); rezolvarea din back-office schimba statusul cererii DOAR din `manual_review`/`approved`/`rejected` (deci o cerere `signed` ramane `signed` – bine).
- `ledger_event_types`: un eveniment nou cere insert in tabel (migratie). `notifications.kind` are check (`withdrawal_reminder`, `secci_email`).

#### 5.5.2 Propunere tehnica (de confirmat cu Bogdan inainte de cod)
- **Migratie `forbearance`:** 3 evenimente noi (`installment_missed`, `forbearance_offered`, `forbearance_chosen`, toate `art. 35`); tabel `forbearance_measures` (`agreement_id` unic, `installment_n`, `option` in `defer`/`reschedule`/`talk`, `extra_cost_lei`, `new_installment_lei`, `new_installments`, `new_total_payable_lei`, `schedule jsonb`, `created_at`), RLS ca la `agreements` (clientul citeste ale lui, operatorul tot; scrieri doar prin API); eventual `notifications.kind` += `installment_missed`.
- **Motor (pur, testat Node + Deno):** `deferOneMonth(...)` → costul = dobanda pe o luna pe soldul ramas (rata/12 × sold), graficul mutat cu o luna; `reschedule(...)` → soldul ramas pe (rate ramase + 6), aceeasi dobanda, rata noua + total nou. Rotunjiri ca la `buildQuote` (ultima rata ajustata).
- **API:** `GET /agreements/:id` primeste `missed_installment` (`{ n, due_date, amount_lei, days_late } | null` – cand „azi” > prima scadenta, contract activ si fara masura aleasa) si `forbearance_options` (cele 3 variante cu cifrele calculate, ca David sa le arate INAINTE de alegere) + `forbearance` (masura aleasa | null). La prima detectare: jurnal `installment_missed` + `forbearance_offered` (lazy, o singura data). Ruta noua `POST /agreements/:id/forbearance { option }` → salveaza masura, jurnal `forbearance_chosen`; `talk` → `human_reviews` (requested_by `customer`, mesaj fix „Rata ratata: vreau sa vorbesc cu un om”), apare in coada.
- **Teste:** motor + flow (Node + Deno), PGlite pentru migratie, smoke: semnare → `time-travel 35` → `missed_installment` → fiecare optiune pe cate un contract (sau doar `defer` + `talk`) → jurnal valid.
- **David:** buton „Sari la ziua 35 (demo)” pe AgreementSheet, cardul bland („Rata din 21 dec. nu a fost platita. Te putem ajuta.”) cu cele 3 optiuni si cifrele lor, ecranul de rezultat. Mesaj cu contractul (v0.6) din timp.

#### 5.5.3 Unde intra in jurnal / CCD2
Art. 35: masuri de toleranta rezonabile inainte de executare; fara comisioane in plus peste costul real. Slide/Q&A: „dupa semnare produsul acopera si rata ratata, cu dovada in jurnal”.

#### 5.5.4 Intrebari pentru Bogdan – RASPUNSE 16:20 (vezi 5.5.0)
1. Dupa o masura aleasa, se mai poate alege alta (ex. dupa „talk”, operatorul decide amanarea)? Recomandare: o singura masura aleasa de client; operatorul doar noteaza in revizuire.
2. „Reesalonare”: arata noul grafic complet sau doar rata noua + totalul nou? Recomandare: rata + total + numarul de rate (graficul complet doar la „Vezi detalii”).
3. Mesaj catre client la rata ratata (notificare simulata, ca reminderul)? Recomandare: da, „email (simulat)”.

### 5.4 FACUT (14:10) – ajustarile web din testul live
PR #14 `feat/backend-web-fixes` (`a9c5c12`) merge-uit dupa PR #13 (ecranele 0–4 ale lui David): `web/src/pages/BudgetSheet.tsx` (textul despre contul bancar), `web/src/pages/DecisionSheet.tsx` (decizie dupa specialist, iconite dupa codul motivului), `supabase/tests/api_smoke.mjs` (14 evenimente la Ana), `docs/DECIZII_HACKATHON.md` sectiunea 16. David poate atinge din nou cele 2 fisiere. Bogdan e pe `main`.
Front-ul local: `cd web`, `npm install`, `.env.local` (cele 4 variabile, `VITE_USE_MOCKS=false`), `npm run dev` → http://localhost:5173 (permis de CORS). In `web/package.json` scripturile ruleaza `node node_modules/vite/bin/vite.js` (din cauza unui `:` in calea lui David) – nu le schimba.

Explicatia back-office-ului pentru Bogdan: proiect claude.ai `HACKATHON/BACKOFFICE_EXPLICAT.md`.

### 5.2 Dupa API (plan pe ore in DECIZII sectiunea 8)
- Sincronizarea 1 cu David la 13:00 (contract confirmat). Poarta la 19:00 (flux real cap-coada; daca nu, taiem ZERO4 si scena optionala).
- ~~Back-office~~ → scris (3.5). Ramane: cand urca David `web/`, legam ruta `/backoffice` (cu acordul lui) si verificam ca Tailwind-ul lui scaneaza `src/backoffice`; dupa login, `GET /me` cu `role = operator` duce la `/backoffice`.
- Deploy web pe Vercel: il importa David (contul lui) cand merge login-ul pe API-ul real; apoi secretul `ALLOWED_ORIGINS` cu domeniul Vercel + QR pentru juriu.

### 5.3 Intrebari deschise (pune-le lui Bogdan, nu decide singur)
1. ~~`human-review` pe o cerere respinsa/aprobata~~ → devine `manual_review` (21.11, 03:00).
2. ~~`OTP_PEPPER`~~ → Bogdan, cu CLI.
3. ~~Back-office~~ → `web/src/backoffice/`; ii spunem lui David cand e gata.
4. ~~Vercel~~ → David importa cand merge login-ul pe API-ul real.
5. Retragere: ce se intampla cu telefonul (intrebare pentru mentorul Neofin; pana atunci afisam doar suma de returnat).
6. ~~Numele operatorului~~ → „Telvia (demo)” in `OPERATOR_NAME` (21.11, 14:20). Modelele sunt deja in `devices`.
7. ~~`GET /applications/{id}`~~ → adaugata (21.11, 03:20), ruta 6b in contract.

---

## 6. Comenzi utile

**Git (Bogdan, PowerShell, din `D:\HACKATHON\comb`):**
```
git checkout main
git pull
git checkout -b feat/backend-<ce>
git add <foldere>
git commit -m "feat: ..."
git push -u origin feat/backend-<ce>
```
Apoi PR pe GitHub → Merge → `git checkout main` + `git pull`. Atentie: daca mai face commit pe un branch DUPA merge, commit-ul nou nu ajunge in `main` fara un PR nou.

**Teste:**
```
node --test supabase/functions/_shared/engine/engine.test.ts
node --test supabase/functions/api/lib/flow.test.ts
cd supabase/tests && npm install && npm run test:schema && npm run test:seed && npm run test:archive && npm run test:bank
node supabase/tests/api_smoke.mjs        # pe API-ul publicat; creeaza cereri reale (jurnalul nu se sterge)
# cu back-office: $env:OPERATOR_PASSWORD = Read-Host "Parola operator"   (inainte de comanda de mai sus)
```

**Deploy API:** `npx supabase@latest functions deploy api --project-ref ezynswlvqqrzahpblkxu --use-api --no-verify-jwt`
