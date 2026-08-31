/**
 * SpreadJS editor component registered through `webFileEditors`.
 *
 * The generic plugin owns the panel and passes the resolved file path. This
 * component keeps the /spreadjs host bridge as the only file-access seam: it
 * fetches the SpreadJS license config and loads the requested file through
 * SpreadsheetHost. It is intentionally view-first — no custom toolbar, so the
 * spreadsheet and the Designer ribbon are the only interactive chrome.
 */
import { useCallback, useEffect, useState } from 'react'
import { SpreadsheetHost } from './SpreadsheetHost.tsx'
import type { StatusTone } from './SpreadsheetHost.tsx'
import type { WebFileEditorViewProps } from './web-file-editors.ts'

interface ConfigResponse {
  licenseKey: string
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function SpreadsheetEditor(props: WebFileEditorViewProps): React.JSX.Element {
  const { path, root } = props
  const [activePath, setActivePath] = useState<string | undefined>(path)
  const [licenseKey, setLicenseKey] = useState('')
  const [configReady, setConfigReady] = useState(false)

  useEffect(() => {
    setActivePath(path)
  }, [path])

  useEffect(() => {
    let alive = true
    void fetch('/spreadjs/api/config')
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return await response.json() as ConfigResponse
      })
      .then(config => {
        if (!alive) return
        setLicenseKey(config.licenseKey ?? '')
        setConfigReady(true)
      })
      .catch(() => {
        if (alive) setConfigReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const handleStatus = useCallback((next: string, tone: StatusTone = 'idle') => {
    props.onStatus?.(next, tone)
  }, [props.onStatus])

  const noop = useCallback(() => {}, [])

  return (
    <div className="dsh-spreadjs-panel" role="region" aria-label={`SpreadJS editor: ${basename(path)}`}>
      <div className="dsh-spreadjs-editor">
        <SpreadsheetHost
          filePath={activePath}
          root={root}
          licenseKey={licenseKey}
          ready={configReady}
          onStatus={handleStatus}
          onLoadingChange={noop}
          onNewWorkbook={noop}
        />
      </div>
    </div>
  )
}
