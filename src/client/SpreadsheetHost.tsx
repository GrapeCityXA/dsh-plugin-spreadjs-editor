/**
 * SpreadJS Designer host: mounts the full designer for one workbook handed over
 * by the Sidebar's document owner, and writes the edited workbook back through
 * this plugin's own /spreadjs host route.
 *
 * The browser bundle imports the current @grapecity-software 19.x plugin set:
 * core sheets + IO, Chinese resources, charts/shapes/slicers/sparklines,
 * print/pdf/barcode/formula panel, PivotTable, TableSheet, data charts,
 * GanttSheet, ReportSheet, and the Designer itself.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as GC from '@grapecity-software/spread-sheets'
import * as ExcelIO from '@grapecity-software/spread-excelio'
import '@grapecity-software/spread-sheets-io'
import '@grapecity-software/spread-sheets-resources-zh'
import '@grapecity-software/spread-sheets-shapes'
import '@grapecity-software/spread-sheets-charts'
import '@grapecity-software/spread-sheets-slicers'
import '@grapecity-software/spread-sheets-sparklines'
import '@grapecity-software/spread-sheets-print'
import '@grapecity-software/spread-sheets-pdf'
import '@grapecity-software/spread-sheets-barcode'
import '@grapecity-software/spread-sheets-formula-panel'
import '@grapecity-software/spread-sheets-pivot-addon'
import '@grapecity-software/spread-sheets-tablesheet'
import '@grapecity-software/spread-sheets-datacharts-addon'
import '@grapecity-software/spread-sheets-ganttsheet'
import '@grapecity-software/spread-sheets-reportsheet-addon'
import '@grapecity-software/spread-sheets-languagepackages'
import '@grapecity-software/spread-sheets-designer-resources-cn'
import * as GCDesigner from '@grapecity-software/spread-sheets-designer'
import {
  redirectDesignerSave,
  registerDesignerSaveTarget,
  type DesignerConfigLike,
  type DesignerNamespaceLike,
} from './designer-save-command.ts'
import { installDesignerAbout } from './about.ts'
import { installDesignerFileMenu, type DesignerFileMenuNamespace } from './designer-file-menu.ts'
import { setEditorTheme } from './styles.ts'
import { harnessThemeIsDark, onHarnessThemeChange } from './ds-theme.ts'
import { resolveDirtyEvents, watchWorkbookChanges, type DirtyWatch, type DirtyWatchWorkbook } from './workbook-dirty.ts'

export type ExportFormat = 'xlsx' | 'sjs' | 'ssjson' | 'csv'
export type StatusTone = 'idle' | 'busy' | 'error'

export interface SpreadsheetHostHandle {
  save: () => Promise<void>
  exportAs: (format: ExportFormat) => Promise<void>
  newWorkbook: () => void
  /**
   * The live workbook this panel is editing, or undefined before the designer
   * exists. Handed to the spreadjs bridge so an agent can operate on the very
   * document on screen (see src/client/bridge.ts).
   */
  getWorkbook: () => unknown | undefined
  /** The SpreadJS namespace, so bridge-injected code can reach enums. */
  getNamespace: () => unknown
}

/** Result of one write-back operation. */
export type SpreadsheetSaveResult = 'saved' | 'download'

/**
 * What the Designer should be holding, which the document decides before anything
 * is loaded: the file's own bytes, or a buffer this panel kept when it last held
 * unsaved edits. `undefined` means "not decided yet" and loads nothing — reading
 * the file first and swapping the buffer in afterwards would re-parse a whole
 * workbook on every tab switch, which is the cost the buffer exists to avoid.
 */
export type SpreadsheetLoad =
  | { readonly kind: 'file' }
  | { readonly kind: 'buffer'; readonly workbook: object }

/** One workbook handed over by the document owner: bytes plus their identity. */
export interface SpreadsheetSource {
  /** Basename, used for extension detection and status text. */
  readonly name: string
  /** Path inside the session, exactly as the file address carried it. */
  readonly path?: string
  /** The complete file, already read by the document owner. */
  readonly bytes: Uint8Array<ArrayBuffer>
}

