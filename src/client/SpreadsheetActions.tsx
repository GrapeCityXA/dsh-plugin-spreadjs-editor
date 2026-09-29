/**
 * The document header's Save actions.
 *
 * Registered at `sidebar.right.tab.document.actions` (see index.ts) — the header
 * the harness itself draws above a previewed file, next to every other viewer's own
 * controls. That official place is what makes this plugin's Save a registration
 * instead of a rewrite of the Designer's private File-menu template.
 *
 * The header knows nothing about workbooks: it has no path it can act on and no
 * workbook to export. Both buttons therefore go through panel-actions.ts to the
 * panel currently on screen, which is what actually owns the write-back. The dot on
 * Save reports the same fact the panel's own state row does, in the place a
 * document's dirty state conventionally lives.
 */
import { useSyncExternalStore } from 'react'
import { editorText } from './locales.ts'
import { panelSnapshot, saveActivePanel, saveAsActivePanel, subscribePanel } from './panel-actions.ts'

export function SpreadsheetActions(): React.JSX.Element {
  const panel = useSyncExternalStore(subscribePanel, panelSnapshot)

  // No panel means no document body is mounted — a header for a hidden docked tab,
  // or a file this plugin does not render. Both actions would be no-ops, so they
  // present as unavailable rather than as buttons that quietly do nothing.
  const unavailable = !panel.available || panel.busy

  return (
    <div className="dsh-spreadjs-actions">
      <button
        type="button"
        className="dsh-spreadjs-actions-button"
        disabled={unavailable}
        title={panel.dirty ? editorText('actions.saveDirty') : editorText('actions.saveClean')}
        onClick={saveActivePanel}
      >
        {panel.dirty ? <span className="dsh-spreadjs-actions-dot" aria-hidden="true" /> : null}
        {editorText('actions.save')}
      </button>
      <button
        type="button"
        className="dsh-spreadjs-actions-button"
        disabled={unavailable}
        title={editorText('saveAs.title')}
        onClick={saveAsActivePanel}
      >
        {editorText('actions.saveAs')}
      </button>
    </div>
  )
}
