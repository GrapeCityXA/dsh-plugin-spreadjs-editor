/**
 * RFC-4180 CSV parsing for the viewer. SpreadJS has no built-in CSV importer,
 * so we parse to rows and feed them into a sheet.
 */

export type Delimiter = ',' | '\t' | ';'

const CANDIDATES: readonly Delimiter[] = [',', '\t', ';']

/** Count delimiter occurrences outside quoted fields in the first lines. */
function countOutsideQuotes(text: string, delimiter: string): number {
  let count = 0
  let inQuotes = false
  const limit = Math.min(text.length, 4096)
  for (let i = 0; i < limit; i++) {
    const c = text[i]
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') i++
      else inQuotes = !inQuotes
    } else if (c === delimiter && !inQuotes) {
      count++
    }
  }
  return count
}

/** Pick the delimiter with the most out-of-quote hits in the CSV head. */
export function detectDelimiter(text: string): Delimiter {
  let best: Delimiter = ','
  let bestCount = -1
  for (const candidate of CANDIDATES) {
    const count = countOutsideQuotes(text, candidate)
    if (count > bestCount) {
      bestCount = count
      best = candidate
    }
  }
  return best
}

/** Parse CSV text into rows of raw string cells (BOM, CRLF, quoted fields). */
export function parseCsv(text: string, delimiter: Delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = text.charCodeAt(0) === 0xFEFF ? 1 : 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
    } else if (c === delimiter) {
      row.push(field)
      field = ''
      i += 1
    } else if (c === '\r') {
      if (text[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i += 1
    } else if (c === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i += 1
    } else {
      field += c
      i += 1
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Best-effort cell typing: numeric-looking strings become numbers. */
export function inferCell(raw: string): string | number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    const num = Number(trimmed)
    if (Number.isFinite(num)) return num
  }
  return raw
}
