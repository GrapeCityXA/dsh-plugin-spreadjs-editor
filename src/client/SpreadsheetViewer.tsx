/**
 * BetterSidebar file viewer for SpreadJS workbooks.
 *
 * ui-all mounts dsh-better-sidebar; this component is registered through its
 * `registerFileViewer` API. Files are read from the sidebar `/sidebar/file`
 * media route and written back through `/sidebar/upload`, so the viewer works
 * inside the active session's workspace without the generic web editor plugin.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SpreadsheetHost, type SpreadsheetFileAccess, type StatusTone } from './SpreadsheetHost.tsx'
import {
  sidebarFileUrl,
  sidebarUploadUrl,
  type SidebarFileViewerProps,
} from './better-sidebar.ts'

interface ConfigResponse {
  licenseKey: string
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function SpreadsheetViewer(props: SidebarFileViewerProps): React.JSX.Element {
  const { scope, path } = props
  const [licenseKey, setLicenseKey] = useState('')
  const [configReady, setConfigReady] = useState(false)
  const [status, setStatus] = useState('')
  const [statusTone, setStatusTone] = useState<StatusTone>('idle')

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

  const fileAccess = useMemo<SpreadsheetFileAccess>(() => ({
    fileUrl: (target) => sidebarFileUrl(scope, target),
    save: async (blob, target) => {
      const response = await fetch(sidebarUploadUrl(scope, target), {
        method: 'POST',
        body: blob,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(body?.error?.message ?? `HTTP ${response.status}`)
      }
      return 'saved'
    },
  }), [scope.cwd, scope.sessionId])

  const handleStatus = useCallback((next: string, tone: StatusTone = 'idle') => {
    setStatus(next)
    setStatusTone(tone)
  }, [])

  const noop = useCallback(() => {}, [])

  return (
    <div className="dsh-spreadjs-panel" role="region" aria-label={`SpreadJS: ${basename(path)}`}>
      <div className="dsh-spreadjs-editor">
        <SpreadsheetHost
          filePath={path}
          licenseKey={licenseKey}
          ready={configReady}
          fileAccess={fileAccess}
          onStatus={handleStatus}
          onLoadingChange={noop}
          onNewWorkbook={noop}
        />
      </div>
      {status !== '' && (
        <div className={`dsh-spreadjs-statusbar dsh-spreadjs-status-${statusTone}`}>{status}</div>
      )}
    </div>
  )
}
