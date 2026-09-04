import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail fast, with a name that says exactly what's missing, at the one
// place that actually knows — not later, as some unrelated call deep in a
// feature silently receiving `undefined` and throwing a generic TypeError
// that gives no hint the real problem is a missing .env value.
if (!supabaseUrl) throw new Error('Missing VITE_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing VITE_SUPABASE_ANON_KEY');

// Anon key only — always. Every mutation in this app goes through RLS as
// the signed-in admin's own user. There is no service_role key anywhere in
// this codebase, and there must never be: this is still a browser app, and
// a leaked service_role key bypasses every RLS policy in the database.
//
// flowType: 'pkce' — the implicit flow returns real access+refresh tokens in
// the URL fragment, where they sit in browser history; PKCE returns a
// short-lived single-use `?code=` instead, which is also what stops that
// code from ever accumulating in a `redirectTo` built from the current URL.
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
