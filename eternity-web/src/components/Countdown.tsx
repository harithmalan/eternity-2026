import { useEffect, useRef, useState, type RefObject } from 'react';

export const SHOW_DATE_MS = new Date('2026-09-18T15:30:00+05:30').getTime();

export default function Countdown({ target = SHOW_DATE_MS }: { target?: number }) {
  const [reducedMotion] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const d = useRef<HTMLDivElement>(null);
  const h = useRef<HTMLDivElement>(null);
  const m = useRef<HTMLDivElement>(null);
  const s = useRef<HTMLDivElement>(null);
  const ms = useRef<HTMLSpanElement>(null);
  const secUnit = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let lastSecond = -1;

    const put = (r: RefObject<HTMLElement | null>, v: string) => {
      if (r.current && r.current.textContent !== v) r.current.textContent = v;
    };

    const frame = () => {
      const gap = Math.max(0, target - Date.now());
      const seconds = Math.floor((gap % 6e4) / 1e3);

      put(d, String(Math.floor(gap / 864e5)).padStart(2, '0'));
      put(h, String(Math.floor((gap % 864e5) / 36e5)).padStart(2, '0'));
      put(m, String(Math.floor((gap % 36e5) / 6e4)).padStart(2, '0'));
      put(s, String(seconds).padStart(2, '0'));

      if (!reducedMotion) {
        put(ms, String(Math.floor(gap % 1e3)).padStart(3, '0'));
      }

      if (seconds !== lastSecond) {
        lastSecond = seconds;
        secUnit.current?.animate(
          [{ opacity: .55 }, { opacity: 1 }],
          { duration: 260, easing: 'ease-out' }
        );
      }

      if (!reducedMotion) raf = requestAnimationFrame(frame);
    };

    if (reducedMotion) {
      frame();
      timer = setInterval(frame, 1000);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      if (raf !== undefined) cancelAnimationFrame(raf);
      if (timer !== undefined) clearInterval(timer);
    };
  }, [target, reducedMotion]);

  return (
    <div className="cd">
      <div className="cd-unit">
        <div className="cd-num" ref={d}>00</div>
        <div className="cd-lab">Days</div>
      </div>
      <div className="cd-sep">:</div>
      <div className="cd-unit">
        <div className="cd-num" ref={h}>00</div>
        <div className="cd-lab">Hours</div>
      </div>
      <div className="cd-sep">:</div>
      <div className="cd-unit">
        <div className="cd-num" ref={m}>00</div>
        <div className="cd-lab">Minutes</div>
      </div>
      <div className="cd-sep">:</div>
      <div className="cd-unit cd-sec">
        <div className="cd-sec-row" ref={secUnit}>
          <div className="cd-num" ref={s}>00</div>
          {!reducedMotion && (
            <span className="cd-ms">
              <span className="cd-ms-dot">.</span>
              <span ref={ms}>000</span>
              <span className="cd-ms-suffix">ms</span>
            </span>
          )}
        </div>
        <div className="cd-lab">Seconds</div>
      </div>
    </div>
  );
}
