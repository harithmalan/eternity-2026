import { useEffect, useState } from 'react';

/** navigator.onLine reflects the OS/browser's view of the network interface, not a live "can we reach Supabase" check — good enough for a status bar the door volunteer glances at, not for gating the sync itself (that just tries and fails fast). */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
