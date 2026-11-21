import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { api, type Me } from './api';

type Ctx = { ready: boolean; me: Me | null; refreshMe: () => Promise<Me | null>; logout: () => Promise<void> };
const SessionCtx = createContext<Ctx>({ ready: false, me: null, refreshMe: async () => null, logout: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const refreshMe = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setMe(null); return null; }
    try { const m = await api.me(); setMe(m); return m; } catch { setMe(null); return null; }
  };

  useEffect(() => { refreshMe().finally(() => setReady(true)); }, []);

  const logout = async () => { await supabase.auth.signOut(); setMe(null); };
  return <SessionCtx.Provider value={{ ready, me, refreshMe, logout }}>{children}</SessionCtx.Provider>;
}
export const useSession = () => useContext(SessionCtx);
