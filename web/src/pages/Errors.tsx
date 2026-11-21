import { isRouteErrorResponse, useNavigate, useOutletContext, useRevalidator, useRouteError } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { Btn, ErrorNote, SheetBody, SheetFoot, SheetTitle, StatusHead, TwoButtons } from '../components/ui';
import { IconAlert } from '../components/Icons';
import { CombMark } from '../components/PhoneFrame';
import type { SheetCtx } from '../components/SheetShell';

function message(e: unknown) {
  if (e instanceof ApiError) return e.message; // mesajul API-ului, exact cum vine
  if (isRouteErrorResponse(e)) return e.status === 404 ? 'Pagina nu există.' : e.statusText;
  return 'A apărut o eroare. Încearcă din nou.';
}

/** Eroare la încărcarea unui pas: rămânem în sheet, cu reîncercare. */
export function SheetError() {
  const err = useRouteError();
  const { close } = useOutletContext<SheetCtx>();
  const rv = useRevalidator();
  return (
    <>
      <SheetBody>
        <StatusHead tone="card" icon={<IconAlert className="size-8 text-danger" />} title="Nu am putut încărca pasul" />
        <ErrorNote>{message(err)}</ErrorNote>
      </SheetBody>
      <SheetFoot>
        <TwoButtons>
          <Btn variant="secondary" onClick={close}>Înapoi</Btn>
          <Btn onClick={() => rv.revalidate()} loading={rv.state === 'loading'}>Încearcă din nou</Btn>
        </TwoButtons>
      </SheetFoot>
    </>
  );
}

/** Eroare în afara fluxului (ex. catalogul nu se încarcă). */
export function RootError() {
  const err = useRouteError();
  const nav = useNavigate();
  return (
    <div className="grid min-h-dvh place-items-center bg-[#ecebe7] p-6">
      <div role="alert" className="on-dark flex w-full max-w-[380px] flex-col gap-5 rounded-[32px] bg-sheet p-6 text-paper">
        <SheetTitle>Ceva nu a mers</SheetTitle>
        <p className="text-[15px] text-muted">{message(err)}</p>
        <Btn onClick={() => nav(0)}>Reîncarcă</Btn>
        <Btn variant="secondary" onClick={() => nav('/login')}>Mergi la autentificare</Btn>
      </div>
    </div>
  );
}

/** Ecranul de pornire, cât se verifică sesiunea. */
export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#ecebe7]" role="status" aria-label="Se încarcă">
      <CombMark className="size-12 animate-pulse" />
    </div>
  );
}
