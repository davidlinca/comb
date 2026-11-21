import { useNavigate, useParams } from 'react-router-dom';
import { Btn, Sheet, SheetHeader } from '../components/ui';
import Backdrop from '../components/Backdrop';

// Loc pentru ecranele 5–6 (oferta și semnarea), care vin în PR-ul următor.
export default function NextSheet() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  return (
    <>
      <Backdrop />
      <Sheet label="Oferta">
        <SheetHeader step={3} onClose={() => nav('/shop')} />
        <h2 className="text-[24px] font-bold">Oferta ta</h2>
        <p className="text-[15px] text-muted">Ecranul ofertei și semnarea vin în următoarea versiune.</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Btn variant="secondary" onClick={() => nav(`/a/${id}/rezultat`)}>Înapoi</Btn>
          <Btn onClick={() => nav('/shop')}>La magazin</Btn>
        </div>
      </Sheet>
    </>
  );
}
