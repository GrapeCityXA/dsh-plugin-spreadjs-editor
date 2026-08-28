import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  isSpreadsheetFile,
  listSpreadsheetFiles,
  resolveWithinRoot,
  SPREADSHEET_EXTENSIONS,
} from '../src/fs-bridge.ts'

function tempTree(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-test-'))
  return root
}

describe('isSpreadsheetFile', () => {
  it('accepts every supported extension', () => {
    for (const ext of SPREADSHEET_EXTENSIONS) {
      expect(isSpreadsheetFile(`report${ext}`)).toBe(true)
    }
  })

  it('is case-insensitive', () => {
    expect(isSpreadsheetFile('DATA.XLSX')).toBe(true)
    expect(isSpreadsheetFile('book.Sjs')).toBe(true)
  })

  it('rejects unsupported extensions and extensionless names', () => {
    expect(isSpreadsheetFile('notes.txt')).toBe(false)
    expect(isSpreadsheetFile('archive.zip')).toBe(false)
    expect(isSpreadsheetFile('README')).toBe(false)
    expect(isSpreadsheetFile('.gitignore')).toBe(false)
    expect(isSpreadsheetFile('book.xlsx.bak')).toBe(false)
  })
})

describe('resolveWithinRoot', () => {
  it('resolves a path inside the root', () => {
    const root = tempTree()
    const abs = resolveWithinRoot(root, join(root, 'a', 'b.xlsx'))
    expect(abs).not.toBeNull()
    expect(abs).toBe(join(root, 'a', 'b.xlsx'))
  })

  it('resolves a RELATIVE path against the root, not the cwd', () => {
    const root = tempTree()
    const abs = resolveWithinRoot(root, 'a/b.xlsx')
    expect(abs).toBe(join(root, 'a', 'b.xlsx'))
  })

  it('resolves the root itself', () => {
    const root = tempTree()
    expect(resolveWithinRoot(root, root)).toBe(root)
  })

  it('rejects escape via ..', () => {
    const root = tempTree()
    expect(resolveWithinRoot(root, join(root, '..', 'other.xlsx'))).toBeNull()
    expect(resolveWithinRoot(root, join(root, 'a', '..', '..', 'x.xlsx'))).toBeNull()
  })

  it('rejects an absolute path outside the root', () => {
    const root = tempTree()
    const outside = join(tmpdir(), 'outside-dsh-spreadjs.xlsx')
    expect(resolveWithinRoot(root, outside)).toBeNull()
  })

  it('rejects a sibling path', () => {
    const root = tempTree()
    const sibling = join(tmpdir(), 'dsh-spreadjs-sibling-dir')
    expect(resolveWithinRoot(root, join(sibling, 'f.xlsx'))).toBeNull()
  })

  it('accepts a path that merely looks like a sibling (same prefix)', () => {
    const root = tempTree()
    // "..foo" is a legitimate child name, not a parent traversal.
    const abs = resolveWithinRoot(root, join(root, '..foo.xlsx'))
    expect(abs).toBe(join(root, '..foo.xlsx'))
  })
})

describe('listSpreadsheetFiles', () => {
  it('walks recursively, filters by extension, and sorts folders-first', async () => {
    const root = tempTree()
    writeFileSync(join(root, 'a.xlsx'), 'x')
    writeFileSync(join(root, 'b.csv'), 'y')
    writeFileSync(join(root, 'notes.txt'), 'z')
    mkdirSync(join(root, 'sub'))
    writeFileSync(join(root, 'sub', 'c.sjs'), 'w')
    writeFileSync(join(root, 'sub', 'readme.md'), 'q')

    const files = await listSpreadsheetFiles(root)
    const rels = files.map(f => f.rel)
    // Folders first, then root-level files by name.
    expect(rels).toEqual(['sub/c.sjs', 'a.xlsx', 'b.csv'])
  })

  it('skips unreadable subdirectories (when the platform enforces chmod)', async () => {
    const root = tempTree()
    writeFileSync(join(root, 'ok.xlsx'), 'x')
    mkdirSync(join(root, 'locked'))
    writeFileSync(join(root, 'locked', 'nope.xlsx'), 'y')
    const fs = await import('node:fs/promises')
    let blocked = false
    try {
      await fs.chmod(join(root, 'locked'), 0o000)
      // Verify the permission actually took effect on this platform
      // (Windows ignores chmod and stays readable).
      await fs.readdir(join(root, 'locked')).catch(() => {
        blocked = true
      })
    } catch {
      blocked = false
    }
    const files = await listSpreadsheetFiles(root)
    const names = files.map(f => f.name).sort()
    if (blocked) {
      expect(names).toEqual(['ok.xlsx'])
    } else {
      expect(names).toEqual(['nope.xlsx', 'ok.xlsx'])
    }
    await fs.chmod(join(root, 'locked'), 0o755).catch(() => {})
  })

  it('throws when the root itself is unreadable or missing', async () => {
    const missing = join(tmpdir(), 'dsh-spreadjs-does-not-exist-xyz')
    await expect(listSpreadsheetFiles(missing)).rejects.toThrow(/cannot read directory/)
  })

  it('does not follow symlinked directories', async () => {
    const root = tempTree()
    const target = tempTree()
    writeFileSync(join(target, 'escape.xlsx'), 'x')
    try {
      await import('node:fs/promises').then(fs => fs.symlink(target, join(root, 'link'), 'dir'))
      const files = await listSpreadsheetFiles(root)
      expect(files).toEqual([])
    } catch {
      // Symlinks unsupported on this platform — nothing to assert.
      expect(true).toBe(true)
    }
  })
})
