# Hackathon Telco – decizii finale si brief pentru David

Versiune: duminica 22.11.2026, ora 11:00 (**codul de semnare pleaca real pe email (Resend) si SMS (SMS Gateway for Android)**, catre echipa; contract v0.7 – sectiunile 1, 6, 14; limita: daca nu merge cap-coada la 12:00, nu setam secretele si ramane pe ecran). Versiunea sambata 21.11.2026, ora 16:40 (**scena „rata ratata” (art. 35)**: migratia `20261121143024 forbearance` aplicata; motor, API si back-office scrise, de comis + deploy; **contract v0.6** – sectiunile 1, 3, 5, 6, 13, 16). Versiunea 16:30 (David face interfata, prezentarea si video-ul; noi dam continutul de business + Q&A – sectiunea 0; cardul „Cererea ta” publicat). Versiunea 16:15 (decizii noi: cardul „Cererea ta” – ruta 6c, contract v0.5; scena art. 35 SE FACE: amanare cu dobanda pe luna in plus, reesalonare +6 luni; QR pe ultimul slide – sectiunile 1, 6, 16). Versiunea 15:40 (**alte rate vazute in contul bancar – engine-v3, contract v0.4** in sectiunea 6; regula in sectiunea 5; Mihai: banca 750 lei; scena art. 35 si recomandarea prudenta raman in afara codului – sectiunea 16). Versiunea 15:00 (**formatul prezentarii anuntat de organizatori la 13:34**: 3 min business + 1 min demo inregistrat + 2 min Q&A, fara laptop propriu – sectiunile 1, 10, 11). Versiunea 14:50 (aplicatia live pe Vercel, testata cap-coada; statusul din sectiunea 15). Versiunea 14:25 (numele operatorului in SECCI: „Telvia (demo)”, sectiunea 1). Versiunea 13:05: adaugata sectiunea 16, idei de roadmap de la mentori. Versiunea 12:15: verificarea venitului prin Open Banking simulat – contract v0.3 in sectiunea 6, regula in sectiunea 5, checklist 4–5). Versiunea 11:30: pitch in engleza, 3–5 minute; aplicatia ramane in romana; arhivarea cererilor demo; `docs/ARHITECTURA.md`). Versiunea 10:50: ZERO4 verificat pe server; back-office in `main`; adaugate: contractul v0.2 pentru rutele 6b si 7–16 in sectiunea 6, deciziile de la 03:00 in sectiunea 1, regula „ore orientative” in sectiunea 8, masura 15 in sectiunea 14, statusul din sectiunea 15). Pentru Claude: citeste si `PREDARE_CLAUDE.md`. Predare pitch: **duminica 22.11, ora 13:30**.
Tema aleasa: **Installments, Built In (Telco, sponsor Neofin)**.

---

## 0. Pe scurt

- Facem un modul de **rate pentru telefoane, integrat in aplicatia unui operator telco fictiv**, conform regulilor CCD2.
- Clientul e un **abonat existent**: alege telefonul, trece prin verificarea accesibilitatii, intelege contractul pe **un singur ecran** si semneaza cu OTP.
- Fiecare pas lasa o **dovada** intr-un jurnal (cu hash inlantuit), pe care operatorul o vede in back-office.
- **Aplicatia clientului e pentru mobil** (pagina web pe telefon). **Back-office-ul e pentru desktop.** Un singur proiect React.
- **Aplicatia in romana, pitch-ul in engleza (3–5 minute)** (21.11, 11:00).
- **Rolurile pana la final (21.11, 16:05):** David termina interfata, face **prezentarea (deck EN) si video-ul de 1 minut**, plus testul SECCI cu oameni; Bogdan + Claude termina codul (scena art. 35, QA) si dau continutul de business (model, competitie, piata) + raspunsurile Q&A tehnice.
- **David:** Figma (cu limita de timp), apoi ecranele in React (in propria lui conversatie sau unealta), testele cu oameni, deck-ul si pitch-ul.
- **Bogdan + Claude:** baza de date, API-ul, motorul (DAE, accesibilitate), jurnalul, securitatea, deploy-ul si back-office-ul. Claude scrie codul, Bogdan il verifica si cere explicatii sau modificari.
- David lucreaza pe **mock-uri JSON** (sectiunea 6) pana e gata API-ul, ca sa nu se astepte unul pe altul.

---

## 1. Ce am decis

| Subiect | Decizie |
|---|---|
| Tema | Telco (Neofin) |
| Segment | Abonati postpaid existenti; o persona prepaid apare doar in demo |
| Momentul din brief | Telefon in 12/24 rate (accesibilitate + contract pe un ecran + semnare). In plus: accesoriu 0% in 4 rate, prin acelasi flux |
| Model de business | Operatorul vinde, creditorul e un partener (banca/IFN fictiv), noi suntem modulul care leaga totul |
| Platforma | Web mobile-first (React + Vite + TS + Tailwind + shadcn/ui), ecran tinta 390 px. In demo, in rama de telefon pe laptop + QR pentru juriu |
| Back-office | O pagina desktop: jurnalul de dovezi + coada de revizuire umana (o fac Bogdan + Claude) |
| Backend | Totul in Supabase: Postgres, Auth, RLS si API-ul in **Edge Functions (TypeScript)**. Claude le creeaza si le publica prin conectorul Supabase |
| Deploy | Web: Vercel, legat de repo-ul lui David (prin conectorul Vercel). API: Supabase Edge Functions. Fara Render |
| Brand | Operator fictiv (numele il alege David; sa nu semene cu Orange, Vodafone sau Digi). Creditor partener fictiv. Fara logo-uri reale |
| Simulat | OTP: **din 22.11 pleaca real pe email + SMS, dar catre telefonul si inboxul echipei** (clientii sunt sintetici); codul ramane si pe ecran pentru juriu. Simulate in continuare: Biroul de Credit, contul bancar (Open Banking), creditorul partener, trimiterea pe email |
| Limba | Aplicatia in romana (produs pentru clienti romani); prezentarea in engleza (21.11, 11:00) |
| Formatul prezentarii | **Anuntat de organizatori (21.11, 13:34), strict cronometrat, 6 minute:** 3 min pitch de business (problema, solutia, piata tinta, modelul de business – cum facem bani –, competitia cu diferentiatorul clar, echipa – „spuneti ceva despre voi”) · **1 min demo tehnic INREGISTRAT (video)** · 2 min Q&A, inclusiv intrebari tehnice. **Nu ne putem conecta laptopul la proiector**, deci video-ul trebuie gata dinainte. Detalii in sectiunea 10 |
| Design | Figma intai (maxim 2,5 ore), apoi cod |
| Accent in pitch | 40% dovada conformitatii · 35% contract inteles in sub 60 de secunde (masurat) · 25% date corecte si explicate |
| Revizuire ceruta de client | Cererea trece in `manual_review` pana decide operatorul; SECCI si semnarea sunt blocate pana atunci (21.11, 03:00) |
| Locul back-office-ului | `web/src/backoffice/`, scris de Bogdan + Claude. Ii spunem lui David cand e gata, nu inainte (21.11, 03:00) |
| Deploy web pe Vercel | Il importa David, imediat ce merge login-ul pe API-ul real (Sincronizarea 1), ca sa testam CORS devreme (21.11, 03:00) |
| Secretul OTP | `OTP_PEPPER` il seteaza Bogdan cu CLI; valoarea nu apare in chat, fisiere sau loguri (21.11, 03:00) |
| Rutele de client | Doar clientul care detine cererea; operatorul lucreaza doar prin `/backoffice/*` (21.11, 03:00) |
| Orele din plan | Orientative: cand un pas e gata mai devreme, trecem la urmatorul (21.11, 03:00) |
| Verificarea venitului (art. 18(3)) | Al 3-lea acord, separat si nebifat: datele din contul bancar (Open Banking, **simulat**). Venit folosit = min(declarat, banca), cheltuieli = max(declarat, banca). **Fara acord sau fara date → revizuire umana**, niciodata aprobare automata pe venit nedovedit. `bank_data` obligatoriu true/false in `/consents` (21.11, 11:45) |
| Numele operatorului | **Telvia** (ales de David). In SECCI, ca intermediar: „Telvia (demo)” – marcat fictiv, ca si creditorul „Credis IFN (demo)”. Se aplica SECCI-urilor noi; cele salvate deja raman neschimbate (21.11, 14:20) |
| Cardul „Cererea ta” (magazin) | Un singur card cu **ultima cerere neincheiata** (in analiza / aprobata / draft / contract activ) + buton spre pasul corect. Ruta noua `GET /applications/current` (6c). Rezolva „Mihai nu are drum inapoi dupa aprobare” (21.11, 15:55) |
| Scena „rata ratata” (art. 35) | **Se face** (21.11, 15:55). „Amana rata o luna” costa doar dobanda pe luna in plus (afisata exact, fara comisioane); „Reesaloneaza” = restul de plata pe ratele ramase + 6 luni, aceeasi dobanda, fara comision; „Vorbeste cu un om” intra in coada din back-office. In demo prima rata e considerata neplatita (aplicatia nu tine evidenta platilor) |
| Rata ratata – detalii (art. 35) | Decis cu Bogdan (21.11, 16:20): **o singura masura pe contract**, aleasa de client; la „vorbeste cu un om” operatorul doar noteaza („Am contactat clientul”), contractul semnat nu se schimba. **Amanare** = ratele ramase se muta cu o luna, in plus doar dobanda pe o luna pe soldul ramas, adaugata la ultima rata (Ana: +27,30 lei, total 2.583,72). **Reesalonare** = datoria la scadenta ratata (sold + dobanda lunii ratate; Ana 2.199 + 27,30 = 2.226,30) pe ratele ramase + 6, aceeasi dobanda (Ana: 29 × 91,89 lei, total 2.664,80; se termina la 6 luni dupa termenul initial). Cardul arata rata, totalul si numarul de rate; graficul complet la „Vezi detalii”. La rata ratata se trimite un mesaj „email (simulat)”. Contract v0.6 in sectiunea 6 |
| Codul de semnare trimis real (22.11, 10:30) | Email prin **Resend** (fetch direct, de la `onboarding@resend.dev` – fara domeniu verificat trimite doar la adresa contului, deci `DEMO_EMAIL_TO` = adresa contului) + SMS prin **SMS Gateway for Android** (mod Cloud, telefonul echipei cu SIM). De ce nu Twilio: trial-ul trimite doar la numere verificate si din sabloane, iar in Romania operatorii suprascriu sender ID-ul neinregistrat (inregistrarea dureaza saptamani). Ambele canale in paralel, un canal picat nu blocheaza semnarea. **Plafon SMS: 40 / 24 h, numarand doar SMS-urile chiar trimise** (din jurnal, `otp_sent` cu `sms`). Codul ramane pe ecran (`OTP_SHOW_ON_SCREEN`, implicit da; daca n-a plecat pe niciun canal, apare oricum). Nimic in baza de date: destinatiile sunt secrete. SECCI pe email ramane simulat. Limita: 12:00 |
| QR spre aplicatia live | Pe ultimul slide, pentru juriu (David) (21.11, 15:55) |
| Date curate pentru demo | Nu stergem nimic. Coloana `applications.archived_at`: cererile arhivate dispar din back-office (lista + coada), jurnalul ramane valid. `data/archive_demo.sql` arhiveaza toate cererile celor 3 conturi demo; il ruleaza Bogdan in SQL Editor inainte de repetitii si inainte de pitch (21.11, 11:20) |

