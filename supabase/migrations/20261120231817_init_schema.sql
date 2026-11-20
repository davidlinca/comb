-- =====================================================================
-- Migrare 1: schema initiala - modul de rate pentru telefoane (CCD2)
-- Hackathon Telco / Neofin, nov. 2026
--
-- Principii:
--   1. RLS pe TOATE tabelele. Clientul vede doar datele lui; operatorul
--      (rol "operator" in app_metadata) vede tot, doar citire.
--   2. Nicio scriere directa din browser: anon/authenticated nu au
--      INSERT/UPDATE/DELETE. Toate scrierile trec prin API (Edge Function),
--      care verifica tokenul si apoi scrie cu cheia secret.
--   3. Jurnalul de dovezi (ledger_entries) e append-only si inlantuit cu
--      SHA-256: orice modificare ulterioara se detecteaza.
--   4. Bani: numeric(12,2), in lei. Fara float in baza de date.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Schema private: functii ajutatoare, NEexpusa prin Data API
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Este userul curent operator? (app_metadata poate fi setat doar server-side)
create or replace function private.is_operator()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'operator', false)
$$;

revoke execute on function private.is_operator() from public, anon;
grant execute on function private.is_operator() to authenticated, service_role;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Clienti (abonati) si datele lor
-- ---------------------------------------------------------------------
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique references auth.users (id) on delete set null, -- null = abonat sintetic fara login
  code             text not null unique,                                      -- ex. c_ana
  display_name     text not null,
  segment          text not null check (segment in ('postpaid', 'prepaid')),
  tenure_months    int  not null check (tenure_months >= 0),
  plan_name        text not null,
  monthly_bill_lei numeric(12,2) not null check (monthly_bill_lei >= 0),
  is_demo          boolean not null default true,
  created_at       timestamptz not null default now()
);
comment on table public.customers is 'Abonatii operatorului fictiv. Toate datele sunt sintetice (is_demo).';

-- customer_id-ul userului logat (security definer = evita recursivitatea RLS)
create or replace function private.my_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.customers c where c.user_id = (select auth.uid())
$$;

revoke execute on function private.my_customer_id() from public, anon;
grant execute on function private.my_customer_id() to authenticated, service_role;

create table public.billing_history (
  id          bigint generated always as identity primary key,
  customer_id uuid not null references public.customers (id) on delete cascade,
  period      date not null,                        -- prima zi a lunii facturate
  amount_lei  numeric(12,2) not null check (amount_lei >= 0),
  due_date    date not null,
  paid_on     date,                                 -- null = neplatita
  days_late   int  not null default 0 check (days_late >= 0),
  unique (customer_id, period)
);
comment on table public.billing_history is 'Istoricul facturilor postpaid. Folosit la evaluare DOAR cu acordul clientului.';

create table public.credit_bureau_records (
  customer_id            uuid primary key references public.customers (id) on delete cascade,
  other_installments_lei numeric(12,2) not null default 0 check (other_installments_lei >= 0),
  active_credits         int not null default 0 check (active_credits >= 0),
  source                 text not null default 'Biroul de Credit (simulat)',
  updated_at             timestamptz not null default now()
);
comment on table public.credit_bureau_records is 'Biroul de Credit SIMULAT: ratele existente ale clientului.';

-- ---------------------------------------------------------------------
-- 2. Catalog: produse si credite
-- ---------------------------------------------------------------------
create table public.devices (
  sku        text primary key,
  name       text not null,
  category   text not null check (category in ('phone', 'accessory')),
  price_lei  numeric(12,2) not null check (price_lei > 0),
  is_active  boolean not null default true,
  sort_order int not null default 0
);

create table public.credit_products (
  id               text primary key,                 -- RATE, ZERO4
  name             text not null,
  applies_to       text not null check (applies_to in ('phone', 'accessory')),
  nominal_rate_pct numeric(6,3) not null check (nominal_rate_pct >= 0),
  fees_lei         numeric(12,2) not null default 0 check (fees_lei >= 0),
  terms            int[] not null check (cardinality(terms) > 0),
  lender_name      text not null,
  lender_address   text not null,
  is_active        boolean not null default true
);

