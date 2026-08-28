import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { FeedPost } from '../lib/database.types';

const PAGE_SIZE = 10;

function orderedFeedQuery() {
  return supabase
    .from('public_feed')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .order('id', { ascending: false });
}

/** The homepage LATEST section — a fixed, non-paginated slice. */
export function useLatestPosts(count: number) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (count <= 0) {
      setLoading(false);
      return;
    }
    orderedFeedQuery()
      .range(0, count - 1)
      .then(
        ({ data, error }) => {
          if (!alive) return;
          if (!error && data) setPosts(data);
          setLoading(false);
        },
        () => {
          if (alive) setLoading(false);
        }
      );
    return () => {
      alive = false;
    };
  }, [count]);

  return { posts, loading };
}

/** /feed — infinite scroll, 10 at a time. */
export function useFeedPage(pageSize = PAGE_SIZE) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const offsetRef = useRef(0);
  const inFlightRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || done) return;
    inFlightRef.current = true;
    const from = offsetRef.current;
    if (from > 0) setLoadingMore(true);

    const { data, error: err } = await orderedFeedQuery().range(from, from + pageSize - 1);

    inFlightRef.current = false;
    if (err || !data) {
      setError(true);
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    offsetRef.current += data.length;
    setPosts((prev) => [...prev, ...data]);
    if (data.length < pageSize) setDone(true);
    setLoading(false);
    setLoadingMore(false);
  }, [pageSize, done]);

  useEffect(() => {
    loadMore();
    // Only the very first page loads on mount — subsequent pages come from
    // the infinite-scroll sentinel calling loadMore() itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { posts, loading, loadingMore, done, error, loadMore };
}
