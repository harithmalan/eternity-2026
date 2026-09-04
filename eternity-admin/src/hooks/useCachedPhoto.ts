import { useEffect, useState } from 'react';
import { getPhotoObjectUrl } from '../lib/gateDb';

/** Resolves a cached photo Blob to an object URL, revoking it on unmount/change so repeated scans don't leak memory over a multi-hour shift at the gate. */
export function useCachedPhoto(passId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!passId) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;

    getPhotoObjectUrl(passId).then((u) => {
      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      objectUrl = u;
      setUrl(u);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [passId]);

  return url;
}
