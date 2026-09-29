/**
 * The Save As prompt.
 *
 * A target path cannot be asked for with the browser's own dialogs: they resolve
 * against the *user's* disk, while this path is relative to the session workspace
 * and is written by the plugin's host half. So the panel asks in its own DOM — and
 * being inside the panel is also why this is not a header action: the header has no
 * room for a form, and the panel already owns the overlay the toast uses.
 *
 * Checking the target happens on submit, not on every keystroke: a path that is
 * still being typed is not usually a mistake worth flagging, and a message that
 * appears and disappears while typing is noise. What can be checked here is checked
 * here; containment is left to the host, which is the only half that resolves the
 * workspace (see save-as.ts).
 */
import { useState, type FormEvent } from 'react'
import { editorText } from './locales.ts'
import { saveAsTargetError } from './save-as.ts'

export interface SaveAsPromptProps {
  /** The target suggested when the prompt opens. */
  readonly initialPath: string
  /** A write is in flight; nothing may be edited or submitted again. */
  readonly busy: boolean
  /** Why the last write failed, as text ready to show. */
  readonly error: string
  readonly onSubmit: (path: string) => void
  readonly onCancel: () => void
}

export function SaveAsPrompt({ initialPath, busy, error, onSubmit, onCancel }: SaveAsPromptProps): React.JSX.Element {
  const [path, setPath] = useState(initialPath)
  const [rejected, setRejected] = useState('')

  function submit(event: FormEvent): void {
    event.preventDefault()
    if (busy) return
    const target = path.trim()
    const problem = saveAsTargetError(target)
    if (problem !== undefined) {
      setRejected(editorText(problem))
      return
    }
    setRejected('')
    onSubmit(target)
  }

  const message = error !== '' ? error : rejected

  return (
    <div className="dsh-spreadjs-dialog-backdrop">
      <form className="dsh-spreadjs-dialog" onSubmit={submit}>
        <h2 className="dsh-spreadjs-dialog-title">{editorText('saveAs.title')}</h2>
        <label className="dsh-spreadjs-dialog-label" htmlFor="dsh-spreadjs-save-as-path">
          {editorText('saveAs.path')}
        </label>
        <input
          id="dsh-spreadjs-save-as-path"
          className="dsh-spreadjs-dialog-input"
          value={path}
          disabled={busy}
          onChange={event => setPath(event.target.value)}
          // The prompt is opened by a click on the header, so focus has to move into
          // the panel by itself: the user is expected to type here next.
          autoFocus
        />
        <p className="dsh-spreadjs-dialog-hint">{editorText('saveAs.hint')}</p>
        {message !== '' ? <p className="dsh-spreadjs-dialog-error" role="alert">{message}</p> : null}
        <div className="dsh-spreadjs-dialog-actions">
          <button type="button" className="dsh-spreadjs-dialog-button" disabled={busy} onClick={onCancel}>
            {editorText('saveAs.cancel')}
          </button>
          <button type="submit" className="dsh-spreadjs-dialog-button dsh-spreadjs-dialog-primary" disabled={busy}>
            {busy ? editorText('saveAs.saving') : editorText('saveAs.confirm')}
          </button>
        </div>
      </form>
    </div>
  )
}
