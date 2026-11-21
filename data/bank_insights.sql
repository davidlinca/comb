-- Open Banking SIMULAT: venitul si cheltuielile din cont pentru toti clientii (date sintetice).
-- Ruleaza DUPA migratia bank_verification. Se poate rula de mai multe ori (nu dubleaza, nu suprascrie).
--  - Ana, Mihai, Ioana: exact valorile din DECIZII (sectiunea 5), ca sa iasa aceleasi decizii.
--  - Clientii cu o evaluare in seed: banca confirma ce au declarat atunci.
--  - Restul: valori deterministe (acelasi rezultat la fiecare rulare).

with last_asmt as (
  select distinct on (a.customer_id) a.customer_id, s.net_income_lei, s.monthly_expenses_lei
  from public.assessments s
  join public.applications a on a.id = s.application_id
  order by a.customer_id, s.created_at
),
base as (
  select c.id, c.code,
    (case when c.segment = 'postpaid' then 3000 else 2200 end) + (abs(hashtext(c.code)) % 60) * 50 as synth_income
  from public.customers c
)
insert into public.bank_account_insights (customer_id, net_income_lei, essential_expenses_lei, months_analysed)
select b.id,
  case b.code when 'c_ana' then 5200 when 'c_mihai' then 3900 when 'c_ioana' then 2600
              else coalesce(l.net_income_lei, b.synth_income) end,
  case b.code when 'c_ana' then 2100 when 'c_mihai' then 1800 when 'c_ioana' then 1700
              else coalesce(l.monthly_expenses_lei, round(b.synth_income * 0.35 / 10) * 10) end,
  3
from base b
left join last_asmt l on l.customer_id = b.id
on conflict (customer_id) do nothing;

-- Verificare
select count(*) as clienti_cu_date_bancare,
  (select count(*) from public.customers) as clienti_total,
  (select net_income_lei || ' / ' || essential_expenses_lei from public.bank_account_insights i
     join public.customers c on c.id = i.customer_id where c.code = 'c_ana') as ana_venit_cheltuieli
from public.bank_account_insights;
