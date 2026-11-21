// Back-office-ul operatorului (codul echipei de backend, nemodificat), încărcat separat doar pentru operator.
import { useLoaderData, useNavigate } from 'react-router-dom';
import { Backoffice } from '../backoffice';
import { requireOperator, signOut } from '../lib/session';
import { getAccessToken } from '../lib/supabase';

export default function BackofficeRoute() {
  const me = useLoaderData() as Awaited<ReturnType<typeof requireOperator>>;
  const nav = useNavigate();
  return (
    <Backoffice
      apiUrl={import.meta.env.VITE_API_URL}
      publishableKey={import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}
      getAccessToken={getAccessToken}
      operatorName={me.display_name ?? 'Operator'}
      onLogout={async () => { await signOut(); nav('/login', { replace: true }); }}
    />
  );
}
