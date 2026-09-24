/**
 * SpreadJS as the harness Sidebar's document implementation for workbooks.
 *
 * The Sidebar's own `text` tab type claims every session file address and routes
 * the file to the best matching registered implementation, so this component
 * receives the file's identity and — because the definition asks for
 * `bytes-complete` — the whole file. Nothing here reads the workspace: the
 * harness owns the read, this component owns the document.
 *
 * Saving is the one operation the harness does not provide. Its filesystem seam
 * reads bytes but writes only text, and neither the harness nor an agent can
 * write a workbook, so this plugin carries that capability itself: the Designer
 * exports bytes and this component posts them to the plugin's own host route,
 * which resolves the target, refuses to clobber a file that changed since it was
 * opened, and replaces it atomically.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentContent, DocumentPreviewProps } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import { VersionLabel } from './VersionLabel.tsx'
import {
  SpreadsheetHost,
  type SpreadsheetFileAccess,
  type SpreadsheetHostHandle,
  type SpreadsheetSaveResult,
  type SpreadsheetSource,
  type StatusTone,
} from './SpreadsheetHost.tsx'
import { PROVIDER_ID, publishWorkbook } from './bridge.ts'
import { contentHash, parseSessionFileAddress } from './session-file-address.ts'

interface ConfigResponse {
  licenseKey: string
  designerLicenseKey?: string
}

/** One save request's answer from the plugin's host half. */
interface SaveResponse {
  ok?: boolean
  /** The written file's content hash, to guard the next save. */
  hash?: string
  error?: { code?: string; message?: string }
}

/** A conflict the user must resolve; kept apart from transport failures. */
class SaveConflictError extends Error {}

export function SpreadsheetDocument(props: DocumentPreviewProps): React.JSX.Element {
  const resourceAddress = props.resourceAddress
  const content = props.content as DocumentContent | undefined
  const address = useMemo(() => parseSessionFileAddress(resourceAddress), [resourceAddress])
  const bytes = content?.kind === 'bytes' ? content.data : undefined
  const source = useMemo<SpreadsheetSource | undefined>(() => {
    if (address === undefined || bytes === undefined) return undefined
    return { name: address.name, path: address.path, bytes }
  }, [address, bytes])

  const hostRef = useRef<SpreadsheetHostHandle | null>(null)
  /** Hash of the bytes currently on disk, as this panel last saw them. */
  const baselineRef = useRef<string | undefined>(undefined)
  const [licenseKey, setLicenseKey] = useState('')
  const [designerLicenseKey, setDesignerLicenseKey] = useState('')
  const [configReady, setConfigReady] = useState(false)
  const [status, setStatus] = useState('')
  const [statusTone, setStatusTone] = useState<StatusTone>('idle')
  /** The workbook is being read into the Designer; Save must wait for it. */
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Record the freshness token of what was opened. A save compares it with the
  // file on disk, so an edit made elsewhere between opening and saving surfaces
  // as a conflict instead of being silently overwritten.
  useEffect(() => {
    let alive = true
    baselineRef.current = undefined
    if (bytes === undefined) return () => { alive = false }
    void contentHash(bytes).then(hash => {
      if (alive) baselineRef.current = hash
    }).catch(() => { /* hashing is a guard, never a precondition to editing */ })
    return () => { alive = false }
  }, [bytes])

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
        setDesignerLicenseKey(config.designerLicenseKey ?? '')
        setConfigReady(true)
      })
      .catch(() => {
        if (alive) setConfigReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  // Offer the workbook on screen to dsh-spreadjs-driver. The panel mounts and
  // unmounts with the selected file, so the slot is republished on each address
  // change and cleared on unmount; the bridge itself is never re-attached.
  useEffect(() => publishWorkbook({
    id: PROVIDER_ID,
    getWorkbook: () => hostRef.current?.getWorkbook(),
    getNamespace: () => hostRef.current?.getNamespace(),
    getActivePath: () => resourceAddress,
    save: async () => {
      await hostRef.current?.save()
    },
  }), [resourceAddress])

  const fileAccess = useMemo<SpreadsheetFileAccess>(() => ({
    save: async (blob, target): Promise<SpreadsheetSaveResult> => {
      if (address === undefined) throw new Error('This document has no file address to save to.')
      const written = new Uint8Array(await blob.arrayBuffer())
      const params = new URLSearchParams({
        sessionId: address.sessionId,
        path: address.path,
        body: await contentHash(written),
      })
      const baseline = baselineRef.current
      if (baseline !== undefined) params.set('base', baseline)
      const response = await fetch(`/spreadjs/api/save?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: blob,
      })
      const body = await response.json().catch(() => null) as SaveResponse | null
      if (!response.ok || body?.ok !== true) {
        const message = body?.error?.message ?? `HTTP ${response.status}`
        if (response.status === 409) {
          // The file moved under us. Report it as such so the status line can say
          // what happened rather than looking like a transport failure.
          throw new SaveConflictError(message)
        }
        throw new Error(message)
      }
      baselineRef.current = body.hash ?? await contentHash(written)
      return 'saved'
    },
  }), [address])

  const handleStatus = useCallback((next: string, tone: StatusTone = 'idle') => {
    setStatus(next)
    setStatusTone(tone)
  }, [])

  // The panel's own Save. It calls the same write-back the Designer's Save
  // command was re-pointed at, so both paths write the workspace file and there
  // is no second, download-shaped meaning of "save" to fall into.
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await hostRef.current?.save()
    } finally {
      setSaving(false)
    }
  }, [])

  const noop = useCallback(() => {}, [])

  // `text` content means the owner did not deliver complete bytes, which only
  // happens for a definition that asked for pages. Say so instead of mounting an
  // editor over a partial file.
  if (source === undefined) {
    return (
      <div className="dsh-spreadjs-panel" role="region" aria-label="SpreadJS">
        <div className="dsh-spreadjs-empty">
          This workbook needs its complete file contents. Reopen it from the file tree.
        </div>
      </div>
    )
  }

  return (
    <div className="dsh-spreadjs-panel" role="region" aria-label={`SpreadJS: ${source.name}`}>
      <div className="dsh-spreadjs-header">
        <span className="dsh-spreadjs-title" title={address?.path ?? source.name}>{source.name}</span>
        <span className="dsh-spreadjs-spacer" />
        <button
          type="button"
          className="dsh-spreadjs-btn dsh-spreadjs-btn-primary"
          onClick={() => { void handleSave() }}
          disabled={!configReady || loading || saving}
          title={`Write the workspace file (Ctrl+S): ${address?.path ?? source.name}`}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="dsh-spreadjs-editor">
        <SpreadsheetHost
          ref={hostRef}
          source={source}
          licenseKey={licenseKey}
          designerLicenseKey={designerLicenseKey}
          ready={configReady}
          fileAccess={fileAccess}
          onStatus={handleStatus}
          onLoadingChange={setLoading}
          onNewWorkbook={noop}
        />
      </div>
      <div className="dsh-spreadjs-statusbar">
        <span className={`dsh-spreadjs-status-text dsh-spreadjs-status-${statusTone}`}>{status}</span>
        <VersionLabel />
      </div>
    </div>
  )
}