-- ---------------------------------------------------------------------
-- 3. Cererea de credit si pasii ei
-- ---------------------------------------------------------------------
create table public.applications (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.customers (id) on delete cascade,
  sku                text not null references public.devices (sku),
  product_id         text not null references public.credit_products (id),
  term_months        int  not null check (term_months > 0),
  status             text not null default 'draft'
                     check (status in ('draft', 'approved', 'manual_review', 'rejected', 'signed', 'cancelled')),
  -- oferta calculata de motor la creare (snapshot, nu se recalculeaza)
  principal_lei      numeric(12,2) not null check (principal_lei > 0),
  installment_lei    numeric(12,2) not null check (installment_lei > 0),
  installments       int not null check (installments > 0),
  total_payable_lei  numeric(12,2) not null,
  total_cost_lei     numeric(12,2) not null check (total_cost_lei >= 0),
  nominal_rate_pct   numeric(6,3) not null,
  apr_pct            numeric(6,2) not null,
  personalised_offer boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (total_payable_lei = principal_lei + total_cost_lei)
);
create index applications_customer_id_idx on public.applications (customer_id);
create index applications_sku_idx on public.applications (sku);
create index applications_product_id_idx on public.applications (product_id);
create index applications_status_idx on public.applications (status);
create trigger applications_touch before update on public.applications
  for each row execute function private.touch_updated_at();

create table public.consents (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  purpose        text not null check (purpose in ('billing_history', 'privacy_notice')),
  granted        boolean not null,
  notice_version text not null default 'v1',
  created_at     timestamptz not null default now(),
  withdrawn_at   timestamptz,
  unique (application_id, purpose)
);

-- Evaluarea: DOAR campurile din lista alba (art. 18(3)). Fara social media, sanatate etc.
create table public.assessments (
  id                              uuid primary key default gen_random_uuid(),
  application_id                  uuid not null unique references public.applications (id) on delete cascade,
  net_income_lei                  numeric(12,2) not null check (net_income_lei >= 0),
  monthly_expenses_lei            numeric(12,2) not null check (monthly_expenses_lei >= 0),
  other_installments_declared_lei numeric(12,2) not null check (other_installments_declared_lei >= 0),
  other_installments_bureau_lei   numeric(12,2) not null check (other_installments_bureau_lei >= 0),
  other_installments_used_lei     numeric(12,2) not null,  -- maximul dintre declarat si Birou
  new_installment_lei             numeric(12,2) not null,
  late_bills_12m                  int,                     -- null = fara istoric sau fara acord
  billing_history_used            boolean not null,
  dti_pct                         numeric(6,2),            -- null daca venitul e 0
  residual_lei                    numeric(12,2) not null,
  decision                        text not null check (decision in ('approved', 'manual_review', 'rejected')),
  reasons                         jsonb not null default '[]'::jsonb,
  automated                       boolean not null default true,
  engine_version                  text not null,
  created_at                      timestamptz not null default now(),
  check (other_installments_used_lei = greatest(other_installments_declared_lei, other_installments_bureau_lei))
);

-- Revizuire umana (art. 18(8)): ceruta de client sau de motor
create table public.human_reviews (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references public.applications (id) on delete cascade,
  requested_by     text not null check (requested_by in ('customer', 'engine')),
  customer_message text check (char_length(customer_message) <= 1000),
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  operator_user_id uuid references auth.users (id) on delete set null,
  operator_note    text check (char_length(operator_note) <= 1000),
  requested_at     timestamptz not null default now(),
  resolved_at      timestamptz,
  check ((status = 'pending') = (resolved_at is null))
);
create index human_reviews_application_id_idx on public.human_reviews (application_id);
create index human_reviews_operator_user_id_idx on public.human_reviews (operator_user_id);
create index human_reviews_status_idx on public.human_reviews (status);
create unique index human_reviews_one_pending on public.human_reviews (application_id) where status = 'pending';

