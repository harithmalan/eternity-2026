import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useReveal } from '../hooks/useReveal';
import { useReveals } from '../hooks/useReveals';
import { useArtists } from '../hooks/useArtists';
import { supabaseUrl } from '../lib/supabase';
import type { PublicArtist, PublicReveal, Settings } from '../lib/database.types';

// Purely decorative — a fixed glyph pattern per card, unrelated to the real
// value's length (which we never know client-side until it's revealed).
// Falls back to a reasonable label while `public_reveals` is still loading.
const SEAL_META: Record<string, { label: string; glyph: string }> = {
  artists: { label: 'Artists on stage', glyph: '▓▓ ▓▓▓▓▓▓▓ ▓▓▓▓▓' },
  venue: { label: 'Venue', glyph: '▓▓▓▓▓ ▓▓▓▓▓▓ ▓▓▓' },
  start: { label: 'Show start', glyph: '▓▓:▓▓ ▓▓' },
  stage: { label: 'Stage design', glyph: '▓▓▓▓▓▓ ▓▓▓▓▓' },
};
const SEAL_ORDER = ['artists', 'venue', 'start', 'stage'];
const COUNT_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four'];
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

function sealedFallback(key: string): PublicReveal {
  return {
    key,
    label: SEAL_META[key]?.label ?? key,
    sort: 0,
    is_revealed: false,
    revealed_at: null,
    value: null,
    detail: null,
    link_url: null,
  };
}

function formatRevealedAt(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Colombo' })
    .format(new Date(iso))
    .toUpperCase();
}

/** True for the ~1.3s window right after `active` flips false → true — drives the unseal fanfare (ring, particles, pulse) without replaying it for state that was already revealed on load. */
function useUnsealFlag(active: boolean, windowMs = 1300): boolean {
  const prev = useRef(active);
  const [flagged, setFlagged] = useState(false);

  useEffect(() => {
    if (active && !prev.current) {
      setFlagged(true);
      prev.current = true;
      const t = setTimeout(() => setFlagged(false), windowMs);
      return () => clearTimeout(t);
    }
    prev.current = active;
  }, [active, windowMs]);

  return flagged;
}

