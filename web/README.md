# Comb · aplicația clientului (web/)

Vite + React + TypeScript + Tailwind 4 + react-router 7 (data router). Mobile-first; pe tabletă și desktop apare într-o ramă de telefon scalată.

```bash
cd web
cp .env.example .env.local   # completează cheia publishable
npm install
npm run dev                  # http://localhost:5173
npm run build
```

Scripturile apelează `node node_modules/...` direct, pentru că folderul proiectului conține `:` în cale, iar `:` strică PATH-ul folosit de `npm run`.

## Ecrane

`/login` → `/shop` → `/shop/:sku` (perioada) → `/a/:id/buget` (+ verificarea) → `/a/:id/rezultat` (aprobat / în analiză / respins) → `/a/:id/oferta` (+ SECCI complet) → `/a/:id/confirma` (glisare) → `/a/:id/semnare` (cod SMS) → `/c/:aid` (contract, memento, retragere). `/backoffice` randează componenta din `src/backoffice/` (a echipei de backend), încărcată separat.

## Cum e construit

- `src/router.tsx`: rutele. Magazinul rămâne afișat sub toate sheet-urile; `SheetShell` e sheet-ul persistent în care se schimbă pașii.
- `src/loaders.ts`: datele fiecărui pas se cer înainte de navigare, plus redirecționările după starea cererii (refresh, înapoi).
- `src/components/ui.tsx`: componentele (Btn, SheetHeader, RadioCard, MoneyField, Checkbox, Collapse, Rows…). Tokenii de culoare sunt în `src/index.css` (`@theme`).
- Animații: View Transitions între pași (`viewTransition: true`), micro-animații CSS; toate se opresc la `prefers-reduced-motion`.
- Accesibilitate: focus pe titlul fiecărui ecran, Escape închide, fundalul e `inert`, inputuri native (radio/checkbox), ținte ≥44 px, glisarea se poate face și cu Enter.
- Clientul Supabase e folosit doar pentru login/logout/token; datele trec prin `src/lib/api.ts`.

## Demo pe desktop

Pe ecrane late (≥1180 px) apare în stânga lista pașilor cu articolul CCD2 acoperit. Pentru înregistrare video fără ea: adaugă `?clean` la URL (`?clean=0` o readuce).
