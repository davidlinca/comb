// Semnarea cu codul din SMS (simulat: codul demo apare pe ecran și se poate completa cu un tap).
import { useEffect, useRef, useState } from 'react';
import { useLoaderData, useNavigate, useOutletContext } from 'react-router-dom';
import { api, api2, ApiError } from '../lib/api';
import { lei } from '../lib/format';
import { useStepBack, vibrate } from '../lib/motion';
import type { LoaderData, otpLoader } from '../loaders';
import type { SheetCtx } from '../components/SheetShell';
import { IconAlert } from '../components/Icons';
import { ArrowLink, Btn, RoundBtn, SheetBody, SheetFoot, SheetTitle, SheetTop, cx } from '../components/ui';

const RESEND_S = 30;
const LEN = 6;

export default function OtpSheet() {
  const { app, lender } = useLoaderData() as LoaderData<typeof otpLoader>;
  const id = app.application_id;
  const { close } = useOutletContext<SheetCtx>();
  const nav = useNavigate();
  const back = useStepBack(`/a/${id}/confirma`);
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_S);
  const input = useRef<HTMLInputElement>(null);
  const requested = useRef(false); // un singur cod la intrare (max 3 coduri în 10 minute)

  async function goToAgreement() {
    const a = await api.application(id).catch(() => null);
    if (a?.agreement_id) nav(`/c/${a.agreement_id}`, { replace: true, viewTransition: true });
  }

  async function requestCode() {
    setError(null);
    try {
      const r = await api2.otp(id);
      setDemoCode(r.otp_demo_code); setCode(''); setCooldown(RESEND_S);
      input.current?.focus({ preventScroll: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ALREADY_SIGNED') { await goToAgreement(); return; }
      setError(e instanceof ApiError ? e.message : 'Codul nu a putut fi trimis.');
    }
  }

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void requestCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sign() {
    if (code.length !== LEN) { setError('Introdu toate cele 6 cifre.'); setShake((s) => s + 1); return; }
    setBusy(true); setError(null);
    try {
      const r = await api2.sign(id, code);
      vibrate(20);
      nav(`/c/${r.agreement_id}`, { replace: true, viewTransition: true, state: { justSigned: true } });
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.code === 'ALREADY_SIGNED') { await goToAgreement(); return; }
      setError(e instanceof ApiError ? e.message : 'Semnarea nu a reușit. Încearcă din nou.'); // mesajul API, exact
      setShake((s) => s + 1); vibrate(30);
      if (e instanceof ApiError && (e.code === 'OTP_LOCKED' || e.code === 'OTP_EXPIRED')) setCooldown(0);
      input.current?.select();
    }
  }

  /** Completează codul demo cifră cu cifră (doar pentru prezentare). */
  function fillDemo() {
    if (!demoCode) return;
    setError(null); setCode('');
    demoCode.split('').forEach((_, i) => setTimeout(() => setCode(demoCode.slice(0, i + 1)), 70 * (i + 1)));
    input.current?.focus({ preventScroll: true });
  }

  const active = Math.min(code.length, LEN - 1);
  return (
    <>
      <SheetTop>
        <div className="flex items-center justify-between">
          <RoundBtn kind="back" onClick={back} label="Înapoi la confirmare" />
          <span className="text-[15px] font-medium">Semnare</span>
          <RoundBtn kind="close" onClick={close} />
        </div>
      </SheetTop>
      <SheetBody>
        <div className="flex flex-col gap-1.5">
          <SheetTitle>Introdu codul trimis prin SMS</SheetTitle>
          <p className="text-[15px]">Codul a fost trimis la 07•• ••• 123.</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="relative">
            <input
              ref={input} id="otp" value={code} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={LEN}
              aria-label="Codul de 6 cifre din SMS" aria-invalid={!!error || undefined} aria-describedby={error ? 'otp-err' : 'otp-help'}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, LEN)); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void sign(); }}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
            />
            <div key={shake} aria-hidden className={cx('grid grid-cols-6 gap-2', shake > 0 && error && 'animate-shake')}>
              {Array.from({ length: LEN }, (_, i) => {
                const ch = code[i];
                const isActive = focused && i === active && !busy;
                return (
                  <span key={i} className={cx(
                    'relative grid h-[58px] place-items-center rounded-[14px] border bg-card text-[26px] font-semibold transition-[border-color,background-color,transform] duration-200',
                    error ? 'border-danger' : isActive ? 'border-brand' : ch ? 'border-paper' : 'border-stroke',
                    ch && !error && 'bg-card-hover',
                  )}>
                    {ch && <span key={ch + i} className="animate-pop">{ch}</span>}
                    {isActive && !ch && <span className="h-7 w-[2px] animate-[blink_1s_steps(1)_infinite] rounded bg-brand" />}
                  </span>
                );
              })}
            </div>
          </div>
          <p id="otp-help" className="sr-only">Introdu cele 6 cifre primite prin SMS, apoi apasă Semnează contractul.</p>
          {error && <p id="otp-err" role="alert" className="flex items-center gap-1.5 text-[14px] font-medium text-danger animate-fade-in"><IconAlert className="size-4" />{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {cooldown > 0
            ? <span className="tabular text-[14px] text-muted" aria-live="off">Retrimite codul în 0:{String(cooldown).padStart(2, '0')}</span>
            : <ArrowLink onClick={requestCode}>Retrimite codul</ArrowLink>}
          {demoCode && (
            <button type="button" onClick={fillDemo} aria-label={`Completează codul demo ${demoCode.split('').join(' ')}`}
              className="min-h-9 rounded-lg bg-brand-soft px-2.5 text-[13px] font-semibold text-ink transition-transform active:scale-95">
              Demo: <span className="tabular tracking-[0.12em]">{demoCode}</span>
            </button>
          )}
        </div>
      </SheetBody>
      <SheetFoot className="flex flex-col gap-3">
        <p className="text-center text-[12.5px] leading-snug text-muted">
          Prin introducerea codului semnezi electronic contractul de credit cu {lender}.
          {app.offer && <> Total de plată: <span className="tabular">{lei(app.offer.total_payable_lei)}</span>.</>}
        </p>
        <Btn onClick={sign} loading={busy} disabled={code.length !== LEN}>Semnează contractul</Btn>
      </SheetFoot>
    </>
  );
}