/** Write-back seam: where an edited workbook goes. */
export interface SpreadsheetFileAccess {
  save(blob: Blob, source: SpreadsheetSource): Promise<SpreadsheetSaveResult>
}

export interface SpreadsheetHostProps {
  /** Workbook to display (undefined = the Sidebar has nothing selected). */
  source: SpreadsheetSource | undefined
  /** What to put in the Designer, once the document has made that decision. */
  load: SpreadsheetLoad | undefined
  /** SpreadJS license key from /spreadjs/api/config. */
  licenseKey: string
  /** Separate Designer key from /spreadjs/api/config. */
  designerLicenseKey?: string
  /** Whether the host config fetch has completed. */
  ready: boolean
  /** Concrete read/write access chosen by the active adapter. */
  fileAccess: SpreadsheetFileAccess
  onStatus: (status: string, tone?: StatusTone) => void
  onLoadingChange: (loading: boolean) => void
  onNewWorkbook: () => void
  /** Whether the live workbook holds edits that are not on disk. */
  onDirtyChange: (dirty: boolean) => void
  /**
   * The body is going away while the workbook still holds edits. Called with
   * `workbook.toJSON()` and nothing else: the file's path and freshness hash belong
   * to the document, which is the half that knows the address.
   */
  onUnsaved: (workbook: object) => void
}

type LoadStatus = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string }

interface DesignerLike {
  getWorkbook(): any
  setWorkbook(spread: any): void
  destroy?(): void
}

