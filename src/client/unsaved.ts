/**
 * Unsaved workbook buffers, and the guard that warns before the whole page goes.
 *
 * Why this exists instead of a "you have unsaved changes" dialog: the Sidebar
 * unmounts a document body as soon as its tab is switched away from — the
 * document preview's own store keeps per-tab state precisely because of that —
 * and the platform offers nothing to veto a close. `DocumentPreviewDefinition`
 * carries no lifecycle hook, a tab close is synchronous, and the only signal a
 * body gets is `tab.signal`, which aborts when the record disappears (pointedly
 * *not* on hide or session switch). A sidebar editor that popped a modal on every
 * tab switch would be worse than the problem, and hooking the close button is the
 * kind of private contract this plugin has been moving away from.
 *
 * So nothing is blocked, and nothing is silently thrown away either:
 *
 * - a live dirty flag per tab drives the "未保存" marker and the page-close guard;
 * - a dirty body that unmounts leaves a snapshot keyed by its tab, read back when
 *   the same tab mounts again, so switching away and back keeps the edits;
 * - that snapshot is kept by path as well, so once the tab record is gone,
 *   reopening the file can offer the buffer back instead of starting from disk.
 *
 * The path-keyed copy is dropped when the file is saved or the user discards it,
 * and it is only offered when the file it came from is still the version on disk
 * (`baseline`) — a stale buffer never silently replaces someone else's edit.
 */

/** A dirty workbook's serialized contents, and what identifies the buffer. */
export interface WorkbookSnapshot {
  /** Path inside the session, exactly as the file address carried it. */
  readonly path: string
  /** The tab occurrence whose body wrote this buffer. */
  readonly tabId: string
  /** Hash of the bytes on disk when this buffer was written, or undefined if unknown yet. */
  readonly baseline: string | undefined
  /** `workbook.toJSON()`: the live workbook in its own serialization. */
  readonly workbook: object
  /** When it was written, for the status text. */
  readonly at: number
}

/** Tabs whose mounted body currently holds edits that are not on disk. */
const dirtyTabs = new Set<string>()

/** The last snapshot written by a dirty body, by the tab that wrote it. */
const byTab = new Map<string, WorkbookSnapshot>()

/**
 * The last snapshot written for a file, by path. This one outlives the tab: it is
 * what makes "close the tab, reopen the file" recoverable.
 */
const byPath = new Map<string, WorkbookSnapshot>()

/** One path's recoverable buffer, and whether the file on disk still fits it. */
export interface RecoverableWorkbook {
  readonly snapshot: WorkbookSnapshot
  /**
   * Whether the file on disk is still the version this buffer came from. When it
   * is false the buffer is offered but never applied on its own.
   */
  readonly matches: boolean
}

/** Record whether the body mounted for `tabId` currently holds unsaved edits. */
export function setTabDirty(tabId: string, dirty: boolean): void {
  if (dirty) dirtyTabs.add(tabId)
  else dirtyTabs.delete(tabId)
}

/** Whether the body mounted for `tabId` holds unsaved edits. */
export function isTabDirty(tabId: string): boolean {
  return dirtyTabs.has(tabId)
}

/**
 * Whether anything at all would be lost if this page went away now: a live dirty
 * body, a buffer waiting for its tab to come back, or a recoverable buffer.
 */
export function hasUnsavedWork(): boolean {
  return dirtyTabs.size > 0 || byTab.size > 0 || byPath.size > 0
}

/**
 * Keep a dirty workbook's snapshot.
 *
 * Written under both keys on purpose: the tab key serves "switched away and
 * back", the path key serves "closed and reopened".
 */
export function stashWorkbook(snapshot: WorkbookSnapshot): void {
  byTab.set(snapshot.tabId, snapshot)
  byPath.set(snapshot.path, snapshot)
}

/**
 * The snapshot this tab left behind, if it left one for that same file.
 *
 * Snapshots under other tab ids for the same path belong to tab occurrences that
 * are over — the platform hands out a fresh id per occurrence — so they are
 * dropped here rather than lingering: this is also what keeps a buffer written
 * during the unmount that follows a tab's `signal` abort from accumulating.
 */
export function tabWorkbook(tabId: string, path: string): WorkbookSnapshot | undefined {
  for (const [key, snapshot] of byTab) {
    if (snapshot.path === path && key !== tabId) byTab.delete(key)
  }
  return byTab.get(tabId)
}

/**
 * The recoverable buffer for `path`, with whether it still fits the file on disk.
 * @param path - file path inside the session.
 * @param baseline - hash of the bytes this panel is showing, as read from disk.
 */
export function recoverableWorkbook(path: string, baseline: string | undefined): RecoverableWorkbook | undefined {
  const snapshot = byPath.get(path)
  if (snapshot === undefined) return undefined
  return { snapshot, matches: snapshot.baseline === baseline }
}

/**
 * Whether any buffer is kept for `path` at all, whatever version of the file it
 * was written from. This is what lets a body that has no buffer to reconcile skip
 * hashing the file it is about to open.
 */
export function hasRecoveryBuffer(path: string): boolean {
  return byPath.has(path)
}

/**
 * Forget one tab's buffer. The path-keyed copy survives, by design.
 */
export function forgetTab(tabId: string): void {
  dirtyTabs.delete(tabId)
  byTab.delete(tabId)
}

/**
 * Forget everything remembered for one file: it was saved, or the user chose to
 * discard the buffer.
 */
export function forgetPath(path: string): void {
  byPath.delete(path)
  for (const [key, snapshot] of byTab) {
    if (snapshot.path === path) byTab.delete(key)
  }
}

/**
 * Warn before the page unloads while unsaved work exists.
 *
 * The listener stays registered and answers at event time, because a browser only
 * shows its own generic prompt — there is nothing to customise per change — and
 * the check is a few Set/Map lookups.
 * @returns the disposer removing the listener.
 */
export function watchUnloadGuard(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!hasUnsavedWork()) return
    event.preventDefault()
    // Older browsers only intercept on a non-empty returnValue.
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  return () => window.removeEventListener('beforeunload', onBeforeUnload)
}

/** Drop all state. Only tests need this; the page's own lifetime is the real scope. */
export function resetUnsavedWork(): void {
  dirtyTabs.clear()
  byTab.clear()
  byPath.clear()
}
