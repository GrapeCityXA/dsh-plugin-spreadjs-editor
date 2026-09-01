/**
 * dsh-spreadjs-editor -- browser half.
 *
 * Registers the SpreadJS file viewer into `dsh-better-sidebar`, which is
 * bundled by `@linxin666/dsh-web-all` (ui-all). The plugin has no generic
 * web-editors dependency: opening and saving go through better-sidebar's
 * session `/sidebar/file` and `/sidebar/upload` routes.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { SpreadsheetViewer } from './SpreadsheetViewer.tsx'
import type { SidebarService } from './better-sidebar.ts'
import { injectStyles } from './styles.ts'

export const name = 'dsh-spreadjs-editor'

/** Optional service discovery: the plugin stays idle if better-sidebar is absent. */
export const inject: string[] = []

const SIDEBAR_VIEWER = {
  id: 'spreadjs',
  title: 'SpreadJS',
  exts: ['xlsx', 'xlsm', 'csv', 'sjs', 'ssjson'],
  fetchStrategy: 'mediaUrl',
  priority: 0,
  component: SpreadsheetViewer,
} as const

export function apply(ctx: ClientContext): void {
  ctx.effect(() => injectStyles(), 'dsh-spreadjs-editor: styles')

  ctx.effect(() => {
    const fiber = ctx.inject(['betterSidebar'], (child) => {
      child.effect(() => {
        const service = child.get('betterSidebar') as SidebarService
        let dispose: (() => void) | undefined
        try {
          dispose = service.registerFileViewer({ ...SIDEBAR_VIEWER })
        } catch (error) {
          console.error('[dsh-spreadjs-editor] betterSidebar registration failed:', error)
        }
        return () => {
          try { dispose?.() } catch { /* already disposed */ }
        }
      }, 'dsh-spreadjs-editor: betterSidebar registration')
    })
    return () => {
      try { fiber.dispose() } catch { /* already disposed */ }
    }
  }, 'dsh-spreadjs-editor: betterSidebar adapter')
}
