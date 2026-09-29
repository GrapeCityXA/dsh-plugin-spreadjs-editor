import { beforeEach, describe, expect, it } from 'vitest'
import { HASH_PENDING, HASH_UNAVAILABLE, decideLoad } from '../src/client/load-decision.ts'
import { resetUnsavedWork, stashWorkbook } from '../src/client/unsaved.ts'

const PATH = 'books/plan.xlsx'

/** A buffer as the host hands one over. */
function keep(tabId: string, baseline: string | undefined): void {
  stashWorkbook({ path: PATH, tabId, baseline, workbook: { wb: tabId }, at: 1 })
}

beforeEach(() => { resetUnsavedWork() })

describe('what a body opens with', () => {
  it('opens the file when nothing was kept for it', () => {
    expect(decideLoad('tab-1', PATH, HASH_PENDING)).toEqual({ kind: 'file' })
    expect(decideLoad('tab-1', PATH, 'hash-1')).toEqual({ kind: 'file' })
  })

  it('brings this tab\u2019s own buffer back, whatever the file\u2019s version', () => {
    keep('tab-1', 'hash-1')
    for (const hash of [HASH_PENDING, HASH_UNAVAILABLE, 'hash-1', 'hash-9']) {
      expect(decideLoad('tab-1', PATH, hash)).toEqual({
        kind: 'buffer',
        buffer: { workbook: { wb: 'tab-1' }, from: 'tab' },
      })
    }
  })

  it('waits for the hash before judging a buffer whose tab is gone', () => {
    keep('tab-1', 'hash-1')
    expect(decideLoad('tab-2', PATH, HASH_PENDING)).toEqual({ kind: 'deferred' })
  })

  it('restores a kept buffer while the file is still the version it came from', () => {
    keep('tab-1', 'hash-1')
    expect(decideLoad('tab-2', PATH, 'hash-1')).toEqual({
      kind: 'buffer',
      buffer: { workbook: { wb: 'tab-1' }, from: 'recovery' },
    })
  })

  it('offers, never applies, a buffer written from another version of the file', () => {
    keep('tab-1', 'hash-1')
    expect(decideLoad('tab-2', PATH, 'hash-2')).toEqual({
      kind: 'offer',
      buffer: { workbook: { wb: 'tab-1' }, from: 'recovery' },
    })
  })

  it('offers instead of waiting when no hash can be had at all', () => {
    keep('tab-1', 'hash-1')
    // No secure context means no digest, and a panel that waited for one would
    // never load anything: this is the case that must not be `deferred`.
    expect(decideLoad('tab-2', PATH, HASH_UNAVAILABLE)).toEqual({
      kind: 'offer',
      buffer: { workbook: { wb: 'tab-1' }, from: 'recovery' },
    })
  })

  it('restores a buffer that never had a hash of its own when nothing can be compared', () => {
    // Both sides are unknown (no digest available, and the buffer was written
    // before one was computed), so the work is kept rather than discarded.
    keep('tab-1', undefined)
    expect(decideLoad('tab-2', PATH, HASH_UNAVAILABLE)).toMatchObject({ kind: 'buffer' })
    // With a hash in hand, an unversioned buffer is not evidence of anything.
    expect(decideLoad('tab-2', PATH, 'hash-1')).toMatchObject({ kind: 'offer' })
  })

  it('does not confuse one file with another', () => {
    keep('tab-1', 'hash-1')
    expect(decideLoad('tab-2', 'books/other.xlsx', 'hash-1')).toEqual({ kind: 'file' })
  })
})