---

## 2. Contextul juridic in 5 randuri (de stiut pe de rost)

1. CCD2 (Directiva UE 2023/2225) se aplica **in UE** de azi, 20.11.2026.
2. **Romania inca nu a adoptat legea** care o transpune. Exista un proiect de OUG, iar pana apare legea ramane in vigoare OUG 50/2010.
3. **Noi construim direct dupa regulile CCD2**: asa cere brieful, iar CCD2 e mai stricta, deci suntem conformi si azi, si dupa transpunere.
4. Fraza pentru juriu: *„CCD2 se aplica in UE de azi. Romania are deocamdata doar un proiect de OUG. Noi am construit direct pe CCD2, deci produsul e gata in ziua in care apare legea.”*
5. **Nu spunem** ca brieful greseste (vorbeste despre UE) si **nu dam** opinii juridice ferme. Spunem „argumentul nostru, de verificat cu juristii”.

Insight pentru pitch: ratele 0% „pe factura” pe 24–36 de luni sunt azi in afara OUG 50/2010. Sub CCD2, amanarea gratuita a platii e exceptata doar daca o da chiar vanzatorul (fara un creditor tert) si doar pana la 50 de zile (14 zile pentru un comerciant mare care vinde online). Deci ratele astea devin credit de consum cand Romania transpune.

**Duminica dimineata:** verificati rapid daca Guvernul a adoptat OUG-ul in weekend. Daca da, schimbati doar fraza din pitch.

---

## 3. Fluxul si ecranele

Fiecare ecran are: scop, continut obligatoriu, regula CCD2, stari si „gata cand”. Textele sunt propuneri; David le poate rescrie in limbaj mai simplu, cu conditia sa pastreze sensul.

### Ecran 0 – Login (demo)
- Login Supabase (email + parola). Sub formular, 3 butoane „Intra ca Ana / Mihai / Ioana” pentru demo (fac login real cu conturile demo).
- Gata cand: dupa login ajungi pe Ecranul 1.

### Ecran 1 – Magazin / oferta (doar la cerere)
- Lista de telefoane + accesoriul, cu pretul integral in lei.
- Pe fiecare produs: buton **„Vreau in rate”**. Nicio optiune de rate nu e preselectata; plata integrala ramane varianta implicita.
- Banner vizibil: **„Atentie! Banii imprumutati costa bani.”** (formularea din proiectul de lege romanesc; art. 8 CCD2).
- Daca oferta e personalizata: eticheta „Oferta personalizata automat pe baza istoricului tau de plata” + link „De ce vad asta?” (art. 13).
- CCD2: fara credit nesolicitat (art. 17), fara casute pre-bifate (art. 14–15).
- Gata cand: se apasa „Vreau in rate”, se creeaza o cerere si se trece la Ecranul 2.

### Ecran 2 – Alegi termenul
- Selector 12 / 24 luni (fara preselectie) pentru telefon; 4 rate fixe pentru accesoriu.
- Dupa alegere se vad imediat: **rata lunara, total de plata, cost total, DAE**.
- Buton „Continua spre verificare”.
- Gata cand: valorile vin din `POST /quotes` (mock la inceput).

### Ecran 3 – Verificarea accesibilitatii
- 2 casute de acord, **separate si nebifate**:
  1. „Sunt de acord sa fie folosit istoricul facturilor mele pentru evaluare.” (optional)
  2. „Sunt de acord sa fie citite veniturile si cheltuielile din contul meu bancar (Open Banking, simulat), doar pentru aceasta evaluare.” (optional, dar fara el venitul il verifica un coleg; „De ce?”: „Legea ne cere sa verificam venitul. Daca nu esti de acord, un coleg iti verifica venitul cu un alt document.”) – adaugat 21.11, 11:45
  3. „Am citit nota de informare privind prelucrarea datelor.” (obligatoriu)
- Campuri: venit net lunar, cheltuieli lunare, alte rate lunare. Fiecare are o explicatie scurta: „De ce intrebam?”.
- Text fix: „Nu folosim date din social media si nici date despre sanatate.”
- Gata cand: `POST /applications/{id}/consents`, apoi `POST /applications/{id}/assessment`.

### Ecran 4 – Decizia, explicata (high-fi in Figma)
- 3 stari: **Aprobat** · **Revizuire umana** · **Respins**.
- 2–4 motive in limbaj simplu (vin din API ca text).
- Bloc „Ce am verificat” (din `verification`): venit declarat / verificat (Open Banking, simulat) / folosit; la fel cheltuielile; alte rate declarat / Biroul de Credit / folosit. `verified_lei = null` → „neverificat – un coleg verifica”.
- Mereu vizibil: „Decizia a fost luata automat.” + butonul **„Cere revizuire de catre un om”** (art. 18(8)).
- Respins: mesaj respectuos, trimitere la consiliere privind datoriile (art. 18(9)) si **fara alt credit oferit in loc**.
- Gata cand: toate cele 3 stari arata bine cu cele 3 persone.

### Ecran 5 – Contractul pe un ecran / SECCI (high-fi in Figma, cel mai important)
- Sus, o caseta cu esentialul, in ordinea asta:
  1. Cat primesti (valoarea telefonului finantata)
  2. Cat platesti lunar si de cate ori
  3. **Cat platesti in total**
  4. **Cat te costa creditul** (total plata minus pret)
  5. DAE si dobanda (fixa)
  6. **Te poti retrage in 14 zile, fara motiv**
- Dedesubt: „Vezi toate detaliile” (formularul complet: creditor, intermediar, graficul de rate, intarzieri, rambursare anticipata).
- Buton „Trimite-mi pe email” (simulat; contractul trebuie oferit pe un suport durabil).
- Buton „Continua la semnare”, cu stil normal: fara cronometre, fara „oferta expira in 5 minute”.
- Ce se trimite la API: cat timp a stat pe ecran si daca a deschis detaliile (pentru dovada). Asta se mentioneaza in nota de informare.
- CCD2: art. 10 (formular standard, esentialul pe prima parte).
- Gata cand: un om care nu a mai vazut ecranul raspunde corect la 3 intrebari in sub 60 de secunde (sectiunea 9).

