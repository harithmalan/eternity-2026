import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';
import { useLatestPosts } from '../hooks/useFeed';
import { useLikes } from '../lib/likes';
import FeedCard from './FeedCard';
import FeedSkeletonCard from './FeedSkeletonCard';
import type { Settings } from '../lib/database.types';

export default function LatestSection({ settings }: { settings: Settings | null }) {
  const head = useReveal();
  const count = settings?.feed_home_count ?? 3;
  const { posts, loading } = useLatestPosts(count);
  const { ensureLoaded } = useLikes();

  useEffect(() => {
    if (posts.length) ensureLoaded(posts.map((p) => p.id));
  }, [posts, ensureLoaded]);

  // Nothing published yet — don't show an empty section before the
  // committee has posted anything.
  if (!loading && posts.length === 0) return null;

  return (
    <section className="band band-line" id="latest">
      <div className="shell">
        <div className={`sec-head ${head.className}`} ref={head.ref} style={head.style}>
          <div>
            <p className="eyebrow">From the society</p>
            <h2 className="sec-title">Latest.</h2>
          </div>
          <p className="sec-note">What&apos;s happening, as it happens.</p>
        </div>

        <div className="latest-grid">
          {loading
            ? Array.from({ length: Math.min(3, count) || 1 }).map((_, i) => <FeedSkeletonCard key={i} />)
            : posts.map((p) => <FeedCard key={p.id} post={p} autoplay={settings?.feed_autoplay ?? true} />)}
        </div>

        <div className="latest-more">
          <Link className="btn btn-ghost" to="/feed">See everything →</Link>
        </div>
      </div>
    </section>
  );
}
