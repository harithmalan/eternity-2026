import { useCallback, useEffect, useState } from 'react';

/**
 * Ports the reference's `.reveal` / `.reveal.in` scroll-in pattern:
 * an IntersectionObserver flips a class once, then stops watching.
 * Pass `index` to reproduce the (i % 3) * 80ms stagger used across
 * groups of reveal elements in the reference markup.
 *
 * Uses a callback ref rather than `useRef` + a `[]`-effect on purpose: a
 * panel that starts out behind a loading/error branch (a different element,
 * with no ref) only gets this ref attached once the real content mounts on
 * a later render. A `[]`-effect reads `ref.current` exactly once, right
 * after the *first* commit, so on that swap it would find nothing to
 * observe and this panel would stay at `opacity: 0` forever. A callback ref
 * re-fires on every mount, including that later one.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(index = 0) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  const ref = useCallback((el: T | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node]);

  return {
    ref,
    className: `reveal${inView ? ' in' : ''}`,
    style: { transitionDelay: `${(index % 3) * 80}ms` },
  };
}
