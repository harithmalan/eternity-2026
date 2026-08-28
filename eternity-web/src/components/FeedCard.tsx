import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useAuth } from '../lib/auth';
import { useLikes } from '../lib/likes';
import { requestPlay, requestUnmute, releasePlay } from '../lib/feedMedia';
import { supabaseUrl } from '../lib/supabase';
import type { FeedPost, PostMedia } from '../lib/database.types';

const DOUBLE_TAP_MS = 300;
const BUFFER_DELAY_MS = 400;

function mediaUrl(path: string) {
  return `${supabaseUrl}/storage/v1/object/public/posts/${path}`;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date(iso));
}

function saveDataOn(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return !!nav.connection?.saveData;
}

export default function FeedCard({ post, autoplay }: { post: FeedPost; autoplay: boolean }) {
  const { user } = useAuth();
  const { isLiked, toggleLike, likeOnly, requestSignInThenLike } = useLikes();
  const liked = isLiked(post.id);
  const [displayCount, setDisplayCount] = useState(post.like_count);
  const [bouncePulse, setBouncePulse] = useState(0);
  const [particleBurst, setParticleBurst] = useState(0);
  const media = post.media ?? [];

  const doToggle = async () => {
    if (!user) {
      requestSignInThenLike(post.id);
      return;
    }
    const willLike = !liked;
    setBouncePulse((p) => p + 1);
    if (willLike) setParticleBurst((p) => p + 1);
    const result = await toggleLike(post.id);
    if (result) setDisplayCount((c) => c + result.delta);
  };

  const doLikeOnly = async () => {
    if (!user) {
      requestSignInThenLike(post.id);
      return;
    }
    if (liked) return; // double-tap only ever likes — a mis-tap on an already-liked post is harmless
    setBouncePulse((p) => p + 1);
    setParticleBurst((p) => p + 1);
    const result = await likeOnly(post.id);
    if (result) setDisplayCount((c) => c + result.delta);
  };

  return (
    <article className="feed-card">
      <header className="feed-card-head">
        <img className="feed-card-sis" src="/img/sis-logo.png" alt="" />
        <div className="feed-card-head-text">
          <p className="feed-card-org">Student Interactive Society</p>
          <p className="feed-card-time">{formatRelativeTime(post.published_at)}</p>
        </div>
      </header>

      {media.length > 0 && <FeedMedia media={media} autoplay={autoplay} onDoubleTap={doLikeOnly} />}

      {post.caption && <FeedCaption caption={post.caption} />}

      <div className="feed-card-foot">
        <button
          type="button"
          className={`feed-like${liked ? ' liked' : ''}`}
          onClick={doToggle}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike this post' : 'Like this post'}
        >
          <span key={bouncePulse} className="feed-heart-pulse">
            <svg viewBox="0 0 24 24" className="feed-heart-icon" aria-hidden="true">
              <path d="M12 21s-7.6-4.6-10-9.4C.4 8.3 2 4.8 5.6 4.8c2 0 3.6 1.2 4.6 2.8 1-1.6 2.6-2.8 4.6-2.8 3.6 0 5.2 3.5 3.6 6.8-2.4 4.8-10 9.4-10 9.4z" />
            </svg>
            {particleBurst > 0 && <FeedLikeParticles key={particleBurst} />}
          </span>
        </button>
        <span className="feed-like-count">
          {displayCount} like{displayCount === 1 ? '' : 's'}
        </span>
      </div>
    </article>
  );
}

function FeedLikeParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        id: i,
        x: (i - 1.5) * 9 + (Math.random() - 0.5) * 6,
        delay: Math.random() * 0.08,
      })),
    []
  );
  return (
    <span className="feed-like-particles" aria-hidden="true">
      {particles.map((p) => (
        <span key={p.id} style={{ ['--particle-x' as string]: `${p.x}px`, animationDelay: `${p.delay}s` }} />
      ))}
    </span>
  );
}

function FeedCaption({ caption }: { caption: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [caption]);

  return (
    <div className="feed-caption-wrap">
      <p ref={ref} className={`feed-caption${expanded ? ' expanded' : ''}`}>
        {caption}
      </p>
      {overflowing && !expanded && (
        <button type="button" className="feed-caption-more" onClick={() => setExpanded(true)}>
          more
        </button>
      )}
    </div>
  );
}

