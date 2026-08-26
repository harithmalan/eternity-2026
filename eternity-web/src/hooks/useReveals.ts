import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PublicReveal } from '../lib/database.types';

/**
 * Reads the sealed-reveal cards from `public_reveals` — the VIEW, never
 * `reveals` — so an unannounced value is never in the initial response,
 * then stays live via the `public_reveals` broadcast topic (see
 * supabase-setup.sql: `broadcast_reveal_change`) so a committee member
 * flipping `is_revealed` unseals the card in every open tab, no refresh.
 */
export function useReveals() {
  const [reveals, setReveals] = useState<Record<string, PublicReveal>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase
      .from('public_reveals')
      .select('*')
      .order('sort')
      .then(
        ({ data, error }) => {
          if (!alive) return;
          if (!error && data) {
            const byKey: Record<string, PublicReveal> = {};
            data.forEach((row) => {
              byKey[row.key] = row;
            });
            setReveals(byKey);
          }
          setLoading(false);
        },
        () => {
          if (alive) setLoading(false);
        }
      );

    const channel = supabase
      .channel('public_reveals')
      .on('broadcast', { event: 'reveal_change' }, ({ payload }) => {
        if (!alive) return;
        const row = payload as PublicReveal;
        setReveals((prev) => ({ ...prev, [row.key]: row }));
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { reveals, loading };
}
