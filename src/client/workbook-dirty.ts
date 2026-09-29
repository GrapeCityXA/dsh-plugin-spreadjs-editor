/**
 * Watch one live workbook for edits, so the panel can say "未保存".
 *
 * SpreadJS 19 has no workbook-level dirty flag to ask: read out of the shipped
 * declarations of `@grapecity-software/spread-sheets@19.2.0`
 * (`dist/gc.spread.sheets.d.ts`), `hasChanges()` and `isDirty()` exist only on a
 * report or table sheet, never on a Workbook. So this watches two things instead,
 * either of which is enough on its own:
 *
 * - the command manager, because every edit a user can undo passes through
 *   `commandManager().execute(...)`. The *instance* method is wrapped rather than
 *   the prototype, and the wrapper is removed again on stop;
 * - the change events a workbook fires for changes that need not be commands.
 *
 * Both signals are one-way on purpose: this only ever reports "something
 * happened", and the panel decides when the workbook counts as clean again (after
 * a load, after a save, after restoring a buffer). Being wrong in that direction
 * costs one marker and one snapshot; being wrong the other way loses work.
 */

/** The workbook surface this needs, kept structural so tests can drive it. */
export interface DirtyWatchWorkbook {
  commandManager?(): { execute?: (...args: never[]) => unknown } | undefined
  bind?(type: string, data?: unknown, fn?: () => void): void
  unbind?(type: string, fn?: () => void): void
}

/**
 * Change events treated as an edit when no command was involved, by the name of
 * their `GC.Spread.Sheets.Events` constant. Resolved through the namespace at the
 * call site so this file never hardcodes a second copy of the strings.
 *
 * - `RangeChanged`: cell values and formats, paste, clear, drag-fill
 * - `SheetChanged`: sheets added, removed, renamed, moved, activated
 * - `ValueChanged` / `ClipboardPasted` / `EditEnded`: the editing path itself
 */
export const DIRTY_EVENT_NAMES = [
  'RangeChanged',
  'SheetChanged',
  'ValueChanged',
  'ClipboardPasted',
  'EditEnded',
] as const

/** The declared event names this build answers, as the strings `bind` wants. */
export function resolveDirtyEvents(events: Record<string, string> | undefined): string[] {
  if (events === undefined) return []
  return DIRTY_EVENT_NAMES
    .map(name => events[name])
    .filter((value): value is string => typeof value === 'string')
}

/** One live watch. `stop` restores the command manager and unbinds the events. */
export interface DirtyWatch {
  stop(): void
}

/** Route the workbook's own command execution through `onDirty`. */
function wrapCommandManager(spread: DirtyWatchWorkbook, onDirty: () => void): (() => void) | undefined {
  const manager = spread.commandManager?.()
  if (manager === undefined) return undefined
  const original = manager.execute
  if (typeof original !== 'function') return undefined
  manager.execute = function (this: unknown, ...args: never[]): unknown {
    const result = original.apply(this, args)
    // `execute` answers false for a command it refused, which is not an edit.
    if (result !== false) onDirty()
    return result
  }
  return () => { manager.execute = original }
}

/** Route the named workbook events through `onDirty`. */
function bindDirtyEvents(
  spread: DirtyWatchWorkbook,
  events: readonly string[],
  onDirty: () => void,
): () => void {
  const handler = (): void => onDirty()
  const bound: string[] = []
  for (const type of events) {
    try {
      // `bind(type, data, fn)`: the handler is the third argument, not the second.
      spread.bind?.(type, undefined, handler)
      bound.push(type)
    } catch {
      // An event name this build does not know: the command manager still covers
      // the editing path, so a missing event degrades instead of breaking.
    }
  }
  return () => {
    for (const type of bound) {
      try {
        spread.unbind?.(type, handler)
      } catch {
        // Already unbound by a destroyed workbook.
      }
    }
  }
}

/**
 * Watch `spread` for edits until `stop` is called.
 * @param spread - the live workbook.
 * @param onDirty - called on the first change of any kind; may be called again.
 * @param events - resolved `GC.Spread.Sheets.Events` names, from {@link resolveDirtyEvents}.
 */
export function watchWorkbookChanges(
  spread: DirtyWatchWorkbook,
  onDirty: () => void,
  events: readonly string[] = [],
): DirtyWatch {
  const undoCommand = wrapCommandManager(spread, onDirty)
  const undoEvents = bindDirtyEvents(spread, events, onDirty)
  let stopped = false
  return {
    stop(): void {
      if (stopped) return
      stopped = true
      undoCommand?.()
      undoEvents()
    },
  }
}
