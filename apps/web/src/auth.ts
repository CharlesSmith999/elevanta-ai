import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const authEnabled = Boolean(url && anonKey);
export const supabase: SupabaseClient | null = authEnabled ? createClient(url!, anonKey!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export type AuthState = { session: Session | null; loading: boolean; error?: string };
