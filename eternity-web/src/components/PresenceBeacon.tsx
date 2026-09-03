import { useEffect } from 'react';
import { subscribePresenceCount } from '../lib/presence';

/** Mounted once, unconditionally, for every visitor — the admin holding the launch button (and the on-site live-count badge) needs to know the room is actually here. */
export default function PresenceBeacon() {
  useEffect(() => subscribePresenceCount(() => {}), []);
  return null;
}
