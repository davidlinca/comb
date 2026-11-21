# Back-office (jurnal de dovezi + coada de revizuire)

Scris de echipa de backend (Bogdan + Claude). Pagina desktop pentru operator:
- **Jurnal de dovezi**: ultimele 25 de cereri, fiecare cu verificarea lantului de hash-uri; la click, lantul complet, cu sigiliul „Jurnal verificat”.
- **Revizuiri**: cererile care asteapta un om (cerute de client sau trimise de motor), cu motivele si cifrele evaluarii; Aproba / Respinge + nota. Se actualizeaza singura la 10 secunde.

Foloseste doar `react` si clase Tailwind. Nu depinde de restul aplicatiei: primeste tokenul printr-o functie.

## Integrare in `web/` (o singura ruta)

```tsx
import { Backoffice } from './backoffice';
import { supabase } from './lib/supabase';

<Route
  path="/backoffice"
  element={
    <Backoffice
      apiUrl={import.meta.env.VITE_API_URL}
      publishableKey={import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}
      getAccessToken={async () => (await supabase.auth.getSession()).data.session?.access_token ?? null}
      operatorName="Operator"
      onLogout={() => void supabase.auth.signOut()}
    />
  }
/>
```

- Dupa login, `GET /me` intoarce `role: "operator"` pentru contul operatorului: atunci aplicatia duce userul la `/backoffice`.
- Un client logat care ajunge aici primeste 403 de la API, iar pagina afiseaza mesajul de eroare.
- Tailwind trebuie sa scaneze `src/backoffice` (implicit, daca scaneaza tot `src/`).

## Test fara proiectul `web/`

`tools/backoffice-dev/` e o pagina de proba care randeaza aceeasi componenta, cu login de operator:

```
cd tools/backoffice-dev
npm install
npm run dev     # http://localhost:5173 (portul permis de CORS)
```