function FeedMedia({ media, autoplay, onDoubleTap }: { media: PostMedia[]; autoplay: boolean; onDoubleTap: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [bloom, setBloom] = useState(0);
  const lastTapRef = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || media.length <= 1) return;
    const onScroll = () => {
      const w = el.scrollWidth / media.length;
      if (w > 0) setActive(Math.round(el.scrollLeft / w));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [media.length]);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      setBloom((b) => b + 1);
      onDoubleTap();
    }
    lastTapRef.current = now;
  };

  return (
    <div className="feed-media" onClick={handleTap}>
      <div className={`feed-media-scroll${media.length > 1 ? ' multi' : ''}`} ref={scrollRef}>
        {media.map((m) => (
          <FeedMediaItem key={m.id} item={m} autoplay={autoplay} />
        ))}
      </div>
      {media.length > 1 && (
        <div className="feed-media-dots">
          {media.map((_, i) => (
            <span key={i} className={i === active ? 'on' : ''} />
          ))}
        </div>
      )}
      {bloom > 0 && (
        <svg key={bloom} viewBox="0 0 24 24" className="feed-bloom-heart" aria-hidden="true">
          <path d="M12 21s-7.6-4.6-10-9.4C.4 8.3 2 4.8 5.6 4.8c2 0 3.6 1.2 4.6 2.8 1-1.6 2.6-2.8 4.6-2.8 3.6 0 5.2 3.5 3.6 6.8-2.4 4.8-10 9.4-10 9.4z" />
        </svg>
      )}
    </div>
  );
}

function FeedMediaItem({ item, autoplay }: { item: PostMedia; autoplay: boolean }) {
  return item.kind === 'video' ? <FeedVideo item={item} autoplay={autoplay} /> : <FeedImage item={item} />;
}

function FeedImage({ item }: { item: PostMedia }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const aspect = item.width && item.height ? `${item.width} / ${item.height}` : '4 / 5';

  return (
    <div className="feed-media-frame" style={{ aspectRatio: aspect }}>
      {item.placeholder && <img className="feed-media-placeholder" src={item.placeholder} alt="" aria-hidden="true" />}
      {!failed && (
        <img
          className={`feed-media-real${loaded ? ' loaded' : ''}`}
          src={mediaUrl(item.path)}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <div className="feed-media-failed">
          <p>Couldn&apos;t load this.</p>
        </div>
      )}
    </div>
  );
}

function FeedVideo({ item, autoplay }: { item: PostMedia; autoplay: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const shouldReduceMotion = !!useReducedMotion();
  const saveData = saveDataOn();
  const canAutoplay = autoplay && !shouldReduceMotion && !saveData;
  const aspect = item.width && item.height ? `${item.width} / ${item.height}` : '4 / 5';
  const posterUrl = item.poster_path ? mediaUrl(item.poster_path) : undefined;

  useEffect(() => {
    const el = containerRef.current;
    const video = videoRef.current;
    if (!el || !video) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (canAutoplay) {
              requestPlay(video);
              video.play().then(() => setStarted(true)).catch(() => {});
            }
          } else {
            video.pause();
            video.currentTime = 0;
            setStarted(false);
            releasePlay(video);
          }
        });
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      releasePlay(video);
    };
  }, [canAutoplay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let timer: number | undefined;
    const onWaiting = () => {
      timer = window.setTimeout(() => setBuffering(true), BUFFER_DELAY_MS);
    };
    const onSettled = () => {
      window.clearTimeout(timer);
      setBuffering(false);
    };
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onSettled);
    video.addEventListener('pause', onSettled);
    return () => {
      window.clearTimeout(timer);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onSettled);
      video.removeEventListener('pause', onSettled);
    };
  }, []);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.muted) {
      requestUnmute(video);
      video.muted = false;
      setMuted(false);
    } else {
      video.muted = true;
      setMuted(true);
    }
  };

  const tapToPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    requestPlay(video);
    video.play().then(() => setStarted(true)).catch(() => {});
  };

  return (
    <div className="feed-media-frame" style={{ aspectRatio: aspect }} ref={containerRef}>
      {/* preload="none" is load-bearing — anything else downloads every clip in the feed whether or not anyone scrolls to it. */}
      <video ref={videoRef} preload="none" muted playsInline loop poster={posterUrl} src={mediaUrl(item.path)} />
      {buffering && <span className="feed-video-spinner" aria-hidden="true" />}
      {!started && !canAutoplay && (
        <button type="button" className="feed-video-play" onClick={tapToPlay} aria-label="Play video">
          <span className="feed-video-play-icon" aria-hidden="true" />
          {saveData && <span className="feed-video-tap-note">Tap to play</span>}
        </button>
      )}
      <button type="button" className="feed-video-mute" onClick={toggleMute} aria-label={muted ? 'Unmute video' : 'Mute video'}>
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
