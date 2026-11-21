-- Ruleaza DUPA ce exista cele 4 conturi in Authentication si DUPA seed_demo.sql.
-- 1) Leaga conturile demo de clientii lor.
update public.customers c
   set user_id = u.id
  from auth.users u
 where (c.code, u.email) in (('c_ana', 'ana@demo.comb.ro'), ('c_mihai', 'mihai@demo.comb.ro'), ('c_ioana', 'ioana@demo.comb.ro'));

-- 2) Rolul de operator: in app_metadata (il poate seta doar serverul). Intra in token la urmatorul login.
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "operator"}'::jsonb
 where email = 'operator@demo.comb.ro';

-- 3) Verificare
select c.code, c.display_name, u.email, (u.raw_app_meta_data ->> 'role') as rol
  from auth.users u left join public.customers c on c.user_id = u.id
 order by u.email;
