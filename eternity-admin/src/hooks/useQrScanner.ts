import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const SCAN_INTERVAL_MS = 180;
// Ignore a repeat decode of the same value for this long — without it, a
// code that's still in frame while a result is dismissing would fire again
// on the very next sampled frame.
const REPEAT_SUPPRESS_MS = 2000;

interface Options {
  /** Scanning pauses (camera stays open, sampling stops) whenever this is false — e.g. while a result is on screen. */
  active: boolean;
  onDecode: (text: string) => void;
}

/** Rear camera, continuous autofocus where the device supports it, sampled against jsQR. */
export function useQrScanner({ active, onDecode }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastDecodeRef = useRef<{ text: string; at: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            // Continuous autofocus isn't in the standard constraint set
            // TypeScript ships, but Chrome on Android honors it when
            // present — harmless where it isn't recognized.
            ...({ focusMode: 'continuous' } as MediaTrackConstraints),
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
        setReady(true);
        setCameraError(null);
      } catch (err) {
        if (!cancelled) setCameraError(err instanceof Error ? err.message : 'Could not open the camera.');
      }
    }

    start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!active || !ready) return;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let imageData: ImageData;
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        return;
      }

      // 'attemptBoth' costs more per frame than 'dontInvert', but this is
      // read off someone else's phone screen at dusk, in glare, at an
      // angle — the extra robustness matters more than shaving a few ms
      // off a 180ms-interval scan loop.
      const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
      if (!result?.data) return;

      const now = Date.now();
      const last = lastDecodeRef.current;
      if (last && last.text === result.data && now - last.at < REPEAT_SUPPRESS_MS) return;
      lastDecodeRef.current = { text: result.data, at: now };
      onDecode(result.data);
    };

    const intervalId = setInterval(tick, SCAN_INTERVAL_MS);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready]);

  return { videoRef, cameraError, ready };
}