interface DesignerNamespace extends DesignerNamespaceLike, DesignerFileMenuNamespace {
  Designer?: new (host: HTMLDivElement, config?: unknown, spread?: unknown, spreadOptions?: unknown) => DesignerLike
  DefaultConfig?: unknown
  LicenseKey?: string
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function extname(path: string): string {
  const name = basename(path)
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

function replaceExt(path: string, ext: string): string {
  const current = extname(path)
  const base = current === '' ? path : path.slice(0, path.length - current.length)
  return `${base}.${ext}`
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function designerNamespace(): DesignerNamespace | undefined {
  const designer = GCDesigner as unknown as { Spread?: { Sheets?: { Designer?: DesignerNamespace } } }
  if (designer.Spread?.Sheets?.Designer !== undefined) return designer.Spread.Sheets.Designer
  const gc = GC as unknown as { Spread?: { Sheets?: { Designer?: DesignerNamespace } } }
  return gc.Spread?.Sheets?.Designer
}

/**
 * The `GC.Spread.Sheets.Events` name table this build exposes.
 *
 * Read as a table rather than as individual constants so the edit watch can be
 * handed the names that exist in whichever build is bundled (see
 * {@link resolveDirtyEvents}).
 */
function eventsTable(): Record<string, string> | undefined {
  return (GC as unknown as { Spread?: { Sheets?: { Events?: Record<string, string> } } }).Spread?.Sheets?.Events
}

/**
 * A per-instance copy of the Designer's default config, so customising it never
 * edits the shared singleton. The copy goes through JSON, which cannot carry
 * functions: any command behaviour has to be installed as a live command object
 * afterwards (see the Save redirect in the creation effect).
 */
function cloneDefaultDesignerConfig(): DesignerConfigLike | undefined {
  const ns = designerNamespace()
  if (ns?.DefaultConfig === undefined) return undefined
  try {
    return JSON.parse(JSON.stringify(ns.DefaultConfig)) as DesignerConfigLike
  } catch {
    return undefined
  }
}

/**
 * Follow the harness's resolved light/dark palette for both halves of the
 * editor: the workbook's own stylesheet and the Designer's chrome preset are
 * swapped, and the caller repaints the workbook to apply that half.
 *
 * Nothing is layered on top. `setTheme()` recolours only the Designer's own
 * `--sjs-*` variables — it reaches neither the workbook nor the product's icon
 * assets — so overriding them would put this plugin's colours in front of the
 * product's dark preset for no gain. The preset is the theme.
 */
function applyEditorTheme(): void {
  setEditorTheme(harnessThemeIsDark())
}

export function workbookFileType(path: string): GC.Spread.Sheets.FileType {
  const ext = extname(path)
  if (ext === '.xlsx' || ext === '.xlsm') return GC.Spread.Sheets.FileType.excel
  if (ext === '.csv') return GC.Spread.Sheets.FileType.csv
  return GC.Spread.Sheets.FileType.ssjson
}

export function exportFileType(format: ExportFormat): GC.Spread.Sheets.FileType {
  if (format === 'xlsx') return GC.Spread.Sheets.FileType.excel
  if (format === 'csv') return GC.Spread.Sheets.FileType.csv
  return GC.Spread.Sheets.FileType.ssjson
}

interface ExcelIoLike {
  open(
    file: File,
    success: (json: object) => void,
    error: (error?: { errorMessage?: string }) => void,
  ): void
}

function excelJson(file: File): Promise<object> {
  const IO = (ExcelIO as unknown as { IO?: new () => ExcelIoLike }).IO
  if (IO === undefined) return Promise.reject(new Error('spread-excelio IO is unavailable'))
  return new Promise((resolve, reject) => {
    const io = new IO()
    io.open(file, json => resolve(json), error => {
      reject(new Error(error?.errorMessage ?? 'excel import failed'))
    })
  })
}

async function loadIntoWorkbook(
  spread: any,
  file: File,
  path: string,
): Promise<void> {
  const ext = extname(path)
  if (ext === '.xlsx' || ext === '.xlsm') {
    // ExcelIO is the proven path for xlsx/xlsm: parse to workbook JSON, then
    // fromJSON into a fresh workbook before handing it to the Designer.
    spread.fromJSON(await excelJson(file))
    return
  }
  if (ext === '.ssjson') {
    spread.fromJSON(JSON.parse(await file.text()) as object)
    return
  }
  await new Promise<void>((resolve, reject) => {
    const fail = (error: unknown) => {
      reject(error instanceof Error ? error : new Error(String(error)))
    }
    if (ext === '.sjs') {
      spread.open(file, resolve, fail)
      return
    }
    spread.import(file, resolve, fail, {
      fileType: workbookFileType(path),
      includeBindingSource: true,
    })
  })
}

function resetWorkbook(spread: any): void {
  const count = spread.getSheetCount()
  for (let i = count - 1; i > 0; i--) spread.removeSheet(i)
  const sheet = spread.getSheet(0)
  if (sheet !== undefined) {
    sheet.reset()
    sheet.setRowCount(200)
    sheet.setColumnCount(20)
  }
}

function workbookBlob(spread: any, path: string, format?: ExportFormat): Promise<Blob> {
  const target = format === undefined && extname(path) === '.sjs'
    ? 'sjs'
    : format === undefined
      ? workbookFileType(path)
      : exportFileType(format)
  return new Promise((resolve, reject) => {
    const fail = (error: unknown) => {
      reject(error instanceof Error ? error : new Error(String(error)))
    }
    if (target === 'sjs') {
      spread.save(resolve, fail, { includeBindingSource: true })
      return
    }
    spread.export(resolve, fail, {
      fileType: target,
      includeBindingSource: true,
    })
  })
}

export const SpreadsheetHost = forwardRef<SpreadsheetHostHandle, SpreadsheetHostProps>(
  function SpreadsheetHost({ source, load, licenseKey, designerLicenseKey = '', ready, fileAccess, onStatus, onLoadingChange, onNewWorkbook, onDirtyChange, onUnsaved }, ref) {
    const hostRef = useRef<HTMLDivElement | null>(null)
    const designerRef = useRef<DesignerLike | null>(null)
    const loadSeqRef = useRef(0)
    const sourceRef = useRef(source)
    /**
     * The newest write-back. The Designer's own Save command and the driver
     * bridge both hold this panel at arm's length and outlive a render, so they
     * must call through a ref rather than capture one closure forever.
     */
    const saveRef = useRef<(() => Promise<void>) | undefined>(undefined)
    /** A load is in flight; saving now would export a workbook with no content. */
    const loadInFlightRef = useRef(false)
    /** One write-back at a time. */
    const saveInFlightRef = useRef(false)
    /** Whether the live workbook holds edits that are not on disk. */
    const dirtyRef = useRef(false)
    /** The edit watch over the current workbook, stopped with it. */
    const dirtyWatchRef = useRef<DirtyWatch | null>(null)
    /** The newest reporters; both outlive a render, like the save redirect above. */
    const onDirtyChangeRef = useRef(onDirtyChange)
    const onUnsavedRef = useRef(onUnsaved)
    const [status, setStatus] = useState<LoadStatus>({ kind: 'idle' })

    sourceRef.current = source
    saveRef.current = save
    onDirtyChangeRef.current = onDirtyChange
    onUnsavedRef.current = onUnsaved

    /**
     * The workbook has edits that are not on disk.
     *
     * A load is excluded because reading a file into the Designer drives commands
     * of its own — that is not a user edit. Both loads end by saying which of the
     * two states the result is in ({@link markWorkbookClean} for the file's own
     * bytes, a dirty mark for a restored buffer).
     */
    function markWorkbookDirty(): void {
      if (loadInFlightRef.current) return
      dirtyRef.current = true
      onDirtyChangeRef.current(true)
    }

    /** The workbook and the file on disk now agree (or there is no file to lose). */
    function markWorkbookClean(): void {
      dirtyRef.current = false
      onDirtyChangeRef.current(false)
    }

    // SpreadJS and Designer require separate license keys and both must be set
    // before the designer is constructed.
    useEffect(() => {
      if (!ready) return
      const sheets = (GC as any).Spread?.Sheets
      if (sheets !== undefined && licenseKey !== '') sheets.LicenseKey = licenseKey
      const ns = designerNamespace()
      if (ns !== undefined && designerLicenseKey !== '') ns.LicenseKey = designerLicenseKey
    }, [licenseKey, designerLicenseKey, ready])

    // Follow the harness palette for both halves of the editor. This runs before
    // the Designer is constructed, so it starts on the right palette and on the
    // matching runtime stylesheet, and it stays subscribed for later switches —
    // a preference change, or the OS while the harness preference is `system`.
    // The workbook is repainted because a theme change is applied by swapping
    // that stylesheet, not by a Designer setting.
    useEffect(() => {
      const apply = (): void => {
        applyEditorTheme()
        designerRef.current?.getWorkbook()?.refresh()
      }
      apply()
      return onHarnessThemeChange(apply)
    }, [])

    // Offer this panel to the Designer's Save command for as long as it is
    // mounted. The command registry is shared, so the redirect resolves the
    // panel from the workbook the command was launched on rather than capturing
    // one; an unmounted panel must stop being a candidate.
    useEffect(() => registerDesignerSaveTarget({
      workbook: () => designerRef.current?.getWorkbook(),
      canWriteBack: () => sourceRef.current !== undefined,
      save: () => { void saveRef.current?.() },
    }), [])

    // Create / destroy the designer with the host element.
    useEffect(() => {
      const el = hostRef.current
      const ns = designerNamespace()
      if (!ready || el === null || ns?.Designer === undefined) return
      const config = cloneDefaultDesignerConfig()
      // The Designer's own Save — ribbon button, File menu, Ctrl+S — downloads a
      // copy by default, which is the wrong meaning inside this panel: the open
      // document already has a file in the session workspace, so Save must write
      // it. Re-point the command before the Designer exists; Export and Save As
      // keep their default behaviour, because those do mean "write a copy".
      const steered = redirectDesignerSave(ns, config)
      if (!steered) {
        console.warn('[dsh-spreadjs-editor] the Designer Save command was not redirected; use the panel Save button')
      }
      // The File tab dispatches through its own handler rather than the command
      // table, so the redirect above does not reach its Save row. Rebind that row
      // in the menu template — and drop the rows that contradict a document tab —
      // before the Designer instance is built from it.
      const menu = installDesignerFileMenu(ns)
      console.info(
        `[dsh-spreadjs-editor] file menu installed=${menu.installed} handler=${menu.handler}`
        + ` navKept=${menu.navKept} navAdded=${menu.navAdded} actionsReplaced=${menu.actionsReplaced}`
        + ` navDropped=[${menu.navDropped.join(',')}] panelsDropped=[${menu.panelsDropped.join(',')}]`,
      )
      if (menu.summary.length > 0) {
        console.info(`[dsh-spreadjs-editor] file menu rows this build did not recognise:\n${menu.summary.join('\n')}`)
      }
      // The panel used to describe itself in a status bar; that information — the
      // plugin and SpreadJS versions, and the licence state — lives in an About
      // dialog now, opened from a button in the Designer's own ribbon.
      const about = installDesignerAbout(ns, config, {
        runtimeLicensed: licenseKey !== '',
        designerLicensed: designerLicenseKey !== '',
      })
      console.info(
        `[dsh-spreadjs-editor] about button installed=${about.installed} tab=${about.tab ?? '-'}`
        + ` registered=${about.registered} command=${about.command} ribbonGroup=${about.ribbonGroup}`
        + (about.reason === undefined ? '' : ` reason=${about.reason}`),
      )
      const designer = new ns.Designer(el, config)
      const spread = designer.getWorkbook()
      if (spread !== undefined) {
        spread.options.tabStripVisible = true
        spread.options.newTabVisible = true
        dirtyWatchRef.current = watchWorkbookChanges(
          spread as DirtyWatchWorkbook,
          markWorkbookDirty,
          resolveDirtyEvents(eventsTable()),
        )
      }
      designerRef.current = designer
      return () => {
        dirtyWatchRef.current?.stop()
        dirtyWatchRef.current = null
        const current = designer.getWorkbook()
        if (dirtyRef.current && current !== undefined) {
          // The body is leaving with edits that never reached the file. Hand the
          // workbook over *before* destroying it: the document keeps it under this
          // tab and under the file's path, so switching back — or reopening the
          // file later — gets the edits back instead of starting from disk.
          try {
            onUnsavedRef.current(current.toJSON())
            console.info('[dsh-spreadjs-editor] kept unsaved changes before unmounting the editor')
          } catch (error) {
            console.error('[dsh-spreadjs-editor] could not keep the unsaved workbook:', error)
          }
          dirtyRef.current = false
        }
        if (current !== undefined && typeof current.destroy === 'function') current.destroy()
        if (typeof designer.destroy === 'function') designer.destroy()
        designerRef.current = null
      }
    }, [ready])

    // Put the selected workbook into the Designer: the file's own bytes, or the
    // buffer the document decided to show instead. A stale async result is dropped
    // by seq. This waits for `ready`, because the Designer is created in a separate
    // effect that only runs after the host config fetch, and for `load`, because the
    // document hashes the bytes before it can tell a kept buffer from a stale one —
    // loading the file first and swapping the buffer in afterwards would re-parse a
    // whole workbook on every tab switch, which is the cost the buffer avoids.
    useEffect(() => {
      const designer = designerRef.current
      if (!ready || designer === null || source === undefined || load === undefined) {
        if (source === undefined) setStatus({ kind: 'idle' })
        loadInFlightRef.current = false
        return
      }
      const buffer = load.kind === 'buffer' ? load.workbook : undefined
      const seq = ++loadSeqRef.current
      loadInFlightRef.current = true
      setStatus({ kind: 'loading' })
      onLoadingChange(true)
      onStatus(buffer === undefined ? `Loading ${source.name}…` : 'Restoring unsaved changes…', 'busy')
      void (async () => {
        const spread = designer.getWorkbook()
        if (spread === undefined) throw new Error('Designer workbook is not available')
        spread.suspendPaint()
        try {
          if (buffer !== undefined) {
            // The snapshot is a workbook's own serialization, so it goes back in
            // through the same door a workbook file does.
            await spread.fromJSON(buffer)
          } else {
            // The document owner already read the file, so there is nothing to
            // fetch: the bytes on hand are the workbook.
            const file = new File([source.bytes], source.name, { type: 'application/octet-stream' })
            await loadIntoWorkbook(spread, file, source.name)
          }
        } finally {
          spread.resumePaint()
        }
        if (seq !== loadSeqRef.current) return
        spread.refresh?.()
      })().then(() => {
        if (seq !== loadSeqRef.current) return
        loadInFlightRef.current = false
        setStatus({ kind: 'idle' })
        onLoadingChange(false)
        if (buffer !== undefined) {
          // A buffer is by definition not what the file on disk holds: it is work
          // still to be saved.
          markWorkbookDirty()
          onStatus('Restored unsaved changes', 'idle')
        } else {
          markWorkbookClean()
          onStatus(`Loaded ${source.name}`, 'idle')
        }
      }).catch((error: unknown) => {
        if (seq !== loadSeqRef.current) return
        loadInFlightRef.current = false
        const message = error instanceof Error ? error.message : String(error)
        setStatus({ kind: 'error', message })
        onLoadingChange(false)
        onStatus(`Load failed: ${message}`, 'error')
      })
    }, [source, load, ready, onLoadingChange, onStatus])

    async function save(): Promise<void> {
      const designer = designerRef.current
      const current = sourceRef.current
      if (designer === null || current === undefined) return
      // A workbook that is still loading has no content yet, so exporting it now
      // would overwrite the file on disk with an empty book.
      if (loadInFlightRef.current) {
        onStatus(`Still loading ${current.name}; nothing was saved`, 'busy')
        return
      }
      if (saveInFlightRef.current) return
      saveInFlightRef.current = true
      onLoadingChange(true)
      onStatus(`Saving ${current.name}…`, 'busy')
      try {
        const blob = await workbookBlob(designer.getWorkbook(), current.name)
        const result = await fileAccess.save(blob, current)
        // What is on disk is now the workbook in front of the user, so there is
        // nothing left that a buffer would have to keep.
        markWorkbookClean()
        onStatus(
          result === 'download' ? `Saved ${current.name} as download` : `Saved ${current.name}`,
          'idle',
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        onStatus(`Save failed: ${message}`, 'error')
      } finally {
        saveInFlightRef.current = false
        onLoadingChange(false)
      }
    }

    async function exportAs(format: ExportFormat): Promise<void> {
      const designer = designerRef.current
      if (designer === null) return
      const path = sourceRef.current?.name ?? 'workbook.sjs'
      const name = replaceExt(path, format)
      onLoadingChange(true)
      onStatus(`Exporting ${name}…`, 'busy')
      try {
        const blob = await workbookBlob(designer.getWorkbook(), path, format)
        downloadBlob(blob, name)
        onStatus(`Exported ${name}`, 'idle')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        onStatus(`Export failed: ${message}`, 'error')
      } finally {
        onLoadingChange(false)
      }
    }

    function newWorkbook(): void {
      const designer = designerRef.current
      if (designer === null) return
      resetWorkbook(designer.getWorkbook())
      loadSeqRef.current += 1
      setStatus({ kind: 'idle' })
      // Resetting the workbook fires changes of its own, and they are not edits to
      // a file: this panel holds a brand-new book that has never been on disk.
      markWorkbookClean()
      onNewWorkbook()
      onStatus('New workbook', 'idle')
    }

    useImperativeHandle(
      ref,
      () => ({
        save,
        exportAs,
        newWorkbook,
        getWorkbook: () => designerRef.current?.getWorkbook(),
        getNamespace: () => GC,
      }),
      [onLoadingChange, onNewWorkbook, onStatus],
    )

    return (
      <div className="dsh-spreadjs-host">
        <div ref={hostRef} />
        {source === undefined ? (
          <div className="dsh-spreadjs-empty">New workbook ready. Use Export to save a copy.</div>
        ) : null}
        {status.kind === 'loading' ? <div className="dsh-spreadjs-loading">Loading…</div> : null}
        {status.kind === 'error' ? <div className="dsh-spreadjs-error">{status.message}</div> : null}
      </div>
    )
  },
)
