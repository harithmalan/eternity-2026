import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — Supabase calls will fail until these are set in .env.local'
  );
}

// Anon key only — always. Every mutation in this app goes through RLS as
// the signed-in admin's own user. There is no service_role key anywhere in
// this codebase, and there must never be: this is still a browser app, and
// a leaked service_role key bypasses every RLS policy in the database.
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
