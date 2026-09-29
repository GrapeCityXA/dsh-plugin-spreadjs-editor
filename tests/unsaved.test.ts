import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  forgetPath,
  forgetTab,
  hasRecoveryBuffer,
  hasUnsavedWork,
  isTabDirty,
  recoverableWorkbook,
  resetUnsavedWork,
  setTabDirty,
  stashWorkbook,
  tabWorkbook,
  watchUnloadGuard,
  type WorkbookSnapshot,
} from '../src/client/unsaved.ts'

function snapshot(over: Partial<WorkbookSnapshot> = {}): WorkbookSnapshot {
  return { path: 'books/plan.xlsx', tabId: 'tab-1', baseline: 'hash-1', workbook: { sheets: {} }, at: 7, ...over }
}

/** The two members of `window` the unload guard uses. */
interface WindowDouble {
  addEventListener: (type: string, fn: (event: unknown) => void) => void
  removeEventListener: (type: string, fn: (event: unknown) => void) => void
  fire: (type: string, event: unknown) => void
  count: (type: string) => number
}

function windowDouble(): WindowDouble {
  const listeners = new Map<string, Set<(event: unknown) => void>>()
  return {
    addEventListener: (type, fn) => {
      const set = listeners.get(type) ?? new Set()
      set.add(fn)
      listeners.set(type, set)
    },
    removeEventListener: (type, fn) => { listeners.get(type)?.delete(fn) },
    fire: (type, event) => { for (const fn of listeners.get(type) ?? []) fn(event) },
    count: type => listeners.get(type)?.size ?? 0,
  }
}

beforeEach(() => { resetUnsavedWork() })
afterEach(() => { vi.unstubAllGlobals(); resetUnsavedWork() })

describe('unsaved work', () => {
  it('starts empty', () => {
    expect(hasUnsavedWork()).toBe(false)
    expect(isTabDirty('tab-1')).toBe(false)
    expect(tabWorkbook('tab-1', 'books/plan.xlsx')).toBeUndefined()
    expect(hasRecoveryBuffer('books/plan.xlsx')).toBe(false)
  })

  it('tracks a tab\u2019s live dirty state, and lets it go clean again', () => {
    setTabDirty('tab-1', true)
    expect(isTabDirty('tab-1')).toBe(true)
    expect(isTabDirty('tab-2')).toBe(false)
    expect(hasUnsavedWork()).toBe(true)

    setTabDirty('tab-1', false)
    expect(isTabDirty('tab-1')).toBe(false)
    expect(hasUnsavedWork()).toBe(false)
  })

  it('keeps a stashed workbook under its tab and under its path', () => {
    stashWorkbook(snapshot())
    expect(tabWorkbook('tab-1', 'books/plan.xlsx')).toMatchObject({ at: 7, baseline: 'hash-1' })
    expect(hasRecoveryBuffer('books/plan.xlsx')).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
  })

  it('hands a buffer back only to the tab that wrote it', () => {
    stashWorkbook(snapshot({ tabId: 'tab-1' }))
    expect(tabWorkbook('tab-2', 'books/plan.xlsx')).toBeUndefined()
    // A different tab id for the same path means the earlier tab occurrence is
    // over, so its buffer is dropped rather than left to accumulate.
    expect(tabWorkbook('tab-1', 'books/plan.xlsx')).toBeUndefined()
    // The path-keyed copy is untouched: that is the one that survives a close.
    expect(hasRecoveryBuffer('books/plan.xlsx')).toBe(true)
  })

  it('keeps the path-keyed buffer after the tab record is gone', () => {
    stashWorkbook(snapshot({ tabId: 'tab-1' }))
    forgetTab('tab-1')
    expect(tabWorkbook('tab-1', 'books/plan.xlsx')).toBeUndefined()
    expect(recoverableWorkbook('books/plan.xlsx', 'hash-1')).toMatchObject({ matches: true })
  })

  it('only calls a kept buffer current when the file is the version it came from', () => {
    stashWorkbook(snapshot({ baseline: 'hash-1' }))
    expect(recoverableWorkbook('books/plan.xlsx', 'hash-1')?.matches).toBe(true)
    // The file was rewritten (by an agent, or another editor) while the tab was
    // closed: the buffer is still offered, but never applied on its own.
    expect(recoverableWorkbook('books/plan.xlsx', 'hash-2')?.matches).toBe(false)
    // A buffer written before the hash was known cannot claim to be current.
    resetUnsavedWork()
    stashWorkbook(snapshot({ baseline: undefined }))
    expect(recoverableWorkbook('books/plan.xlsx', 'hash-1')?.matches).toBe(false)
  })

  it('reports nothing for a path it never saw', () => {
    expect(recoverableWorkbook('books/other.xlsx', 'hash-1')).toBeUndefined()
  })

  it('drops every buffer for a path once that file is saved', () => {
    stashWorkbook(snapshot({ tabId: 'tab-1' }))
    stashWorkbook(snapshot({ tabId: 'tab-2' }))
    forgetPath('books/plan.xlsx')
    expect(hasRecoveryBuffer('books/plan.xlsx')).toBe(false)
    expect(tabWorkbook('tab-1', 'books/plan.xlsx')).toBeUndefined()
    expect(tabWorkbook('tab-2', 'books/plan.xlsx')).toBeUndefined()
  })

  it('leaves other files alone when one is saved', () => {
    stashWorkbook(snapshot({ path: 'books/plan.xlsx', tabId: 'tab-1' }))
    stashWorkbook(snapshot({ path: 'books/other.xlsx', tabId: 'tab-2' }))
    forgetPath('books/plan.xlsx')
    expect(hasRecoveryBuffer('books/other.xlsx')).toBe(true)
    expect(tabWorkbook('tab-2', 'books/other.xlsx')).toBeDefined()
  })

  it('warns before the page unloads only while something would be lost', () => {
    const win = windowDouble()
    vi.stubGlobal('window', win)
    const stop = watchUnloadGuard()
    expect(win.count('beforeunload')).toBe(1)

    const clean = { preventDefault: vi.fn(), returnValue: undefined as unknown }
    win.fire('beforeunload', clean)
    expect(clean.preventDefault).not.toHaveBeenCalled()
    expect(clean.returnValue).toBeUndefined()

    setTabDirty('tab-1', true)
    const dirty = { preventDefault: vi.fn(), returnValue: undefined as unknown }
    win.fire('beforeunload', dirty)
    expect(dirty.preventDefault).toHaveBeenCalledTimes(1)
    // Older browsers only intercept on a non-empty returnValue.
    expect(dirty.returnValue).toBe('')

    // A buffer alone is enough: the body may be unmounted and the edits still real.
    setTabDirty('tab-1', false)
    stashWorkbook(snapshot())
    const kept = { preventDefault: vi.fn(), returnValue: undefined as unknown }
    win.fire('beforeunload', kept)
    expect(kept.preventDefault).toHaveBeenCalledTimes(1)

    stop()
    expect(win.count('beforeunload')).toBe(0)
  })

  it('returns a no-op guard where there is no window to warn', () => {
    vi.stubGlobal('window', undefined)
    expect(() => watchUnloadGuard()()).not.toThrow()
  })
})
