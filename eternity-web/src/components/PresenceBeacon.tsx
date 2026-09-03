import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Same literal channel name eternity-admin's /launch page reads presence
// from — there's no shared module between the two apps, so this string
// has to match by hand on both sides.
const PRESENCE_CHANNEL = 'eternity-launch-presence';

/** Mounted once, unconditionally, for every visitor — the admin holding the launch button needs to know the room is actually here. */
export default function PresenceBeacon() {
  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: crypto.randomUUID() } },
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ online_at: new Date().toISOString() });
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
