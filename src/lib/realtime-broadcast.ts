// src/lib/realtime-broadcast.ts
// Cross-tab BroadcastChannel for 0ms instant sync across browser tabs on the same device

let channel: BroadcastChannel | null = null;

export function initCrossTabSync(onMessage: (type: string, payload: any) => void) {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return () => {};
  
  try {
    if (!channel) {
      channel = new BroadcastChannel('an_academy_tab_sync');
    }

    const handler = (e: MessageEvent) => {
      if (e.data && e.data.type) {
        onMessage(e.data.type, e.data.payload);
      }
    };

    channel.addEventListener('message', handler);
    return () => {
      channel?.removeEventListener('message', handler);
    };
  } catch (err) {
    console.warn('[CrossTabSync] Failed to initialize BroadcastChannel:', err);
    return () => {};
  }
}

export function broadcastTabChange(type: string, payload?: any) {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
  try {
    if (!channel) {
      channel = new BroadcastChannel('an_academy_tab_sync');
    }
    channel.postMessage({ type, payload, timestamp: Date.now() });
  } catch (err) {
    console.warn('[CrossTabSync] Broadcast failed:', err);
  }
}
