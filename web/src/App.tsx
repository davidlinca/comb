import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import PhoneFrame from './components/PhoneFrame';
import { useSession } from './lib/session';
import { getAccessToken } from './lib/supabase';
import Login from './pages/Login';
import Shop from './pages/Shop';
import BudgetSheet from './pages/BudgetSheet';
import DecisionSheet from './pages/DecisionSheet';
import NextSheet from './pages/NextSheet';
import { Backoffice } from './backoffice';

function Guard({ children, role = 'customer' }: { children: ReactNode; role?: 'customer' | 'operator' }) {
  const { ready, me } = useSession();
  if (!ready) return <div className="grid min-h-dvh place-items-center text-[15px] text-subtle">Se încarcă…</div>;
  if (!me) return <Navigate to="/login" replace />;
  if (me.role !== role) return <Navigate to={me.role === 'operator' ? '/backoffice' : '/shop'} replace />;
  return <>{children}</>;
}

function BackofficeRoute() {
  const { me, logout } = useSession();
  const nav = useNavigate();
  return (
    <Backoffice
      apiUrl={import.meta.env.VITE_API_URL}
      publishableKey={import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}
      getAccessToken={getAccessToken}
      operatorName={me?.display_name ?? 'Operator'}
      onLogout={async () => { await logout(); nav('/login', { replace: true }); }}
    />
  );
}

const phone = (el: ReactNode) => <PhoneFrame>{el}</PhoneFrame>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={phone(<Login />)} />
      <Route path="/shop" element={phone(<Guard><Shop /></Guard>)} />
      <Route path="/shop/:sku" element={phone(<Guard><Shop /></Guard>)} />
      <Route path="/a/:id/buget" element={phone(<Guard><BudgetSheet /></Guard>)} />
      <Route path="/a/:id/rezultat" element={phone(<Guard><DecisionSheet /></Guard>)} />
      <Route path="/a/:id/oferta" element={phone(<Guard><NextSheet /></Guard>)} />
      <Route path="/backoffice" element={<Guard role="operator"><BackofficeRoute /></Guard>} />
      <Route path="*" element={<Navigate to="/shop" replace />} />
    </Routes>
  );
}
