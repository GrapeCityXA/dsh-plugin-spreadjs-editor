/**
 * dsh-spreadjs-editor — browser half.
 *
 * Two registrations share one root store handle:
 *  - `sidebar.footer.action` — trigger button that opens the viewer;
 *  - `shell.overlay`         — the full viewer panel (renders nothing closed).
 *
 * Both target slots are declared by other packages (ui-sidebar / ui-layout),
 * so registration waits on the declaration through `ctx.slots.inject()` rather
 * than assuming order. Service/slot/store types come from the published rc
 * harness packages; at runtime only react and the harness module-table rows
 * (@deepseek-ai/dsh-client-runtime, @deepseek-ai/dsh-client-ui-slots) are
 * external, all resolved by the client module table.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { ViewerTrigger } from './ViewerTrigger.tsx'
import { SpreadsheetViewer } from './SpreadsheetViewer.tsx'
import { createViewerStore } from './store.ts'
import { injectStyles } from './styles.ts'

export const name = 'dsh-spreadjs-editor'

/** Required service: the slot registry (provided by dsh-client-runtime). */
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  // One handle shared by both entries (root scope) -> one store instance.
  const store = createViewerStore()

  ctx.effect(() => injectStyles(), 'dsh-spreadjs-editor: styles')

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'spreadjs.open',
    order: 120,
    store,
  }, ViewerTrigger))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'spreadjs.viewer',
    order: 120,
    store,
  }, SpreadsheetViewer))
}
