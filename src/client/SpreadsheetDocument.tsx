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
 *
 * A body is unmounted whenever the user switches to another tab, and the platform
 * provides no way to veto a close, so leaving is never blocked here. Instead this
 * component is the half that remembers: it decides, before the Designer is
 * allowed to load anything, whether the tab has edits of its own to come back to
 * (see unsaved.ts), and it is what the host hands a dirty workbook to when its
 * body goes away.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentContent, DocumentPreviewProps } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import {
  SpreadsheetHost,
  WorkbookNotReadyError,
  type SpreadsheetFileAccess,
  type SpreadsheetHostHandle,
  type SpreadsheetLoad,
  type SpreadsheetSaveResult,
  type SpreadsheetSource,
  type StatusTone,
} from './SpreadsheetHost.tsx'
import { PROVIDER_ID, publishWorkbook } from './bridge.ts'
import { HASH_PENDING, HASH_UNAVAILABLE, decideLoad, type HeldBuffer } from './load-decision.ts'
import { editorText } from './locales.ts'
import { publishPanel, refreshPanel } from './panel-actions.ts'
import { defaultSaveAsPath, saveAsFailureText } from './save-as.ts'
import { SaveAsPrompt } from './SaveAsPrompt.tsx'
import { contentHash, parseSessionFileAddress, sessionFileAddressFor } from './session-file-address.ts'
import { statusLineFor } from './status-line.ts'
import {
  forgetPath,
  forgetTab,
  setTabDirty,
  stashWorkbook,
} from './unsaved.ts'

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

/** The self-directed tab operation this body needs: navigating its own tab. */
interface SpreadsheetTabActionsLike {
  openResource: (address: string, options?: { readonly replaceTab?: boolean }) => void
}

/**
 * The tab facts this body relies on, as the platform's own bodies read them
 * (`const { tab } = props.useTabInfo()` in the product's Office body).
 *
 * `signal` is the whole lifetime story: it aborts when the tab *record* is gone,
 * and deliberately not when the tab is merely hidden or the session switches —
 * which is why a hidden tab's editor comes back from a buffer rather than being
 * treated as closed.
 *
 * Read through this shape rather than the platform type because the record's type
 * (`TabRecord`) is not resolvable from this package — it belongs to a build-time
 * internal module — so a shape mismatch would otherwise reach the DOM unchecked.
 */
interface SpreadsheetTabInfoLike {
  readonly tab?: {
    readonly id?: unknown
    readonly signal?: unknown
    readonly actions?: unknown
  }
}

/** The account a panel uses when the tab record is not what it expects. */
const UNTRACKED_TAB = 'untracked'

/**
 * A tab record's id, abort signal and actions, or the neutral fallback for each.
 *
 * `actions` is read here too because Save As ends by navigating *this* tab to the
 * file it wrote, and only the tab can do that: the panel cannot open a file, it can
 * only be one. A record without actions loses the automatic switch, not the save.
 */
function readTab(info: SpreadsheetTabInfoLike | undefined): {
  id: string
  signal: AbortSignal | undefined
  actions: SpreadsheetTabActionsLike | undefined
} {
  const id = info?.tab?.id
  const signal = info?.tab?.signal
  const actions = info?.tab?.actions
  return {
    id: typeof id === 'string' && id !== '' ? id : UNTRACKED_TAB,
    // `AbortSignal` exists in this runtime; a record that hands over something else
    // simply loses the close notification, not the buffer.
    signal: typeof AbortSignal !== 'undefined' && signal instanceof AbortSignal ? signal : undefined,
    actions: typeof (actions as SpreadsheetTabActionsLike | undefined)?.openResource === 'function'
      ? actions as SpreadsheetTabActionsLike
      : undefined,
  }
}

/**
 * What the Designer should hold, together with the inputs that decision was made
 * for. Keeping the inputs *with* it is what makes a fresh read of the same file
 * fall back to "not decided yet" in the very render the new bytes arrive, so a
 * stale buffer is never flashed into the Workbook.
 */
interface LoadDecision {
  readonly tabId: string
  readonly path: string
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly load: SpreadsheetLoad
}

