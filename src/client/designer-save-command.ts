/**
 * Redirect the Designer's own Save command to this plugin's write-back.
 *
 * Save is the affordance a user reaches for first, and the Designer's default
 * one opens a "save file" dialog that downloads a copy to local disk. That is the
 * wrong meaning inside this panel, where the open document already has a file in
 * the session workspace: Save must write that file. Copies belong to Export and
 * Save As, which keep their default behaviour.
 *
 * Three facts about the Designer shape this module:
 *
 * 1. `Designer.CommandNames.Save` is the string `"save"`, and the ribbon button,
 *    the File menu entry and Ctrl+S all dispatch through it.
 * 2. A command can be replaced either on the object the registry hands back from
 *    `Designer.getCommand()` or through `config.commandMap`, which the Designer
 *    registers per instance in `_applyConfig`. This module installs the same
 *    wrapper in **both** places, so it does not matter which one wins dispatch.
 * 3. Both of those are process-wide or shared, while panels are not: opening a
 *    second workbook mounts a second panel over the same command registry. The
 *    wrapper therefore does not capture a panel; it resolves the panel from the
 *    command context's workbook at call time (see {@link registerDesignerSaveTarget}).
 *
 * The substitution is deliberately conditional: when no panel can write back, the
 * Designer's own command runs, so a Designer with no workspace file is never left
 * with a dead Save button.
 */

/** A command object, as `Designer.getCommand()` hands it over. */
export interface DesignerCommandLike {
  execute?: (...args: unknown[]) => unknown
  [key: string]: unknown
}

/** The Designer namespace surface used to find and replace the command. */
export interface DesignerNamespaceLike {
  CommandNames?: DesignerCommandNames
  getCommand?: (name: string) => DesignerCommandLike | undefined
}

/**
 * The Designer's `CommandNames` table. Only `Save` is read by name; the index
 * signature lets the File-menu customisation look up the other entries it owns
 * without this module having to enumerate the whole product enum.
 */
export interface DesignerCommandNames {
  Save?: string
  [name: string]: unknown
}

/** The Designer config whose `commandMap` is written back into. */
export interface DesignerConfigLike {
  commandMap?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * One panel that can receive a Save. Panels register on mount and unregister on
 * unmount, so an unmounted workbook can never swallow a Save meant for another.
 */
export interface DesignerSaveTarget {
  /**
   * The workbook this panel is editing, for identity matching against the
   * workbook the launched command belongs to. `undefined` before the Designer
   * exists.
   */
  workbook: () => unknown
  /** Whether this panel has a workspace file to write to right now. */
  canWriteBack: () => boolean
  /** Write this panel's workbook back to its workspace file. */
  save: () => void
}

/**
 * Key under which a wrapper this module installed remembers the Designer's real
 * command, so re-installing after a remount replaces the redirect instead of
 * wrapping the previous wrapper.
 */
const PRISTINE = '__dshSpreadjsPristineSave'

interface RedirectingExecute {
  (...args: unknown[]): unknown
  [PRISTINE]?: ((...args: unknown[]) => unknown) | undefined
}

const targets: DesignerSaveTarget[] = []

/**
 * Make a mounted panel eligible to receive the Designer's Save.
 *
 * @param target - the panel's workbook, availability and write-back.
 * @returns an unregister function; call it when the panel unmounts.
 */
export function registerDesignerSaveTarget(target: DesignerSaveTarget): () => void {
  targets.push(target)
  return () => {
    const index = targets.indexOf(target)
    if (index >= 0) targets.splice(index, 1)
  }
}

/** The workbook a launched Designer command belongs to, if it says. */
function workbookOf(context: unknown): unknown {
  const candidate = context as { getWorkbook?: () => unknown } | undefined
  if (candidate === undefined || candidate === null) return undefined
  return typeof candidate.getWorkbook === 'function' ? candidate.getWorkbook() : undefined
}

/**
 * The panel a Save belongs to.
 *
 * Matching is by workbook identity, which is what makes this correct with more
 * than one panel mounted: the command context carries the workbook it was
 * launched on, and a panel reports the workbook it is editing. A lone panel is
 * accepted without a match, because a context that cannot name its workbook
 * still has only one possible destination.
 *
 * Exported for the File menu customisation, which receives the same kind of
 * context from the Designer's own handler.
 */
export function designerSaveTargetFor(context: unknown): DesignerSaveTarget | undefined {
  if (targets.length === 0) return undefined
  const workbook = workbookOf(context)
  if (workbook !== undefined) {
    const matched = targets.find(target => target.workbook() === workbook)
    if (matched !== undefined) return matched
  }
  return targets.length === 1 ? targets[0] : undefined
}

/**
 * Point the Designer's Save command at the registered write-back.
 *
 * @param namespace - the Designer namespace, if the package is loaded.
 * @param config - the config about to be handed to the Designer constructor.
 * @returns whether a Save command was found and redirected. `false` means this
 *   Designer build cannot be steered; the header's Save — the published document
 *   action — still writes the file, so the feature survives, but the Designer's
 *   own Save keeps its download behaviour.
 */
export function redirectDesignerSave(
  namespace: DesignerNamespaceLike | undefined,
  config: DesignerConfigLike | undefined,
): boolean {
  const name = namespace?.CommandNames?.Save
  if (namespace === undefined || config === undefined || typeof name !== 'string' || name === '') return false
  const command = namespace.getCommand?.(name)
  if (command === undefined || command === null || typeof command !== 'object') return false

  const previous = command.execute as RedirectingExecute | undefined
  const pristine = previous?.[PRISTINE] ?? previous
  const redirecting: RedirectingExecute = (context: unknown, ...rest: unknown[]): unknown => {
    const target = designerSaveTargetFor(context)
    if (target === undefined || !target.canWriteBack()) {
      return pristine?.apply(command, [context, ...rest])
    }
    target.save()
    return undefined
  }
  redirecting[PRISTINE] = pristine

  // Both dispatch paths. The registry object is what a global dispatch resolves;
  // the config entry is what the Designer registers for this instance.
  command.execute = redirecting
  config.commandMap = { ...(config.commandMap ?? {}), [name]: { ...command, execute: redirecting } }
  return true
}
