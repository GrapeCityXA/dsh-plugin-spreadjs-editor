/**
 * What the panel's state line says, and which actions sit beside it.
 *
 * Kept out of the component because it is a small matrix that is easy to get
 * subtly wrong — a saved file must offer nothing, a returned buffer must offer a
 * way out, and precedence between the three states is the whole point.
 *
 * The three inputs are not independent in practice: a buffer that came back
 * (`offered`/`held`) is unsaved work by definition, so it outranks the workbook's
 * own dirty flag. `offered` is the sharper case — the file moved on disk — and
 * outranks `held`.
 */
import type { EditorTextKey } from './locales.ts'

/** One state line: its text, its colour tone, and the actions that make sense. */
export interface StatusLine {
  /** Which string to show; always one of the unsaved-work keys. */
  readonly key: Extract<EditorTextKey, `unsaved.${string}`>
  /** `dirty` gets the attention colour, `clean` the muted one. */
  readonly tone: 'clean' | 'dirty'
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
 * Derive the state line.
 * @param input - the panel's current dirty/buffer state.
 * @returns the text key, tone, and available actions.
 */
export function statusLineFor(input: StatusLineInput): StatusLine {
  if (input.hasOffered) {
    return { key: 'unsaved.stale', tone: 'dirty', canRestore: true, canDiscard: true }
  }
  if (input.hasHeld) {
    return { key: 'unsaved.restored', tone: 'dirty', canRestore: false, canDiscard: true }
  }
  if (input.dirty) {
    return { key: 'unsaved.dirty', tone: 'dirty', canRestore: false, canDiscard: true }
  }
  return { key: 'unsaved.saved', tone: 'clean', canRestore: false, canDiscard: false }
}
