/**
 * Which workbook a document body should open with.
 *
 * A body is unmounted whenever its tab is hidden, so "open the file" is not the
 * only possibility: the body may have left edits behind, and those come back
 * instead (see unsaved.ts). The choice has to be made *before* the Designer loads
 * anything, because loading the file first and swapping the buffer in afterwards
 * would re-parse a whole workbook on every tab switch — the exact cost the buffer
 * exists to avoid.
 *
 * Two kinds of buffer, with different rules:
 *
 * - the tab's **own** buffer wins outright and needs no hashing: that tab never
 *   closed, so its edits are exactly as current as the file it is reading — the
 *   state a tab that stayed on screen would be in;
 * - a buffer kept for the file's **path** outlived its tab, so it is only applied
 *   once the hash says the file on disk is still the version it was written from.
 *   Otherwise it is offered, never applied behind the user's back — unless no hash
 *   can be had at all (no secure context), which is decided the same cautious way
 *   rather than waited on forever.
 */
import {
  hasRecoveryBuffer,
  recoverableWorkbook,
  tabWorkbook,
  type WorkbookSnapshot,
} from './unsaved.ts'

/** The content hash is still being computed. Not a possible hex digest. */
export const HASH_PENDING = 'pending'

/**
 * No content hash can be had — `crypto.subtle` only exists in a secure context, so
 * a LAN address allowed through `trustedHosts` has none. Also not a hex digest.
 */
export const HASH_UNAVAILABLE = 'unavailable'

/** A workbook buffer kept from an earlier body, and where it came from. */
export interface HeldBuffer {
  readonly workbook: object
  /** `tab` = this tab's own buffer; `recovery` = one kept for the file's path. */
  readonly from: 'tab' | 'recovery'
}

/** What to load, or that the decision cannot be made yet. */
export type LoadOutcome =
  /** The hash a kept buffer must be reconciled against is not in yet. */
  | { readonly kind: 'deferred' }
  /** The file's own bytes. */
  | { readonly kind: 'file' }
  /** A buffer to load instead of the file. */
  | { readonly kind: 'buffer'; readonly buffer: HeldBuffer }
  /** The file, plus a buffer the user may choose to apply. */
  | { readonly kind: 'offer'; readonly buffer: HeldBuffer }

function held(snapshot: WorkbookSnapshot, from: HeldBuffer['from']): HeldBuffer {
  return { workbook: snapshot.workbook, from }
}

/**
 * Decide what `tabId` should open `path` with.
 *
 * @param tabId - the tab occurrence asking; its own buffer, if any, wins.
 * @param path - the file's path inside the session.
 * @param diskHash - the current file's content hash, or {@link HASH_PENDING} /
 *   {@link HASH_UNAVAILABLE}.
 * @returns what to load, or `deferred` while the hash is pending.
 */
export function decideLoad(tabId: string, path: string, diskHash: string): LoadOutcome {
  const mine = tabWorkbook(tabId, path)
  if (mine !== undefined) return { kind: 'buffer', buffer: held(mine, 'tab') }

  if (!hasRecoveryBuffer(path)) return { kind: 'file' }
  if (diskHash === HASH_PENDING) return { kind: 'deferred' }

  const recovery = recoverableWorkbook(path, diskHash === HASH_UNAVAILABLE ? undefined : diskHash)
  if (recovery === undefined) return { kind: 'file' }
  return recovery.matches
    ? { kind: 'buffer', buffer: held(recovery.snapshot, 'recovery') }
    : { kind: 'offer', buffer: held(recovery.snapshot, 'recovery') }
}