### Ecran 6 – Semnare OTP si dupa semnare
- „Ti-am trimis un cod” + codul demo afisat pe ecran (simulare) + campul pentru cod.
- Dupa semnare:
  - Confirmare, data primei rate.
  - **Termenul de retragere** (data exacta) + buton **„Ma retrag din contract”** (art. 26).
  - Card „Reminder”: daca ai semnat in mai putin de o zi de la primirea informatiilor, primesti un reminder despre retragere intre zilele 1 si 7 (art. 10).
- In demo: un buton discret „Sari la ziua 3”, ca sa aratam reminderul.
- Gata cand: retragerea functioneaza si afiseaza suma de returnat si termenul.

### Back-office (desktop, il fac Bogdan + Claude)
- Tabelul jurnalului: ora, eveniment, articol CCD2, hash. Insigna „Jurnal verificat ✓”.
- Coada de revizuire umana: Aproba / Respinge + nota.

### Dupa semnare: rata ratata (art. 35) – SE FACE (decis 21.11, 15:55; detalii 16:20)
- Pe ecranul contractului: buton discret **„Sari la ziua 35 (demo)”** (`POST /demo/time-travel` cu `days: 35`, apoi `GET /agreements/{id}`).
- Cand `missed_installment` nu e `null` si `forbearance` e `null`: **card bland**, fara ton de amenintare: „Rata din 21 dec. 2026 nu a fost platita. Te putem ajuta.” + mesajul simulat (`missed_notice`).
- 3 optiuni, la fel de vizibile, fiecare cu cifrele ei din `forbearance_options` **inainte** de alegere: **Amana rata o luna** (rata ramane aceeasi, „platesti in plus doar X lei dobanda”), **Reesaloneaza** (rata noua, numarul de rate, totalul nou; graficul la „Vezi detalii”), **Vorbeste cu un om** („Un coleg revine in 24 de ore.”). Scris clar: **fara comisioane**.
- Dupa alegere: ecran de rezultat cu `forbearance.text` (si graficul la „Vezi detalii”). La „om”: `forbearance.review.status` (`pending` → „Un coleg revine in 24 de ore.”; `approved` → „Un coleg te-a contactat.”).
- CCD2: art. 35 (masuri de toleranta rezonabile inainte de executare, fara costuri in plus peste costul real). Gata cand: Ana → ziua 35 → amanare, iar jurnalul din back-office arata cele 3 evenimente art. 35.

---

## 4. Reguli de UX obligatorii

- **Fara dark patterns:** nimic pre-bifat, nicio presiune de timp, butoanele de „nu” la fel de vizibile ca cele de „da”, fara texte de tipul „imprumutul iti imbunatateste situatia”.
- **Limbaj simplu:** fraze scurte, fara jargon. Termenii tehnici (DAE) au o explicatie de un rand.
- **Accesibilitate:** text de minimum 16 px, contrast bun, butoane de minimum 44 px inaltime, focus vizibil.
- **Formatare RO:** `1.234,56 lei` (Intl.NumberFormat `ro-RO`, currency `RON`), date de forma `21 nov. 2026`.
- **Fara imagini protejate:** fara logo-uri reale si fara poze oficiale de telefoane. Folositi ilustratii generice sau forme simple.
- **Securitate pe front:** nu logati in consola date personale; tokenul vine doar de la Supabase; `.env.local` nu intra niciodata in git.

---

## 5. Date demo

### Operator si creditor (fictive)
- Operator: nume ales de David (exemplu de stil: un cuvant scurt + „Mobil”), cu culori proprii.
- Creditor partener: „[Nume] IFN” fictiv, cu adresa marcata „demo”.

### Catalog (preturi demo, in lei)

| SKU | Produs | Categorie | Pret |
|---|---|---|---|
| PH-1 | Telefon gama de intrare | phone | 999,00 |
| PH-2 | Telefon gama medie | phone | 2.199,00 |
| PH-3 | Telefon gama medie-plus | phone | 3.499,00 |
| PH-4 | Telefon gama de varf | phone | 5.999,00 |
| AC-1 | Casti wireless | accessory | 399,00 |

David poate da nume fictive modelelor (de ex. „Nova 5”).

### Produse de credit (presupuneri demo)

| ID | Nume | Pentru | Dobanda | Costuri | Termen |
|---|---|---|---|---|---|
| RATE | Rate prin partener | telefoane | 14,9% fixa/an | 0 lei | 12 sau 24 luni |
| ZERO4 | 4 rate fara dobanda | accesorii | 0% | 0 lei | 4 rate lunare |

ZERO4 e intentionat in demo: il da un creditor partener (tert), pe mai mult de 50 de zile, deci si creditul 0% intra sub CCD2.

### Cele 3 persone (valori orientative; le calculeaza API-ul)

| Persona | Tip | Venit net | Cheltuieli | Alte rate | Facturi intarziate >30 zile (12 luni) | Ce vrea | Rezultat |
|---|---|---|---|---|---|---|---|
| Ana Popescu | postpaid, 38 luni | 5.200 | 2.100 | 300 | 0 | PH-2, 24 luni (~106,52 lei/luna) | Aprobat |
| Mihai Ionescu | postpaid, 14 luni | 3.900 | 1.800 | 650 | 2 | PH-3, 24 luni (~169,49 lei/luna) | Revizuire umana |
| Ioana Marin | prepaid | 2.600 | 1.700 | 900 | – (fara istoric) | PH-2, 24 luni | Respins (nu ramane nimic dupa rate) |

### Regulile deciziei (le implementeaza Bogdan + Claude; David afiseaza motivele)
- Gradul de indatorare = (alte rate + rata noua) / venit net. **Peste 40% → respins** (limita BNR pentru credite in lei, in vigoare din 2019; BNR are un proiect de modificare in 2026).
- Ce ramane = venit − cheltuieli − alte rate − rata noua. **Sub 0 → respins; intre 0 si 500 lei → revizuire umana** (prag ales de noi, presupunere).
- **2 sau mai multe facturi intarziate peste 30 de zile in ultimele 12 luni → revizuire umana**, niciodata respingere automata.
- Lipsa istoricului (prepaid) nu se pune ca minus.
- **Alte rate = maximul dintre ce declara clientul, Biroul de Credit (simulat) si ratele platite lunar vazute in contul bancar** (Open Banking simulat, doar cu acordul `bank_data`; prinde BNPL / rate la magazin / IFN care nu raporteaza la Birou; citim doar suma lunara, nu tranzactiile). Daca Biroul sau banca arata mai mult, motivul afisat spune sursa folosita (`BUREAU_HIGHER` / `BANK_INSTALLMENTS_HIGHER`). Date demo: banca = Birou pentru toti, **Mihai 750 lei** (Birou 650 + 100 BNPL) → ramane in revizuire, DTI 24%, raman ~1.181 lei (engine-v3, 21.11, 15:10).
- **Venit = minimul dintre declarat si contul bancar; cheltuieli = maximul** (Open Banking simulat, doar cu acordul `bank_data`). Daca banca arata alt venit/alte cheltuieli, motivul afisat spune asta. **Fara acord sau fara date → revizuire umana** (`INCOME_NOT_VERIFIED` / `BANK_DATA_UNAVAILABLE`); respingerea ramane automata daca nici cifrele declarate nu ajung (engine-v2, 21.11, 11:45).
- Pragurile exacte: 40,00% trece, peste 40% e respins; daca raman exact 500 lei, e aprobat.

### Reguli de calcul (decise 21.11, 01:30; implementate in `supabase/functions/_shared/engine/`)
- **DAE** dupa Anexa I CCD2, cu ipoteza „12 luni egale” (Ana: 15,96%). Credit 0% fara costuri = DAE 0.
- **Rata** se rotunjeste la ban; **ultima rata se ajusteaza**, ca totalul din grafic sa fie exact (Ana: 23 × 106,52 + 106,46 = 2.556,42 lei).
- **Prima rata** la o luna de la semnare (21 nov. → 21 dec.); daca ziua nu exista in luna, ultima zi a lunii.
- **Retragere:** 14 zile calendaristice de la semnare. **Suma de returnat** = creditul + dobanda pe zilele folosite (rata anuala / 365 × zile), in maximum 30 de zile de la retragere. Ex.: retragere dupa 3 zile = 2.199 + 2,69 = 2.201,69 lei.
- **Reminder:** daca a semnat la mai putin de 24 de ore dupa ce a vazut SECCI, reminder intre zilele 1 si 7 de la semnare.
- **Rata ratata (art. 35, decis 21.11, 16:20):** in demo prima rata e neplatita cand „azi” (data reala + zilele sarite) e **dupa** scadenta (in ziua scadentei nu e intarziata). **Amanare** = ratele ramase se muta cu o luna; cost in plus = dobanda pe o luna pe soldul ramas (rata anuala / 12 × sold, rotunjit la ban), adaugata la ultima rata. **Reesalonare** = (soldul inainte de rata ratata + dobanda lunii ei) pe (rate ramase dupa cea ratata + 6) rate egale, aceeasi dobanda, ultima rata ajustata; prima rata noua la o luna dupa scadenta ratata. Fara comisioane; la creditul 0% ambele costa 0 lei in plus. Ana (2.199 lei, 24 luni): amanare +27,30 lei (total 2.583,72); reesalonare 29 × 91,89 lei (ultima 91,88), total 2.664,80 (+108,38).

