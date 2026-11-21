# Motorul de calcul (engine-v1)

Cod pur TypeScript, fara baza de date si fara retea. Il folosesc API-ul (Edge Function) si scriptul de date demo.

| Fisier | Ce face |
|---|---|
| `loan.ts` | Oferta si graficul de rate (anuitate, rata rotunjita la ban, ultima rata ajustata) |
| `apr.ts` | DAE dupa Anexa I CCD2 (12 luni egale), rezolvata numeric |
| `affordability.ts` | Decizia: aprobat / revizuire umana / respins + 2–3 motive in limbaj simplu |
| `validation.ts` | Lista alba pentru evaluare (art. 18(3)); campurile interzise dau eroare |
| `agreement.ts` | Termenul de retragere, reminderul, suma de returnat la retragere |
| `dates.ts`, `money.ts` | Date in ora Romaniei, bani in bani (intregi), formatare ro-RO |

Teste (25), aceleasi in Node si in Deno:

```
node --test supabase/functions/_shared/engine/engine.test.ts
deno test supabase/functions/_shared/engine/engine.test.ts
```
