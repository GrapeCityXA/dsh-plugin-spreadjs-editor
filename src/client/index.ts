/**
 * dsh-spreadjs-editor -- browser half.
 *
 * Registers SpreadJS as a document implementation of the harness's own right
 * Sidebar. Two registrations share one identity:
 *
 *  - `ctx.documentPreviews` claims the workbook suffixes. `priority` is left at
 *    its `extension` default, which is what keeps this implementation ahead of
 *    the product's own builtins — since DSH 0.1.7 one of those builtins, a
 *    read-only Excel preview, does claim `xlsx`/`xls`/`csv`/`tsv`, so the two
 *    are now alternatives rather than one being a fallback for the other.
 *  - the `sidebar.right.tab.document` keyed slot provides the body under the
 *    same id. The Sidebar's `text` tab type already claims every session file
 *    address and routes it to the best matching implementation, so this plugin
 *    registers no tab type, pane, store, or layout of its own.
 *  - the `sidebar.right.tab.document.actions` list slot adds the file's own Save
 *    and Save As to the header the harness draws above it. That published slot is
 *    where the editor's Save lives; the Designer's private File-menu template is
 *    customised as well, but nothing depends on that rewrite succeeding.
 *
 * This is the whole client-side surface: no third-party sidebar bundle is
 * required or consulted, and the document owner reads the file, so the plugin
 * performs no file reads.
 *
 * The editor's own light/dark pair is chosen from the harness's resolved palette
 * (`theme`, see ds-theme.ts). The panel's chrome needs no such help: it reads the
 * `--dsw-*` tokens the harness swaps for it. The display name comes from the
 * harness locale when one is composed in (see locales.ts).
 *
 * Leaving a tab is never blocked, because the platform gives a document body
 * nothing to veto with: a hidden tab unmounts its body, and a close is
 * synchronous. What a dirty body's edits do instead is survive the unmount as a
 * buffer, keyed by tab and by file (see unsaved.ts).
 */
import type { Context } from '@deepseek-ai/cordis'
import { SpreadsheetActions } from './SpreadsheetActions.tsx'
import { SpreadsheetDocument } from './SpreadsheetDocument.tsx'
import { attachToBridge } from './bridge.ts'
import { attachHarnessTheme } from './ds-theme.ts'
import { attachEditorLocale, editorTitle } from './locales.ts'
import { injectStyles } from './styles.ts'
import { watchUnloadGuard } from './unsaved.ts'

export const name = 'dsh-spreadjs-editor'

/** Required client services. The two registries are part of the web shell. */
export const inject = ['documentPreviews', 'slots', 'theme']

/** File suffixes this implementation renders, without a leading dot. */
export const SPREADSHEET_EXTENSIONS = ['xlsx', 'xlsm', 'csv', 'sjs', 'ssjson'] as const

/**
 * The suffixes among {@link SPREADSHEET_EXTENSIONS} whose bytes are not text.
 *
 * The harness drops the plain-text fallback for a suffix as soon as *any*
 * registration declares it binary, and until DSH 0.1.7 nothing declared one: the
 * product's builtins covered only the document types they rendered. Its Excel
 * preview now declares `xlsx`/`xls`, which covers those two by accident of
 * someone else's registration — `xlsm`, `sjs` and `ssjson` are still undeclared
 * and could therefore be offered as text, showing a workbook as mojibake. All
 * four are ZIP or JSON containers, so all four belong here; `csv` stays text,
 * matching the product's own split.
 *
 * Every entry must appear in {@link SPREADSHEET_EXTENSIONS} as well: the
 * registry rejects a stray, and it rejects it by throwing, which would take the
 * whole editor down rather than just this file type.
 */
export const SPREADSHEET_BINARY_EXTENSIONS = ['xlsx', 'xlsm', 'sjs', 'ssjson'] as const

/**
 * This implementation's identity in the document system: the name the metadata
 * registers under and the key its body registers under. Namespaced, because a
 * duplicate live id makes the registry throw.
 */
export const SPREADSHEET_DOCUMENT_ID = '@grapecity-software/dsh-spreadjs-editor/spreadsheet'

export function apply(ctx: Context): void {
  ctx.effect(() => injectStyles(), 'dsh-spreadjs-editor: styles')

  // Read the harness palette before any panel mounts, so the first Designer is
  // built on the scheme the user chose rather than the one the OS reports.
  ctx.effect(() => attachHarnessTheme(ctx), 'dsh-spreadjs-editor: harness theme')

  // Optional: the display name the harness lists this viewer under, in the
  // harness's language. Without a locale service the shipped Chinese name is
  // used, which is what the rest of this editor's own copy is written in.
  ctx.effect(() => attachEditorLocale(ctx), 'dsh-spreadjs-editor: locale')

  ctx.effect(() => ctx.documentPreviews.register({
    id: SPREADSHEET_DOCUMENT_ID,
    extensions: SPREADSHEET_EXTENSIONS,
    binaryExtensions: SPREADSHEET_BINARY_EXTENSIONS,
    title: editorTitle,
    // The editor needs the whole workbook, not a page window: this is the mode
    // the product's own image and PDF implementations use.
    loading: 'bytes-complete',
    wrap: false,
  }), 'dsh-spreadjs-editor: document metadata')

  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
    name: 'sidebar.right.tab.document',
    key: SPREADSHEET_DOCUMENT_ID,
  }, SpreadsheetDocument)), 'dsh-spreadjs-editor: document body')

  // Save acts on the file, so it belongs in the header the harness draws above a
  // previewed file, next to every other viewer's own controls — not inside the
  // Designer's chrome. Two facts make that the right home: the slot is published by
  // the platform (so it survives Designer release changes), and it is rendered for
  // the file rather than by the plugin, so a Save is reachable without knowing
  // anything about SpreadJS. The buttons rout back into the panel on screen through
  // panel-actions.ts, which is where the workbook actually lives.
  //
  // `order` is the list slot's documented display order (`KindOptions`: "List display
  // order"; entries sort by priority, then order, then registration sequence), and
  // -10 is the harness's own convention for "first in a header actions list" —
  // `dsh-client-ui-agent-preset` puts its session-header label at exactly -10. Left
  // unset, this entry and the product's own `open-in-app` both sit at 0, and which
  // one comes first is decided by plugin load order: an accident, and one that would
  // also push the unsaved mark away from where the eye lands when a file is opened.
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document.actions', () => ctx.slots.register({
    name: 'sidebar.right.tab.document.actions',
    id: 'spreadjs-save',
    order: -10,
  }, SpreadsheetActions)), 'dsh-spreadjs-editor: document header actions')

  // Unsaved work is the body's business (see unsaved.ts): it keeps a dirty
  // workbook alive across an unmount, and a tab close only costs the tab-keyed
  // copy of it. What no body can do is outlive the page, so the one veto the
  // platform does have — the browser's own unload prompt — is claimed here, once,
  // and only while something would actually be lost.
  ctx.effect(() => watchUnloadGuard(), 'dsh-spreadjs-editor: unsaved work guard')

  // Offer the live Designer to dsh-spreadjs-driver, when that plugin is present.
  // Nothing here depends on it: without a bridge this is a no-op and the editor
  // is unchanged.
  ctx.effect(() => attachToBridge(ctx), 'dsh-spreadjs-editor: spreadjs bridge adapter')
}
