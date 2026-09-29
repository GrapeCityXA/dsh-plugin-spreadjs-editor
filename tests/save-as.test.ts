import { describe, expect, it } from 'vitest'
import {
  SAVE_AS_EXTENSIONS,
  defaultSaveAsPath,
  saveAsFailureText,
  saveAsTargetError,
} from '../src/client/save-as.ts'

describe('saveAsTargetError', () => {
  it.each(SAVE_AS_EXTENSIONS)('accepts .%s', extension => {
    expect(saveAsTargetError(`books/q1.${extension}`)).toBeUndefined()
  })

  it('accepts upper-case extensions and surrounding space', () => {
    expect(saveAsTargetError('  books/q1.XLSM  ')).toBeUndefined()
  })

  it.each(['', '   ', '\t'])('refuses the empty target %j', path => {
    expect(saveAsTargetError(path)).toBe('saveAs.empty')
  })

  it.each([
    'book.txt',
    'book',
    'dir.xlsx/',
    'book.xlsx.bak',
    'notes.xlsx.md',
  ])('refuses %j, which could not be reopened here', path => {
    expect(saveAsTargetError(path)).toBe('saveAs.badExtension')
  })

  it('does not judge containment: only the host resolves the workspace', () => {
    // Outside the workspace, and refused by the host's own containment rule. If
    // this returned an error the browser would be duplicating that rule, and the
    // two would drift.
    expect(saveAsTargetError('../../outside.xlsx')).toBeUndefined()
  })
})

describe('saveAsFailureText', () => {
  // Asserted against the shipped fallback dictionary on purpose: with no locale
  // service composed in, these are the strings a reader actually sees.
  it('words a name already in use itself, rather than repeating the host', () => {
    const text = saveAsFailureText('conflict', 'The file already exists but the editor did not state what it opened')
    expect(text).toBe('目标文件已存在，请换一个名字')
  })

  it('words an editor that is not ready itself', () => {
    expect(saveAsFailureText('notReady', 'Another save is already running')).toBe('编辑器还没准备好，请稍候再试')
  })

  it('keeps the host wording when the refusal is neither', () => {
    const message = 'Refusing to write outside the session workspace: D:\\elsewhere\\a.xlsx'
    expect(saveAsFailureText('other', message)).toBe(message)
  })
})

describe('defaultSaveAsPath', () => {
  it('keeps the directory and extension and marks the name as a copy', () => {
    expect(defaultSaveAsPath('books/q1.xlsx', '副本')).toBe('books/q1-副本.xlsx')
    expect(defaultSaveAsPath('books/q1.xlsx', 'copy')).toBe('books/q1-copy.xlsx')
  })

  it('handles a bare file name', () => {
    expect(defaultSaveAsPath('q1.xlsx', '副本')).toBe('q1-副本.xlsx')
  })

  it('keeps the extension spelling', () => {
    expect(defaultSaveAsPath('dir/Report.XLSM', 'copy')).toBe('dir/Report-copy.XLSM')
  })

  it('keeps a multi-dot stem intact', () => {
    expect(defaultSaveAsPath('dir/q1.final.xlsx', '副本')).toBe('dir/q1.final-副本.xlsx')
  })

  it.each([
    ['noext', 'noext-副本'],
    ['dir/.hidden', 'dir/.hidden-副本'],
  ])('appends to %j without inventing an extension', (path, expected) => {
    expect(defaultSaveAsPath(path, '副本')).toBe(expected)
  })
})
