/**
 * Sidebar footer trigger: opens the Spreadsheet viewer. Registered into
 * `sidebar.footer.action` (list, root scope) sharing the viewer store handle.
 */
import type { PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ViewerStoreHandle } from './store.ts'

export interface ViewerTriggerProps extends PropsStore<ViewerStoreHandle> {
  /** Sidebar owner prop: false renders the compact rail form. */
  wide: boolean
}

export function ViewerTrigger({ wide, actions }: ViewerTriggerProps): React.JSX.Element {
  return (
    <button
      type="button"
      className="dsh-spreadjs-trigger"
      title="Open spreadsheet viewer"
      onClick={() => actions.open()}
    >
      <span aria-hidden="true">▦</span>
      {wide ? <span>Spreadsheets</span> : null}
    </button>
  )
}
