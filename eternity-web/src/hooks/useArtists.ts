import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PublicArtist } from '../lib/database.types';

/**
 * Reads revealed artists from `public_artists` — the VIEW, never `artists`
 * — so a sealed act never reaches the browser at all (see the view
 * definition in supabase-setup.sql), then stays live via the
 * `public_artists` broadcast topic (`broadcast_artist_change`) so a
 * committee member flipping one artist's `is_revealed` grows the card in
 * every open tab, no refresh.
 */
export function useArtists() {
  const [artists, setArtists] = useState<PublicArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase
      .from('public_artists')
      .select('*')
      .order('sort')
      .then(
        ({ data, error }) => {
          if (!alive) return;
          if (!error && data) setArtists(data);
          setLoading(false);
        },
        () => {
          if (alive) setLoading(false);
        }
      );

    const channel = supabase
      .channel('public_artists')
      .on('broadcast', { event: 'artist_change' }, ({ payload }) => {
        if (!alive) return;
        const row = payload as PublicArtist;
        setArtists((prev) => {
          const next = prev.filter((a) => a.id !== row.id);
          next.push(row);
          next.sort((a, b) => a.sort - b.sort);
          return next;
        });
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { artists, loading };
}
