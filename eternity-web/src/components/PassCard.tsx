import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import type { Pass } from '../lib/database.types';

interface Props {
  pass: Pass;
  holderName: string;
  orderCode: string;
}

function formatCheckInTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-LK', { hour: 'numeric', minute: '2-digit' });
}

// order.code alone ("ETR-1029") already uniquely identifies the pass — one
// pass per order — so this suffix isn't load-bearing for lookup, it just
// makes the human-typeable fallback code look like a real ticket code
// rather than a guessable sequential number. Duplicated by hand in
// eternity-admin's gate scanner (no shared package between the two apps);
// keep both sides of this exact expression identical if it ever changes.
function passCode(orderCode: string, passId: string): string {
  return `${orderCode}-${passId.replace(/-/g, '').slice(0, 3).toUpperCase()}`;
}

/**
 * The thing an alumnus holds up at the gate. Renders straight from
 * `pass.id` — a scanner just looks that value up, there's no separate
 * "code" to keep in sync with it.
 */
export default function PassCard({ pass, holderName, orderCode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const admitted = !!pass.checked_in_at;

  useEffect(() => {
    if (!canvasRef.current) return;
    // errorCorrectionLevel 'H' (30% of the code can be damaged/obscured and
    // still scan) — this is read off a cracked screen at low brightness by
    // someone's tired camera at a gate, not off a clean monitor. margin: 2
    // bakes a real quiet zone into the code itself, on top of the white
    // card's own 16px padding.
    QRCode.toCanvas(canvasRef.current, pass.id, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(() => {
      // Nothing sensible to show in place of a QR code that failed to
      // render — the code text underneath still works as a fallback.
    });
  }, [pass.id]);

  // The single most common gate delay is a dimmed, auto-locked phone.
  // Wake Lock is real and well-supported; there is no standard web API to
  // set hardware screen brightness (no browser ships one — a page silently
  // maxing a visitor's brightness would be a real abuse vector), so
  // Fullscreen is the closest actual lever available: it strips browser
  // chrome so the white square fills more of the physical screen, and on
  // some Android browsers holding fullscreen also suppresses adaptive
  // dimming. Both are best-effort — neither is allowed to break the card
  // if denied, unsupported, or requires a gesture we don't have.
  useEffect(() => {
    if (admitted) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          sentinel = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Denied or unsupported — the card still works, it just won't
        // stop the screen from sleeping on its own.
      }
    };
    requestWakeLock();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (cardRef.current?.requestFullscreen) {
      cardRef.current.requestFullscreen().catch(() => {
        // No user gesture in the call stack, or the browser/OS refused —
        // silently stay at normal size.
      });
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
      if (document.fullscreenElement === cardRef.current) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [admitted]);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `eternity-pass-${orderCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div ref={cardRef} className={`pass-card${admitted ? ' admitted' : ''}`}>
      <p className="pass-eyebrow">Entry pass</p>

      <div className="pass-qr-wrap">
        <canvas ref={canvasRef} width={240} height={240} />
      </div>

      <p className="pass-code">{passCode(orderCode, pass.id)}</p>
      <p className="pass-code-hint">If the scan fails, read this out.</p>

      <h3 className="pass-holder">{holderName}</h3>
      <p className="pass-meta">Admits one · 18 September · Air Force Ground</p>

      {admitted && <div className="pass-admitted-pill">Admitted · {formatCheckInTime(pass.checked_in_at!)}</div>}

      {!admitted && (
        <>
          <button type="button" className="btn btn-ghost pass-download" onClick={downloadPng}>
            Download pass
          </button>
          <p className="pass-home-hint">Add this page to your home screen so it opens instantly, even offline.</p>
        </>
      )}
    </div>
  );
}
