/**
 * SpreadJS Designer host: mounts the full designer into the generic editor
 * panel and loads workspace files through the /spreadjs file bridge.
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

export type ExportFormat = 'xlsx' | 'sjs' | 'ssjson' | 'csv'
export type StatusTone = 'idle' | 'busy' | 'error'

export interface SpreadsheetHostHandle {
  save: () => Promise<void>
  exportAs: (format: ExportFormat) => Promise<void>
  newWorkbook: () => void
}

export interface SpreadsheetHostProps {
  /** Absolute path of the file to open (undefined = nothing). */
  filePath: string | undefined
  /** Browse root sent to the host (may be undefined for host default). */
  root: string | undefined
  /** SpreadJS license key from /spreadjs/api/config. */
  licenseKey: string
  /** Whether the host config fetch has completed. */
  ready: boolean
  onStatus: (status: string, tone?: StatusTone) => void
  onLoadingChange: (loading: boolean) => void
  onNewWorkbook: () => void
}

type LoadStatus = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string }

interface DesignerLike {
  getWorkbook(): any
  setWorkbook(spread: any): void
  destroy?(): void
}

interface DesignerNamespace {
  Designer?: new (host: HTMLDivElement, config?: unknown, spread?: unknown, spreadOptions?: unknown) => DesignerLike
  DefaultConfig?: unknown
  LicenseKey?: string
  setTheme?(theme: Record<string, string | undefined> | null): void
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

function cloneDefaultDesignerConfig(): unknown {
  const ns = designerNamespace()
  if (ns?.DefaultConfig === undefined) return undefined
  try {
    return JSON.parse(JSON.stringify(ns.DefaultConfig))
  } catch {
    return undefined
  }
}

/** Dark palette for the Designer chrome (ribbon, tabs, dialogs, panels). */
const DARK_THEME: Record<string, string | undefined> = {
  colorForeground: '#e8eaed',
  colorForegroundDisabled: '#7a808a',
  colorBackground: '#1e2227',
  colorBackgroundHover: '#2a2f36',
  colorBackgroundSelected: '#33383f',
  colorBackgroundDisabled: '#262a30',
  colorBackground2: '#171a1f',
  colorBackground2Hover: '#23272d',
  colorBackground2Selected: '#2c3138',
  colorBrandForeground: '#ffffff',
  colorBrandBackground: '#3b6ef6',
  colorBrandBackgroundHover: '#2f5ce0',
  colorBrandBackgroundSelected: '#2748b8',
  colorStroke: '#3a414a',
  colorStrokeHover: '#4b5563',
  colorStrokeSelected: '#5a6470',
  colorStrokeDisabled: '#2c3036',
  borderRadiusM: '4px',
  borderRadiusL: '6px',
  borderRadiusXL: '8px',
  shadow4: '0 1px 2px rgba(0, 0, 0, 0.55)',
  shadow8: '0 2px 6px rgba(0, 0, 0, 0.5)',
}

function applyDesignerTheme(): void {
  const ns = designerNamespace()
  if (ns?.setTheme === undefined) return
  const dark = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches === true
  try {
    ns.setTheme(dark ? DARK_THEME : null)
  } catch {
    // Theming is cosmetic; never block the editor for a palette failure.
  }
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
  function SpreadsheetHost({ filePath, root, licenseKey, ready, onStatus, onLoadingChange, onNewWorkbook }, ref) {
    const hostRef = useRef<HTMLDivElement | null>(null)
    const designerRef = useRef<DesignerLike | null>(null)
    const loadSeqRef = useRef(0)
    const pathRef = useRef(filePath)
    const rootRef = useRef(root)
    const [status, setStatus] = useState<LoadStatus>({ kind: 'idle' })

    pathRef.current = filePath
    rootRef.current = root

    // SpreadJS and Designer require separate license keys and both must be set
    // before the designer is constructed.
    useEffect(() => {
      if (!ready || licenseKey === '') return
      const sheets = (GC as any).Spread?.Sheets
      if (sheets !== undefined) sheets.LicenseKey = licenseKey
      const ns = designerNamespace()
      if (ns !== undefined) ns.LicenseKey = licenseKey
    }, [licenseKey, ready])

    // Follow the OS light/dark preference for the Designer chrome. This runs
    // before the Designer is constructed so the instance starts on the right
    // palette, and keeps listening for live system theme changes.
    useEffect(() => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyDesignerTheme()
      const onChange = (): void => applyDesignerTheme()
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange)
      else if (typeof mq.addListener === 'function') (mq as MediaQueryList & { addListener(cb: () => void): void }).addListener(onChange)
      return () => {
        if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange)
        else if (typeof mq.removeListener === 'function') (mq as MediaQueryList & { removeListener(cb: () => void): void }).removeListener(onChange)
      }
    }, [])

    // Create / destroy the designer with the host element.
    useEffect(() => {
      const el = hostRef.current
      const ns = designerNamespace()
      if (!ready || el === null || ns?.Designer === undefined) return
      const designer = new ns.Designer(el, cloneDefaultDesignerConfig())
      const spread = designer.getWorkbook()
      if (spread !== undefined) {
        spread.options.tabStripVisible = true
        spread.options.newTabVisible = true
      }
      designerRef.current = designer
      return () => {
        const current = designer.getWorkbook()
        if (current !== undefined && typeof current.destroy === 'function') current.destroy()
        if (typeof designer.destroy === 'function') designer.destroy()
        designerRef.current = null
      }
    }, [ready])

    // Load the selected file; a stale async result is dropped by seq. This must
    // wait for `ready` because the Designer is created in a separate effect that
    // runs only after the host config fetch completes.
    useEffect(() => {
      const designer = designerRef.current
      if (!ready || designer === null || filePath === undefined || filePath === '') {
        if (filePath === undefined || filePath === '') setStatus({ kind: 'idle' })
        return
      }
      const seq = ++loadSeqRef.current
      setStatus({ kind: 'loading' })
      onLoadingChange(true)
      onStatus(`Loading ${basename(filePath)}…`, 'busy')
      void (async () => {
        const response = await fetch(fileApiPath(root, filePath))
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null
          throw new Error(body?.error ?? `HTTP ${response.status}`)
        }
        const buffer = await response.arrayBuffer()
        const name = basename(filePath)
        const file = new File([buffer], name, { type: response.headers.get('content-type') ?? 'application/octet-stream' })
        const spread = designer.getWorkbook()
        if (spread === undefined) throw new Error('Designer workbook is not available')
        spread.suspendPaint()
        try {
          await loadIntoWorkbook(spread, file, filePath)
        } finally {
          spread.resumePaint()
        }
        if (seq !== loadSeqRef.current) return
        spread.refresh?.()
      })().then(() => {
        if (seq !== loadSeqRef.current) return
        setStatus({ kind: 'idle' })
        onLoadingChange(false)
        onStatus(`Loaded ${basename(filePath)}`, 'idle')
      }).catch((error: unknown) => {
        if (seq !== loadSeqRef.current) return
        const message = error instanceof Error ? error.message : String(error)
        setStatus({ kind: 'error', message })
        onLoadingChange(false)
        onStatus(`Load failed: ${message}`, 'error')
      })
    }, [filePath, root, ready, onLoadingChange, onStatus])

    async function save(): Promise<void> {
      const designer = designerRef.current
      const path = pathRef.current
      if (designer === null || path === undefined || path === '') return
      onLoadingChange(true)
      onStatus(`Saving ${basename(path)}…`, 'busy')
      try {
        const blob = await workbookBlob(designer.getWorkbook(), path)
        const response = await fetch(fileApiPath(rootRef.current, path), {
          method: 'PUT',
          body: blob,
        })
        if (response.status === 404) {
          // Older running profiles only serve the read-only bridge. Keep Save useful by
          // falling back to a local download until the host profile is restarted.
          downloadBlob(blob, basename(path))
          onStatus(`Saved ${basename(path)} as download`, 'idle')
          return
        }
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null
          throw new Error(body?.error ?? `HTTP ${response.status}`)
        }
        onStatus(`Saved ${basename(path)}`, 'idle')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        onStatus(`Save failed: ${message}`, 'error')
      } finally {
        onLoadingChange(false)
      }
    }

    async function exportAs(format: ExportFormat): Promise<void> {
      const designer = designerRef.current
      if (designer === null) return
      const path = pathRef.current ?? 'workbook.sjs'
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
      onNewWorkbook()
      onStatus('New workbook', 'idle')
    }

    useImperativeHandle(ref, () => ({ save, exportAs, newWorkbook }), [onLoadingChange, onNewWorkbook, onStatus])

    return (
      <div className="dsh-spreadjs-host">
        <div ref={hostRef} />
        {filePath === undefined || filePath === '' ? (
          <div className="dsh-spreadjs-empty">New workbook ready. Use Export to save a copy.</div>
        ) : null}
        {status.kind === 'loading' ? <div className="dsh-spreadjs-loading">Loading…</div> : null}
        {status.kind === 'error' ? <div className="dsh-spreadjs-error">{status.message}</div> : null}
      </div>
    )
  },
)
