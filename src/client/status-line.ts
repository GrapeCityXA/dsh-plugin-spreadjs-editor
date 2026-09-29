/**
 * What the panel's state pill says, and which actions it carries.
 *
 * Kept out of the component because it is a small matrix that is easy to get
 * subtly wrong — a saved file must offer nothing, a returned buffer must offer a
 * way out, and precedence between the three states is the whole point.
 *
 * The three inputs are not independent in practice: a buffer that came back
 * (`offered`/`held`) is unsaved work by definition, so it outranks the workbook's
 * own dirty flag. `offered` is the sharper case — the file moved on disk — and
 * outranks `held`.
 *
 * `undefined` is the fourth answer: nothing to say. The pill floats over the sheet
 * instead of holding a row of its own, so it appears only while it carries
 * information; a permanently floating "已保存" would be furniture over someone's
 * spreadsheet, and where the platform publishes the header actions slot (DSH
 * 0.1.7+) the Save button already carries that mark.
 */
import type { EditorTextKey } from './locales.ts'

/** One state pill: its text, and the actions that make sense beside it. */
export interface StatusLine {
  /** Which string to show; always one of the unsaved-work keys. */
  readonly key: Extract<EditorTextKey, `unsaved.${string}`>
  /** Offer to put a kept buffer back into the Designer. */
  readonly canRestore: boolean
  /** Offer to throw the pending work away and reload the file from disk. */
  readonly canDiscard: boolean
}

/** What the panel currently holds. */
export interface StatusLineInput {
  /** The mounted workbook has edits that are not on disk. */
  readonly dirty: boolean
  /** A buffer from this session is on screen. */
  readonly hasHeld: boolean
  /** A buffer exists but the file changed on disk, so it is only offered. */
  readonly hasOffered: boolean
}

/**
 * Derive the state pill.
 * @param input - the panel's current dirty/buffer state.
 * @returns the text key and available actions, or `undefined` when everything the
 *   panel knows about is already on disk.
 */
export function statusLineFor(input: StatusLineInput): StatusLine | undefined {
  if (input.hasOffered) {
    return { key: 'unsaved.stale', canRestore: true, canDiscard: true }
  }
  if (input.hasHeld) {
    return { key: 'unsaved.restored', canRestore: false, canDiscard: true }
  }
  if (input.dirty) {
    return { key: 'unsaved.dirty', canRestore: false, canDiscard: true }
  }
  return undefined
}