---

## 6. Contractul API – versiunea v0

**E specificatie, nu cod.** Rutele si campurile se confirma la Sincronizarea 1 (sambata 13:00). Valorile numerice din exemple sunt calculate aproximativ; API-ul le calculeaza exact. David foloseste exemplele doar pentru forma datelor.

- Baza: `VITE_API_URL` = `https://<proiect>.supabase.co/functions/v1/api` (o singura Edge Function care serveste rutele de mai jos).
- Fiecare cerere are doua headere: `apikey: <cheia publishable>` si `Authorization: Bearer <access_token-ul userului logat>`. Nu se trimite niciodata cheia publishable in `Authorization`.
- Bani: numere cu 2 zecimale. Date: `YYYY-MM-DD`.
- Erori: `{ "error": { "code": "VALIDATION", "message": "Text pentru utilizator" } }`.
- P0 = obligatoriu pentru demo; P1 = daca e timp.

| # | Metoda | Ruta | Ecran | P |
|---|---|---|---|---|
| 1 | GET | `/me` | 0–1 | P0 |
| 2 | GET | `/catalog` | 1 | P0 |
| 3 | POST | `/quotes` | 2 | P0 |
| 4 | POST | `/applications` | 1→2 | P0 |
| 5 | POST | `/applications/{id}/consents` | 3 | P0 |
| 6 | POST | `/applications/{id}/assessment` | 3→4 | P0 |
| 6c | GET | `/applications/current` (nou in v0.5) | 1 | P1 |
| 6b | GET | `/applications/{id}` (nou in v0.2) | 2–6 | P0 |
| 7 | POST | `/applications/{id}/human-review` | 4 | P0 |
| 8 | GET | `/applications/{id}/secci` | 5 | P0 |
| 9 | POST | `/applications/{id}/secci/viewed` | 5 | P1 |
| 9b | POST | `/applications/{id}/secci/email` (nou in v0.2) | 5 | P1 |
| 10 | POST | `/applications/{id}/otp` | 6 | P0 |
| 11 | POST | `/applications/{id}/sign` | 6 | P0 |
| 12 | GET | `/agreements/{id}` | 6 | P0 |
| 12b | POST | `/agreements/{id}/forbearance` (nou in v0.6) | 6 | P1 |
| 13 | POST | `/agreements/{id}/withdraw` | 6 | P0 |
| 14 | POST | `/demo/time-travel` | 6 | P1 |
| 15 | GET | `/backoffice/ledger` | back-office | P0 |
| 16 | GET/POST | `/backoffice/reviews` | back-office | P1 |

### Schimbari v0.1 (21.11, 02:40) – fata de exemplele de mai jos
- `POST /applications`: body-ul are si `"shown": { "ad_warning": true, "personalised_label": true }` (dovada pentru art. 8 si 13). Fara `ad_warning: true` → 400 `AD_WARNING_NOT_SHOWN`; client postpaid fara `personalised_label: true` → 400 `PERSONALISED_LABEL_NOT_SHOWN`. Raspunsul vine cu 201 si are in plus `quote`.
- `GET /me` are in plus `role` (`customer` / `operator`); pentru operator vine doar `{ role, display_name }`.
- `GET /catalog`: `personalised.text` e `null` pentru prepaid.
- `/quotes` si `/applications` au in plus `last_installment_lei`.
- Erorile pot avea `fields` (campurile gresite). Coduri noi: `FORBIDDEN_FIELD`, `CONSENTS_MISSING`, `PRIVACY_NOTICE_REQUIRED`, `TERM_NOT_ALLOWED`, `PRODUCT_NOT_APPLICABLE`, `ALREADY_ASSESSED` (409).
- `/assessment` cere intai `/consents`; a doua evaluare pe aceeasi cerere → 409.
- ID-urile sunt UUID; `app_001` din exemple e doar forma.

### Schimbari v0.2 (21.11, 03:25) – rutele 6b si 7–16
Publicate pe 21.11, 03:25 (functia `api` versiunea 3) si testate pe server. Valorile de mai jos sunt cele reale (Ana, PH-2, 24 luni).
- **Toate rutele de client (5–14)** merg doar pentru clientul care detine cererea/contractul: operatorul primeste 403, cererea altcuiva 404.
- **6b `GET /applications/{id}`** (nou, decis 21.11, 03:20) – starea cererii, pentru revenire dupa refresh si dupa revizuirea umana: `{ application_id, status, created_at, next_step, offer { sku, product_id, term_months, installment_lei, installments, total_credit_lei, total_payable_lei, total_cost_lei, nominal_rate_pct, apr_pct }, decision (decizia automata: `decision`, `automated`, `reasons`, `metrics`) | null, debt_advice | null, review { status, requested_by, requested_at, resolved_at } | null, secci_shown, agreement_id | null, agreement_status | null }`. `next_step` = `consents` · `assessment` · `wait_review` · `rejected` · `secci` · `sign` · `agreement` · `none` – spune la ce ecran revine aplicatia. Ex.: Mihai in revizuire → `wait_review`; dupa ce operatorul aproba → `secci`.
- **7 `POST /applications/{id}/human-review`** – body optional `{ "message": "..." }` (max 1000 caractere). Merge pe `approved` si `rejected`; cererea trece in `manual_review` pana decide operatorul. Raspuns ca in exemplu. Erori 409: `REVIEW_PENDING` (exista deja o revizuire, inclusiv cea pornita de motor pentru Mihai), `REVIEW_NOT_ALLOWED` (`draft`), `ALREADY_SIGNED`.
- **8 `GET /applications/{id}/secci`** – doar pentru `approved` (pentru `signed` returneaza documentul salvat). Prima afisare il salveaza; urmatoarele returneaza exact acelasi document. In plus fata de exemplu: `key.last_installment_lei`, `product { id, fees_lei }`, `schedule` cu toate ratele. Erori 409: `NOT_APPROVED`, `OFFER_CHANGED`.
- **9 `POST /applications/{id}/secci/viewed`** – `{ "time_on_screen_ms": 42000, "details_opened": false }` → `{ "ok": true }`. Se trimite cand pleaca de pe ecranul 5 (timpul se aduna intre vizite). Eroare 409: `SECCI_NOT_SHOWN`.
- **9b `POST /applications/{id}/secci/email`** (nou) – fara body → `{ "ok": true, "sent_at": "...", "channel": "email (simulat)" }`. Pentru butonul „Trimite-mi pe email”.
- **10 `POST /applications/{id}/otp`** – fara body, doar dupa SECCI. Raspuns ca in exemplu. Erori: 409 `SECCI_NOT_SHOWN` / `NOT_APPROVED` / `ALREADY_SIGNED`, 429 `OTP_RATE_LIMIT` (max 3 coduri in 10 minute), 503 `OTP_NOT_CONFIGURED`.
- **11 `POST /applications/{id}/sign`** – `{ "otp": "482913" }`; conteaza ultimul cod cerut. Raspuns ca in exemplu; `reminder_window` poate fi `null`. Erori 400: `VALIDATION` (nu are 6 cifre), `OTP_NOT_REQUESTED`, `OTP_EXPIRED`, `OTP_INVALID` (mesajul spune cate incercari mai are), `OTP_LOCKED` (dupa 5 greseli: cere cod nou). Erori 409: `ALREADY_SIGNED`, `OTP_ALREADY_USED`.
- **12 `GET /agreements/{id}`** – in plus fata de exemplu: `agreement_id`, `application_id`, `signed_at`, `first_installment_due`, `today` (ziua „de azi” din demo), `demo_offset_days`, `reminder_window`, `withdrawal` (`null` sau `{ withdrawn_at, amount_to_return_lei, return_by }`). `reminders[]` = `{ sent_at, channel, text }`; reminderul apare singur cand „azi” intra in zilele 1–7.
- **13 `POST /agreements/{id}/withdraw`** – fara body. Raspuns: `status`, `withdrawn_at`, `amount_to_return_lei`, `principal_lei`, `interest_lei`, `days_used`, `return_by`, `text`. Ana in ziua 3: 2.201,69 lei. Erori 409: `ALREADY_WITHDRAWN`, `WITHDRAWAL_EXPIRED`.
- **14 `POST /demo/time-travel`** – `{ "agreement_id": "...", "days": 3 }` (0–60, valoare absoluta, nu se aduna) → `{ agreement_id, demo_offset_days, today }`. Butonul „Sari la ziua 3”, apoi `GET /agreements/{id}`.
- **15–16 back-office** (doar operatorul, altfel 403; le foloseste back-office-ul nostru): `GET /backoffice/ledger` (ultimele 25 de cereri + `all_valid`), `GET /backoffice/ledger?application_id=` (`valid`, `entries_count`, `entries[]` cu `description`, `actor`, `payload`), `GET /backoffice/reviews` (`?status=all` pentru istoric), `POST /backoffice/reviews` `{ review_id, status: "approved" | "rejected", note? }`.