-- SECCI afisat clientului (art. 10): continutul exact + hash, plus dovada vizualizarii
create table public.secci_documents (
  id                uuid primary key default gen_random_uuid(),
  application_id    uuid not null references public.applications (id) on delete cascade,
  secci_version     text not null,
  content           jsonb not null,
  content_sha256    text not null,
  first_shown_at    timestamptz not null default now(),
  time_on_screen_ms int check (time_on_screen_ms >= 0),
  details_opened    boolean,
  emailed_at        timestamptz,
  unique (application_id, secci_version)
);

-- OTP: codul se pastreaza DOAR ca hash; in demo il afisam pe ecran
create table public.otp_challenges (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  code_hash      text not null,
  expires_at     timestamptz not null,
  attempts       int not null default 0 check (attempts between 0 and 5),
  consumed_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index otp_challenges_application_idx on public.otp_challenges (application_id, created_at desc);

-- Contractul semnat, retragerea (art. 26) si reminderul (art. 10)
create table public.agreements (
  id                    uuid primary key default gen_random_uuid(),
  application_id        uuid not null unique references public.applications (id) on delete cascade,
  secci_document_id     uuid not null references public.secci_documents (id),
  signed_at             timestamptz not null,
  info_received_at      timestamptz not null,       -- cand a vazut SECCI prima data
  first_installment_due date not null,
  withdrawal_deadline   date not null,
  reminder_required     boolean not null,           -- semnat la < 1 zi de la informare
  reminder_from         date,
  reminder_to           date,
  status                text not null default 'active' check (status in ('active', 'withdrawn')),
  withdrawn_at          timestamptz,
  amount_to_return_lei  numeric(12,2),
  return_by             date,
  demo_offset_days      int not null default 0 check (demo_offset_days between 0 and 60), -- "Sari la ziua 3"
  check ((status = 'withdrawn') = (withdrawn_at is not null)),
  check (reminder_required = (reminder_from is not null and reminder_to is not null))
);
create index agreements_secci_document_id_idx on public.agreements (secci_document_id);

-- Mesaje trimise clientului (simulate): reminder retragere, SECCI pe email
create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  kind           text not null check (kind in ('withdrawal_reminder', 'secci_email')),
  channel        text not null default 'email (simulat)',
  sent_at        timestamptz not null default now(),
  body           text not null
);
create index notifications_application_id_idx on public.notifications (application_id);

-- ---------------------------------------------------------------------
-- 4. Jurnalul de dovezi (append-only, hash inlantuit per cerere)
-- ---------------------------------------------------------------------
create table public.ledger_event_types (
  event       text primary key,
  ccd2_ref    text not null,
  description text not null
);

insert into public.ledger_event_types (event, ccd2_ref, description) values
  ('offer_requested',              'art. 17',     'Clientul a cerut singur oferta de rate (fara credit nesolicitat)'),
  ('ad_warning_shown',             'art. 8',      'S-a afisat avertismentul "Atentie! Banii imprumutati costa bani."'),
  ('personalised_offer_disclosed', 'art. 13',     'Clientul a fost informat ca oferta e personalizata automat'),
  ('consent_given',                'GDPR art. 7', 'Clientul si-a dat acordul pentru un scop anume'),
  ('assessment_done',              'art. 18',     'Evaluarea bonitatii s-a facut pe date din lista alba'),
  ('debt_advice_shown',            'art. 18(9)',  'La respingere, clientul a primit trimitere la consiliere'),
  ('human_review_requested',       'art. 18(8)',  'S-a cerut revizuirea deciziei de catre un om'),
  ('human_review_resolved',        'art. 18(8)',  'Un operator a revizuit decizia'),
  ('secci_shown',                  'art. 10',     'S-a afisat formularul SECCI'),
  ('secci_viewed',                 'art. 10',     'Timpul pe ecran si daca s-au deschis detaliile'),
  ('secci_emailed',                'art. 10',     'SECCI trimis pe suport durabil (simulat)'),
  ('otp_sent',                     '-',           'Cod OTP generat pentru semnare (simulat)'),
  ('agreement_signed',             '-',           'Contract semnat cu OTP'),
  ('withdrawal_reminder_sent',     'art. 10',     'Reminder despre dreptul de retragere'),
  ('withdrawn',                    'art. 26',     'Clientul s-a retras din contract');

