import { useCallback, useEffect, useState } from 'react';

function hoverCapable() {
  return (
    matchMedia('(hover: hover)').matches &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Button pulls toward the pointer, ported from `.magnetic` in the reference.
 * A callback ref (not `useRef` + a `[]`-effect) so a button that only mounts
 * once an earlier loading/error branch resolves still gets the effect wired
 * up — a `[]`-effect would have already run and found nothing on that first
 * pass.
 */
export function useMagnetic<T extends HTMLElement = HTMLButtonElement>() {
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node || !hoverCapable()) return;

    const onMove = (e: PointerEvent) => {
      const r = node.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.22;
      const y = (e.clientY - r.top - r.height / 2) * 0.3;
      node.style.transform = `translate(${x}px,${y}px)`;
    };
    const onLeave = () => {
      node.style.transform = '';
    };
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);
    return () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
    };
  }, [node]);

  return ref;
}

/** Card tilts toward the pointer, ported from `.tilt` in the reference. Same callback-ref reasoning as `useMagnetic`. */
export function useTilt<T extends HTMLElement = HTMLDivElement>() {
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node || !hoverCapable()) return;

    const onMove = (e: PointerEvent) => {
      const r = node.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      node.style.transform = `perspective(1100px) rotateY(${px * 5}deg) rotateX(${-py * 5}deg) translateY(-4px)`;
    };
    const onLeave = () => {
      node.style.transform = '';
    };
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);
    return () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
    };
  }, [node]);

  return ref;
}