### Schimbari v0.3 (21.11, 12:15) – verificarea venitului (Open Banking, simulat)
Trimis lui David la 11:50. Ecranele 3 si 4.
- **5 `POST /applications/{id}/consents`** – body nou, `bank_data` **obligatoriu** (true/false): `{ "billing_history": true, "bank_data": true, "privacy_notice_read": true }`. Fara `bank_data` → 400 `VALIDATION`, `fields: ["bank_data"]`. Cu `true` se scrie in jurnal `consent_given { purpose: "bank_data" }`.
- **6 `POST /applications/{id}/assessment`** – body neschimbat. Raspunsul are in plus `verification`:
  `{ "bank_data_used": true, "source": "Open Banking (simulat)", "income": { "declared_lei": 5200, "verified_lei": 5200, "used_lei": 5200 }, "expenses": { "declared_lei": 2100, "verified_lei": 2100, "used_lei": 2100 }, "other_installments": { "declared_lei": 300, "bureau_lei": 300, "used_lei": 300 } }`. Fara acord bancar: `bank_data_used: false`, `source: null`, `verified_lei: null`.
- `reasons` are acum **maximum 4** motive (ordinea: ce a decis – intai respingerea –, ajustarile din surse verificate, confirmarea verificarii, explicatii). Coduri noi: `INCOME_VERIFIED`, `INCOME_VERIFIED_LOWER`, `EXPENSES_VERIFIED_HIGHER`, `INCOME_NOT_VERIFIED`, `BANK_DATA_UNAVAILABLE`. Ana: `INCOME_VERIFIED, DTI_OK, RESIDUAL_OK, BILLS_ON_TIME`.
- **6b `GET /applications/{id}`** – `decision.verification`, aceeasi forma (pe evaluarile vechi: `used_lei` = declarat).
- **16 `GET /backoffice/reviews`** – `assessment` are in plus `bank_data_used`, `income_verified_lei`, `income_used_lei`, `expenses_verified_lei`, `expenses_used_lei`; back-office-ul arata „Venit neverificat: cere un document” cand lipseste verificarea.
- Jurnal: `assessment_done` are in payload `income_verification` (`open_banking_simulated` / `no_consent` / `unavailable`) si `engine_version: "engine-v2"`.

### Schimbari v0.7 (22.11, 11:00) – codul de semnare trimis real
Aditiv: front-ul actual nu se strica.
- **10 `POST /applications/{id}/otp`** – raspuns `{ "otp_demo_code"?: "482913", "expires_in_s": 300, "delivery": { "email": "sent" | "failed" | "off", "sms": "queued" | "failed" | "off" | "limit" } }`. `otp_demo_code` vine cat timp `OTP_SHOW_ON_SCREEN` nu e `"false"` (implicit vine) si oricum daca n-a plecat pe niciun canal. `queued` = preluat de serverul SMS, ajunge in cateva secunde; `limit` = s-a atins plafonul zilnic de SMS; `off` = canalul nu e configurat.
- Front (optional): pe ecranul OTP, dupa `delivery`, „Am trimis codul prin SMS si pe email” (doar canalele `sent`/`queued`); codul demo apare doar daca vine `otp_demo_code`.
- Jurnal: `otp_sent` are `{ expires_in_s, channels: ["email", "sms", "pe ecran (demo)"] }` – doar canalele reusite, fara destinatie si fara cod (inainte: `channel: "pe ecran (simulat)"`).
- Textul trimis: „Comb: codul tau de semnare este 482913. Expira in 5 minute. Nu il da nimanui.” (fara diacritice si fara link: un singur segment SMS).

### Schimbari v0.6 (21.11, 16:40) – rata ratata (art. 35)
Decis cu Bogdan la 16:20. Ecranul 6 (contractul); butonul „Sari la ziua 35 (demo)” foloseste ruta 14 existenta (`days: 35`).
- **12 `GET /agreements/{id}`** – campuri noi:
  - `missed_installment`: `{ "n": 1, "due_date": "2026-12-21", "amount_lei": 106.52, "days_late": 5 }` sau `null` (scadenta nu a trecut sau contractul e retras). La prima detectare se trimite mesajul simulat si se scrie in jurnal, o singura data.
  - `missed_notice`: `{ "sent_at", "channel": "email (simulat)", "text": "Rata 1 (106,52 lei), cu scadenta pe 21 dec. 2026, nu a fost platita. Te putem ajuta: ... Fara comisioane." }` sau `null`.
  - `forbearance_options` (doar inainte de alegere, altfel `null`):
    `{ "defer": { "installment_lei": 106.52, "last_installment_lei": 133.76, "installments": 24, "first_due_date": "2027-01-21", "last_due_date": "2028-12-21", "total_payable_lei": 2583.72, "extra_cost_lei": 27.30, "schedule": [...] }, "reschedule": { "installment_lei": 91.89, "last_installment_lei": 91.88, "installments": 29, "first_due_date": "2027-01-21", "last_due_date": "2029-05-21", "total_payable_lei": 2664.80, "extra_cost_lei": 108.38, "schedule": [...] }, "talk": { "eta_text": "Un coleg revine in 24 de ore." } }`.
    `schedule[]` = `{ n, due_date, amount_lei, principal_lei, interest_lei, balance_lei }`, ratele ramase (pentru „Vezi detalii”).
  - `forbearance`: masura aleasa sau `null`: `{ "option", "chosen_at", "installment_n", "missed_due_date", "installment_lei", "last_installment_lei", "installments", "first_due_date", "last_due_date", "total_payable_lei", "extra_cost_lei", "schedule", "text", "review": { "status", "resolved_at" } | null }`. La `talk` cifrele si `schedule` sunt `null`, iar `review` arata starea cererii din coada.
  - Regula pentru card: se arata cand `missed_installment != null` si `forbearance == null`.
- **12b `POST /agreements/{id}/forbearance`** (nou) – body `{ "option": "defer" | "reschedule" | "talk" }` → `{ "forbearance": { ...ca mai sus }, "text": "..." }`. Erori: 400 `VALIDATION` (optiune necunoscuta, camp in plus); 409 `NO_MISSED_INSTALLMENT` (inainte de scadenta), `FORBEARANCE_ALREADY_CHOSEN`, `ALREADY_WITHDRAWN`, `REVIEW_PENDING`. Doar clientul care detine contractul (operator 403, altcineva 404).
  Texte (Ana): defer – „Ratele se muta cu o luna. Urmatoarea rata (106,52 lei) e pe 21 ian. 2027. Platesti in plus doar 27,30 lei dobanda pentru luna in plus, adaugata la ultima rata. Fara comisioane.”; reschedule – „Ai 29 de rate a cate 91,89 lei, prima pe 21 ian. 2027. Total de plata: 2.664,80 lei (cu 108,38 lei dobanda in plus). Fara comisioane.”; talk – „Un coleg revine in 24 de ore.”
- **16 `GET /backoffice/reviews`**: in plus `topic` (`decision` / `forbearance`) si `forbearance` (`{ option, installment_n, missed_due_date }` | `null`). Back-office-ul arata eticheta „Rata ratata · CCD2 art. 35” si un singur buton „Am contactat clientul” (trimite `approved`; contractul semnat nu se schimba).
- Jurnal: evenimente noi `installment_missed`, `forbearance_offered`, `forbearance_chosen` (toate art. 35); la `talk` urmeaza si `human_review_requested` (`topic: "forbearance"`). Payload fara date personale (numarul ratei, scadenta, sumele variantelor, `fees_lei: 0`).

### Schimbari v0.5 (21.11, 16:15) – cardul „Cererea ta”
- **6c `GET /applications/current`** (nou, doar client; operator → 403). Raspuns `{ "application": null }` sau
  `{ "application": { "application_id", "status", "created_at", "next_step", "sku", "device_name", "product_id", "term_months", "installment_lei", "installments", "total_payable_lei", "agreement_id", "agreement_status" } }`.
  Se ia ultima cerere **in curs**: `draft`, `manual_review`, `approved` sau `signed` cu contract `active` (nu respinse, nu contracte retrase, nu arhivate). `next_step` ca la 6b → butonul duce la ecranul potrivit (`wait_review` → rezultat, `secci`/`sign` → oferta, `agreement` → `/c/{agreement_id}`, `consents`/`assessment` → buget).

