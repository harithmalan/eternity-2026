import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useQrScanner } from '../hooks/useQrScanner';
import { allPasses, countAdmitted, countPending, countPasses, type CachedPass } from '../lib/gateDb';
import { downloadManifest, syncPending, type DownloadProgress } from '../lib/gateSync';
import { resolveScannedText, type GateResult } from '../lib/gateResolve';
import { downloadBlob } from '../lib/csv';
import ScannerView from '../components/gate/ScannerView';
import ResultOverlay from '../components/gate/ResultOverlay';
import ManualFallback from '../components/gate/ManualFallback';

const SYNC_INTERVAL_MS = 8000;

function attendanceToCsv(rows: CachedPass[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const headers = ['Order Code', 'Name', 'Center', 'Phone', 'Admitted', 'Checked In At', 'Checked In By', 'Void Reason'];
  const lines = rows.map((r) => [
    r.order_code, r.full_name, r.center, r.phone,
    r.checked_in_at ? 'Yes' : 'No', r.checked_in_at ?? '', r.checked_in_by_name ?? '', r.void_reason ?? '',
  ]);
  return [headers, ...lines].map((r) => r.map(esc).join(',')).join('\r\n');
}

export default function Gate() {
  const { profile, user } = useAuth();
  const admittedByName = profile?.full_name || user?.email || 'Committee';
  const online = useOnlineStatus();

  const [cached, setCached] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [admitted, setAdmitted] = useState(0);

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [result, setResult] = useState<GateResult | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const syncingRef = useRef(false);

  const refreshCounts = useCallback(async () => {
    const [c, p, a] = await Promise.all([countPasses(), countPending(), countAdmitted()]);
    setCached(c);
    setPending(p);
    setAdmitted(a);
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  const runDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadManifest(setDownloadProgress);
      await refreshCounts();
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed.');
    }
    setDownloading(false);
    setDownloadProgress(null);
  };

  // Opportunistic sync — on an interval, and immediately whenever the
  // browser thinks it's back online. Never lets two sync passes overlap.
  const runSync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    try {
      await syncPending();
    } finally {
      syncingRef.current = false;
      refreshCounts();
    }
  }, [refreshCounts]);

  useEffect(() => {
    if (cached === null || cached === 0) return;
    const interval = setInterval(runSync, SYNC_INTERVAL_MS);
    window.addEventListener('online', runSync);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', runSync);
    };
  }, [cached, runSync]);

  const scanningActive = cached !== null && cached > 0 && !result && !manualOpen;
  const { videoRef, cameraError } = useQrScanner({
    active: scanningActive,
    onDecode: async (text) => {
      const r = await resolveScannedText(text, admittedByName);
      setResult(r);
      refreshCounts();
    },
  });

  const dismissResult = () => setResult(null);

  const exportAttendance = async () => {
    setExporting(true);
    const rows = await allPasses();
    downloadBlob(attendanceToCsv(rows), `eternity-attendance-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    setExporting(false);
  };

  if (cached === null) {
    return <div className="gate-page gate-loading" />;
  }

  if (cached === 0) {
    return (
      <div className="gate-page gate-download-screen">
        <p className="eyebrow">Entry gate</p>
        <h1 className="gate-download-title">Download the manifest</h1>
        <p className="gate-download-note">
          Do this before doors open, on a good connection. It caches every pass — including photos — so scanning
          needs no network at all.
        </p>
        {downloading && downloadProgress && (
          <div className="gate-download-progress">
            <div className="gate-download-bar">
              <div
                className="gate-download-bar-fill"
                style={{ width: `${downloadProgress.total ? (downloadProgress.done / downloadProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="gate-download-progress-label">
              {downloadProgress.stage === 'passes' ? 'Fetching passes…' : 'Caching photos…'} {downloadProgress.done} / {downloadProgress.total}
            </p>
          </div>
        )}
        {downloadError && <p className="auth-error">{downloadError}</p>}
        <button type="button" className="btn btn-gold" disabled={downloading} onClick={runDownload}>
          {downloading ? 'Downloading…' : 'Download manifest'}
        </button>
      </div>
    );
  }

  return (
    <div className="gate-page">
      <div className={`gate-status-bar${online ? '' : ' offline'}`}>
        <span className="gate-status-dot" />
        {online ? 'Online' : 'Offline'} · {cached} passes cached · {pending} pending
      </div>

      <ScannerView videoRef={videoRef} cameraError={cameraError} />

      {result && <ResultOverlay result={result} onDismiss={dismissResult} />}

      {manualOpen && (
        <ManualFallback
          admittedByName={admittedByName}
          onClose={() => setManualOpen(false)}
          onResult={(r) => {
            setResult(r);
            refreshCounts();
          }}
        />
      )}

      <div className="gate-bottom">
        <div className="gate-stats-bar">{admitted} / {cached} admitted</div>
        <div className="gate-actions">
          <button type="button" className="btn btn-ghost gate-manual-open" onClick={() => setManualOpen(true)}>
            Manual check-in
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={downloading} onClick={runDownload}>
            {downloading ? 'Re-downloading…' : 'Re-download manifest'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={exporting} onClick={exportAttendance}>
            {exporting ? 'Preparing…' : 'Export attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}
