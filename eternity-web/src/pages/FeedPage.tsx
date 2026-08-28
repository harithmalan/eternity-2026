import { useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import FeedCard from '../components/FeedCard';
import FeedSkeletonCard from '../components/FeedSkeletonCard';
import { useFeedPage } from '../hooks/useFeed';
import { useLikes } from '../lib/likes';
import { useSettings } from '../hooks/useEternityData';

export default function FeedPage() {
  const { posts, loading, loadingMore, done, error, loadMore } = useFeedPage();
  const { settings } = useSettings();
  const { ensureLoaded } = useLikes();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (posts.length) ensureLoaded(posts.map((p) => p.id));
  }, [posts, ensureLoaded]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <Layout>
      <section className="band feed-page">
        <div className="feed-shell">
          <div className="feed-page-head">
            <p className="eyebrow">The feed</p>
            <h1 className="sec-title">Latest.</h1>
          </div>

          {loading ? (
            <>
              <FeedSkeletonCard />
              <FeedSkeletonCard />
              <FeedSkeletonCard />
            </>
          ) : error && posts.length === 0 ? (
            <p className="feed-empty">Couldn&apos;t load the feed — try refreshing.</p>
          ) : posts.length === 0 ? (
            <p className="feed-empty">Nothing here yet.</p>
          ) : (
            <>
              {posts.map((p) => (
                <FeedCard key={p.id} post={p} autoplay={settings?.feed_autoplay ?? true} />
              ))}
              {loadingMore && <FeedSkeletonCard />}
              {done && !loadingMore && <p className="feed-caught-up">You&apos;re all caught up.</p>}
            </>
          )}

          <div ref={sentinelRef} aria-hidden="true" />
        </div>
      </section>
    </Layout>
  );
}
