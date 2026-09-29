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
 *
 * That slot renders for every previewed file, so this component draws nothing at all
 * unless the panel on screen is this plugin's own (see `actionsVisible`): a Save
 * beside a markdown file would be furniture rather than an action.
 */
import { useSyncExternalStore } from 'react'
import { editorText } from './locales.ts'
import {
  actionsVisible,
  panelSnapshot,
  saveActivePanel,
  saveAsActivePanel,
  subscribePanel,
} from './panel-actions.ts'

export function SpreadsheetActions(): React.JSX.Element | null {
  const panel = useSyncExternalStore(subscribePanel, panelSnapshot)

  // This slot exists on every previewed file, so the header is only ours to draw in
  // while this plugin's body is the one on screen; without that, Save and Save As
  // would appear next to files this plugin has nothing to do with.
  if (!actionsVisible(panel)) return null

  // A panel is on screen, so the buttons are real: only a load or a save in flight
  // makes them wait.
  const unavailable = panel.busy

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
