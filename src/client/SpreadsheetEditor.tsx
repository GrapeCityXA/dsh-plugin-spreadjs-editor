/**
 * webFileEditors adapter for the SpreadJS editor.
 *
 * This is the clean-web-editors registration path: it opens through
 * `dsh-plugin-web-editors` and reads/writes through the `/spreadjs` host
 * bridge. ui-all profiles use SpreadsheetViewer instead.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SpreadsheetHost, type SpreadsheetFileAccess, type StatusTone } from './SpreadsheetHost.tsx'
import type { WebFileEditorViewProps } from './web-file-editors.ts'

interface ConfigResponse {
  licenseKey: string
}

function fileApiPath(root: string | undefined, path: string): string {
  const params = new URLSearchParams()
  if (root !== undefined && root !== '') params.set('root', root)
  params.set('path', path)
  return `/spreadjs/api/file?${params.toString()}`
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
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

  const fileAccess = useMemo<SpreadsheetFileAccess>(() => ({
    fileUrl: (target) => fileApiPath(root, target),
    save: async (blob, target) => {
      const response = await fetch(fileApiPath(root, target), {
        method: 'PUT',
        body: blob,
      })
      if (response.status === 404) {
        downloadBlob(blob, basename(target))
        return 'download'
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? `HTTP ${response.status}`)
      }
      return 'saved'
    },
  }), [root])

  const handleStatus = useCallback((next: string, tone: StatusTone = 'idle') => {
    props.onStatus?.(next, tone)
  }, [props.onStatus])

  const noop = useCallback(() => {}, [])

  return (
    <div className="dsh-spreadjs-panel" role="region" aria-label={`SpreadJS editor: ${basename(path)}`}>
      <div className="dsh-spreadjs-editor">
        <SpreadsheetHost
          filePath={activePath}
          licenseKey={licenseKey}
          ready={configReady}
          fileAccess={fileAccess}
          onStatus={handleStatus}
          onLoadingChange={noop}
          onNewWorkbook={noop}
        />
      </div>
    </div>
  )
}
