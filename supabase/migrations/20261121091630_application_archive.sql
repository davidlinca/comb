-- Curatare pentru demo (decizie 21.11, 11:20): o cerere arhivata dispare din back-office (lista jurnalelor + coada).
-- Nu sterge nimic: cererea, evaluarea, contractul si jurnalul raman; ledger_verify ramane valid.
-- Arhivarea o face doar serverul (cheia secret / SQL Editor): authenticated are doar SELECT pe tabel.

alter table public.applications add column archived_at timestamptz;

comment on column public.applications.archived_at is
  'Ascunsa din back-office (curatare demo, ex. cererile create de teste). Nu sterge nimic; jurnalul ramane intact.';

-- Lista din back-office: ultimele cereri nearhivate
create index applications_active_created_idx on public.applications (created_at desc) where archived_at is null;