### Schimbari v0.4 (21.11, 15:40) – alte rate vazute in contul bancar (engine-v3)
Fara schimbari in ce trimite front-ul. Ecranul 4 si back-office-ul le-am actualizat noi (PR `feat/backend-bank-installments`, cu acordul lui Bogdan).
- **6 `POST /applications/{id}/assessment`** si **6b `GET /applications/{id}`**: `verification.other_installments` are in plus `bank_lei` – ratele platite lunar vazute in cont; `null` fara acord bancar si pe evaluarile vechi. `used_lei` = max(declarat, Birou, banca).
  Mihai: `{ "declared_lei": 650, "bureau_lei": 650, "bank_lei": 750, "used_lei": 750 }`.
- Cod nou in `reasons`: `BANK_INSTALLMENTS_HIGHER` (banca arata mai mult decat declarat si decat Biroul). Mihai: `BILLS_LATE, BANK_INSTALLMENTS_HIGHER, INCOME_VERIFIED, DTI_OK`.
- **16 `GET /backoffice/reviews`**: `assessment.other_installments_bank_lei`.
- Jurnal: `assessment_done` are `engine_version: "engine-v3"`.

### Exemple de raspuns (mock-uri, pentru Ana)

`GET /me`
```json
{ "customer_id": "c_ana", "display_name": "Ana Popescu", "segment": "postpaid",
  "tenure_months": 38, "plan_name": "Nelimitat 15", "monthly_bill_lei": 45.00 }
```

`GET /catalog`
```json
{
  "devices": [
    { "sku": "PH-2", "name": "Nova 5", "category": "phone", "price_lei": 2199.00 },
    { "sku": "AC-1", "name": "Casti Air", "category": "accessory", "price_lei": 399.00 }
  ],
  "products": [
    { "id": "RATE", "name": "Rate prin partener", "lender": "Credis IFN (demo)",
      "nominal_rate_pct": 14.9, "fees_lei": 0, "terms": [12, 24], "applies_to": "phone" },
    { "id": "ZERO4", "name": "4 rate fara dobanda", "lender": "Credis IFN (demo)",
      "nominal_rate_pct": 0, "fees_lei": 0, "terms": [4], "applies_to": "accessory" }
  ],
  "ad_warning": "Atentie! Banii imprumutati costa bani.",
  "personalised": { "is_personalised": true,
    "text": "Oferta personalizata automat pe baza istoricului tau de plata." }
}
```

`POST /quotes` – body `{ "sku": "PH-2", "product_id": "RATE", "term_months": 24 }`
```json
{ "installment_lei": 106.52, "installments": 24, "total_credit_lei": 2199.00,
  "total_payable_lei": 2556.42, "total_cost_lei": 357.42,
  "nominal_rate_pct": 14.9, "apr_pct": 15.96 }
```

`POST /applications` – acelasi body → `{ "application_id": "app_001", "status": "draft" }`

`POST /applications/{id}/consents`
```json
{ "billing_history": true, "bank_data": true, "privacy_notice_read": true }
```
→ `{ "ok": true }`

`POST /applications/{id}/assessment` – body `{ "net_income_lei": 5200, "monthly_expenses_lei": 2100, "other_installments_lei": 300 }`
```json
{
  "decision": "approved",
  "automated": true,
  "reasons": [
    { "code": "DTI_OK", "text": "Ratele tale ar fi 8% din venit, sub limita de 40%." },
    { "code": "RESIDUAL_OK", "text": "Dupa cheltuieli si rate iti raman aproximativ 2.693 lei pe luna." },
    { "code": "BILLS_ON_TIME", "text": "Ti-ai platit facturile la timp in ultimele 12 luni." }
  ],
  "metrics": { "dti_pct": 7.8, "residual_lei": 2693.48, "late_bills_12m": 0 },
  "human_review_available": true,
  "debt_advice": null
}
```
Pentru Ioana: `"decision": "rejected"`, un motiv cu codul `RESIDUAL_NEGATIVE` si `"debt_advice": { "text": "Poti cere gratuit sfaturi despre datorii.", "contact": "serviciu de consiliere (demo)" }`.
Pentru Mihai: `"decision": "manual_review"`, un motiv cu codul `BILLS_LATE`.

`POST /applications/{id}/human-review` – body `{ "message": "text optional" }` → `{ "status": "manual_review", "eta_text": "Un coleg revine in 24 de ore." }`

`GET /applications/{id}/secci`
```json
{
  "secci_version": "v1",
  "key": { "total_credit_lei": 2199.00, "installment_lei": 106.52, "installments": 24,
           "total_payable_lei": 2556.42, "total_cost_lei": 357.42,
           "apr_pct": 15.96, "nominal_rate_pct": 14.9, "rate_type": "fixa",
           "withdrawal_days": 14 },
  "creditor": { "name": "Credis IFN (demo)", "address": "Str. Exemplu 1, Bucuresti (demo)" },
  "intermediary": { "name": "[Operatorul fictiv]" },
  "late_payment": "Penalitati de intarziere conform contractului (demo).",
  "early_repayment": "Poti rambursa oricand inainte de termen.",
  "schedule": [ { "n": 1, "due_date": "2026-12-21", "amount_lei": 106.52 } ]
}
```

`POST /applications/{id}/otp` → `{ "otp_demo_code": "482913", "expires_in_s": 300 }`

`POST /applications/{id}/sign` – body `{ "otp": "482913" }`
```json
{ "agreement_id": "agr_001", "signed_at": "2026-11-21T14:02:00+02:00",
  "first_installment_due": "2026-12-21",
  "withdrawal_deadline": "2026-12-05",
  "reminder_window": { "from": "2026-11-22", "to": "2026-11-28" } }
```

`GET /agreements/{id}` → `{ "status": "active", "can_withdraw": true, "withdrawal_deadline": "2026-12-05", "reminders": [] }`

`POST /agreements/{id}/withdraw`
```json
{ "status": "withdrawn", "amount_to_return_lei": 2199.00, "return_by": "2026-12-21",
  "text": "Returnezi suma primita si dobanda pentru zilele folosite, in maximum 30 de zile." }
```

`GET /backoffice/ledger?application_id=app_001`
```json
{ "valid": true, "entries": [
  { "seq": 1, "at": "2026-11-21T13:55:02+02:00", "event": "offer_requested", "ccd2_ref": "art. 17",
    "hash": "9f1c...", "prev_hash": "0000..." }
] }
```

Evenimentele din jurnal: `offer_requested` (art. 17) · `ad_warning_shown` (art. 8) · `personalised_offer_disclosed` (art. 13) · `consent_given` (GDPR) · `assessment_done` (art. 18) · `human_review_requested` (art. 18(8)) · `secci_shown` (art. 10) · `otp_sent` · `agreement_signed` · `withdrawal_reminder_sent` (art. 10) · `withdrawn` (art. 26) · `installment_missed`, `forbearance_offered`, `forbearance_chosen` (art. 35, nou in v0.6).

---

## 7. Setup tehnic pentru David

- Repo: cel creat de David pe GitHub, folosit ca monorepo:
  - `web/` – aplicatia React (David)
  - `supabase/migrations/` si `supabase/functions/api/` – baza de date si API-ul (Bogdan + Claude)
  - `data/` – datele demo; `docs/` – fisierul asta, surse, pitch
- Proiect Vite cu sablonul React + TypeScript, apoi Tailwind + shadcn/ui + react-router.
- Structura propusa pentru `web/src/`:
```
web/src/
  pages/       Login, Shop, Term, Affordability, Decision, Secci, Sign, Agreement, Backoffice
  components/  ui (shadcn), PhoneFrame, MoneyText, WarningBanner, ReasonList
  lib/api.ts   un fetch central; daca VITE_USE_MOCKS=true citeste din mocks/
  lib/supabase.ts
  mocks/       me.json, catalog.json, quote.json, assessment_*.json, secci.json, sign.json ...
```
- `.env.local` (nu intra in git): `VITE_API_URL=...`, `VITE_USE_MOCKS=true`, `VITE_SUPABASE_URL=...`, `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`. Doar cheia publishable merge in front, niciodata cea secret.
- **Proiectul Supabase (creat 21.11, 01:00):** `comb`, regiunea Frankfurt.
  - `VITE_SUPABASE_URL=https://ezynswlvqqrzahpblkxu.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_LJBH2tJNlXCXEZCh9ujE2g_IBeMHh2f`
  - `VITE_API_URL=https://ezynswlvqqrzahpblkxu.supabase.co/functions/v1/api`
