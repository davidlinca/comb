-- Alte rate vazute in contul bancar (Open Banking, SIMULAT), decizie 21.11, 15:10 (engine-v3).
-- Alte rate folosite = maximul dintre declarat, Biroul de Credit si banca. Banca se foloseste DOAR cu acordul bank_data.
-- Prinde ce nu raporteaza nimeni la Birou: BNPL, rate la magazin, IFN-uri mici (CCD2 art. 18(3): verificare, nu colectare in plus;
-- se citeste doar suma lunara, nu tranzactiile).
-- Nu modifica nicio valoare existenta: adauga 2 coloane si completeaza doar coloana noua.

-- 1. Banca: suma lunara a ratelor platite din cont
alter table public.bank_account_insights
  add column installments_seen_lei numeric(12,2) not null default 0 check (installments_seen_lei >= 0);
comment on column public.bank_account_insights.installments_seen_lei is
  'Open Banking SIMULAT: rate platite lunar vazute in cont (inclusiv BNPL / rate la magazin / IFN care nu raporteaza la Birou).';

-- Date demo: banca vede aceleasi rate ca Biroul de Credit; Mihai are in plus 100 lei BNPL, pe care Biroul nu il vede.
update public.bank_account_insights b
set installments_seen_lei = cb.other_installments_lei + case when c.code = 'c_mihai' then 100 else 0 end
from public.credit_bureau_records cb
join public.customers c on c.id = cb.customer_id
where cb.customer_id = b.customer_id;

-- 2. Evaluarea pastreaza ce a vazut in banca (null pe evaluarile vechi si fara acord bancar)
alter table public.assessments
  add column other_installments_bank_lei numeric(12,2) check (other_installments_bank_lei >= 0);

alter table public.assessments
  add constraint assessments_bank_installments_check check (other_installments_bank_lei is null or bank_data_used);

-- Regula „folosit = maximul” include acum si banca (pe randurile vechi banca e null -> aceeasi regula ca inainte)
alter table public.assessments drop constraint assessments_check;
alter table public.assessments add constraint assessments_other_installments_used_check check (
  other_installments_used_lei = greatest(other_installments_declared_lei, other_installments_bureau_lei, coalesce(other_installments_bank_lei, 0)));
