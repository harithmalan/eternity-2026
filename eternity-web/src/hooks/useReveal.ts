import { useEffect, useRef, useState } from 'react';

/**
 * Ports the reference's `.reveal` / `.reveal.in` scroll-in pattern:
 * an IntersectionObserver flips a class once, then stops watching.
 * Pass `index` to reproduce the (i % 3) * 80ms stagger used across
 * groups of reveal elements in the reference markup.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(index = 0) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return {
    ref,
    className: `reveal${inView ? ' in' : ''}`,
    style: { transitionDelay: `${(index % 3) * 80}ms` },
  };
}