- Clientul Supabase din front se foloseste **doar pentru login/logout si token**. Datele se citesc si se scriu doar prin API; browserul nu are drept de scriere in tabele.
- Git: branch-uri `feat/david-<ce>` (respectiv `feat/backend-<ce>` pentru Bogdan + Claude), PR-uri mici catre `main`. **Fiecare face merge la PR-urile lui, fara review** (decizie 21.11, 01:00). Commit-uri cu `feat:`, `fix:`, `chore:`. Nu lucrati amandoi in aceleasi fisiere: `web/` e al lui David, restul e al lui Bogdan.
- Pentru demo: componenta `PhoneFrame` care pe desktop arata aplicatia intr-o rama de telefon, iar pe telefon o afiseaza pe tot ecranul.

---

## 8. Planul pe ore

„Bogdan” in tabel inseamna Bogdan + Claude: Claude scrie codul, Bogdan verifica.

**Orele sunt orientative** (decizie 21.11, 03:00): cand un pas e gata mai devreme, trecem la urmatorul, fara sa asteptam ora din tabel.

| Cand | Bogdan | David | Gata cand |
|---|---|---|---|
| **Sam 00:45–01:30** (impreuna) | Porneste conversatia noua, ataseaza repo-ul, conecteaza Vercel; Claude verifica proiectul Supabase si cheile | Fisier Figma, paleta, numele operatorului | Contract API v0 confirmat, catalog ales |
| **Sam 01:30–03:30** | Schema + RLS (aprobata de Bogdan inainte de aplicare), datele demo, motorul DAE cu teste | Figma: componente; Ecranele 4 si 5 high-fi; restul wireframe; textele | Date generate, design de baza gata |
| 03:30–09:00 | somn | somn | |
| **Sam 09:00–13:00** | API P0 in Edge Functions (rutele 1–8, 10–13), verificarea tokenului | Proiect React, login, Ecranele 0–3 pe mock-uri | |
| **13:00–13:20** | Sincronizare 1 | Sincronizare 1 | Flux pe mock-uri, contract API confirmat |
| **Sam 14:00–19:00** | Jurnal cu hash, retragere, „sari la ziua 3”, revizuiri, securitate P0 | Ecranele 4–6, trecere pe API-ul real, testul SECCI #1 (3 oameni) | |
| **19:00–19:20** | Poarta | Poarta | Flux real cap-coada? Daca nu, taiem ZERO4 si scena optionala |
| **Sam 20:00–00:30** | Back-office, ZERO4, cele 3 persone, deploy web pe Vercel + QR | Polish, accesibilitate, testul #2, deck v1, script demo v1 | Aplicatie live |
| 00:30–07:00 | somn | somn | |
| **Dum 07:00–09:30** | Verificare: a aparut OUG-ul? Buguri, video de backup, slide tehnic + securitate | Deck final, script final | **09:30 feature freeze** |
| **Dum 09:30–12:00** (impreuna) | 3 repetitii cronometrate + Q&A | 3 repetitii cronometrate + Q&A | Pitch stapanit |
| **Dum 12:00–13:30** | Rezerva + trimitere | Rezerva + trimitere | Tinta 12:45, limita 13:30 |

Ore de lucru: aproximativ 18 ore fiecare, plus timpul petrecut impreuna. Back-office-ul l-a preluat Bogdan, ca sa compenseze orele de Figma.

---

## 9. Testul cu utilizatori (David)

Ne da cifra reala pentru slide-ul „inainte / dupa”. Nu inventam numere.
1. 3–5 oameni care nu au vazut aplicatia (colegi de la hackathon).
2. Arati Ecranul 5 si pornesti cronometrul.
3. Pui 3 intrebari: „Cat platesti in total?”, „Cat platesti pe luna?”, „In cate zile te poti retrage?”
4. Notezi secundele pana la 3 raspunsuri corecte.
5. Comparatie: aceeasi persoana (sau alta) cu varianta „toate detaliile” deschise, adica formularul lung.
6. Rezultat pentru pitch: „In medie X secunde pe ecranul nostru vs. Y pe formularul complet, cu Z/N raspunsuri corecte.”

---

## 10. Prezentarea (EN, 6 minute, format impus de organizatori la 21.11, 13:34)

**Formatul (strict cronometrat):**
1. **3 min – pitch de business** (slide-uri): problema · solutia · piata tinta · modelul de business (cum facem bani) · competitia + diferentiatorul clar · echipa (ceva despre noi).
2. **1 min – demo tehnic inregistrat** (video, pregatit dinainte; nu avem laptop la proiector). Scenariul Ana + Mihai trebuie comprimat in ~60 s, montat.
3. **2 min – Q&A**, inclusiv tehnic: arhitectura, securitatea, jurnalul cu hash, DAE, verificarea venitului, ce e simulat – raspunsuri pregatite (ghid, cap. 13), nu slide separat obligatoriu.

**Ce lipseste fata de planul vechi (de decis impreuna, nu de inventat):** modelul de business concret (cine plateste modulul si cum), competitia (cine face azi rate embedded/BNPL pentru telco in Romania) si diferentiatorul, piata tinta cu cifre cu sursa (avem: ~74% SIM-uri pe abonament, ANCOM 2024).

Planul vechi de slide-uri (sursa de continut, de comprimat in 3 minute):

| Slide | Ce spunem | Cine |
|---|---|---|
| 1 · Problema | De azi se aplica CCD2 in UE. Ratele 0% pe factura devin credit de consum cand Romania transpune. Operatorul vrea sa vanda in rate clientilor existenti, fara trucuri si fara amenzi. | David |
| 2 · Dovezi | Romania inca fara lege (zero masuri notificate, nimic in sedinta de Guvern din 20.11); OUG 50/2010 exclude creditul 0%; operatorii vand deja in rate pe factura si prin parteneri bancari; aproximativ 74% din SIM-uri sunt pe abonament (2024). | David |
| 3 · Costul | Un produs care trebuie refacut cand intra legea, cu risc de amenzi ANPC; clienti care nu inteleg costul total. Fara cifre inventate. | David |
| 4 · Solutia + demo | Ana de la cap la coada, apoi Mihai la revizuire umana. Juriul scaneaza QR-ul. | Ambii |
| 5 · Inainte / dupa | Rezultatele testului din sectiunea 9. | David |
| Tehnic + securitate | Arhitectura, DAE, regula de accesibilitate, RLS, jurnalul cu hash, testul pentru campuri interzise, ce e simulat. | Bogdan |
| 6 · Echipa + Q&A | Informatica Economica + E-Business. Fraza juridica din sectiunea 2. | Ambii |

---

## 11. De aflat de la organizatori si mentori

- ~~Cat dureaza pitch-ul si cat Q&A-ul?~~ → 3 min business + 1 min demo + 2 min Q&A (13:34).
- Ce se trimite la 13:30: deck PDF, link la repo, link la demo, video? (inca de aflat; video-ul de 1 minut e sigur necesar)
- ~~Demo live sau inregistrat?~~ → **inregistrat** (13:34).
- ~~Pe proiector se poate folosi propriul laptop?~~ → **nu** (13:34).
- In ce format se preda video-ul (fisier pe stick, link, trimis inainte)?
- Pentru mentorul Neofin: e corect argumentul ca ratele 0% pe factura intra sub CCD2 dupa transpunere?
- Pentru mentorul Neofin: daca clientul se retrage din credit, ce se intampla cu telefonul (il plateste integral sau il returneaza)? Pana aflam, in demo afisam doar suma de returnat catre creditor.

---

## 12. Surse principale

- EUR-Lex – sinteza Directivei 2023/2225: https://eur-lex.europa.eu/RO/legal-content/summary/consumer-credit-agreements-2023.html
- CCD2 pe articole: https://wiki.private.law/en/ccd2-bnpl-eu.md
- Fara masuri romanesti la EUR-Lex: https://informat.ro/ue/ue-reguli-credite-consum-ursula-von-der-leyen-eur-lex-147639
- Actele adoptate de Guvern pe 20.11.2026: https://www.juridice.ro/870488/actele-normative-adoptate-in-cadrul-sedintei-guvernului-din-20-noiembrie-2026.html
- Formularea avertismentului in proiectul de lege: https://playtech.ro/2025/noua-lege-se-pregateste-pentru-creditele-de-consum-fara-executare-silita-a-contractelor-cesionate-restrictii-pentru-creditori-si-recuperatori-si-interzicerea-verificarii-pe-facebook-sau-tiktok/
- OUG 50/2010 (ANPC): https://www.anpc.ro/download/325/servicii-financiare/60373/ordonanta-de-urgenta-nr-50-2010-privind-contractele-de-credit-pentru-consumatori.pdf
- Grad de indatorare 40% (BNR): https://kpmg.com/ro/ro/home/publicatii/2019/01/debt-to-income-ratio-loans-2019-restricted.html
- Orange, rate pe factura: https://www.orange.ro/servicii/plata-in-rate-pe-factura/index.html
- ANCOM / Agerpres, SIM-uri si abonamente: https://agerpres.ro/economic/2025/05/16/ancom-sectorul-de-telecomunicatii-din-romania-a-raportat-venituri-in-scadere-cu-5-in-2024--1449843
- Fisa completa cu toate sursele: pagina „Hackathon decizie finala”.

