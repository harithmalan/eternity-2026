import { useEffect, useState } from 'react';
import { subscribePresenceCount } from '../lib/presence';

/** Live count of connected browser tabs across the whole site, null until the first sync arrives. */
export function useLiveCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => subscribePresenceCount(setCount), []);
  return count;
}
