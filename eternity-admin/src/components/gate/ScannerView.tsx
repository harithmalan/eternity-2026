import type { RefObject } from 'react';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraError: string | null;
}

/** Camera fills the screen; the gold frame is purely visual guidance — jsQR samples the whole frame, not just the boxed area. */
export default function ScannerView({ videoRef, cameraError }: Props) {
  return (
    <div className="gate-scanner">
      <video ref={videoRef} className="gate-scanner-video" playsInline muted autoPlay />
      <div className="gate-scanner-frame" aria-hidden="true" />
      {cameraError && (
        <div className="gate-scanner-error">
          <p>Camera unavailable: {cameraError}</p>
          <p>Use manual check-in below.</p>
        </div>
      )}
    </div>
  );
}
