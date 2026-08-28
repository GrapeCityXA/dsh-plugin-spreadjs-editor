/**
 * SpreadJS host: creates one Workbook and loads the selected file.
 * Supports .xlsx/.xlsm (excelio), .sjs (native), .ssjson/.json (fromJSON)
 * and .csv (parsed locally). Read-only by default.
 */
import { useEffect, useRef, useState } from 'react'
import * as GC from '@grapecity/spread-sheets'
import * as ExcelIO from '@grapecity/spread-excelio'
// Side effect: installs the Chinese UI resource dictionary.
import '@grapecity/spread-sheets-resources-zh'
import { detectDelimiter, inferCell, parseCsv } from './csv.ts'

export interface SpreadsheetHostProps {
  /** Absolute path of the file to open (undefined = nothing). */
  filePath: string | undefined
  /** Browse root sent to the host (may be undefined for host default). */
  root: string | undefined
  /** SpreadJS license key from /spreadjs/api/config. */
  licenseKey: string
}

type LoadStatus = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string }

function fileApiPath(root: string | undefined, path: string): string {
  const params = new URLSearchParams()
  if (root !== undefined && root !== '') params.set('root', root)
  params.set('path', path)
  return `/spreadjs/api/file?${params.toString()}`
}

function resetWorkbook(wb: GC.Spread.Sheets.Workbook): void {
  const count = wb.getSheetCount()
  for (let i = count - 1; i > 0; i--) wb.removeSheet(i)
  const sheet = wb.getSheet(0)
  if (sheet !== undefined) {
    sheet.reset()
    sheet.setRowCount(0)
    sheet.setColumnCount(0)
  }
}

function fillCsvSheet(wb: GC.Spread.Sheets.Workbook, rows: string[][]): void {
  const sheet = wb.getSheet(0)
  if (sheet === undefined || rows.length === 0) return
  let colCount = 0
  for (const row of rows) colCount = Math.max(colCount, row.length)
  sheet.setColumnCount(colCount)
  sheet.setRowCount(rows.length)
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!
    for (let c = 0; c < colCount; c++) {
      const value = inferCell(row[c] ?? '')
      if (value !== null) sheet.setValue(r, c, value)
    }
  }
}

/** Fetch and load `path` into the workbook (paint already suspended). */
async function loadFile(
  wb: GC.Spread.Sheets.Workbook,
  root: string | undefined,
  path: string,
): Promise<void> {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
  const response = await fetch(fileApiPath(root, path))
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${response.status}`)
  }
  if (ext === '.xlsx' || ext === '.xlsm') {
    const buffer = await response.arrayBuffer()
    const json = await new Promise<object>((resolve, reject) => {
      const io = new ExcelIO.IO()
      io.open(new Blob([buffer]), resolve, (error: { errorMessage?: string }) =>
        reject(new Error(error?.errorMessage ?? 'excel import failed')))
    })
    wb.fromJSON(json)
  } else if (ext === '.sjs') {
    const buffer = await response.arrayBuffer()
    const name = path.split(/[\\/]/).pop() ?? 'book.sjs'
    await wb.open(new File([buffer], name))
  } else if (ext === '.ssjson' || ext === '.json') {
    const json = await response.json()
    wb.fromJSON(json)
  } else if (ext === '.csv') {
    const text = await response.text()
    const rows = parseCsv(text, detectDelimiter(text))
    resetWorkbook(wb)
    fillCsvSheet(wb, rows)
  } else {
    throw new Error(`unsupported file type: ${ext || '(none)'}`)
  }
}

export function SpreadsheetHost({ filePath, root, licenseKey }: SpreadsheetHostProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const workbookRef = useRef<GC.Spread.Sheets.Workbook | null>(null)
  const loadSeqRef = useRef(0)
  const [status, setStatus] = useState<LoadStatus>({ kind: 'idle' })

  useEffect(() => {
    if (licenseKey !== '') GC.Spread.Sheets.LicenseKey = licenseKey
  }, [licenseKey])

  // Create / destroy the workbook with the host element.
  useEffect(() => {
    const el = hostRef.current
    if (el === null) return
    const wb = new GC.Spread.Sheets.Workbook(el, { sheetCount: 1 })
    wb.options.tabStripVisible = true
    wb.options.newTabVisible = false
    workbookRef.current = wb
    return () => {
      wb.destroy()
      workbookRef.current = null
    }
  }, [])

  // Load the selected file; a stale async result is dropped by seq.
  useEffect(() => {
    const wb = workbookRef.current
    if (wb === null) return
    if (filePath === undefined || filePath === '') {
      setStatus({ kind: 'idle' })
      return
    }
    const seq = ++loadSeqRef.current
    setStatus({ kind: 'loading' })
    wb.suspendPaint()
    void loadFile(wb, root, filePath)
      .then(() => {
        if (seq !== loadSeqRef.current) return
        wb.resumePaint()
        setStatus({ kind: 'idle' })
      })
      .catch((error: unknown) => {
        if (seq !== loadSeqRef.current) return
        wb.resumePaint()
        setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
      })
  }, [filePath, root])

  return (
    <div className="dsh-spreadjs-host">
      <div ref={hostRef} />
      {filePath === undefined || filePath === '' ? (
        <div className="dsh-spreadjs-empty">Select a file on the left to preview it with SpreadJS.</div>
      ) : null}
      {status.kind === 'loading' ? <div className="dsh-spreadjs-loading">Loading…</div> : null}
      {status.kind === 'error' ? <div className="dsh-spreadjs-error">{status.message}</div> : null}
    </div>
  )
}
