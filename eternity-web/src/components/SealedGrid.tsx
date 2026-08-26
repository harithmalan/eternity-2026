import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useReveal } from '../hooks/useReveal';
import { useReveals } from '../hooks/useReveals';
import type { PublicReveal } from '../lib/database.types';

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

function sealedFallback(key: string): PublicReveal {
  return {
    key,
    label: SEAL_META[key]?.label ?? key,
    sort: 0,
    is_revealed: false,
    revealed_at: null,
    value: null,
    detail: null,
  };
}

export default function SealedGrid() {
  const head = useReveal();
  const { reveals } = useReveals();

  return (
    <section className="band band-line" id="reveal">
      <div className="shell">
        <div className={`sec-head ${head.className}`} ref={head.ref} style={head.style}>
          <div>
            <p className="eyebrow">Sealed until announced</p>
            <h2 className="sec-title">Four things we&apos;re <i>not</i> telling you yet.</h2>
          </div>
          <p className="sec-note">Following will be unlocked at the correct time.</p>
        </div>
        <div className="seals">
          {SEAL_ORDER.map((key, i) => (
            <Seal key={key} row={reveals[key] ?? sealedFallback(key)} glyph={SEAL_META[key].glyph} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function formatRevealedAt(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Colombo' })
    .format(new Date(iso))
    .toUpperCase();
}

function Seal({ row, glyph, index }: { row: PublicReveal; glyph: string; index: number }) {
  const reveal = useReveal(index);
  const shouldReduceMotion = useReducedMotion();
  const isRevealed = row.is_revealed;
  const duration = shouldReduceMotion ? 0 : 0.9;

  return (
    <div className={`seal ${reveal.className}`} ref={reveal.ref} style={reveal.style}>
      <div className="k">{row.label}</div>

      <motion.div
        className="scramble"
        animate={{ filter: isRevealed ? 'blur(0px)' : 'blur(7px)', opacity: isRevealed ? 1 : 0.5 }}
        transition={{ duration, ease: [0.2, 0.9, 0.3, 1] }}
        style={{ userSelect: isRevealed ? 'text' : 'none' }}
      >
        {isRevealed ? row.value : glyph}
      </motion.div>
      {isRevealed && row.detail && <div className="detail">{row.detail}</div>}

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
            Announced{row.revealed_at ? ` · ${formatRevealedAt(row.revealed_at)}` : ''}
          </motion.div>
        ) : (
          <motion.div
            key="sealed"
            className="stamp"
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
          >
            <span className="dot" />
            Sealed
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
