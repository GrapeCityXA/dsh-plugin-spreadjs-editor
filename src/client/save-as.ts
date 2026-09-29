/**
 * Save As: what target is acceptable, and what to suggest first.
 *
 * Two small rules that are easier to state and test than to keep straight inside a
 * dialog component.
 *
 * The extension matters more than it looks: the host writes whatever bytes it is
 * given, and the exporter picks its format from the target's extension — with an
 * unrecognised one it falls back to the SpreadJS JSON format. A file called
 * `book.txt` would therefore hold JSON, and this plugin does not register `.txt`,
 * so the file could not be opened again in the editor that wrote it. Only the
 * suffixes this plugin renders are accepted.
 */
import { extensionOf } from './session-file-address.ts'
import { editorText } from './locales.ts'

/** The suffixes a Save As target may use: exactly what this plugin registers. */
export const SAVE_AS_EXTENSIONS = ['xlsx', 'xlsm', 'csv', 'sjs', 'ssjson'] as const

/** Why a typed target cannot be used yet, as a text key; `undefined` means it can. */
export type SaveAsTargetError = 'saveAs.empty' | 'saveAs.badExtension'

/**
 * How a refused write is classified before it is worded: a name already in use, an
 * editor that is not ready, or anything else (a containment refusal, a transport
 * failure), which is reported as the host worded it.
 */
export type SaveAsFailure = 'conflict' | 'notReady' | 'other'

/**
 * Word a refused Save As write.
 *
 * The two cases the user can act on get their own sentence in their own language;
 * everything else keeps the host's own message, which names the actual rule that
 * refused it (a path outside the workspace, a payload over the size limit).
 *
 * @param failure - how the refusal was classified at the catch site.
 * @param message - the underlying message, used for the unclassified case.
 * @returns text ready to show in the prompt.
 */
export function saveAsFailureText(failure: SaveAsFailure, message: string): string {
  if (failure === 'conflict') return editorText('saveAs.exists')
  if (failure === 'notReady') return editorText('saveAs.notReady')
  return message
}

/**
 * Check a typed Save As target.
 *
 * Containment is deliberately not judged here: only the host resolves the session
 * workspace, and it refuses a write outside it. Guessing at that in the browser
 * would either duplicate the host's rule or contradict it.
 *
 * @param path - what the user typed.
 * @returns the reason to refuse, or `undefined` when the target looks usable.
 */
export function saveAsTargetError(path: string): SaveAsTargetError | undefined {
  const trimmed = path.trim()
  if (trimmed === '') return 'saveAs.empty'
  const extension = extensionOf(trimmed)
  if (extension === '' || !(SAVE_AS_EXTENSIONS as readonly string[]).includes(extension)) {
    return 'saveAs.badExtension'
  }
  return undefined
}

/**
 * The target suggested when the prompt opens: the same directory, the same
 * extension, and the caller's word for "a copy" appended to the name.
 *
 * @param currentPath - the file being edited.
 * @param suffix - the localized copy suffix, without punctuation.
 * @returns a workspace-relative path that does not collide with the current file.
 */
export function defaultSaveAsPath(currentPath: string, suffix: string): string {
  const slash = currentPath.lastIndexOf('/')
  const directory = slash >= 0 ? currentPath.slice(0, slash + 1) : ''
  const name = slash >= 0 ? currentPath.slice(slash + 1) : currentPath
  if (name === '') return `${directory}${suffix}`
  // The extension keeps its original spelling: only the stem gains the suffix.
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  return `${directory}${stem}-${suffix}${extension}`
}
