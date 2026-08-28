/**
 * Spreadsheet viewer overlay. Registered into `shell.overlay` (list, root
 * scope) sharing the viewer store handle with the sidebar trigger: the
 * component reads `open` and renders nothing while closed.
 */
import { useEffect, useMemo, useState } from 'react'
import type { PropsStore, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { SpreadsheetHost } from './SpreadsheetHost.tsx'
import type { ViewerStoreHandle } from './store.ts'

export interface SpreadsheetViewerProps extends PropsStore<ViewerStoreHandle> {
  /** Global standard prop supplied by the workspace runtime. */
  useWorkspaces: SnapshotSelectorHook<WorkspaceListState>
}

interface ListItem {
  name: string
  rel: string
  path: string
  size: number
}

interface RootsResponse { cwd: string }
interface ConfigResponse { licenseKey: string }
interface ListResponse { files: ListItem[] }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SpreadsheetViewer({ useStore, actions, useWorkspaces }: SpreadsheetViewerProps): React.JSX.Element | null {
  const open = useStore(state => state.open)
  if (!open) return null
  return <ViewerPanel useStore={useStore} actions={actions} useWorkspaces={useWorkspaces} />
}

function ViewerPanel({
  useStore,
  actions,
  useWorkspaces,
}: SpreadsheetViewerProps): React.JSX.Element {
  const root = useStore(state => state.root)
  const selected = useStore(state => state.selected)
  const refreshToken = useStore(state => state.refreshToken)
  const workspaceOptions = useWorkspaces(state => state.items.map(item => ({ path: item.path, title: item.title })))

  const [cwd, setCwd] = useState<string | undefined>()
  const [licenseKey, setLicenseKey] = useState('')
  const [files, setFiles] = useState<readonly ListItem[]>([])
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [listError, setListError] = useState('')

  // Fetch host defaults (browse root fallback + license key).
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const roots = await fetch('/spreadjs/api/roots').then(r => r.json()) as RootsResponse
        const config = await fetch('/spreadjs/api/config').then(r => r.json()) as ConfigResponse
        if (!alive) return
        setCwd(roots.cwd)
        setLicenseKey(config.licenseKey ?? '')
      } catch {
        if (alive) setCwd(undefined)
      }
    })()
    return () => { alive = false }
  }, [])

  // Fetch the file list for the current root.
  useEffect(() => {
    let alive = true
    setListState('loading')
    const params = new URLSearchParams()
    if (root !== undefined && root !== '') params.set('root', root)
    void fetch(`/spreadjs/api/list?${params.toString()}`)
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return await response.json() as ListResponse
      })
      .then(data => {
        if (!alive) return
        setFiles(data.files)
        setListState('ready')
        setListError('')
      })
      .catch((error: unknown) => {
        if (!alive) return
        setListState('error')
        setListError(error instanceof Error ? error.message : String(error))
      })
    return () => { alive = false }
  }, [root, refreshToken])

  const groups = useMemo(() => {
    const map = new Map<string, ListItem[]>()
    for (const file of files) {
      const dir = file.rel.includes('/') ? file.rel.slice(0, file.rel.lastIndexOf('/')) : ''
      const bucket = map.get(dir) ?? []
      bucket.push(file)
      map.set(dir, bucket)
    }
    return [...map.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
  }, [files])

  return (
    <div className="dsh-spreadjs-backdrop" onClick={e => { if (e.target === e.currentTarget) actions.close() }}>
      <div className="dsh-spreadjs-panel" role="dialog" aria-label="Spreadsheet viewer">
        <div className="dsh-spreadjs-header">
          <h2 className="dsh-spreadjs-title">Spreadsheet Viewer</h2>
          <select
            className="dsh-spreadjs-root-select"
            value={root ?? ''}
            onChange={e => actions.setRoot(e.target.value === '' ? undefined : e.target.value)}
            title="Browse root"
          >
            <option value="">{cwd ?? 'Current working directory'}</option>
            {workspaceOptions.map(ws => (
              <option key={ws.path} value={ws.path}>{ws.title}</option>
            ))}
          </select>
          <span className="dsh-spreadjs-spacer" />
          <button type="button" className="dsh-spreadjs-btn" onClick={() => actions.refresh()}>
            Refresh
          </button>
          <button type="button" className="dsh-spreadjs-btn" onClick={() => actions.close()}>
            Close
          </button>
        </div>

        <div className="dsh-spreadjs-body">
          <div className="dsh-spreadjs-filelist">
            {listState === 'loading' ? (
              <div className="dsh-spreadjs-filelist-status">Loading files…</div>
            ) : listState === 'error' ? (
              <div className="dsh-spreadjs-filelist-status">Failed to list files: {listError}</div>
            ) : files.length === 0 ? (
              <div className="dsh-spreadjs-filelist-status">No spreadsheet files found under this root.</div>
            ) : (
              groups.map(([dir, items]) => (
                <div key={dir || '/'}>
                  <div className="dsh-spreadjs-file-group">{dir === '' ? '/' : dir}</div>
                  {items.map(file => (
                    <button
                      key={file.path}
                      type="button"
                      className={`dsh-spreadjs-file${file.path === selected ? ' dsh-spreadjs-file-selected' : ''}`}
                      onClick={() => actions.select(file.path)}
                    >
                      <span className="dsh-spreadjs-file-name">{file.name}</span>
                      <span className="dsh-spreadjs-file-meta">{formatSize(file.size)}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
          <SpreadsheetHost filePath={selected} root={root} licenseKey={licenseKey} />
        </div>
      </div>
    </div>
  )
}
