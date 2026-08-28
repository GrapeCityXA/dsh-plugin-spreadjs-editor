/**
 * Pure file-bridge logic for the /spreadjs routes. Kept dependency-free and
 * side-effect-light so it can be unit tested directly (see tests/).
 */

import { readdir, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'

/** Spreadsheet extensions the viewer knows how to open. */
export const SPREADSHEET_EXTENSIONS = [
  '.xlsx', '.xlsm', '.csv', '.sjs', '.ssjson', '.json',
] as const

export type SpreadExtension = (typeof SPREADSHEET_EXTENSIONS)[number]

/** One spreadsheet file surfaced to the viewer. */
export interface SpreadFileEntry {
  /** Basename. */
  name: string
  /** Path relative to the requested root, forward slashes, '' for the root. */
  rel: string
  /** Absolute path on the host. */
  path: string
  /** File size in bytes. */
  size: number
  /** Last-modified epoch millis. */
  mtimeMs: number
}

/** Whether a file name carries a supported spreadsheet extension. */
export function isSpreadsheetFile(name: string): boolean {
  return (SPREADSHEET_EXTENSIONS as readonly string[]).includes(extname(name).toLowerCase())
}

/**
 * Resolve a user-supplied path inside `root`, or null when it escapes the
 * root. Relative targets resolve against `root`; absolute targets are checked
 * as given. The returned value is the canonical absolute path (not
 * realpath'd — callers wanting symlink safety can realpath the root first).
 */
export function resolveWithinRoot(root: string, target: string): string | null {
  const absRoot = resolve(root)
  const absTarget = isAbsolute(target) ? resolve(target) : resolve(absRoot, target)
  const rel = relative(absRoot, absTarget)
  if (rel === '') return absRoot
  if (rel === '..' || rel.startsWith(`..${sep()}`) || isAbsolute(rel)) return null
  return absTarget
}

/** Windows uses '\\'; POSIX '/'. Helper kept as a function for testability. */
function sep(): string {
  return process.platform === 'win32' ? '\\' : '/'
}

/** Normalize a filesystem path to forward slashes for JSON display. */
function toForward(p: string): string {
  return p.split('\\').join('/')
}

/**
 * Recursively walk `root` and collect every spreadsheet file below it.
 * Symlinked directories are not followed (avoids cycles). Errors on a
 * subdirectory are skipped (best effort); an unreadable root throws.
 */
export async function listSpreadsheetFiles(root: string): Promise<SpreadFileEntry[]> {
  const absRoot = resolve(root)
  const out: SpreadFileEntry[] = []
  const stack = [absRoot]
  while (stack.length > 0) {
    const dir = stack.pop()!
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      // Unreadable subdirectory: skip. The root itself failing surfaces on
      // the first iteration and propagates (caller turns it into an error).
      if (dir === absRoot) throw new Error(`cannot read directory: ${dir}`)
      continue
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(abs)
      } else if (entry.isFile() && isSpreadsheetFile(entry.name)) {
        const info = await stat(abs)
        out.push({
          name: entry.name,
          rel: toForward(relative(absRoot, abs)),
          path: abs,
          size: info.size,
          mtimeMs: info.mtimeMs,
        })
      }
    }
  }
  // Deterministic order: folders first, then name.
  out.sort((a, b) => {
    const aDir = a.rel.includes('/')
    const bDir = b.rel.includes('/')
    if (aDir !== bDir) return aDir ? -1 : 1
    return a.rel.localeCompare(b.rel)
  })
  return out
}
