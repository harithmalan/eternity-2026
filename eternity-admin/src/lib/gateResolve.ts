import { findByCode, getPass, putPass, type CachedPass } from './gateDb';

export type GateResult =
  | { state: 'admitted'; pass: CachedPass }
  | { state: 'already'; pass: CachedPass }
  | { state: 'void'; pass: CachedPass }
  | { state: 'invalid' };

/**
 * The one place a scan (camera or manual) turns into a decision — entirely
 * against the local cache, entirely offline. Marking someone admitted here
 * is instant and durable (IndexedDB write) even if the app crashes or the
 * tab closes a second later; syncing to the server is a separate, later
 * concern (see gateSync.ts).
 */
export async function resolvePass(passId: string, admittedByName: string): Promise<GateResult> {
  const pass = await getPass(passId);
  if (!pass) return { state: 'invalid' };
  if (pass.void_reason) return { state: 'void', pass };
  if (pass.checked_in_at) return { state: 'already', pass };

  const admitted: CachedPass = {
    ...pass,
    checked_in_at: new Date().toISOString(),
    checked_in_by_name: admittedByName,
    pending: true,
  };
  await putPass(admitted);
  return { state: 'admitted', pass: admitted };
}

/** The camera hands back the raw QR payload, which is exactly `pass.id`. */
export function resolveScannedText(text: string, admittedByName: string): Promise<GateResult> {
  return resolvePass(text.trim(), admittedByName);
}

export async function resolveCode(code: string, admittedByName: string): Promise<GateResult> {
  const pass = await findByCode(code);
  if (!pass) return { state: 'invalid' };
  return resolvePass(pass.pass_id, admittedByName);
}
