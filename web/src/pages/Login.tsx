import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { signIn } from '../lib/session';
import { IconAlert, IconChevronRight } from '../components/Icons';
import { Spinner, cx } from '../components/ui';
import { CombMark } from '../components/PhoneFrame';

const DEMO = [
  { email: 'ana@demo.comb.ro', name: 'Ana Popescu', meta: 'Abonament · 38 de luni · plăți la timp', initial: 'A', brand: true },
  { email: 'mihai@demo.comb.ro', name: 'Mihai Ionescu', meta: 'Abonament · 14 luni · 2 întârzieri', initial: 'M' },
  { email: 'ioana@demo.comb.ro', name: 'Ioana Marin', meta: 'Cartelă preplătită', initial: 'I' },
];
const DEMO_PASSWORD = 'Demo2026!';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(e: string, p: string) {
    setBusy(e); setError(null);
    try {
      const me = await signIn(e, p);
      nav(me.role === 'operator' ? '/backoffice' : '/shop', { replace: true, viewTransition: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'A apărut o eroare. Încearcă din nou.');
      setBusy(null);
    }
  }
  const onSubmit = (ev: FormEvent) => { ev.preventDefault(); void go(email.trim(), password); };

  return (
    <main className="absolute inset-0 overflow-y-auto bg-paper">
      <div className="flex min-h-full flex-col gap-8 px-5 pb-[calc(var(--safe-bottom)+24px)] pt-[calc(var(--safe-top)+28px)]">
        <header className="flex flex-col gap-6 animate-fade-up">
          <span className="text-[24px] font-extrabold tracking-[-0.04em]">telvia</span>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em]">Bine ai venit</h1>
            <p className="text-[16px] text-subtle">Alege un client demo ca să intri în aplicație.</p>
          </div>
        </header>

        <section aria-labelledby="quick" className="flex flex-col gap-2.5">
          <h2 id="quick" className="sr-only">Clienți demo</h2>
          {DEMO.map((d, i) => (
            <button key={d.email} type="button" onClick={() => go(d.email, DEMO_PASSWORD)} disabled={!!busy}
              aria-busy={busy === d.email || undefined}
              style={{ animationDelay: `${80 + i * 60}ms` }}
              className={cx(
                'group flex min-h-[72px] items-center gap-3.5 rounded-[20px] border border-cloud bg-paper p-3.5 text-left animate-fade-up',
                'transition-[background-color,border-color,transform,opacity] duration-200 hover:border-ink/20 hover:bg-mist active:scale-[0.985]',
                busy && busy !== d.email && 'opacity-50',
              )}>
              <span aria-hidden className={cx('grid size-12 shrink-0 place-items-center rounded-full text-[18px] font-bold', d.brand ? 'bg-brand' : 'bg-mist group-hover:bg-cloud')}>{d.initial}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[17px] font-semibold">{d.name}</span>
                <span className="truncate text-[14px] text-subtle">{d.meta}</span>
              </span>
              {busy === d.email
                ? <Spinner className="size-5 text-ink" />
                : <IconChevronRight className="size-5 text-subtle transition-transform duration-200 group-hover:translate-x-0.5" />}
            </button>
          ))}
        </section>

        <form onSubmit={onSubmit} className="flex flex-col gap-3 animate-fade-up [animation-delay:300ms]" aria-labelledby="with-email">
          <div className="flex items-center gap-3 text-[13px] text-subtle" aria-hidden>
            <span className="h-px flex-1 bg-cloud" /><span>sau</span><span className="h-px flex-1 bg-cloud" />
          </div>
          <h2 id="with-email" className="text-[16px] font-semibold">Intră cu email</h2>
          <Field label="Email" type="email" autoComplete="username" value={email} onChange={setEmail} />
          <Field label="Parolă" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-2xl bg-danger-strong/[0.07] px-4 py-3 text-[14px] font-medium text-danger-strong animate-fade-up">
              <IconAlert className="size-[18px] shrink-0" />{error}
            </p>
          )}
          <button type="submit" disabled={!!busy || !email || !password} aria-busy={busy === email.trim() || undefined}
            className="relative mt-1 h-[50px] rounded-full bg-ink text-[16px] font-semibold text-paper transition-[background-color,transform] duration-200 hover:bg-graphite active:scale-[0.98] disabled:bg-cloud disabled:text-subtle">
            {busy === email.trim() ? <Spinner className="mx-auto size-5" /> : 'Intră'}
          </button>
        </form>

        <footer className="mt-auto flex items-center justify-center gap-2 text-[13px] text-subtle">
          <CombMark className="size-4" /> Rate prin Comb · clienți și date fictive
        </footer>
      </div>
    </main>
  );
}

function Field({ label, type, autoComplete, value, onChange }: { label: string; type: string; autoComplete: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-[14px] font-medium">
      {label}
      <input type={type} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} required
        className="h-[50px] rounded-2xl border border-cloud bg-mist px-4 text-[16px] font-normal outline-none transition-colors hover:border-ink/20 focus:border-ink focus:bg-paper focus-visible:outline-none" />
    </label>
  );
}
