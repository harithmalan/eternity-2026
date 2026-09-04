import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GateManifestRow } from './database.types';

const DB_NAME = 'eternity-gate';
const DB_VERSION = 1;

// order.code alone ("ETR-1029") already uniquely identifies the pass — one
// pass per order — so this suffix isn't load-bearing for lookup, it just
// matches the human-typeable code printed on the pass itself (see
// eternity-web's PassCard.tsx — same expression, duplicated by hand since
// there's no shared package between the two apps).
//
// Accepts null/undefined on purpose: a row from gate_manifest is a live
// server response, not a value this code controls the shape of — if either
// field is ever missing (a renamed view column, a null we didn't expect),
// this must degrade to a weird-looking code, never throw and take the
// whole manifest download down with it.
export function passCode(orderCode: string | null | undefined, passId: string | null | undefined): string {
  const safeOrderCode = orderCode ?? '';
  const safeSuffix = (passId ?? '').replace(/-/g, '').slice(0, 3).toUpperCase();
  return `${safeOrderCode}-${safeSuffix}`;
}

export interface CachedPass {
  pass_id: string;
  order_code: string;
  pass_code: string;
  full_name: string;
  center: string;
  phone: string;
  photo_url: string | null;
  // Server-known state as of the last manifest download or last successful
  // sync — NOT necessarily current if `pending` is true (see below).
  checked_in_at: string | null;
  checked_in_by_name: string | null;
  void_reason: string | null;
  // Set the instant a local scan (or manual Admit) marks someone admitted,
  // before any network call — this is what a re-scan of the same pass
  // reads to say ALREADY USED entirely offline. Cleared once check_in_pass
  // confirms the sync.
  pending: boolean;
}

interface GateDBSchema extends DBSchema {
  passes: {
    key: string;
    value: CachedPass;
    indexes: { 'by-name': string; 'by-phone': string; 'by-code': string };
  };
  photos: { key: string; value: Blob };
}

let dbPromise: Promise<IDBPDatabase<GateDBSchema>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<GateDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('passes', { keyPath: 'pass_id' });
        store.createIndex('by-name', 'full_name');
        store.createIndex('by-phone', 'phone');
        store.createIndex('by-code', 'pass_code');
        db.createObjectStore('photos');
      },
    });
  }
  return dbPromise;
}

/** Wipes the manifest and cached photos — pressed before a fresh "Download manifest" so a stale name/photo never lingers from a previous rehearsal. */
export async function clearManifest(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['passes', 'photos'], 'readwrite');
  await Promise.all([tx.objectStore('passes').clear(), tx.objectStore('photos').clear(), tx.done]);
}

/**
 * Every field here is defensively coerced except `pass_id` — that's the
 * IndexedDB keyPath, and silently falling it back to '' would make every
 * row with a missing id collide into one, overwriting each other instead
 * of failing loudly. A row with no pass_id can't be cached meaningfully at
 * all, so this throws a specifically diagnosable error and leaves it to
 * the caller (gateSync.ts) to log the row and skip it rather than losing
 * the rest of a several-hundred-row download over one bad row.
 */
export async function saveManifestRow(row: GateManifestRow): Promise<void> {
  if (!row.pass_id) {
    throw new Error(`gate_manifest row has no pass_id — got ${JSON.stringify(row)}`);
  }
  const db = await getDb();
  await db.put('passes', {
    pass_id: row.pass_id,
    order_code: row.order_code ?? '',
    pass_code: passCode(row.order_code, row.pass_id),
    full_name: row.full_name ?? '',
    center: row.center ?? '',
    phone: row.phone ?? '',
    photo_url: row.photo_url ?? null,
    checked_in_at: row.checked_in_at ?? null,
    checked_in_by_name: row.checked_in_by_name ?? null,
    void_reason: row.void_reason ?? null,
    pending: false,
  });
}

export async function savePhoto(passId: string, blob: Blob): Promise<void> {
  const db = await getDb();
  await db.put('photos', blob, passId);
}

/** Caller owns the returned object URL and must revoke it when done with it. */
export async function getPhotoObjectUrl(passId: string): Promise<string | null> {
  const db = await getDb();
  const blob = await db.get('photos', passId);
  return blob ? URL.createObjectURL(blob) : null;
}

export async function getPass(passId: string): Promise<CachedPass | undefined> {
  const db = await getDb();
  return db.get('passes', passId);
}

export async function putPass(pass: CachedPass): Promise<void> {
  const db = await getDb();
  await db.put('passes', pass);
}

export async function allPasses(): Promise<CachedPass[]> {
  const db = await getDb();
  return db.getAll('passes');
}

export async function countPasses(): Promise<number> {
  const db = await getDb();
  return db.count('passes');
}

export async function pendingPasses(): Promise<CachedPass[]> {
  const all = await allPasses();
  return all.filter((p) => p.pending);
}

export async function countPending(): Promise<number> {
  return (await pendingPasses()).length;
}

export async function countAdmitted(): Promise<number> {
  const all = await allPasses();
  return all.filter((p) => !!p.checked_in_at).length;
}

/**
 * Local-only, instant — the whole point of caching the manifest. Every
 * cached record's string fields are already coerced to '' at save time
 * (see saveManifestRow), so no field here should ever be null/undefined —
 * but this reads from a query object built at runtime, not something the
 * type system can fully vouch for, so it stays defensive rather than
 * trusting that.
 */
export async function searchByNameOrPhone(query: string | null | undefined): Promise<CachedPass[]> {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return [];
  const all = await allPasses();
  const qDigits = q.replace(/\s+/g, '');
  return all
    .filter((p) => (p.full_name ?? '').toLowerCase().includes(q) || (p.phone ?? '').replace(/\s+/g, '').includes(qDigits))
    .slice(0, 25);
}

/** Accepts either the full printed code ("ETR-1029-4K7") or just the order code ("ETR-1029"). */
export async function findByCode(code: string | null | undefined): Promise<CachedPass | undefined> {
  const db = await getDb();
  const normalized = (code ?? '').trim().toUpperCase();
  if (!normalized) return undefined;
  const byFullCode = await db.getFromIndex('passes', 'by-code', normalized);
  if (byFullCode) return byFullCode;
  const all = await db.getAllFromIndex('passes', 'by-code');
  return all.find((p) => (p.order_code ?? '').toUpperCase() === normalized);
}