create table public.ledger_entries (
  id             bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete restrict, -- dovezile nu se sterg
  seq            int  not null,
  occurred_at    timestamptz not null default now(),
  event          text not null references public.ledger_event_types (event),
  ccd2_ref       text not null,
  actor          text not null check (actor in ('customer', 'system', 'operator')),
  payload        jsonb not null default '{}'::jsonb,  -- fara date personale in clar
  prev_hash      text not null,
  hash           text not null,
  unique (application_id, seq)
);
create index ledger_entries_event_idx on public.ledger_entries (event);
create index ledger_entries_occurred_at_idx on public.ledger_entries (occurred_at desc);

-- Hash-ul unei intrari: SHA-256 peste toate campurile + hash-ul anterior
create or replace function private.ledger_hash(
  p_application_id uuid, p_seq int, p_occurred_at timestamptz, p_event text,
  p_ccd2_ref text, p_actor text, p_payload jsonb, p_prev_hash text)
returns text
language sql
stable
set search_path = ''
as $$
  select encode(sha256(convert_to(concat_ws('|',
    p_application_id::text,
    p_seq::text,
    to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    p_event,
    p_ccd2_ref,
    p_actor,
    p_payload::text,
    p_prev_hash), 'UTF8')), 'hex')
$$;

-- La insert: seq, prev_hash, ccd2_ref si hash le pune baza de date, nu API-ul
create or replace function private.ledger_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_seq  int;
  v_hash text;
  v_at   timestamptz;
begin
  -- serializare per cerere, ca doua inserari simultane sa nu rupa lantul
  perform pg_advisory_xact_lock(hashtextextended(new.application_id::text, 0));

  select l.seq, l.hash, l.occurred_at into v_seq, v_hash, v_at
    from public.ledger_entries l
   where l.application_id = new.application_id
   order by l.seq desc
   limit 1;

  new.occurred_at := coalesce(new.occurred_at, now());
  if v_at is not null and new.occurred_at < v_at then
    raise exception 'ledger: occurred_at nu poate fi inaintea intrarii anterioare';
  end if;

  new.seq       := coalesce(v_seq, 0) + 1;
  new.prev_hash := coalesce(v_hash, repeat('0', 64));
  select t.ccd2_ref into new.ccd2_ref from public.ledger_event_types t where t.event = new.event;
  new.hash := private.ledger_hash(new.application_id, new.seq, new.occurred_at, new.event,
                                  new.ccd2_ref, new.actor, new.payload, new.prev_hash);
  return new;
end
$$;

create trigger ledger_entries_chain before insert on public.ledger_entries
  for each row execute function private.ledger_before_insert();

-- Append-only: UPDATE / DELETE / TRUNCATE interzise pentru oricine (si pentru cheia secret)
create or replace function private.ledger_block_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ledger_entries este append-only: % interzis', tg_op using errcode = '42501';
end
$$;

create trigger ledger_entries_no_update_delete before update or delete on public.ledger_entries
  for each row execute function private.ledger_block_change();
create trigger ledger_entries_no_truncate before truncate on public.ledger_entries
  for each statement execute function private.ledger_block_change();

-- Verificarea lantului: recalculeaza toate hash-urile unei cereri
create or replace function public.ledger_verify(p_application_id uuid)
returns table (valid boolean, entries int, first_invalid_seq int)
language plpgsql
stable
set search_path = ''
as $$
declare
  r          record;
  v_prev     text := repeat('0', 64);
  v_expected int  := 1;
begin
  for r in
    select * from public.ledger_entries l
     where l.application_id = p_application_id
     order by l.seq
  loop
    if r.seq <> v_expected
       or r.prev_hash <> v_prev
       or r.hash <> private.ledger_hash(r.application_id, r.seq, r.occurred_at, r.event,
                                        r.ccd2_ref, r.actor, r.payload, r.prev_hash) then
      return query select false, v_expected, r.seq;
      return;
    end if;
    v_prev := r.hash;
    v_expected := v_expected + 1;
  end loop;
  return query select true, v_expected - 1, null::int;
