# Predare pentru Claude – conversatia urmatoare

Versiune: sambata 21.11.2026, 04:00 (API partea 2 in `main`; back-office scris si testat; deciziile din 5.3 rezolvate). Scris pentru conversatia noua (Opus 5.5, effort extra).
Sursa de adevar pentru DECIZII ramane `DECIZII_HACKATHON.md`. Fisierul asta spune CUM lucram, UNDE e totul, CE e gata si CE urmeaza exact.

---

## 0. Primii pasi in conversatia noua (in ordinea asta)

1. Citeste COMPLET, din proiectul claude.ai „HACKATHON”: `HACKATHON/DECIZII_HACKATHON.md` si `HACKATHON/PREDARE_CLAUDE.md` (fisierul asta). Brieful (`Telco_Embedded_Financing_Challenge_Nov_2026.pdf`) si cele 2 poze cu notite de pitch le citesti doar daca ai nevoie.
2. Ataseaza repo-ul: `add_repo` owner `davidlinca`, repo `comb`, apoi `git clone --depth 1 https://github.com/davidlinca/comb /home/claude/comb`. Push-ul din sesiune e refuzat (aplicatia Claude nu e instalata pe contul lui David) – nu e nevoie: Bogdan da commit-urile. (Repo-ul e public: `add_repo` poate raspunde ca citirea merge direct si propune clona in `/home/claude/davidlinca/comb` – e ok.)
3. Cere acces la folderul lui Bogdan: `device_request_folder_access` cu `D:\HACKATHON\comb`. Acolo scrii fisierele (vezi sectiunea 6). Daca raspunde ca fereastra desktop nu e disponibila, Bogdan deschide aplicatia Claude desktop si reincerci.
4. Verifica starea pe server (doar citire): `list_migrations`, `list_edge_functions`, numaratori din tabele, `ledger_verify` pe toate cererile.
5. Da-i lui Bogdan un rezumat de maximum 8 randuri + intrebarile deschise (sectiunea 5.3), apoi incepi API partea 2.

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
| Repo | https://github.com/davidlinca/comb (public). `main` la `e7aa2f9`. PR-uri merge-uite: #1 schema, #2 motor + date, #3 API partea 1, #4 docs contract v0.1, #5 docs predare, #6 API partea 2. In lucru: `feat/backend-backoffice`. Proiectul `web/` al lui David NU e inca pe GitHub (in `main`, `web/` are doar `src/backoffice/`) |
| Folder local Bogdan | `D:\HACKATHON\comb` (Windows, PowerShell). Montat in device_bash la `$HOME/mnt/comb` |
| Supabase | proiect `comb`, ref `ezynswlvqqrzahpblkxu`, org „MareBogdan's Org” (Free), regiunea eu-central-1 |
| URL | `https://ezynswlvqqrzahpblkxu.supabase.co` |
| Cheia publishable | `sb_publishable_LJBH2tJNlXCXEZCh9ujE2g_IBeMHh2f` (publica, merge in front, doar in headerul `apikey`) |
| Cheia secret | DOAR in mediul Edge Function (`SUPABASE_SECRET_KEYS`). Niciodata in chat, fisiere sau front |
| API | `https://ezynswlvqqrzahpblkxu.supabase.co/functions/v1/api` – Edge Function `api`, versiunea 3 (partea 2, 21.11 03:25), `verify_jwt = false` |
| Migratii aplicate | `20261120231817 init_schema` (singura; partea 2 NU a cerut migrari) |
| Secrete Edge Function | `OTP_PEPPER` (setat de Bogdan cu `npx supabase secrets set` pe 21.11, valoarea nu apare nicaieri), `ALLOWED_ORIGINS` (de setat cu domeniul Vercel) |
| Conturi demo | `ana@`, `mihai@`, `ioana@demo.comb.ro` – parola `Demo2026!` (publica, in front). `operator@demo.comb.ro` – parola doar la Bogdan, `app_metadata.role = operator` |
| Vercel | conectorul Vercel e conectat in claude.ai; proiectul NU e inca legat de repo. Repo-ul e pe contul lui David |
| Proiect claude.ai | „HACKATHON”: `DECIZII_HACKATHON.md`, `PREDARE_CLAUDE.md`, brieful PDF, 2 poze cu notite de pitch |
| Doc de invatare pentru Bogdan | https://claude.ai/artifact/Gppawttr1LQRGWbNVNb36b (Docs) |

**Starea datelor pe server (21.11, 03:30):** 63 clienti, 983 facturi, 47 cereri (42 din seed + 5 create de testele API), 370 intrari in jurnal, 0 jurnale invalide, 15 contracte, 7 cereri in coada de revizuire.

---

## 3. Ce e gata

| Pas | Stare | Unde | Teste |
|---|---|---|---|
| Schema + RLS (15 tabele) | aplicat pe server | `supabase/migrations/20261120231817_init_schema.sql` | `supabase/tests/schema.test.mjs` – 25/25 (PGlite) |
| Motorul (DAE, rate, decizie, lista alba, retragere, SECCI) | in repo | `supabase/functions/_shared/engine/` | `engine.test.ts` – 25/25 in Node si Deno |
| Date demo | aplicat pe server (rulat de Bogdan in SQL Editor) + conturi legate | `data/generate_seed.ts` → `data/seed_demo.sql`, `data/link_accounts.sql` | `supabase/tests/seed.test.mjs` |
| API partea 1 (rutele 1–6) | publicat (CLI), testat pe server | `supabase/functions/api/` | `supabase/tests/api_smoke.mjs` – 15/15 |
| API partea 2 (rutele 6b, 7–16) | publicat (CLI, v3), testat pe server 62/63 (FAIL-ul era in test: ordinea cheilor din jsonb; reparat) | `routes/signing.ts`, `routes/agreements.ts`, `routes/backoffice.ts`, `lib/flow.ts`, `GET /applications/:id` in `routes/customer.ts` | `lib/flow.test.ts` 12/12 (Node + Deno), `deno check` ok; `api_smoke.mjs` extins la 63 verificari |
| Back-office | scris, testat pe server cu operatorul (pagina de proba) | `web/src/backoffice/` (Backoffice, LedgerView, ReviewsView, api, format, ui, README) + `tools/backoffice-dev/` | `npm run build` (tsc strict + vite) ok; verificat in Chrome: 25/25 jurnale intacte, coada cu 7 cereri, „Vezi jurnalul” merge |
| Checklist CCD2 + securitate | in DECIZII, sectiunile 13–14 | `docs/` | – |

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
Reguli decise (DECIZII sectiunea 5): DAE cu 12 luni egale; rata rotunjita la ban, ultima ajustata; prima rata la o luna de la semnare; alte rate = max(declarat, Birou); praguri 40% / 0 / 500 lei / 2 facturi > 30 zile; retragere 14 zile, suma = credit + dobanda zilnica (rata/365), returnare 30 zile; reminder zilele 1–7 daca semnat la < 24h de la SECCI.
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
6. Numele operatorului si al modelelor (David) – le schimbam in `devices`/SECCI cand le avem (update de date = cu aprobare). In cod: `OPERATOR_NAME` din `lib/flow.ts`.
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
cd supabase/tests && npm install && npm run test:schema && npm run test:seed
node supabase/tests/api_smoke.mjs        # pe API-ul publicat; creeaza cereri reale (jurnalul nu se sterge)
# cu back-office: $env:OPERATOR_PASSWORD = Read-Host "Parola operator"   (inainte de comanda de mai sus)
```

**Deploy API:** `npx supabase@latest functions deploy api --project-ref ezynswlvqqrzahpblkxu --use-api --no-verify-jwt`
