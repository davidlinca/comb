import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { IconChevron } from '../components/Icons';

const DEMO = [
  { email: 'ana@demo.comb.ro', name: 'Ana Popescu', meta: 'Abonament · 38 de luni · plăți la timp', initial: 'A', brand: true },
  { email: 'mihai@demo.comb.ro', name: 'Mihai Ionescu', meta: 'Abonament · 14 luni · 2 întârzieri', initial: 'M' },
  { email: 'ioana@demo.comb.ro', name: 'Ioana Marin', meta: 'Cartelă preplătită', initial: 'I' },
];
const DEMO_PASSWORD = 'Demo2026!';

export default function Login() {
  const nav = useNavigate();
  const { refreshMe } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: string, p: string) {
    setBusy(e); setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: e, password: p });
    if (err) { setError('Email sau parolă greșite.'); setBusy(null); return; }
    const me = await refreshMe();
    setBusy(null);
    nav(me?.role === 'operator' ? '/backoffice' : '/shop', { replace: true });
  }
  const onSubmit = (ev: FormEvent) => { ev.preventDefault(); void signIn(email.trim(), password); };

  return (
    <div className="flex min-h-full flex-col gap-7 bg-paper px-5 pb-8 pt-16">
      <div>
        <p className="text-[34px] font-extrabold tracking-tight">telvia</p>
        <p className="text-[16px] text-subtle">Demo · rate prin Comb</p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="quick">
        <h1 id="quick" className="text-[22px] font-bold">Intră ca</h1>
        {DEMO.map((d) => (
          <button key={d.email} type="button" onClick={() => signIn(d.email, DEMO_PASSWORD)} disabled={!!busy}
            className="flex items-center gap-3.5 rounded-2xl bg-mist p-4 text-left hover:bg-cloud disabled:opacity-60">
            <span className={`grid size-11 shrink-0 place-items-center rounded-full text-[17px] font-bold ${d.brand ? 'bg-brand' : 'bg-cloud'}`}>{d.initial}</span>
            <span className="flex flex-1 flex-col">
              <span className="text-[17px] font-semibold">{busy === d.email ? 'Se conectează…' : d.name}</span>
              <span className="text-[14px] text-subtle">{d.meta}</span>
            </span>
            <IconChevron className="size-5 text-subtle" />
          </button>
        ))}
      </section>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-cloud pt-6">
        <h2 className="text-[16px] font-semibold">Sau cu email</h2>
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-2xl bg-mist px-4 text-[16px] font-normal outline-none focus:ring-2 focus:ring-ink" required />
        </label>
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">Parolă
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-2xl bg-mist px-4 text-[16px] font-normal outline-none focus:ring-2 focus:ring-ink" required />
        </label>
        {error && <p role="alert" className="text-[14px] font-medium text-danger-strong">{error}</p>}
        <button type="submit" disabled={!!busy} className="h-12 rounded-full bg-ink text-[16px] font-semibold text-paper hover:bg-graphite disabled:opacity-60">Intră</button>
      </form>
      <p className="mt-auto text-center text-[13px] text-subtle">Clienți și date fictive, doar pentru demo.</p>
    </div>
  );
}
