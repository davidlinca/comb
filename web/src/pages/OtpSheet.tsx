import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, api2, ApiError } from '../lib/api';
import { lei } from '../lib/format';
import { Btn, Sheet } from '../components/ui';
import { IconArrow, IconBack, IconInfo, IconX } from '../components/Icons';
import Backdrop from '../components/Backdrop';

const RESEND_S = 30;

// Ecranul 6a: semnarea cu codul din SMS (simulat: codul demo apare pe ecran).
export default function OtpSheet() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_S);
  const [total, setTotal] = useState<number | null>(null);
  const [lender, setLender] = useState('creditor');
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const requested = useRef(false); // un singur cod la intrare (max 3 coduri în 10 minute)

  async function requestCode() {
    setError(null);
    try {
      const r = await api2.otp(id);
      setDemoCode(r.otp_demo_code); setDigits(Array(6).fill('')); setCooldown(RESEND_S);
      inputs.current[0]?.focus();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ALREADY_SIGNED') { await goToAgreement(); return; }
      setError(e instanceof ApiError ? e.message : 'Codul nu a putut fi trimis.');
    }
  }
  async function goToAgreement() {
    const a = await api.application(id).catch(() => null);
    if (a?.agreement_id) nav(`/c/${a.agreement_id}`, { replace: true });
  }

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void requestCode();
    api.application(id).then(async (a) => {
      if (a.offer) setTotal(a.offer.total_payable_lei);
      const cat = await api.catalog();
      setLender(cat.products.find((p) => p.id === a.offer?.product_id)?.lender ?? 'creditor');
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join('');
  const setAt = (i: number, v: string) => {
    const d = v.replace(/\D/g, '');
    if (!d) { setDigits((p) => p.map((x, j) => (j === i ? '' : x))); return; }
    setDigits((p) => { const n = [...p]; d.slice(0, 6 - i).split('').forEach((c, k) => { n[i + k] = c; }); return n; });
    inputs.current[Math.min(5, i + d.length)]?.focus();
    setError(null);
  };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'Enter' && code.length === 6) void sign();
  };
  const onPaste = (e: ClipboardEvent) => { const t = e.clipboardData.getData('text'); if (/\d/.test(t)) { e.preventDefault(); setAt(0, t); } };

  async function sign() {
    if (code.length !== 6) { setError('Introdu toate cele 6 cifre.'); return; }
    setBusy(true); setError(null);
    try {
      const r = await api2.sign(id, code);
      nav(`/c/${r.agreement_id}`, { replace: true });
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.code === 'ALREADY_SIGNED') { await goToAgreement(); return; }
      setError(e instanceof ApiError ? e.message : 'Semnarea nu a reușit. Încearcă din nou.');
      if (e instanceof ApiError && (e.code === 'OTP_LOCKED' || e.code === 'OTP_EXPIRED')) setCooldown(0);
    }
  }

  return (
    <>
      <Backdrop />
      <Sheet label="Semnare cu cod SMS">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => nav(`/a/${id}/confirma`)} aria-label="Înapoi" className="grid size-10 place-items-center rounded-full border border-line hover:bg-field"><IconBack /></button>
          <span className="text-[15px] font-medium">Semnare</span>
          <button type="button" onClick={() => nav('/shop')} aria-label="Închide" className="grid size-10 place-items-center rounded-full border border-line hover:bg-field"><IconX /></button>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[26px] font-bold tracking-tight">Introdu codul trimis prin SMS</h2>
          <p className="text-[15px]">Codul a fost trimis la 07•• ••• 123.</p>
        </div>

        <div role="group" aria-label="Codul de 6 cifre" aria-describedby={error ? 'otp-err' : undefined} className="grid grid-cols-6 gap-2">
          {digits.map((d, i) => (
            <input key={i} ref={(el) => { inputs.current[i] = el; }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={6} aria-label={`Cifra ${i + 1}`} aria-invalid={!!error || undefined}
              onChange={(e) => setAt(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} onPaste={onPaste} onFocus={(e) => e.target.select()}
              className={`h-14 min-w-0 rounded-2xl border bg-field text-center text-[24px] font-semibold text-paper outline-none ${error ? 'border-danger' : d ? 'border-paper' : 'border-field focus:border-muted'}`} />
          ))}
        </div>
        {error && <p id="otp-err" role="alert" className="flex items-center gap-1.5 text-[14px] font-medium text-danger"><IconInfo />{error}</p>}

        <div className="flex items-center justify-between gap-3">
          {cooldown > 0
            ? <span className="text-[14px] text-muted">Retrimite codul în 0:{String(cooldown).padStart(2, '0')}</span>
            : <button type="button" onClick={requestCode} className="flex items-center gap-1.5 text-[15px] font-semibold hover:underline"><IconArrow className="size-4 text-brand" />Retrimite codul</button>}
          {demoCode && <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-[13px] font-semibold text-ink">Demo: {demoCode}</span>}
        </div>

        <p className="mt-2 text-center text-[13px] text-muted">
          Prin introducerea codului semnezi electronic contractul de credit cu {lender}.{total != null && ` Total de plată: ${lei(total)}.`}
        </p>
        <Btn onClick={sign} loading={busy} disabled={code.length !== 6}>Semnează contractul</Btn>
      </Sheet>
    </>
  );
}
