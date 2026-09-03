import { supabase } from './supabase';

// Same literal channel name eternity-admin's /launch page reads presence
// from — there's no shared module between the two apps, so this string
// has to match by hand on both sides.
const PRESENCE_CHANNEL = 'eternity-launch-presence';

type CountListener = (count: number) => void;

// A single shared channel for the whole tab: `supabase.channel(topic)`
// returns the *same* underlying channel instance for a repeated topic, and
// `.on()` can't be called after `.subscribe()` — so every consumer (the
// beacon that tracks this tab, any badge that just wants the live count)
// has to route through one owner instead of each opening its own channel.
let channel: ReturnType<typeof supabase.channel> | null = null;
let count = 0;
const listeners = new Set<CountListener>();

function ensureChannel() {
  if (channel) return channel;
  const c = supabase.channel(PRESENCE_CHANNEL, {
    config: { presence: { key: crypto.randomUUID() } },
  });
  c.on('presence', { event: 'sync' }, () => {
    count = Object.keys(c.presenceState()).length;
    listeners.forEach((l) => l(count));
  });
  c.subscribe((status) => {
    if (status === 'SUBSCRIBED') c.track({ online_at: new Date().toISOString() });
  });
  channel = c;
  return c;
}

/** Joins the shared presence channel (tracking this tab) and reports live counts as they change. */
export function subscribePresenceCount(listener: CountListener): () => void {
  ensureChannel();
  listeners.add(listener);
  listener(count);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
      count = 0;
    }
  };
}
