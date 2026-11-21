-- Curatare pentru demo: arhiveaza TOATE cererile conturilor demo (Ana, Mihai, Ioana = clientii cu cont de login).
-- Nu sterge nimic: cererile, contractele si jurnalul raman; doar dispar din back-office (lista + coada).
-- Se ruleaza in Supabase -> SQL Editor inainte de repetitii / inainte de pitch. Se poate rula de oricate ori.
-- Clientii sintetici fara cont (cei 60) NU sunt atinsi.

-- 1. Ce s-ar arhiva (doar citire)
select c.display_name, a.status, count(*) as cereri
from public.applications a
join public.customers c on c.id = a.customer_id
where a.archived_at is null and c.user_id is not null
group by 1, 2
order by 1, 2;

-- 2. Arhivarea
update public.applications a
set archived_at = now()
from public.customers c
where c.id = a.customer_id
  and c.user_id is not null
  and a.archived_at is null;

-- 3. Verificare: 0 cereri demo vizibile, toate jurnalele valide
select
  (select count(*) from public.applications a join public.customers c on c.id = a.customer_id
    where c.user_id is not null and a.archived_at is null) as demo_vizibile,
  (select count(*) from public.applications a cross join lateral public.ledger_verify(a.id) v
    where not v.valid) as jurnale_invalide;