export default function SealedGrid({ settings }: { settings: Settings | null }) {
  const head = useReveal();
  const { reveals } = useReveals();
  const { artists } = useArtists();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const artistsUnsealed = artists.length > 0;
  const unsealedCount = SEAL_ORDER.reduce((n, key) => {
    if (key === 'artists') return n + (artistsUnsealed ? 1 : 0);
    return n + (reveals[key]?.is_revealed ? 1 : 0);
  }, 0);
  const sealedCount = SEAL_ORDER.length - unsealedCount;

  // Mobile carousel: which card is centred, for the scroll-indicator dots.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const cardWidth = el.scrollWidth / SEAL_ORDER.length;
      if (cardWidth > 0) setActiveSlide(Math.round(el.scrollLeft / cardWidth));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className="band band-line" id="reveal">
      <div className="shell">
        <div className={`sec-head ${head.className}`} ref={head.ref} style={head.style}>
          <div>
            <p className="eyebrow">Sealed until announced</p>
            <h2 className="sec-title">
              {sealedCount === 0 ? (
                'Everything is out. See you on the 18th.'
              ) : (
                <>
                  {COUNT_WORDS[sealedCount]} {sealedCount === 1 ? 'thing' : 'things'} we&apos;re <i>not</i> telling you yet.
                </>
              )}
            </h2>
          </div>
          <p className="sec-note">Each one unseals on its own schedule. Keep watching.</p>
        </div>

        <p className="seal-progress">
          {unsealedCount} OF {SEAL_ORDER.length} UNSEALED
        </p>

        <div className="seals" ref={scrollRef}>
          {SEAL_ORDER.map((key, i) =>
            key === 'artists' ? (
              <ArtistsCard
                key={key}
                row={reveals[key] ?? sealedFallback(key)}
                artists={artists}
                settings={settings}
                index={i}
              />
            ) : (
              <Seal key={key} row={reveals[key] ?? sealedFallback(key)} glyph={SEAL_META[key].glyph} index={i} />
            )
          )}
        </div>

        <div className="seals-dots" aria-hidden="true">
          {SEAL_ORDER.map((_, i) => (
            <span key={i} className={i === activeSlide ? 'on' : ''} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SealRing({ playing }: { playing: boolean }) {
  return (
    <AnimatePresence>
      {playing && (
        <motion.span
          className="seal-ring"
          initial={{ scale: 0.3, opacity: 0.9 }}
          animate={{ scale: 2.4, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}

function SealParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 + Math.round(Math.random() * 4) }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 150,
        delay: Math.random() * 0.25,
        size: 2 + Math.random() * 2,
        rise: 55 + Math.random() * 45,
      })),
    []
  );
  return (
    <div className="seal-particles" aria-hidden="true">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="particle"
          style={{ left: `calc(50% + ${p.x}px)`, width: p.size, height: p.size }}
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -p.rise }}
          transition={{ duration: 1.2, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

interface SealFrameProps {
  reveal: ReturnType<typeof useReveal>;
  label: string;
  isRevealed: boolean;
  revealedAt: string | null;
  fanfare: boolean;
  shouldReduceMotion: boolean;
  extraClass?: string;
  children: ReactNode;
}

/** The shared card shell — outer card, ring/particle fanfare, k-label, and the SEALED/ANNOUNCED pill. Both the plain seals and the artists card render their own middle content into this. */
function SealFrame({ reveal, label, isRevealed, revealedAt, fanfare, shouldReduceMotion, extraClass, children }: SealFrameProps) {
  const playFanfare = fanfare && !shouldReduceMotion;

  return (
    <motion.div
      className={`seal ${isRevealed ? 'is-revealed' : 'is-sealed'}${extraClass ? ` ${extraClass}` : ''} ${reveal.className}`}
      ref={reveal.ref}
      style={reveal.style}
      animate={{ scale: fanfare && !shouldReduceMotion ? [1, 1.03, 1] : 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <SealRing playing={playFanfare} />
      {playFanfare && <SealParticles />}
      {!isRevealed && <span className="scan-line" aria-hidden="true" />}

      <div className="k">{label}</div>
      <div className="seal-mid">{children}</div>

      <AnimatePresence mode="wait" initial={false}>
        {isRevealed ? (
          <motion.div
            key="announced"
            className="stamp announced"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.35 }}
          >
            <span className="dot" />
            Announced{revealedAt ? ` · ${formatRevealedAt(revealedAt)}` : ''}
          </motion.div>
        ) : (
          <motion.div key="sealed" className="stamp" exit={{ opacity: 0 }} transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}>
            <span className="dot" />
            Sealed
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Seal({ row, glyph, index }: { row: PublicReveal; glyph: string; index: number }) {
  const reveal = useReveal(index);
  const shouldReduceMotion = !!useReducedMotion();
  const isRevealed = row.is_revealed;
  const justUnsealed = useUnsealFlag(isRevealed);
  const blurDuration = shouldReduceMotion ? 0.3 : 0.9;

  return (
    <SealFrame
      reveal={reveal}
      label={row.label}
      isRevealed={isRevealed}
      revealedAt={row.revealed_at}
      fanfare={justUnsealed}
      shouldReduceMotion={shouldReduceMotion}
    >
      <div className="scramble-stack">
        <AnimatePresence initial={false}>
          {isRevealed ? (
            <motion.div
              key="value"
              className="scramble"
              initial={{ opacity: 0, filter: 'blur(7px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: blurDuration, ease: EASE_OUT_EXPO }}
              style={{ userSelect: 'text' }}
            >
              {row.value}
            </motion.div>
          ) : (
            <motion.div key="glyph" className="scramble-sealed-wrap" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div className="scramble scramble-base" aria-hidden="true">{glyph}</div>
              <div className="scramble scramble-sharp" aria-hidden="true">{glyph}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {isRevealed && row.detail && <div className="detail">{row.detail}</div>}
      {isRevealed && row.link_url && (
        <a className="seal-link" href={row.link_url} target="_blank" rel="noopener">
          OPEN IN GOOGLE MAPS →
        </a>
      )}
    </SealFrame>
  );
}

function ArtistPortrait({ artist, fresh, shouldReduceMotion }: { artist: PublicArtist; fresh: boolean; shouldReduceMotion: boolean }) {
  const photoUrl = artist.photo_path ? `${supabaseUrl}/storage/v1/object/public/artists/${artist.photo_path}` : null;
  const initial = artist.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <motion.div
      className="artist-portrait"
      initial={fresh && !shouldReduceMotion ? { opacity: 0, scale: 0.8, filter: 'blur(8px)' } : false}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: shouldReduceMotion ? 0.3 : 0.7, ease: 'easeOut' }}
    >
      <div className="artist-photo">
        {photoUrl ? <img src={photoUrl} alt="" loading="lazy" decoding="async" /> : <span className="artist-initial">{initial}</span>}
      </div>
      <div className="artist-name">{artist.name}</div>
      {artist.tagline && <div className="artist-tagline">{artist.tagline}</div>}
    </motion.div>
  );
}

function ArtistsCard({ row, artists, settings, index }: { row: PublicReveal; artists: PublicArtist[]; settings: Settings | null; index: number }) {
  const reveal = useReveal(index);
  const shouldReduceMotion = !!useReducedMotion();
  const hasArtists = artists.length > 0;

  // Tracks which artist ids are new since the last render *after the first
  // load* — the initial fetch seeds this silently so every already-revealed
  // artist a first-time visitor sees doesn't fanfare at once; only an
  // artist that flips revealed while the tab is open does.
  const seenIds = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (seenIds.current === null) {
      seenIds.current = new Set(artists.map((a) => a.id));
      return;
    }
    const newOnes = artists.filter((a) => !seenIds.current!.has(a.id));
    if (newOnes.length === 0) return;
    newOnes.forEach((a) => seenIds.current!.add(a.id));
    setFreshIds((prev) => {
      const next = new Set(prev);
      newOnes.forEach((a) => next.add(a.id));
      return next;
    });
    const t = setTimeout(() => {
      setFreshIds((prev) => {
        const next = new Set(prev);
        newOnes.forEach((a) => next.delete(a.id));
        return next;
      });
    }, 900);
    return () => clearTimeout(t);
  }, [artists]);

  const placeholderCount = Math.max(0, settings?.artist_placeholders ?? 0);

  if (!hasArtists) {
    return (
      <SealFrame reveal={reveal} label={row.label} isRevealed={false} revealedAt={null} fanfare={false} shouldReduceMotion={shouldReduceMotion}>
        <div className="scramble-stack">
          <div className="scramble-sealed-wrap">
            <div className="scramble scramble-base" aria-hidden="true">{SEAL_META.artists.glyph}</div>
            <div className="scramble scramble-sharp" aria-hidden="true">{SEAL_META.artists.glyph}</div>
          </div>
        </div>
      </SealFrame>
    );
  }

  return (
    <SealFrame
      reveal={reveal}
      label={row.label}
      isRevealed
      revealedAt={null}
      fanfare={freshIds.size > 0}
      shouldReduceMotion={shouldReduceMotion}
      extraClass="seal-artists has-artists"
    >
      <div className="artist-strip">
        {artists.map((a) => (
          <ArtistPortrait key={a.id} artist={a} fresh={freshIds.has(a.id)} shouldReduceMotion={shouldReduceMotion} />
        ))}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <div className="artist-placeholder" key={`ph-${i}`}>
            <div className="artist-placeholder-circle">?</div>
          </div>
        ))}
        {settings?.more_artists_coming && <div className="more-to-come">MORE TO COME</div>}
      </div>
    </SealFrame>
  );
}
