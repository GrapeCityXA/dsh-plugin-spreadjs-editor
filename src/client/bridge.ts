/**
 * Offer this plugin's live Designer to the spreadjs bridge.
 *
 * This plugin *owns* the workbook, so it decides who may operate on it: it
 * offers the document to `dsh-plugin-spreadjs-driver`'s `spreadjsHostBridge` service and
 * to nobody else. The workbook never leaves the page and is never serialized —
 * the bridge receives a live reference, which is exactly why a style written
 * through it appears in the Designer the moment it lands.
 *
 * The bridge is optional. With dsh-plugin-spreadjs-driver absent, or with a bridge that
 * cannot attach, this file does nothing and the editor behaves as before.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

/** A live workbook offered to the bridge, plus the few facts it needs. */
export interface SpreadjsWorkbookProvider {
  readonly id: string
  /** The workbook instance on screen, or undefined before the Designer exists. */
  getWorkbook(): unknown | undefined
  /** The SpreadJS namespace, so bridge-injected code can reach enums. */
  getNamespace?(): unknown
  /** Absolute path of the open file, for correlating with the agent's view. */
  getActivePath?(): string | undefined
  /** Persist the workbook to its file. */
  save?(): Promise<void>
}

/** The `spreadjsHostBridge` client service published by dsh-plugin-spreadjs-driver. */
export interface SpreadjsHostBridge {
  attach(provider: SpreadjsWorkbookProvider): () => void
  list?(): readonly string[]
}

/** Service name owned by dsh-plugin-spreadjs-driver; this file only names it. */
export const BRIDGE_SERVICE = 'spreadjsHostBridge'

/** The provider id the bridge will see. */
export const PROVIDER_ID = 'spreadjs-designer'

/**
 * The panel currently showing a workbook. The sidebar renders one file viewer at
 * a time, so a single slot is enough: the last panel to mount wins, and a panel
 * that unmounts only clears the slot while it still owns it.
 */
let active: SpreadjsWorkbookProvider | undefined

/** Offer `provider` to the bridge until the returned function is called. */
export function publishWorkbook(provider: SpreadjsWorkbookProvider): () => void {
  active = provider
  let released = false
  return () => {
    if (released) return
    released = true
    if (active === provider) active = undefined
  }
}

/**
 * The provider the bridge holds. It reads through to whichever panel is mounted,
 * so a panel that opens or closes later never needs a re-attach — and a bridge
 * that is installed *after* this plugin still finds the workbook.
 */
const DESIGNER: SpreadjsWorkbookProvider = {
  id: PROVIDER_ID,
  getWorkbook: () => active?.getWorkbook(),
  getNamespace: () => active?.getNamespace?.(),
  getActivePath: () => active?.getActivePath?.(),
  save: async () => {
    await active?.save?.()
  },
}

/**
 * Publish the live Designer to the bridge when one is installed. Returns a
 * disposer; calling it when nothing was attached is a no-op.
 */
export function attachToBridge(ctx: ClientContext): () => void {
  const fiber = ctx.inject([BRIDGE_SERVICE], (child) => {
    child.effect(() => {
      const bridge = child.get(BRIDGE_SERVICE) as SpreadjsHostBridge | undefined
      let dispose: (() => void) | undefined
      if (bridge !== undefined && typeof bridge.attach === 'function') {
        try {
          dispose = bridge.attach(DESIGNER)
        } catch (error) {
          console.error('[dsh-spreadjs-editor] spreadjs bridge attach failed:', error)
        }
      }
      return () => {
        try { dispose?.() } catch { /* already released */ }
      }
    }, 'dsh-spreadjs-editor: spreadjs bridge attachment')
  })
  return () => {
    try { fiber.dispose() } catch { /* already disposed */ }
  }
}
