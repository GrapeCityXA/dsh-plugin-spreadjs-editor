/**
 * dsh-spreadjs-editor -- browser half.
 *
 * Registers the SpreadJS editor through whichever file-editor surface is
 * present:
 * - `dsh-better-sidebar` (ui-all) -> SpreadsheetViewer, session file routes
 * - `dsh-plugin-web-editors`      -> SpreadsheetEditor, /spreadjs bridge
 *
 * Both services are optional, so the plugin activates in either deployment.
 * Production profiles should install one adapter only. When both are mounted,
 * the default is `webFileEditors`; set `preferViewer: 'betterSidebar'` to use
 * ui-all instead. `auto` registers both and is migration/testing only.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { SpreadsheetViewer } from './SpreadsheetViewer.tsx'
import { SpreadsheetEditor } from './SpreadsheetEditor.tsx'
import type { SidebarService } from './better-sidebar.ts'
import type { WebFileEditors } from './web-file-editors.ts'
import { injectStyles } from './styles.ts'

export const name = 'dsh-spreadjs-editor'

/** No hard service dependency: this plugin waits for either adapter lazily. */
export const inject: string[] = []

const BETTER_SIDEBAR = 'betterSidebar'
const WEB_FILE_EDITORS = 'webFileEditors'
const ADAPTERS = [BETTER_SIDEBAR, WEB_FILE_EDITORS] as const

const SIDEBAR_VIEWER = {
  id: 'spreadjs',
  title: 'SpreadJS',
  exts: ['xlsx', 'xlsm', 'csv', 'sjs', 'ssjson'],
  fetchStrategy: 'mediaUrl',
  priority: 0,
  component: SpreadsheetViewer,
} as const

const WEB_EDITOR = {
  id: 'spreadjs',
  title: 'SpreadJS',
  extensions: ['.xlsx', '.xlsm', '.csv', '.sjs', '.ssjson'],
  component: SpreadsheetEditor,
} as const

/** Client plugin config merged from the plugin row. */
export interface ClientConfig {
  /**
   * Adapter selection when both are mounted. Defaults to `webFileEditors`
   * (commercial/clean). Use `betterSidebar` for ui-all. `auto` registers both
   * and is intended only for migration/testing.
   */
  preferViewer?: 'auto' | typeof BETTER_SIDEBAR | typeof WEB_FILE_EDITORS
}

export function apply(ctx: ClientContext, config: ClientConfig = {}): void {
  ctx.effect(() => injectStyles(), 'dsh-spreadjs-editor: styles')

  const preferViewer = config.preferViewer ?? WEB_FILE_EDITORS
  const disposers = new Map<string, () => void>()

  const registerFor = (adapter: string): void => {
    if (preferViewer === BETTER_SIDEBAR && adapter === WEB_FILE_EDITORS) return
    if (preferViewer === WEB_FILE_EDITORS && adapter === BETTER_SIDEBAR) return

    const service = ctx.get(adapter)
    const existing = disposers.get(adapter)
    if (service !== undefined && existing === undefined) {
      try {
        const dispose = adapter === BETTER_SIDEBAR
          ? (service as SidebarService).registerFileViewer({ ...SIDEBAR_VIEWER })
          : (service as WebFileEditors).register({ ...WEB_EDITOR })
        disposers.set(adapter, () => {
          try { dispose() } catch { /* already disposed */ }
        })
      } catch (error) {
        console.error('[dsh-spreadjs-editor] adapter registration failed:', error)
      }
    } else if (service === undefined && existing !== undefined) {
      existing()
      disposers.delete(adapter)
    }
  }

  ctx.effect(() => {
    const off = ctx.on('internal/service', (changed: string) => {
      if (changed === BETTER_SIDEBAR || changed === WEB_FILE_EDITORS) {
        registerFor(changed)
      }
    })
    for (const adapter of ADAPTERS) registerFor(adapter)
    return () => {
      off()
      for (const dispose of disposers.values()) dispose()
      disposers.clear()
    }
  }, 'dsh-spreadjs-editor: adapter registration')
}
