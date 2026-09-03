import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface LaunchRow {
  launch_state: 'idle' | 'armed' | 'launched';
  launch_armed_at: string | null;
  launch_countdown_secs: number;
}

/**
 * Every visitor subscribes to the settings row via Realtime on mount — this
 * table is already fully public-readable (see supabase-setup.sql), so a
 * plain postgres_changes subscription works without the broadcast-masking
 * trick reveals/artists need.
 */
export function useLaunchState() {
  const [state, setState] = useState<LaunchRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase
      .from('settings')
      .select('launch_state, launch_armed_at, launch_countdown_secs')
      .eq('id', 1)
      .single()
      .then(
        ({ data, error }) => {
          if (!alive) return;
          if (!error && data) setState(data);
          setLoading(false);
        },
        () => {
          if (alive) setLoading(false);
        }
      );

    const channel = supabase
      .channel('settings-launch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'id=eq.1' },
        (payload) => {
          if (!alive) return;
          const row = payload.new as LaunchRow;
          setState({
            launch_state: row.launch_state,
            launch_armed_at: row.launch_armed_at,
            launch_countdown_secs: row.launch_countdown_secs,
          });
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { state, loading };
}
