import { supabase } from './supabase';
import { allPasses, clearManifest, getPass, putPass, saveManifestRow, savePhoto } from './gateDb';

export interface DownloadProgress {
  done: number;
  total: number;
  stage: 'passes' | 'photos';
}

/**
 * Wipes and re-downloads the whole manifest, then fetches and caches every
 * photo as a real Blob — not just the URL, which would be one more network
 * request per person at exactly the moment there's no network. Run this
 * once, before doors open, while there's still a good connection.
 */
export async function downloadManifest(onProgress?: (p: DownloadProgress) => void): Promise<{ count: number; rowFailures: number; photoFailures: number }> {
  const { data, error } = await supabase.from('gate_manifest').select('*');
  if (error) throw error;
  const rows = data ?? [];

  // The exact shape of what the server actually sent — logged before any
  // of it is touched, so a field that's missing or named differently than
  // this code expects is visible in devtools rather than only inferrable
  // from a stack trace.
  console.log('[gate] gate_manifest response:', rows);

  await clearManifest();

  // One malformed row (a manifest column renamed live but not here — this
  // has happened before on this project) must never take the other few
  // hundred good rows down with it. Each row is cached independently; a
  // failure is logged with the row that caused it and the download keeps
  // going.
  let rowFailures = 0;
  const validPassIds = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await saveManifestRow(row);
      if (row.pass_id) validPassIds.add(row.pass_id);
    } catch (err) {
      rowFailures++;
      console.error('[gate] failed to cache manifest row:', row, err);
    }
    onProgress?.({ done: i + 1, total: rows.length, stage: 'passes' });
  }

  // Photos come from an external host (Google/Facebook's OAuth avatar CDN,
  // not our own storage) — fetched with modest concurrency so a few hundred
  // of them don't open a few hundred sockets at once. Only for rows that
  // actually made it into the cache above.
  const withPhotos = rows.filter((r) => r.photo_url && validPassIds.has(r.pass_id));
  let done = 0;
  let photoFailures = 0;
  const CONCURRENCY = 6;
  let cursor = 0;

  async function worker() {
    while (cursor < withPhotos.length) {
      const row = withPhotos[cursor++];
      try {
        const res = await fetch(row.photo_url!, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          await savePhoto(row.pass_id, blob);
        } else {
          photoFailures++;
        }
      } catch (err) {
        // No photo cached for this person — the gate UI falls back to
        // initials. Not fatal, doesn't stop the rest of the download.
        photoFailures++;
        console.error('[gate] failed to fetch/cache photo for row:', row, err);
      }
      done++;
      onProgress?.({ done, total: withPhotos.length, stage: 'photos' });
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, withPhotos.length) }, worker));

  return { count: validPassIds.size, rowFailures, photoFailures };
}

/**
 * Pushes every locally-admitted-but-unsynced pass to the server. Safe to
 * call opportunistically (on reconnect, on an interval, on demand) — each
 * call only touches rows still marked pending, and check_in_pass itself is
 * idempotent server-side.
 */
export async function syncPending(): Promise<{ synced: number; failed: number }> {
  const pending = (await allPasses()).filter((p) => p.pending);
  let synced = 0;
  let failed = 0;

  for (const p of pending) {
    try {
      const { data, error } = await supabase.rpc('check_in_pass', {
        p_pass_id: p.pass_id,
        p_checked_in_at: p.checked_in_at ?? new Date().toISOString(),
      });
      if (error) throw error;
      const result = data?.[0];
      if (!result) throw new Error('No response from check_in_pass.');

      const fresh = await getPass(p.pass_id);
      if (fresh) {
        await putPass({
          ...fresh,
          checked_in_at: result.out_checked_in_at,
          checked_in_by_name: fresh.checked_in_by_name, // resolved server-side name arrives on next full manifest download
          pending: false,
        });
      }
      synced++;
    } catch {
      // Stays pending — picked up by the next sync attempt. A void pass
      // (voided after this device's manifest was downloaded) also lands
      // here; it stays "pending" rather than silently vanishing, which at
      // least keeps it visible for a volunteer to notice and investigate.
      failed++;
    }
  }

  return { synced, failed };
}
