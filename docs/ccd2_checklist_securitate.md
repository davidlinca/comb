## 13. Checklist CCD2 (devine slide-ul „Reality”)

| # | Cerinta | Articol | Unde apare in aplicatie | Dovada in jurnal | Cine | P |
|---|---|---|---|---|---|---|
| 1 | Fara credit nesolicitat; nimic pre-bifat | 17, 14–15 | Ecran 1: oferta doar la „Vreau in rate”; optiunile pornesc nebifate | `offer_requested` | David | P0 |
| 2 | Avertisment „Banii imprumutati costa bani” | 8 | Banner pe ecranele 1–2 | `ad_warning_shown` | David + API | P0 |
| 3 | Informare cand oferta e personalizata automat | 13 | Eticheta + „De ce vad asta?” | `personalised_offer_disclosed` | David | P1 |
| 4 | Evaluare pe venit, cheltuieli, obligatii; fara date sensibile sau social media | 18(3) | API accepta doar campuri din lista alba; test automat pica daca apare un camp interzis | `assessment_done` (hash-ul datelor, nu datele) | Bogdan | P0 |
| 5 | Datele declarate se verifica | 18 | „Alte rate” = maximul dintre declarat si Biroul de Credit (simulat) | `assessment_done` | Bogdan | P0 |
| 6 | Credit doar daca evaluarea e pozitiva; nu doar pe istoricul de credit | 18(6), 18(11) | Grad de indatorare max. 40% + rest dupa rate; prepaid fara istoric nu e penalizat | `assessment_done` | Bogdan | P0 |
| 7 | Decizie automata: explicatie, interventie umana, contestare | 18(8) + GDPR 22 | Ecran 4 (motive + buton) + coada din back-office | `human_review_requested`, `human_review_resolved` | Ambii | P0 |
| 8 | La respingere: informare imediata + consiliere, fara alt credit oferit | 18(9) | Ecran 4, starea „Respins” | `debt_advice_shown` | Ambii | P1 |
| 9 | SECCI, cu esentialul pe prima parte; DAE dupa Anexa I | 10, Anexa I | Ecran 5 + motorul DAE (testat: 0% fara costuri = DAE 0) | `secci_shown`, `secci_viewed` | Ambii | P0 |
| 10 | Informatiile pe suport durabil | 10 | „Trimite-mi pe email” (simulat) | `secci_emailed` | Ambii | P1 |
| 11 | Reminder de retragere in zilele 1–7 daca s-a semnat la < 1 zi de la informare | 10 | Card „Reminder” + „Sari la ziua 3” | `withdrawal_reminder_sent` | Bogdan | P1 |
| 12 | Retragere in 14 zile, fara motiv; returnare in 30 de zile | 26 | Ecran 6: termenul exact + „Ma retrag din contract” | `withdrawn` | Ambii | P0 |
| 13 | Masuri de toleranta inainte de executare | 35 | Scena optionala „rata ratata” | – | Ambii | P2 |

## 14. Securitate (slide-ul tehnic)

| # | Masura | Unde | P |
|---|---|---|---|
| 1 | Login Supabase (email + parola); conturile demo vad doar datele lor | Auth | P0 |
| 2 | RLS pe toate cele 15 tabele; clientul citeste doar ce e al lui | Postgres | P0 |
| 3 | Rolul „operator” vine din `app_metadata` (il poate seta doar serverul), nu din `user_metadata` | Postgres + API | P0 |
| 4 | Browserul nu scrie nimic direct: fara INSERT/UPDATE/DELETE pentru anon si authenticated; toate scrierile trec prin API | Postgres | P0 |
| 5 | Chei noi: publishable in front (doar in headerul `apikey`), secret doar in Edge Function | config | P0 |
| 6 | API: `verify_jwt = false` (platforma nu intelege cheile noi), dar fiecare cerere verifica tokenul cu `getClaims` (chei asimetrice, JWKS). Citirile se fac cu tokenul userului, ca RLS sa se aplice si in API | Edge Function | P0 |
| 7 | Validare pe server cu lista alba; un camp necunoscut sau interzis da eroare 400 | Edge Function | P0 |
| 8 | OTP pastrat doar ca hash, expira in 5 minute, maximum 5 incercari | Postgres + API | P0 |
| 9 | Jurnal append-only (nici cheia secret nu poate modifica sau sterge), hash SHA-256 inlantuit, verificare cu `ledger_verify`; testat: o modificare facuta pe ascuns e detectata | Postgres | P0 |
| 10 | Fara date personale in clar in jurnal si in loguri | API | P0 |
| 11 | CORS doar pentru domeniul de pe Vercel + localhost | Edge Function | P0 |
| 12 | Secrete doar in variabile de mediu; `.env.local` in `.gitignore`, `.env.example` in repo | repo | P0 |
| 13 | Limita de cereri pe OTP (3 coduri / 10 minute) | API | P1 |
| 14 | Security Advisor Supabase fara avertismente | Supabase | P1 |
