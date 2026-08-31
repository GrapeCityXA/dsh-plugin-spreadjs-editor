/**
 * dsh-spreadjs-editor — browser half.
 *
 * Registers the SpreadJS editor into the generic `webFileEditors` service
 * provided by `dsh-plugin-web-editors`. The service is a hard dependency:
 * the client half waits for it before activating, so the editor registration
 * is never lost to plugin activation order.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { SpreadsheetEditor } from './SpreadsheetEditor.tsx'
import { injectStyles } from './styles.ts'
import type { WebFileEditors } from './web-file-editors.ts'

export const name = 'dsh-spreadjs-editor'

/** Hard dependency: the generic editor framework must be mounted in the same Web profile. */
export const inject = ['webFileEditors']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => injectStyles(), 'dsh-spreadjs-editor: styles')

  const editors = ctx.get('webFileEditors') as WebFileEditors | undefined
  if (editors === undefined) return

  ctx.effect(() => editors.register({
    id: 'spreadjs',
    title: 'SpreadJS',
    extensions: ['.xlsx', '.xlsm', '.csv', '.sjs', '.ssjson'],
    component: SpreadsheetEditor,
  }), 'dsh-spreadjs-editor: webFileEditors registration')
}
