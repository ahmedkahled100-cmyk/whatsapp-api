// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const getSupabaseUrl = () => {
  if (typeof window !== 'undefined') {
    // On the client browser, use the local proxy to bypass ISP blocking on *.supabase.co
    return `${window.location.origin}/api/supabase-proxy`;
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
};

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl && typeof window === 'undefined') {
  console.warn('Supabase credentials missing. Supabase functionality will be disabled.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Helper for Realtime channel management
export const getMessageChannel = (teacherId: string) => {
  return supabase
    .channel(`messages:${teacherId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `teacher_id=eq.${teacherId}`,
      },
      (payload) => {
        console.log('New message received via Supabase Realtime:', payload);
      }
    );
};
