import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useReveal } from '../hooks/useReveal';
import { useReveals } from '../hooks/useReveals';
import { useArtists } from '../hooks/useArtists';
import { supabaseUrl } from '../lib/supabase';
import type { PublicArtist, PublicReveal, Settings } from '../lib/database.types';

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

function artistPhotoUrl(artist: PublicArtist) {
  return artist.photo_path ? `${supabaseUrl}/storage/v1/object/public/artists/${artist.photo_path}` : null;
}

function artistInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function useFreshArtistIds(artists: PublicArtist[]) {
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
    }, 1100);
    return () => clearTimeout(t);
  }, [artists]);

  return freshIds;
}

export default function SealedGrid({ settings }: { settings: Settings | null }) {
  const head = useReveal();
  const lineupReveal = useReveal(2);
  const { reveals } = useReveals();
  const { artists } = useArtists();
  const freshIds = useFreshArtistIds(artists);
  const statusRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const artistsUnsealed = artists.length > 0;
  const unsealedCount = SEAL_ORDER.reduce((n, key) => {
    if (key === 'artists') return n + (artistsUnsealed ? 1 : 0);
    return n + (reveals[key]?.is_revealed ? 1 : 0);
  }, 0);
  const sealedCount = SEAL_ORDER.length - unsealedCount;

  useEffect(() => {
    const el = statusRef.current;
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
            <div className="reveal-kicker">
              <p className="eyebrow">Sealed until announced</p>
              <p className="seal-progress">{unsealedCount} OF {SEAL_ORDER.length} UNSEALED</p>
            </div>
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

        <div className="seals" ref={statusRef}>
          {SEAL_ORDER.map((key, i) =>
            key === 'artists' ? (
              <ArtistsStatusCard key={key} artists={artists} index={i} />
            ) : (
              <StatusCard key={key} row={reveals[key] ?? sealedFallback(key)} glyph={SEAL_META[key].glyph} index={i} />
            )
          )}
        </div>

        <div className="seals-dots" aria-hidden="true">
          {SEAL_ORDER.map((_, i) => (
            <span key={i} className={i === activeSlide ? 'on' : ''} />
          ))}
        </div>

        <div className={`lineup-band ${lineupReveal.className}`} id="lineup-band" ref={lineupReveal.ref} style={lineupReveal.style}>
          <div className="lineup-head">
            <div>
              <p className="eyebrow">The line-up</p>
              <h3>Who&apos;s playing.</h3>
            </div>
            <p>Announced one at a time. Keep watching.</p>
          </div>
          <Lineup artists={artists} settings={settings} freshIds={freshIds} />
        </div>
      </div>
    </section>
  );
}

function StatusCard({ row, glyph, index }: { row: PublicReveal; glyph: string; index: number }) {
  const reveal = useReveal(index);
  const isRevealed = row.is_revealed;
  const value = isRevealed ? (row.value || row.label) : glyph;

  return (
    <div className={`seal status-card ${isRevealed ? 'is-revealed' : 'is-sealed'} ${reveal.className}`} ref={reveal.ref} style={reveal.style}>
      {!isRevealed && <span className="scan-line" aria-hidden="true" />}
      <div className="k">{row.label}</div>
      <div className="seal-mid">
        <div className={`scramble${isRevealed ? ' status-value' : ''}${row.key === 'venue' ? ' venue-value' : ''}`} title={isRevealed && row.value ? row.value : undefined}>
          {value}
        </div>
        {isRevealed && row.link_url && (
          <a className="seal-link" href={row.link_url} target="_blank" rel="noopener">
            Open in Google Maps
          </a>
        )}
      </div>
      <StatusStamp announced={isRevealed} revealedAt={row.revealed_at} />
    </div>
  );
}

function ArtistsStatusCard({ artists, index }: { artists: PublicArtist[]; index: number }) {
  const reveal = useReveal(index);
  const announced = artists.length > 0;
  const visibleThumbs = artists.slice(0, 5);
  const hiddenCount = Math.max(0, artists.length - visibleThumbs.length);

  return (
    <button
      className={`seal status-card artists-status ${announced ? 'is-revealed' : 'is-sealed'} ${reveal.className}`}
      ref={reveal.ref as unknown as Ref<HTMLButtonElement>}
      style={reveal.style}
      type="button"
      onClick={() => document.getElementById('lineup-band')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      {!announced && <span className="scan-line" aria-hidden="true" />}
      <div className="k">Artists on stage</div>
      <div className="seal-mid">
        <div className="scramble status-value">{artists.length} announced</div>
        <div className="artist-thumbs" aria-hidden={artists.length === 0}>
          {visibleThumbs.map((artist) => (
            <TinyThumb key={artist.id} artist={artist} />
          ))}
          {hiddenCount > 0 && <span className="thumb-more">+{hiddenCount}</span>}
        </div>
      </div>
      <StatusStamp announced={announced} />
    </button>
  );
}

function StatusStamp({ announced, revealedAt }: { announced: boolean; revealedAt?: string | null }) {
  return (
    <div className={`stamp${announced ? ' announced' : ''}`}>
      <span className="dot" />
      {announced ? `Announced${revealedAt ? ` - ${formatRevealedAt(revealedAt)}` : ''}` : 'Sealed'}
    </div>
  );
}

function TinyThumb({ artist }: { artist: PublicArtist }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = artistPhotoUrl(artist);

  return (
    <span className="artist-thumb" title={artist.name}>
      {photoUrl && !failed ? (
        <img src={photoUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span>{artistInitial(artist.name)}</span>
      )}
    </span>
  );
}

function Lineup({ artists, settings, freshIds }: { artists: PublicArtist[]; settings: Settings | null; freshIds: Set<string> }) {
  const placeholderSlots = Math.max(0, settings?.artist_placeholders ?? 4);
  const placeholderCount = Math.max(0, placeholderSlots - artists.length);

  return (
    <>
      <div className="lineup-row">
        <AnimatePresence mode="popLayout">
          {artists.map((artist) => (
            <ArtistPortrait key={artist.id} artist={artist} fresh={freshIds.has(artist.id)} />
          ))}
          {Array.from({ length: placeholderCount }).map((_, i) => (
            <motion.div
              className="lineup-placeholder"
              key={`ph-${i}`}
              style={{ ['--pulse-delay' as string]: `${i * 400}ms` }}
              exit={{ opacity: 0, scale: 0.85, filter: 'blur(8px)' }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <div className="lineup-placeholder-circle">?</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {settings?.more_artists_coming && <p className="more-to-come">MORE TO COME</p>}
    </>
  );
}

function ArtistPortrait({ artist, fresh }: { artist: PublicArtist; fresh: boolean }) {
  const [failed, setFailed] = useState(false);
  const shouldReduceMotion = !!useReducedMotion();
  const particles = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 190,
      y: -30 - Math.random() * 65,
      delay: Math.random() * 0.18,
      size: 2 + Math.random() * 2,
    })),
    []
  );
  const photoUrl = artistPhotoUrl(artist);
  const instagram = (artist as PublicArtist & { instagram?: string | null }).instagram;
  const spotify = (artist as PublicArtist & { spotify?: string | null }).spotify;

  return (
    <motion.article
      className={`lineup-artist${fresh ? ' fresh' : ''}`}
      layout
      initial={fresh && !shouldReduceMotion ? { opacity: 0, scale: 0.85, filter: 'blur(10px)' } : false}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.7, ease: EASE_OUT_EXPO }}
    >
      <div className="lineup-photo">
        {photoUrl && !failed ? (
          <img src={photoUrl} alt={artist.name} loading="lazy" decoding="async" onError={() => setFailed(true)} />
        ) : (
          <span className="artist-initial">{artistInitial(artist.name)}</span>
        )}
        {fresh && !shouldReduceMotion && <span className="lineup-ring" aria-hidden="true" />}
        {fresh && !shouldReduceMotion && (
          <span className="lineup-particles" aria-hidden="true">
            {particles.map((p) => (
              <span
                key={p.id}
                style={{
                  ['--particle-x' as string]: `${p.x}px`,
                  ['--particle-y' as string]: `${p.y}px`,
                  left: `calc(50% + ${p.x}px)`,
                  top: '50%',
                  width: p.size,
                  height: p.size,
                  animationDelay: `${p.delay}s`,
                }}
              />
            ))}
          </span>
        )}
      </div>
      <h4>{artist.name}</h4>
      {(instagram || spotify) && (
        <div className="artist-links">
          {instagram && <a href={instagram} target="_blank" rel="noopener" aria-label={`${artist.name} on Instagram`}>IG</a>}
          {spotify && <a href={spotify} target="_blank" rel="noopener" aria-label={`${artist.name} on Spotify`}>SP</a>}
        </div>
      )}
      {artist.tagline && <p className="artist-tagline">{artist.tagline}</p>}
      {artist.revealed_at && <p className="artist-date">{formatRevealedAt(artist.revealed_at)}</p>}
    </motion.article>
  );
}
