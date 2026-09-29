/**
 * What the document header's actions can ask of the panel on screen.
 *
 * Since DSH 0.1.7 a document header has an official place for file actions
 * (`sidebar.right.tab.document.actions`), which is where a Save belongs: it sits
 * above the body, next to every other viewer's own controls, and it is registered
 * rather than rewritten into the Designer's private File-menu template.
 *
 * The header is not *inside* the panel, though. It cannot see the workbook, and
 * the only thing it is given about the file is its absolute Host path — not the
 * workbook, and not the plugin's write-back. So the two halves talk through this
 * module: the body publishes one panel (the sidebar shows one document body at a
 * time, the same assumption bridge.ts makes for the agent bridge), and the header
 * reads it, plus a subscription so its button can say whether anything is pending.
 *
 * Everything a caller can do goes through the published panel, so a header action
 * for a tab whose body is not mounted is a no-op instead of a guess.
 */

/** One panel on screen, as far as the header is concerned. */
export interface SpreadsheetPanel {
  /** Whether this panel has a file it could write back to right now. */
  canSave(): boolean
  /** Whether the mounted workbook holds edits that are not on disk. */
  isDirty(): boolean
  /** Whether a load or a save is already in flight. */
  isBusy(): boolean
  /** Write the workbook back to its file. */
  save(): void
  /** Ask the panel to open its own Save As target prompt. */
  requestSaveAs(): void
}

/** The header's view of the panel, recomputed whenever the panel says so. */
export interface PanelSnapshot {
  /** A panel is mounted and can be written to. */
  readonly available: boolean
  /** Its workbook has edits that are not on disk. */
  readonly dirty: boolean
  /** It is loading or saving; an action waits rather than piling up. */
  readonly busy: boolean
}

/** The snapshot with no panel behind it. */
const NO_PANEL: PanelSnapshot = { available: false, dirty: false, busy: false }

let active: SpreadsheetPanel | undefined
let snapshot: PanelSnapshot = NO_PANEL
const listeners = new Set<() => void>()

function snapshotOf(panel: SpreadsheetPanel | undefined): PanelSnapshot {
  if (panel === undefined) return NO_PANEL
  return {
    available: panel.canSave(),
    dirty: panel.isDirty(),
    busy: panel.isBusy(),
  }
}

function publish(next: PanelSnapshot): void {
  if (
    next.available === snapshot.available
    && next.dirty === snapshot.dirty
    && next.busy === snapshot.busy
  ) return
  snapshot = next
  for (const listener of listeners) listener()
}

/**
 * Offer `panel` as the one the document header acts on.
 *
 * @param panel - the mounted panel's abilities.
 * @returns a disposer; it clears the slot only while this panel still owns it, so
 *   a panel that unmounts after another has mounted does not take the new one's
 *   place away.
 */
export function publishPanel(panel: SpreadsheetPanel): () => void {
  active = panel
  publish(snapshotOf(panel))
  let released = false
  return () => {
    if (released) return
    released = true
    if (active !== panel) return
    active = undefined
    publish(NO_PANEL)
  }
}

/** Re-read the mounted panel. Call it whenever its dirty, busy or target changes. */
export function refreshPanel(): void {
  publish(snapshotOf(active))
}

/** Observe snapshot changes; an unchanged snapshot notifies nobody. */
export function subscribePanel(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The current snapshot, as a stable reference until something actually changes. */
export function panelSnapshot(): PanelSnapshot {
  return snapshot
}

/**
 * Whether the document header should draw this plugin's actions at all.
 *
 * The slot is a *list* on **every** previewed file, so a contribution that always
 * renders puts Save and Save As beside every markdown file, image and log in the
 * workspace — where they can only ever be dead buttons, because no workbook is
 * mounted. The product's own contribution into this slot behaves the other way:
 * `FileOpenTarget` settles the desktop query and then returns null when there is no
 * application to offer, so the header simply has no open button for a file it cannot
 * hand over. This is the same shape: this plugin's header furniture exists only
 * while its own body is mounted with a file it can write.
 *
 * @param panel - the current snapshot.
 * @returns true only while the panel on screen is this plugin's, with a target.
 */
export function actionsVisible(panel: PanelSnapshot): boolean {
  return panel.available
}

/** Save the panel on screen, if there is one and it can be saved. */
export function saveActivePanel(): void {
  active?.save()
}

/** Ask the panel on screen for a Save As target, if there is one. */
export function saveAsActivePanel(): void {
  active?.requestSaveAs()
}

/** Drop all state. Only tests need this: the page's lifetime is the real scope. */
export function resetPanelActions(): void {
  active = undefined
  snapshot = NO_PANEL
  listeners.clear()
}
