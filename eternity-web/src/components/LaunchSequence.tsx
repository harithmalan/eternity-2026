import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { setLaunchVisualPhase } from '../lib/launchVisuals';

type Stage = 'countdown' | 'whiteout' | 'collapse' | 'ignition' | 'mark' | 'burst' | 'settle';
type CinematicStage = Exclude<Stage, 'countdown'>;

const STAGE_ORDER: CinematicStage[] = ['whiteout', 'collapse', 'ignition', 'mark', 'burst', 'settle'];
const STAGE_MS: Record<CinematicStage, number> = {
  whiteout: 180,
  collapse: 900,
  ignition: 700,
  mark: 1100,
  burst: 1400,
  settle: 900,
};
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface Props {
  armedAt: number;
  countdownSecs: number;
  /** True once the DB itself reports 'launched' — the cinematic starts at zero OR here, whichever lands first. */
  dbLaunched: boolean;
  onComplete: () => void;
}

export default function LaunchSequence({ armedAt, countdownSecs, dbLaunched, onComplete }: Props) {
  const shouldReduceMotion = !!useReducedMotion();
  const [stage, setStage] = useState<Stage>('countdown');
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLaunchVisualPhase('none');
    onComplete();
  };

  // The countdown ends the instant EITHER the local clock hits zero or the
  // DB confirms 'launched' — a synced clock is exact but not guaranteed to
  // arrive; the realtime event is guaranteed to arrive but not exact. Race
  // them, take whichever wins.
  useEffect(() => {
    if (stage !== 'countdown') return;
    if (dbLaunched) {
      setStage('whiteout');
      return;
    }
    let raf: number;
    const tick = () => {
      const left = countdownSecs - (Date.now() - armedAt) / 1000;
      if (left <= 0) {
        setStage('whiteout');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [stage, armedAt, countdownSecs, dbLaunched]);

  // Dims the moment the countdown starts, not just once it reaches zero.
  useEffect(() => {
    if (stage === 'countdown') setLaunchVisualPhase('dim');
  }, [stage]);

  // Reduced motion takes a single short exit instead of the full cascade:
  // one 600ms gold fade, then done. No white-out, no particles, no spin.
  useEffect(() => {
    if (stage === 'countdown' || !shouldReduceMotion) return;
    const t = setTimeout(finish, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, shouldReduceMotion]);

  // The full cinematic cascade — each stage's own timer advances to the next.
  useEffect(() => {
    if (shouldReduceMotion || stage === 'countdown') return;
    if (stage === 'whiteout' || stage === 'collapse') setLaunchVisualPhase('collapse');
    else if (stage === 'burst') setLaunchVisualPhase('burst');
    else if (stage === 'settle') setLaunchVisualPhase('none');

    const idx = STAGE_ORDER.indexOf(stage);
    const t = setTimeout(() => {
      const next = STAGE_ORDER[idx + 1];
      if (next) setStage(next);
      else finish();
    }, STAGE_MS[stage]);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, shouldReduceMotion]);

  // Escape or a tap anywhere skips straight to the end state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backgrounded mid-sequence — nobody was watching a stale animation
  // resume, so just land on the end state for whenever they come back.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) finish();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Belt and suspenders — an unmount from anywhere (including the error
  // boundary catching a throw) must never leave the scene dimmed/spinning.
  useEffect(() => () => setLaunchVisualPhase('none'), []);

  return (
    <div className="launch-overlay" role="presentation" onClick={finish}>
      {stage === 'countdown' ? (
        <ArmedCountdown armedAt={armedAt} countdownSecs={countdownSecs} reducedMotion={shouldReduceMotion} />
      ) : shouldReduceMotion ? (
        <ReducedLaunch />
      ) : (
        <FullCinematic stage={stage} />
      )}
    </div>
  );
}

function ArmedCountdown({ armedAt, countdownSecs, reducedMotion }: { armedAt: number; countdownSecs: number; reducedMotion: boolean }) {
  const [display, setDisplay] = useState(() => Math.max(0, Math.ceil(countdownSecs - (Date.now() - armedAt) / 1000)));

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const left = countdownSecs - (Date.now() - armedAt) / 1000;
      setDisplay(Math.max(0, Math.ceil(left)));
      if (left > 0) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [armedAt, countdownSecs]);

  return (
    <div className="launch-armed">
      <motion.div className="launch-armed-dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
      <AnimatePresence mode="popLayout">
        <motion.div
          key={display}
          className="launch-armed-number"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.3 : 0.95, ease: EASE_OUT_EXPO }}
        >
          {display}
          {!reducedMotion && (
            <motion.span
              className="launch-armed-ring"
              initial={{ scale: 1.7, opacity: 0.85 }}
              animate={{ scale: 1, opacity: 0 }}
              transition={{ duration: 0.95, ease: 'easeOut' }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ReducedLaunch() {
  return (
    <motion.div className="launch-reduced" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
      <img className="wordmark launch-mark" src="/img/eternity-logo.png" alt="Eternity" />
    </motion.div>
  );
}

function FullCinematic({ stage }: { stage: CinematicStage }) {
  const idx = STAGE_ORDER.indexOf(stage);
  const reached = (s: CinematicStage) => idx >= STAGE_ORDER.indexOf(s);
  const isSettle = stage === 'settle';

  return (
    <motion.div className="launch-cinematic" animate={{ opacity: isSettle ? 0 : 1 }} transition={{ duration: isSettle ? 0.9 : 0 }}>
      {/* 1. WHITE-OUT — one hard cut, never repeated: a seizure risk lives in anything that flickers, not in a single flash. */}
      <motion.div
        className="launch-flash"
        animate={{ opacity: stage === 'whiteout' ? 1 : 0 }}
        transition={{ duration: stage === 'whiteout' ? 0.18 : 0.45 }}
      />

      {/* 2. COLLAPSE backdrop — the starfield itself (via launchVisuals) does the spinning/rushing; this just darkens the rest of the frame around it. */}
      <motion.div className="launch-void" animate={{ opacity: reached('collapse') ? 1 : 0 }} transition={{ duration: 0.4 }} />

      {/* 3. IGNITION */}
      {reached('ignition') && (
        <motion.div
          className="launch-slash"
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: stage === 'ignition' ? 1 : 0.35 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
        />
      )}

      {/* 4. MARK — persists through burst and settle, easing toward its normal hero position as the whole layer fades in settle. */}
      {reached('mark') && (
        <motion.img
          src="/img/eternity-logo.png"
          alt="Eternity"
          className="wordmark launch-mark"
          initial={{ scale: 0.7, opacity: 0, filter: 'blur(24px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.1, ease: EASE_OUT_EXPO }}
        />
      )}

      {/* 5. BURST — the particle scatter itself is the shared three.js scene; this is just the chrome ring. */}
      {stage === 'burst' && (
        <motion.div
          className="launch-ring"
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 3.4, opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
      )}
    </motion.div>
  );
}
