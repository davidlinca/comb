// Pagina de proba: login de operator + componenta Backoffice, exact cum o va folosi aplicatia din web/.
// Cheia publishable e publica (merge in front). Parola nu se salveaza nicaieri in afara sesiunii Supabase.

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, type Session } from '@supabase/supabase-js';
import { Backoffice } from '../../../web/src/backoffice';
import './index.css';

const SUPABASE_URL = 'https://ezynswlvqqrzahpblkxu.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_LJBH2tJNlXCXEZCh9ujE2g_IBeMHh2f';
const API_URL = `${SUPABASE_URL}/functions/v1/api`;

const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY);

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  if (!session) return <Login />;
  return (
    <Backoffice
      apiUrl={API_URL}
      publishableKey={PUBLISHABLE_KEY}
      getAccessToken={async () => (await supabase.auth.getSession()).data.session?.access_token ?? null}
      operatorName={session.user.email ?? 'Operator'}
      onLogout={() => void supabase.auth.signOut()}
    />
  );
}

function Login() {
  const [email, setEmail] = useState('operator@demo.comb.ro');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError('Email sau parola gresita.');
    setBusy(false);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Back-office (pagina de proba)</h1>
          <p className="text-sm text-slate-600">Intra cu contul de operator.</p>
        </div>
        <label className="block text-sm font-medium text-slate-800">
          Email
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Parola
          <input type="password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="min-h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Se verifica…' : 'Intra'}
        </button>
      </form>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
