import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';

const TYPE_MS = 72;
const DWELL_MS = 2200;

/** Fires once per fresh sign-in (never on route change or session restore) — ported from the `.greet` overlay in index-preview.html. */
export default function Greeting() {
  const { pendingGreetName, dismissGreeting } = useAuth();
  const [typed, setTyped] = useState('');
  const [show, setShow] = useState(false);
  const typeTimer = useRef<number | undefined>(undefined);
  const dwellTimer = useRef<number | undefined>(undefined);

  const active = pendingGreetName !== undefined;
  const name = pendingGreetName; // string | null while active

  useEffect(() => {
    if (!active) return;

    setShow(true);
    setTyped('');

    if (!name) {
      // "Hello there" has no name to type out character by character.
      dwellTimer.current = window.setTimeout(dismissGreeting, DWELL_MS);
      return () => window.clearTimeout(dwellTimer.current);
    }

    let i = 0;
    typeTimer.current = window.setInterval(() => {
      i++;
      setTyped(name.slice(0, i));
      if (i >= name.length) {
        window.clearInterval(typeTimer.current);
        dwellTimer.current = window.setTimeout(dismissGreeting, DWELL_MS);
      }
    }, TYPE_MS);

    return () => {
      window.clearInterval(typeTimer.current);
      window.clearTimeout(dwellTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, name]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissGreeting();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, dismissGreeting]);

  // Let the fade-out transition finish before unmounting content.
  useEffect(() => {
    if (active) return;
    const t = window.setTimeout(() => setShow(false), 800);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!show) return null;

  return (
    <div className={`greet${active ? ' show' : ''}`} onClick={dismissGreeting}>
      <div className="ring" />
      <div className="greet-inner">
        <img src="/img/eternity-logo.png" alt="Eternity" />
        {name ? (
          <h2>Hello, <i>{typed}</i><span className="cursor" /></h2>
        ) : (
          <h2>Hello there</h2>
        )}
        <p>Good to have you here. Your pre-order takes about two minutes.</p>
      </div>
    </div>
  );
}
