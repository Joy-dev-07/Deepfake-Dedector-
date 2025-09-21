import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // Consumers should guard, but we expose a helpful message in dev
  if (import.meta.env.DEV) {
    console.warn('Supabase client not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
}

export const supabase = url && anon ? createClient(url, anon) : null;
export const SUPABASE_TABLE = (import.meta.env.VITE_SUPABASE_TABLE as string | undefined) || 'file_results';