export function SpreadsheetDocument(props: DocumentPreviewProps): React.JSX.Element {
  // Read once per render, defensively: the panel must open even if the record is
  // not the shape the platform documents (see readTab).
  const { id: tabId, signal: tabSignal, actions: tabActions } = readTab(props.useTabInfo() as unknown as SpreadsheetTabInfoLike)
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
  /**
   * Live copies of the two facts the document header's buttons report, read there
   * outside React: `dirty` decides whether Save carries a mark, `busy` whether it
   * waits. State alone cannot be read from a callback, and republishing the panel on
   * every keystroke would churn the header instead.
   */
  const dirtyRef = useRef(false)
  const busyRef = useRef(false)
  /** The pending "this message fades" timer, if one is running. */
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [designerLicenseKey, setDesignerLicenseKey] = useState('')
  const [configReady, setConfigReady] = useState(false)
  const [status, setStatus] = useState('')
  const [statusTone, setStatusTone] = useState<StatusTone>('idle')
  /** The workbook is being read into the Designer; Save must wait for it. */
  const [loading, setLoading] = useState(false)
  /** The mounted workbook holds edits that are not on disk. */
  const [dirty, setDirty] = useState(false)
  /**
   * SHA-256 of the bytes on disk, or {@link HASH_PENDING} / {@link HASH_UNAVAILABLE}
   * while that is not known. Nothing may wait on a hash that will never arrive, so
   * the unavailable case is decided like a version mismatch rather than left open.
   * The save guard reads the same value by ref, not from here.
   */
  const [diskHash, setDiskHash] = useState<string>(HASH_PENDING)
  const [decision, setDecision] = useState<LoadDecision | undefined>(undefined)
  /** The buffer this panel is showing. */
  const [held, setHeld] = useState<HeldBuffer | undefined>(undefined)
  /** A buffer that cannot be applied on its own, because the file changed under it. */
  const [offered, setOffered] = useState<HeldBuffer | undefined>(undefined)
  /** The Save As prompt is open. */
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  /** A Save As write is in flight. */
  const [saveAsBusy, setSaveAsBusy] = useState(false)
  /** Why the last Save As write was refused, as text ready to show. */
  const [saveAsError, setSaveAsError] = useState('')

  const handleStatus = useCallback((next: string, tone: StatusTone = 'idle') => {
    setStatus(next)
    setStatusTone(tone)
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
    // An in-flight operation and a failure hold their message until something
    // replaces them; "Loaded x" or "Saved x" is transient.
    if (next === '' || tone === 'busy' || tone === 'error') return
    hideTimerRef.current = setTimeout(() => { setStatus('') }, 4000)
  }, [])

  const handleDirtyChange = useCallback((next: boolean) => {
    dirtyRef.current = next
    setDirty(next)
    // The page-close guard asks the module, not this component: a body that
    // unmounts stops being a live editor but its buffer must still count.
    setTabDirty(tabId, next)
    // The header's Save button marks itself from the same fact.
    refreshPanel()
  }, [tabId])

  /** Loading covers the load and every write, which is exactly what Save waits for. */
  const handleLoadingChange = useCallback((next: boolean) => {
    busyRef.current = next
    setLoading(next)
    refreshPanel()
  }, [])

  /** The host is leaving with edits: keep them under this tab and this file. */
  const handleUnsaved = useCallback((workbook: object) => {
    if (address === undefined) return
    stashWorkbook({
      path: address.path,
      tabId,
      // The hash is what lets a later body tell whether this buffer still fits the
      // file it came from; it is undefined only if the read beat the hashing.
      baseline: baselineRef.current,
      workbook,
      at: Date.now(),
    })
  }, [address, tabId])

  // Record the freshness token of what was opened. A save compares it with the
  // file on disk, so an edit made elsewhere between opening and saving surfaces
  // as a conflict instead of being silently overwritten.
  useEffect(() => {
    let alive = true
    baselineRef.current = undefined
    setDiskHash(HASH_PENDING)
    if (bytes === undefined) return () => { alive = false }
    void contentHash(bytes).then(hash => {
      if (!alive) return
      baselineRef.current = hash
      setDiskHash(hash)
    }).catch(() => {
      // No digest (no secure context): the panel still opens, and a kept buffer is
      // then treated as unverifiable rather than waited for forever.
      if (alive) setDiskHash(HASH_UNAVAILABLE)
    })
    return () => { alive = false }
  }, [bytes])

  // What the Designer opens with — decided before the host is allowed to load
  // anything at all, so a buffer is never preceded by a parse of the file it
  // replaces. The rules themselves are in load-decision.ts, where they are unit
  // tested; this effect only maps one outcome onto the panel's state.
  useEffect(() => {
    if (address === undefined || bytes === undefined) {
      setDecision(undefined)
      setHeld(undefined)
      setOffered(undefined)
      return
    }
    const path = address.path
    const outcome = decideLoad(tabId, path, diskHash)
    if (outcome.kind === 'deferred') return
    if (outcome.kind === 'buffer') {
      // One line per open, next to the file menu's and the about button's: the
      // console is where this plugin says why the panel is doing what it does.
      console.info(`[dsh-spreadjs-editor] restoring unsaved changes for ${path} (from this ${outcome.buffer.from === 'tab' ? 'tab' : 'session'})`)
      setHeld(outcome.buffer)
      setOffered(undefined)
      setDecision({ tabId, path, bytes, load: { kind: 'buffer', workbook: outcome.buffer.workbook } })
      return
    }
    if (outcome.kind === 'offer') {
      console.info(`[dsh-spreadjs-editor] unsaved changes for ${path} were kept, but the file changed on disk; offering them`)
    }
    setHeld(undefined)
    setOffered(outcome.kind === 'offer' ? outcome.buffer : undefined)
    setDecision({ tabId, path, bytes, load: { kind: 'file' } })
  }, [address, bytes, tabId, diskHash])

  // Follow the harness palette for the panel's own copy.
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

  // Offer this panel to the document header's Save actions (panel-actions.ts). The
  // header is outside the panel and cannot see the workbook, so Save and Save As are
  // registered there and routed here. Republished on an address change only: the
  // callbacks read the live dirty and busy flags through refs, so typing does not
  // republish, and the header reads them again whenever refreshPanel says so.
  useEffect(() => publishPanel({
    canSave: () => address !== undefined && hostRef.current !== null,
    isDirty: () => dirtyRef.current,
    isBusy: () => busyRef.current,
    save: () => { void hostRef.current?.save() },
    requestSaveAs: () => {
      setSaveAsError('')
      setSaveAsOpen(true)
    },
  }), [address])

  // The tab record is gone: this body will never mount again, so its tab-keyed
  // buffer is spent. The copy keyed by the file's path stays — that is what makes
  // closing a tab and reopening the file recoverable — and is dropped when the
  // file is saved or the user discards it.
  useEffect(() => {
    const onAbort = (): void => { forgetTab(tabId) }
    if (tabSignal === undefined) return
    if (tabSignal.aborted) {
      onAbort()
      return
    }
    tabSignal.addEventListener('abort', onAbort)
    return () => tabSignal.removeEventListener('abort', onAbort)
  }, [tabId, tabSignal])

  // A live dirty flag describes a mounted editor; once this body is gone, what it
  // left behind is the buffer the host handed over during unmount.
  useEffect(() => () => { setTabDirty(tabId, false) }, [tabId])

  /**
   * Post one workbook to the host's write route.
   *
   * `base` is the freshness token of the file being *replaced*; Save As passes none,
   * because there is no file to replace and the host turns the missing token into a
   * refusal when the name is taken. A 409 is separated from a transport failure here,
   * once, so both callers can word it as what it is.
   */
  const writeWorkbook = useCallback(async (
    blob: Blob,
    path: string | undefined,
    base: string | undefined,
  ): Promise<SaveResponse> => {
    if (address === undefined || path === undefined) {
      throw new Error('This document has no file address to write to.')
    }
    const written = new Uint8Array(await blob.arrayBuffer())
    const params = new URLSearchParams({
      sessionId: address.sessionId,
      path,
      body: await contentHash(written),
    })
    if (base !== undefined) params.set('base', base)
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
    return body ?? {}
  }, [address])

  const fileAccess = useMemo<SpreadsheetFileAccess>(() => ({
    save: async (blob, target): Promise<SpreadsheetSaveResult> => {
      const written = await writeWorkbook(blob, target.path, baselineRef.current)
      baselineRef.current = written.hash ?? await contentHash(new Uint8Array(await blob.arrayBuffer()))
      // What is on disk is now exactly what this panel holds, so every buffer kept
      // for this file is spent — including one restored from a tab that is gone.
      forgetPath(target.path ?? '')
      return 'saved'
    },
    saveTo: async (blob, path): Promise<void> => {
      // No baseline and no bookkeeping: this is a *new* file, and the panel that
      // called it is about to be navigated to that file, where the ordinary load
      // path takes over and hashes what is there.
      await writeWorkbook(blob, path, undefined)
    },
  }), [writeWorkbook])

  /** Keep the buffer the user was offered, and put it in the Designer. */
  const restoreOffered = useCallback(() => {
    const buffer = offered
    if (buffer === undefined) return
    setHeld(buffer)
    setOffered(undefined)
    setDecision(current => current === undefined
      ? undefined
      : { ...current, load: { kind: 'buffer', workbook: buffer.workbook } })
    handleStatus(editorText('unsaved.restored'), 'idle')
  }, [offered, handleStatus])

  /**
   * Throw the edits away and start from the file on disk again.
   *
   * Covers both shapes of unsaved work: a buffer that came back from this session,
   * and edits made straight into the Designer, which no buffer holds. The second
   * shape is why the load is always re-issued with a *new* object — the host's load
   * effect keys on that object's identity, so reusing the current one would clear
   * the markers and leave the discarded edits on screen.
   */
  const discardEdits = useCallback(() => {
    if (address === undefined) return
    console.info(`[dsh-spreadjs-editor] discarded unsaved changes for ${address.path}; reloading from disk`)
    forgetPath(address.path)
    setHeld(undefined)
    setOffered(undefined)
    setDirty(false)
    setTabDirty(tabId, false)
    setDecision(current => current === undefined ? current : { ...current, load: { kind: 'file' } })
    handleStatus(editorText('unsaved.dropped'), 'idle')
  }, [address, tabId, handleStatus])

  /**
   * Write the workbook to a new workspace path, then move this tab onto it.
   *
   * Save As deliberately leaves the file it came from alone: that file keeps what it
   * had, and the edits now live under the new name. Which is why the buffers kept for
   * the old path are dropped here — they describe edits that are on disk somewhere
   * else, and offering them again when that file is reopened would be a lie.
   */
  const confirmSaveAs = useCallback(async (target: string) => {
    if (address === undefined) return
    const host = hostRef.current
    if (host === null) {
      setSaveAsError(editorText('saveAs.notReady'))
      return
    }
    setSaveAsBusy(true)
    setSaveAsError('')
    try {
      await host.saveAs(target)
    } catch (error) {
      const failure = error instanceof SaveConflictError
        ? 'conflict'
        : error instanceof WorkbookNotReadyError
          ? 'notReady'
          : 'other'
      setSaveAsError(saveAsFailureText(failure, error instanceof Error ? error.message : String(error)))
      setSaveAsBusy(false)
      return
    }
    // The write is done: everything after this point reports it, never undoes it.
    setSaveAsBusy(false)
    const writtenFrom = address.path
    forgetPath(writtenFrom)
    setSaveAsOpen(false)
    handleStatus(`${editorText('saveAs.done')}${target}`, 'idle')
    console.info(`[dsh-spreadjs-editor] saved ${writtenFrom} as ${target}`)
    if (tabActions === undefined) {
      // The file is on disk; only the automatic switch is missing, so say where it
      // went instead of leaving the panel looking like it now shows that file.
      console.warn(`[dsh-spreadjs-editor] wrote ${target}, but this tab cannot navigate; open it from the file tree`)
      return
    }
    try {
      tabActions.openResource(sessionFileAddressFor(address.sessionId, target), { replaceTab: true })
    } catch (error) {
      // A failed navigation is not a failed save, and must not be reported as one.
      console.warn('[dsh-spreadjs-editor] could not open the file just written:', error)
    }
  }, [address, handleStatus, tabActions])

  const noop = useCallback(() => {}, [])

  // The decision is only valid for the exact inputs it was made from; a fresh read
  // of the same file withdraws it in the same render, so nothing loads twice.
  const load = decision !== undefined
    && source !== undefined
    && decision.tabId === tabId
    && decision.path === source.path
    && decision.bytes === bytes
    ? decision.load
    : undefined

  /**
   * The panel's own state pill, shown only while it has something to say.
   *
   * It used to be a row of the panel's column, which held height away from the
   * Designer for the whole session to report a state that is usually "everything is
   * saved". As a floating pill it costs no layout at all, and it carries its own
   * actions because the restore/discard decision has to travel with the state it
   * belongs to. The matrix is status-line.ts, where it is unit tested.
   */
  const statusLine = statusLineFor({
    dirty,
    hasHeld: held !== undefined,
    hasOffered: offered !== undefined,
  })

  /**
   * What the Save As prompt suggests: the current directory and format, with the
   * localized word for "a copy" in the name. The suffix is part of the suggestion
   * rather than a rule, so it follows the reader's language.
   */
  const saveAsInitialPath = defaultSaveAsPath(address?.path ?? '', editorText('saveAs.suffix'))

  // `text` content means the owner did not deliver complete bytes, which only
  // happens for a definition that asked for pages. Say so instead of mounting an
  // editor over a partial file.
  if (source === undefined) {
    return (
      <div className="dsh-spreadjs-panel" role="region" aria-label="SpreadJS">
        <div className="dsh-spreadjs-empty">
          {editorText('empty.bytes')}
        </div>
      </div>
    )
  }

  return (
    <div className="dsh-spreadjs-panel" role="region" aria-busy={loading} aria-label={`SpreadJS: ${source.name}`}>
      <div className="dsh-spreadjs-editor">
        <SpreadsheetHost
          ref={hostRef}
          source={source}
          load={load}
          licenseKey={licenseKey}
          designerLicenseKey={designerLicenseKey}
          ready={configReady}
          fileAccess={fileAccess}
          onStatus={handleStatus}
          onLoadingChange={handleLoadingChange}
          onNewWorkbook={noop}
          onDirtyChange={handleDirtyChange}
          onUnsaved={handleUnsaved}
        />
      </div>
      {statusLine === undefined && status === ''
        ? null
        : (
          <div className="dsh-spreadjs-overlay">
            {statusLine === undefined
              ? null
              : (
                <div className="dsh-spreadjs-chip" role="status">
                  <span className="dsh-spreadjs-chip-text">{editorText(statusLine.key)}</span>
                  {statusLine.canRestore
                    ? (
                      <button type="button" className="dsh-spreadjs-chip-action" onClick={restoreOffered}>
                        {editorText('unsaved.restore')}
                      </button>
                    )
                    : null}
                  {statusLine.canDiscard
                    ? (
                      <button type="button" className="dsh-spreadjs-chip-action" onClick={discardEdits}>
                        {editorText('unsaved.discard')}
                      </button>
                    )
                    : null}
                </div>
              )}
            {status === ''
              ? null
              : <div className={`dsh-spreadjs-toast dsh-spreadjs-toast-${statusTone}`} role="status">{status}</div>}
          </div>
        )}
      {saveAsOpen
        ? (
          <SaveAsPrompt
            // Remounting on a new address re-seeds the suggested target, which is
            // the only thing the prompt takes from the panel.
            key={address?.path ?? ''}
            initialPath={saveAsInitialPath}
            busy={saveAsBusy}
            error={saveAsError}
            onSubmit={path => { void confirmSaveAs(path) }}
            onCancel={() => setSaveAsOpen(false)}
          />
        )
        : null}
    </div>
  )
}
