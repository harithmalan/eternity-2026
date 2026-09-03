// Lets the launch sequence drive the ALREADY-MOUNTED Cosmos scene (dim/
// brighten the starfield, spin it into a collapse, spawn a burst) without
// prop-drilling through Layout/Cosmos on every page, and without spinning
// up a second three.js renderer for the sequence's own effects. A plain
// module-level pub-sub rather than React context because Cosmos is mounted
// once per page deep inside <Layout>, while the sequence itself is mounted
// at the app root — there's no shared component tree to pass a prop through.
export type LaunchVisualPhase = 'none' | 'dim' | 'collapse' | 'burst';

type Listener = (phase: LaunchVisualPhase) => void;

let currentPhase: LaunchVisualPhase = 'none';
const listeners = new Set<Listener>();

export function setLaunchVisualPhase(phase: LaunchVisualPhase) {
  currentPhase = phase;
  listeners.forEach((l) => l(phase));
}

export function subscribeLaunchVisualPhase(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentPhase);
  return () => {
    listeners.delete(listener);
  };
}
