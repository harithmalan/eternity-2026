import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — Supabase calls will fail until these are set in .env.local'
  );
}

// Falls back to a placeholder so createClient doesn't throw on an invalid
// URL when the env vars aren't set yet — requests will simply fail, and the
// data hooks handle that gracefully.
//
// flowType: 'pkce' — the implicit flow returns real access+refresh tokens in
// the URL fragment, where they sit in browser history; PKCE returns a
// short-lived single-use `?code=` instead, which is also what stops that
// code from ever accumulating in a `redirectTo` built from the current URL.
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
