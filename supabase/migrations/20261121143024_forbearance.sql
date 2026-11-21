-- Rata ratata: masuri de toleranta (CCD2 art. 35). Decizii 21.11, 15:55 si 16:20 (Varianta A):
--   amanare   = toate ratele se muta cu o luna; in plus doar dobanda pe o luna, adaugata la ultima rata;
--   reesalonare = datoria la scadenta ratata pe ratele ramase + 6, aceeasi dobanda, fara comision;
--   vorbeste cu un om = cerere in coada din back-office.
-- O singura masura pe contract, aleasa de client. In demo prima rata e considerata neplatita
-- cand „azi” (data reala + demo_offset_days) trece de scadenta (aplicatia nu tine evidenta platilor).
-- Nu modifica nicio valoare existenta: 3 tipuri de evenimente, 1 tabel nou, 1 tip nou de notificare.

-- 1. Evenimente noi in jurnal
insert into public.ledger_event_types (event, ccd2_ref, description) values
  ('installment_missed',  'art. 35', 'Rata nu a fost platita la scadenta (in demo: prima rata)'),
  ('forbearance_offered', 'art. 35', 'Clientului i s-au aratat masurile de toleranta, cu costul exact, fara comisioane'),
  ('forbearance_chosen',  'art. 35', 'Clientul a ales o masura de toleranta');

-- 2. Mesajul simulat „rata nu a fost platita” (cel mult unul pe cerere: marcheaza si ca rata ratata a fost deja inregistrata)
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('withdrawal_reminder', 'secci_email', 'installment_missed'));
create unique index notifications_one_installment_missed on public.notifications (application_id)
  where kind = 'installment_missed';

-- 3. Masura aleasa de client (una singura pe contract)
create table public.forbearance_measures (
  id                    uuid primary key default gen_random_uuid(),
  agreement_id          uuid not null unique references public.agreements (id) on delete cascade,
  installment_n         int  not null check (installment_n >= 1),
  missed_due_date       date not null,
  option                text not null check (option in ('defer', 'reschedule', 'talk')),
  extra_cost_lei        numeric(12,2) check (extra_cost_lei >= 0),        -- dobanda in plus fata de contract (fara comisioane)
  new_installment_lei   numeric(12,2) check (new_installment_lei > 0),
  new_installments      int check (new_installments > 0),
  new_total_payable_lei numeric(12,2) check (new_total_payable_lei > 0),
  schedule              jsonb,                                            -- graficul nou (null la „vorbeste cu un om”)
  human_review_id       uuid references public.human_reviews (id) on delete set null,
  created_at            timestamptz not null default now(),
  check (
    (option = 'talk' and extra_cost_lei is null and new_installment_lei is null and new_installments is null
                     and new_total_payable_lei is null and schedule is null)
    or
    (option <> 'talk' and extra_cost_lei is not null and new_installment_lei is not null and new_installments is not null
                      and new_total_payable_lei is not null and schedule is not null)
  )
);
create index forbearance_measures_human_review_id_idx on public.forbearance_measures (human_review_id);

-- RLS: clientul citeste doar masurile contractelor lui, operatorul tot; scrieri doar prin API (cheia secret)
alter table public.forbearance_measures enable row level security;
create policy "masuri proprii sau operator" on public.forbearance_measures
  for select to authenticated
  using ((select private.is_operator()) or exists (
    select 1 from public.agreements g
      join public.applications a on a.id = g.application_id
     where g.id = agreement_id and a.customer_id = (select private.my_customer_id())));

revoke all on public.forbearance_measures from anon;
revoke insert, update, delete, truncate, references, trigger on public.forbearance_measures from authenticated;
grant select on public.forbearance_measures to authenticated;
