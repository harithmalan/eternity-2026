import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  AdminPostRow,
  Artist,
  BandAvailability,
  Batch,
  EmailOutboxRow,
  Feature,
  Product,
  Profile,
  Reveal,
  Settings,
  SizeAvailability,
  SizeStock,
} from '../lib/database.types';

function makeListHook<Row>(
  run: () => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
) {
  return function useList() {
    const [data, setData] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(async () => {
      const { data: rows, error } = await run();
      if (!error && rows) setData(rows);
      setLoading(false);
    }, []);

    useEffect(() => {
      setLoading(true);
      refetch();
    }, [refetch]);

    return { data, loading, refetch };
  };
}

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
    setSettings(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  return { settings, loading, refetch };
};

export const useProducts = makeListHook<Product>(() =>
  supabase.from('products').select('*').order('sort')
);

export const useBatches = makeListHook<Batch>(() =>
  supabase.from('batches').select('*').order('sort')
);

export const useReveals = makeListHook<Reveal>(() =>
  supabase.from('reveals').select('*').order('sort')
);

// Reads the base `artists` table, never `public_artists` — admins need to
// see sealed artists (to edit/reveal them) as well as announced ones; the
// public view exists specifically to hide the former from everyone else.
export const useArtists = makeListHook<Artist>(() =>
  supabase.from('artists').select('*').order('sort')
);

// Reads admin_post_view, not the base `posts` table — the view pre-joins
// each post's media as a JSON array server-side (see supabase-setup.sql),
// which sidesteps postgrest embedded-select typing against the generated
// Database type entirely.
export const usePosts = makeListHook<AdminPostRow>(() =>
  supabase.from('admin_post_view').select('*').order('created_at', { ascending: false })
);

export const useFeatures = makeListHook<Feature>(() =>
  supabase.from('features').select('*').order('sort')
);

export const useSizeStock = makeListHook<SizeStock>(() =>
  supabase.from('size_stock').select('*').order('size')
);

export const useSizeAvailability = makeListHook<SizeAvailability>(() =>
  supabase.from('size_availability').select('*').order('sort')
);

export const useProfiles = makeListHook<Profile>(() =>
  supabase.from('profiles').select('*').order('created_at', { ascending: false })
);

export const useEmailOutbox = makeListHook<EmailOutboxRow>(() =>
  supabase.from('email_outbox').select('*').order('created_at', { ascending: false }).limit(300)
);

export function useBandAvailability() {
  const [data, setData] = useState<BandAvailability | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data: row } = await supabase.from('band_availability').select('*').single();
    setData(row);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}
