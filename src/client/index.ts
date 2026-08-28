/**
 * dsh-spreadjs-editor — browser half.
 *
 * Two registrations share one root store handle:
 *  - `sidebar.footer.action` — trigger button that opens the viewer;
 *  - `shell.overlay`         — the full viewer panel (renders nothing closed).
 *
 * Both target slots are declared by other packages, so registration waits on
 * the declaration through `ctx.slots.inject()` rather than assuming order.
 * Service/slot types come from the typed facade (src/typed/dsh-facade.d.ts);
 * at runtime only react and @deepseek-ai/dsh-client-store are external, both
 * resolved by the harness module table.
 */
import type { Context } from '@deepseek-ai/cordis'
import { ViewerTrigger } from './ViewerTrigger.tsx'
import { SpreadsheetViewer } from './SpreadsheetViewer.tsx'
import { createViewerStore } from './store.ts'
import { injectStyles } from './styles.ts'

export const name = 'dsh-spreadjs-editor'

/** Required service: the slot registry (ui-renderer). */
export const inject = ['slots']

export function apply(ctx: Context): void {
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
