# Comb · aplicația clientului (web/)

Vite + React + TypeScript + Tailwind 4 + react-router. Mobile-first (390 px), în ramă de telefon pe desktop.

```bash
cd web
cp .env.example .env.local   # completează cheia publishable
npm install
npm run dev                  # http://localhost:5173
npm run build
```

Scripturile apelează `node node_modules/...` direct, pentru că folderul proiectului conține `:` în cale, iar `:` strică PATH-ul folosit de `npm run`.

Ecrane (contract API v0.3): `/login` → `/shop` → `/shop/:sku` (perioada) → `/a/:id/buget` → `/a/:id/rezultat`. `/a/:id/oferta` e loc pentru ecranele 5–6. `/backoffice` randează componenta din `src/backoffice/` (a echipei de backend).