---

## 13. Checklist CCD2 (devine slide-ul „Reality”)

| # | Cerinta | Articol | Unde apare in aplicatie | Dovada in jurnal | Cine | P |
|---|---|---|---|---|---|---|
| 1 | Fara credit nesolicitat; nimic pre-bifat | 17, 14–15 | Ecran 1: oferta doar la „Vreau in rate”; optiunile pornesc nebifate | `offer_requested` | David | P0 |
| 2 | Avertisment „Banii imprumutati costa bani” | 8 | Banner pe ecranele 1–2 | `ad_warning_shown` | David + API | P0 |
| 3 | Informare cand oferta e personalizata automat | 13 | Eticheta + „De ce vad asta?” | `personalised_offer_disclosed` | David | P1 |
| 4 | Evaluare pe venit, cheltuieli, obligatii; fara date sensibile (art. 18(3)) sau social media (considerentul 55) | 18(3) | API accepta doar campuri din lista alba; test automat pica daca apare un camp interzis | `assessment_done` (hash-ul datelor, nu datele) | Bogdan | P0 |
| 5 | Datele declarate se verifica (surse interne si externe) | 18(3) | Venit = min(declarat, cont bancar), cheltuieli = max(declarat, cont bancar) – Open Banking simulat, cu acord explicit; alte rate = max(declarat, Biroul de Credit simulat, ratele vazute in cont). Fara acord bancar → revizuire umana, nu aprobare automata | `consent_given` (bank_data), `assessment_done` (`income_verification`) | Bogdan | P0 |
| 6 | Credit doar daca evaluarea e pozitiva; nu doar pe istoricul de credit | 18(6), 18(11) | Grad de indatorare max. 40% + rest dupa rate; prepaid fara istoric nu e penalizat | `assessment_done` | Bogdan | P0 |
| 7 | Decizie automata: explicatie, interventie umana, contestare | 18(8) + GDPR 22 | Ecran 4 (motive + buton) + coada din back-office | `human_review_requested`, `human_review_resolved` | Ambii | P0 |
| 8 | La respingere: informare imediata + consiliere, fara alt credit oferit | 18(9) | Ecran 4, starea „Respins” | `debt_advice_shown` | Ambii | P1 |
| 9 | SECCI, cu esentialul pe prima parte; DAE dupa Anexa I | 10, Anexa I | Ecran 5 + motorul DAE (testat: 0% fara costuri = DAE 0) | `secci_shown`, `secci_viewed` | Ambii | P0 |
| 10 | Informatiile pe suport durabil | 10 | „Trimite-mi pe email” (simulat) | `secci_emailed` | Ambii | P1 |
| 11 | Reminder de retragere in zilele 1–7 daca s-a semnat la < 1 zi de la informare | 10 | Card „Reminder” + „Sari la ziua 3” | `withdrawal_reminder_sent` | Bogdan | P1 |
| 12 | Retragere in 14 zile, fara motiv; returnare in 30 de zile | 26 | Ecran 6: termenul exact + „Ma retrag din contract” | `withdrawn` | Ambii | P0 |
| 13 | Masuri de toleranta inainte de executare, fara costuri peste costul real | 35 | Ecran 6: „Sari la ziua 35” → card cu amanare o luna (doar dobanda pe luna in plus) / reesalonare (+6 luni, aceeasi dobanda) / vorbeste cu un om (coada din back-office); fara comisioane | `installment_missed`, `forbearance_offered`, `forbearance_chosen` | Ambii | P1 |

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
| 15 | Rutele de client accepta doar clientul care detine cererea; operatorul (care vede tot) lucreaza doar prin `/backoffice/*` | Edge Function | P0 |
| 16 | Codul OTP trimis real (22.11): cheile Resend / SMS Gateway si destinatiile doar in secretele Edge Function; codul nu apare in loguri, jurnal sau `notifications`; plafon 40 SMS / 24 h (protejeaza telefonul cand juriul scaneaza QR-ul); timeout 5 s pe fiecare canal, iar un canal picat nu blocheaza semnarea | Edge Function | P1 |

---

## 15. Status (21.11, 14:50)

| Ce | Stare |
|---|---|
| Proiect Supabase `comb` | creat, Frankfurt, Free |
| Schema + RLS (15 tabele) | aplicata, testata (25/25 local), Security Advisor fara probleme reale |
| Motorul (DAE, decizie, retragere, SECCI) | in repo, 25/25 teste in Node si Deno |
| Date demo | pe server: 63 clienti, 983 facturi, 47 cereri, 370 intrari in jurnal, toate jurnalele valide; conturile legate, operatorul are rol |
| API partea 1 (rutele 1–6) | publicat, test pe server 15/15 |
| API partea 2 (rutele 6b, 7–16) | publicat (versiunea 3, `OTP_PEPPER` setat); test pe server 62/63 – singurul FAIL era in test (ordinea cheilor din jsonb), reparat; local: 12 teste noi + 25 motor |
| Back-office (`web/src/backoffice/`) | scris, decuplat de restul aplicatiei; testat pe API-ul real cu operatorul, prin pagina de proba `tools/backoffice-dev/`. Se leaga cu o singura ruta `/backoffice` cand urca David `web/` (vezi `web/src/backoffice/README.md`) |
| ZERO4 (casti, 4 rate, 0%) | verificat pe server cap-coada (smoke 71/71); la retragere textul spune „fara dobanda” |
| Aplicatia clientului (`web/`, David) | ecranele 0–6 in `main` (PR #13, #16), legate de API-ul real, back-office la `/backoffice` |
| Deploy Vercel + QR | live: https://comb-sigma.vercel.app, CORS setat; testat 14:50 (Ana pana la retragere, Ioana respinsa, Mihai aprobat din back-office, jurnale valide). QR: de facut pentru deck |
| Arhivare cereri demo | migratia `20261121091630 application_archive` aplicata, PR merge-uit, arhivarea rulata |
| Verificarea venitului (Open Banking simulat) | migratia `20261121094520 bank_verification` aplicata + date bancare pentru cei 63 de clienti; motor `engine-v2` (33/33), API si back-office scrise; de facut: PR + deploy + smoke; David: casuta 3 + blocul „Ce am verificat” |
| Arhitectura | `docs/ARHITECTURA.md`: diagrame, toate rutele, starile cererii, exemplul Ana, jurnalul, securitatea |

## 16. Idei de roadmap (din discutiile cu mentorii, 21.11, 13:00) – pentru pitch („ce urmeaza”), NU in cod acum

| Idee | Decizie | De ce |
|---|---|---|
| A 3-a cifra din banca: „rate platite lunar, vazute in cont” (prinde BNPL / rate la magazin / IFN care nu raporteaza la Birou). Alte rate = max(declarat, Birou, banca) | **FACUT (21.11, 15:40, engine-v3)** – vezi sectiunile 5 si 6 (v0.4) | Verificare in plus, nu colectare in plus |
| „Toate datele bancare posibile” | **Nu** | CCD2 art. 18(3) + GDPR: doar date necesare si proportionale; tranzactiile complete dezvaluie date interzise (sanatate, religie, politic). Argument de pitch: „luam doar ce trebuie” |
| Recomandari de tip „ai venit mare, ia o rata mai mare / un telefon mai scump” sau „respins pe 12 luni, ia pe 24” | **Nu** | Upselling de credit (art. 17), risc de supra-indatorare; recomandarea personalizata = servicii de consiliere (art. 16) + informare (art. 13) |
| Scena „rata ratata” (art. 35): la ziua 35 prima rata e neplatita → card bland cu amanare o luna / reesalonare / vorbeste cu un om, totul in jurnal | **Se face** (Bogdan, 21.11, 15:55); **scris in cod 16:40** (migratie aplicata, motor + API + back-office; de comis + deploy; cardul il face David) – regulile in sectiunile 1 si 5 | Art. 35 cere masuri de toleranta inainte de executare |
| Recomandare prudenta: „daca iti permiti rata pe 12 luni, platesti cu X lei mai putin in total decat pe 24” | Roadmap (pitch); **nu o implementam** (Bogdan, 21.11, 15:10) | Reduce costul, in interesul clientului; cere ecran nou la David |

Detaliile tehnice, regulile de lucru si pasii urmatori exacti sunt in `PREDARE_CLAUDE.md` (in proiect si in `docs/`).
