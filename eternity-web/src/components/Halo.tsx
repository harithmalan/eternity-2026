import { useEffect, useRef } from 'react';

/** Pointer-following glow, ported from `#halo` in the reference. */
export default function Halo() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !matchMedia('(hover: hover)').matches
    ) {
      return;
    }
    const el = ref.current;
    if (!el) return;

    let hx = 0, hy = 0, htx = 0, hty = 0;
    let raf: number;
    const onMove = (e: PointerEvent) => { htx = e.clientX; hty = e.clientY; };
    window.addEventListener('pointermove', onMove, { passive: true });

    const loop = () => {
      hx += (htx - hx) * 0.09;
      hy += (hty - hy) * 0.09;
      el.style.transform = `translate(${hx}px,${hy}px) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div id="halo" ref={ref} />;
}
