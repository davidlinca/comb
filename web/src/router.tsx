import { useEffect } from 'react';
import { createBrowserRouter, Outlet, redirect, useNavigation } from 'react-router-dom';
import { clearTransitionMark } from './lib/motion';
import PhoneFrame from './components/PhoneFrame';
import SheetShell from './components/SheetShell';
import { ToastProvider } from './lib/toast';
import { requireOperator } from './lib/session';
import * as L from './loaders';
import Login from './pages/Login';
import Shop from './pages/Shop';
import TermSheet from './pages/TermSheet';
import BudgetSheet from './pages/BudgetSheet';
import DecisionSheet from './pages/DecisionSheet';
import OfferSheet from './pages/OfferSheet';
import ConfirmSheet from './pages/ConfirmSheet';
import OtpSheet from './pages/OtpSheet';
import AgreementSheet from './pages/AgreementSheet';
import { RootError, SheetError, Splash } from './pages/Errors';

function Stage() {
  const state = useNavigation().state;
  useEffect(() => { if (state === 'idle') clearTransitionMark(); }, [state]);
  return (
    <PhoneFrame>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </PhoneFrame>
  );
}

const sheet = { errorElement: <SheetError /> };

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Stage />,
    errorElement: <RootError />,
    hydrateFallbackElement: <Splash />,
    children: [
      { index: true, loader: () => redirect('/shop') },
      { path: 'login', loader: L.loginLoader, element: <Login /> },
      {
        // Magazinul rămâne afișat sub toate sheet-urile (fundal real, nu o imagine).
        id: 'shop',
        loader: L.shopLoader,
        element: <Shop />,
        children: [
          { path: 'shop', id: 'shop-home', loader: L.currentLoader, element: null },
          {
            element: <SheetShell />,
            children: [
              { path: 'shop/:sku', loader: L.termLoader, element: <TermSheet />, handle: { step: 0 }, ...sheet },
              { path: 'a/:id/buget', loader: L.budgetLoader, element: <BudgetSheet />, handle: { step: 1 }, ...sheet },
              { path: 'a/:id/rezultat', loader: L.decisionLoader, element: <DecisionSheet />, handle: { step: 2 }, ...sheet },
              { path: 'a/:id/oferta', loader: L.offerLoader, element: <OfferSheet />, handle: { step: 3 }, ...sheet },
              { path: 'a/:id/confirma', loader: L.confirmLoader, element: <ConfirmSheet />, handle: { step: 4 }, ...sheet },
              { path: 'a/:id/semnare', loader: L.otpLoader, element: <OtpSheet />, handle: { step: 4 }, ...sheet },
              { path: 'c/:aid', loader: L.agreementLoader, element: <AgreementSheet />, handle: { step: 5 }, ...sheet },
            ],
          },
        ],
      },
      { path: '*', loader: () => redirect('/shop') },
    ],
  },
  {
    path: '/backoffice',
    loader: requireOperator,
    lazy: async () => ({ Component: (await import('./pages/BackofficeRoute')).default }),
    hydrateFallbackElement: <Splash />,
  },
]);