end
$$;

revoke execute on function public.ledger_verify(uuid) from public, anon, authenticated;
grant execute on function public.ledger_verify(uuid) to service_role;
revoke execute on function private.ledger_hash(uuid, int, timestamptz, text, text, text, jsonb, text) from public;
grant execute on function private.ledger_hash(uuid, int, timestamptz, text, text, text, jsonb, text) to service_role;

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
alter table public.customers             enable row level security;
alter table public.billing_history       enable row level security;
alter table public.credit_bureau_records enable row level security;
alter table public.devices               enable row level security;
alter table public.credit_products       enable row level security;
alter table public.applications          enable row level security;
alter table public.consents              enable row level security;
alter table public.assessments           enable row level security;
alter table public.human_reviews         enable row level security;
alter table public.secci_documents       enable row level security;
alter table public.otp_challenges        enable row level security;  -- fara politici = nimeni din browser
alter table public.agreements            enable row level security;
alter table public.notifications         enable row level security;
alter table public.ledger_event_types    enable row level security;
alter table public.ledger_entries        enable row level security;

-- Catalog: orice user logat
create policy "catalog citit de useri logati" on public.devices
  for select to authenticated using (true);
create policy "catalog citit de useri logati" on public.credit_products
  for select to authenticated using (true);
create policy "tipuri de evenimente citite de useri logati" on public.ledger_event_types
  for select to authenticated using (true);

-- Clientul: doar datele lui. Operatorul: tot.
create policy "client propriu sau operator" on public.customers
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_operator()));

create policy "facturi proprii sau operator" on public.billing_history
  for select to authenticated
  using (customer_id = (select private.my_customer_id()) or (select private.is_operator()));

create policy "birou propriu sau operator" on public.credit_bureau_records
  for select to authenticated
  using (customer_id = (select private.my_customer_id()) or (select private.is_operator()));

create policy "cereri proprii sau operator" on public.applications
  for select to authenticated
  using (customer_id = (select private.my_customer_id()) or (select private.is_operator()));

-- Tabelele copil: prin cererea parinte
create policy "acorduri proprii sau operator" on public.consents
  for select to authenticated
  using ((select private.is_operator()) or exists (
    select 1 from public.applications a
     where a.id = application_id and a.customer_id = (select private.my_customer_id())));

create policy "evaluari proprii sau operator" on public.assessments
  for select to authenticated
  using ((select private.is_operator()) or exists (
    select 1 from public.applications a
     where a.id = application_id and a.customer_id = (select private.my_customer_id())));

create policy "revizuiri proprii sau operator" on public.human_reviews
  for select to authenticated
  using ((select private.is_operator()) or exists (
    select 1 from public.applications a
     where a.id = application_id and a.customer_id = (select private.my_customer_id())));

create policy "secci propriu sau operator" on public.secci_documents
  for select to authenticated
  using ((select private.is_operator()) or exists (
    select 1 from public.applications a
     where a.id = application_id and a.customer_id = (select private.my_customer_id())));

create policy "contracte proprii sau operator" on public.agreements
  for select to authenticated
  using ((select private.is_operator()) or exists (
    select 1 from public.applications a
     where a.id = application_id and a.customer_id = (select private.my_customer_id())));

create policy "notificari proprii sau operator" on public.notifications
  for select to authenticated
  using ((select private.is_operator()) or exists (
    select 1 from public.applications a
     where a.id = application_id and a.customer_id = (select private.my_customer_id())));

-- Jurnalul: doar operatorul
create policy "jurnal doar pentru operator" on public.ledger_entries
  for select to authenticated
  using ((select private.is_operator()));

-- ---------------------------------------------------------------------
-- 6. Drepturi: browserul doar citeste; anon nu vede nimic
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
revoke all on public.otp_challenges from authenticated;
grant select on
  public.customers, public.billing_history, public.credit_bureau_records,
  public.devices, public.credit_products, public.applications, public.consents,
  public.assessments, public.human_reviews, public.secci_documents,
  public.agreements, public.notifications, public.ledger_event_types, public.ledger_entries
  to authenticated;
