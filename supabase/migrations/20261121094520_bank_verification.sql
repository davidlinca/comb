-- Verificarea venitului si a cheltuielilor (CCD2 art. 18(3)), decizie 21.11, 11:45.
-- Sursa: contul bancar al clientului prin Open Banking (SIMULAT), doar cu acordul lui explicit (acord nou: bank_data).
-- Motorul (engine-v2) foloseste: venit = min(declarat, banca), cheltuieli = max(declarat, banca).
-- Fara acord sau fara date -> revizuire umana (niciodata aprobare automata pe venit nedovedit).
-- Nu modifica niciun rand existent.

-- 1. Acordul nou
alter table public.consents drop constraint consents_purpose_check;
alter table public.consents add constraint consents_purpose_check
  check (purpose in ('billing_history', 'privacy_notice', 'bank_data'));

-- 2. Datele din contul bancar (SIMULAT): media ultimelor luni
create table public.bank_account_insights (
  customer_id            uuid primary key references public.customers (id) on delete cascade,
  net_income_lei         numeric(12,2) not null check (net_income_lei >= 0),          -- venitul net lunar incasat
  essential_expenses_lei numeric(12,2) not null check (essential_expenses_lei >= 0),  -- cheltuieli lunare esentiale
  months_analysed        int not null default 3 check (months_analysed between 1 and 12),
  source                 text not null default 'Open Banking (simulat)',
  updated_at             timestamptz not null default now()
);
comment on table public.bank_account_insights is
  'Open Banking SIMULAT: venitul si cheltuielile din contul bancar. Folosit la evaluare DOAR cu acordul bank_data.';

alter table public.bank_account_insights enable row level security;
create policy "banca proprie sau operator" on public.bank_account_insights
  for select to authenticated
  using (customer_id = (select private.my_customer_id()) or (select private.is_operator()));

-- Ca la celelalte tabele: browserul doar citeste, anon nimic; scrierile doar cu cheia secret
revoke all on public.bank_account_insights from anon;
revoke insert, update, delete, truncate, references, trigger on public.bank_account_insights from authenticated;
grant select on public.bank_account_insights to authenticated;

-- 3. Evaluarea pastreaza ce a verificat (null pe evaluarile vechi, engine-v1)
alter table public.assessments
  add column bank_data_used        boolean not null default false,
  add column income_verified_lei   numeric(12,2) check (income_verified_lei >= 0),
  add column income_used_lei       numeric(12,2),
  add column expenses_verified_lei numeric(12,2) check (expenses_verified_lei >= 0),
  add column expenses_used_lei     numeric(12,2);

alter table public.assessments
  add constraint assessments_income_used_check check (income_used_lei is null or income_used_lei =
    case when income_verified_lei is null then net_income_lei else least(net_income_lei, income_verified_lei) end),
  add constraint assessments_expenses_used_check check (expenses_used_lei is null or expenses_used_lei =
    case when expenses_verified_lei is null then monthly_expenses_lei else greatest(monthly_expenses_lei, expenses_verified_lei) end),
  add constraint assessments_bank_used_check check (
    bank_data_used = (income_verified_lei is not null and expenses_verified_lei is not null));
