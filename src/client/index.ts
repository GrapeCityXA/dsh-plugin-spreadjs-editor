/**
 * dsh-spreadjs-editor -- browser half.
 *
 * Registers SpreadJS as a document implementation of the harness's own right
 * Sidebar. Two registrations share one identity:
 *
 *  - `ctx.documentPreviews` claims the workbook suffixes. `priority` is left at
 *    its `extension` default, so this entry sorts ahead of the product's own
 *    builtins — none of which claims a workbook — and ahead of nothing else.
 *  - the `sidebar.right.tab.document` keyed slot provides the body under the
 *    same id. The Sidebar's `text` tab type already claims every session file
 *    address and routes it to the best matching implementation, so this plugin
 *    registers no tab type, pane, store, or layout of its own.
 *
 * This is the whole client-side surface: no third-party sidebar bundle is
 * required or consulted, and the document owner reads the file, so the plugin
 * performs no file reads.
 */
import type { Context } from '@deepseek-ai/cordis'
import { SpreadsheetDocument } from './SpreadsheetDocument.tsx'
import { attachToBridge } from './bridge.ts'
import { injectStyles } from './styles.ts'

export const name = 'dsh-spreadjs-editor'

/** Required client services. The two registries are part of the web shell. */
export const inject = ['documentPreviews', 'slots']

/** File suffixes this implementation renders, without a leading dot. */
export const SPREADSHEET_EXTENSIONS = ['xlsx', 'xlsm', 'csv', 'sjs', 'ssjson'] as const

/**
 * This implementation's identity in the document system: the name the metadata
 * registers under and the key its body registers under. Namespaced, because a
 * duplicate live id makes the registry throw.
 */
export const SPREADSHEET_DOCUMENT_ID = '@grapecity-software/dsh-spreadjs-editor/spreadsheet'

export function apply(ctx: Context): void {
  ctx.effect(() => injectStyles(), 'dsh-spreadjs-editor: styles')

  ctx.effect(() => ctx.documentPreviews.register({
    id: SPREADSHEET_DOCUMENT_ID,
    extensions: SPREADSHEET_EXTENSIONS,
    title: () => 'SpreadJS',
    // The editor needs the whole workbook, not a page window: this is the mode
    // the product's own image and PDF implementations use.
    loading: 'bytes-complete',
    wrap: false,
  }), 'dsh-spreadjs-editor: document metadata')

  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
    name: 'sidebar.right.tab.document',
    key: SPREADSHEET_DOCUMENT_ID,
  }, SpreadsheetDocument)), 'dsh-spreadjs-editor: document body')

  // Offer the live Designer to dsh-spreadjs-driver, when that plugin is present.
  // Nothing here depends on it: without a bridge this is a no-op and the editor
  // is unchanged.
  ctx.effect(() => attachToBridge(ctx), 'dsh-spreadjs-editor: spreadjs bridge adapter')
}
