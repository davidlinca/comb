// Clientul Supabase se foloseste DOAR pentru login/logout si token. Datele trec prin lib/api.ts.
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

export async function getAccessToken(): Promise<string | null> {
  return (await supabase.auth.getSession()).data.session?.access_token ?? null;
}
