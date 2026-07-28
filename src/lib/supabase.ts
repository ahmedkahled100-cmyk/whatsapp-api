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

// Prevent WebSocket connection attempts in the browser globally.
// WebSockets are blocked by ISPs and not supported by the Vercel API proxy.
if (typeof window !== 'undefined') {
  const originalChannel = supabase.channel.bind(supabase);
  supabase.channel = (name: string, options?: any) => {
    return {
      on: function (event: string, filter: any, callback: any) {
        return this;
      },
      subscribe: function (callback?: (status: string, err?: any) => void) {
        if (callback) {
          setTimeout(() => callback('SUBSCRIBED'), 0);
        }
        return {
          unsubscribe: () => {},
        } as any;
      },
      send: async function () {
        return 'ok';
      },
      track: async function () {
        return 'ok';
      },
      untrack: async function () {
        return 'ok';
      },
      presenceState: function () {
        return {};
      }
    } as any;
  };

  const originalRemoveChannel = supabase.removeChannel.bind(supabase);
  supabase.removeChannel = (channel: any) => {
    if (channel && typeof channel.unsubscribe === 'function') {
      channel.unsubscribe();
    }
    return Promise.resolve('ok') as any;
  };

  const originalRemoveAllChannels = supabase.removeAllChannels.bind(supabase);
  supabase.removeAllChannels = () => {
    return Promise.resolve([]) as any;
  };
}

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
