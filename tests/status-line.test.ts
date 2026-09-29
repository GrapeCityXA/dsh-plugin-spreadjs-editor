import { describe, expect, it } from 'vitest'
import { statusLineFor } from '../src/client/status-line.ts'

describe('the panel state pill', () => {
  it('says nothing for a file whose edits are all on disk', () => {
    // The pill floats over the sheet, so a permanent "Saved" would be furniture over
    // someone's spreadsheet; where the platform publishes the header actions slot
    // (DSH 0.1.7+), the Save button already carries that mark.
    expect(statusLineFor({ dirty: false, hasHeld: false, hasOffered: false })).toBeUndefined()
  })

  it('reports live edits that no buffer holds', () => {
    expect(statusLineFor({ dirty: true, hasHeld: false, hasOffered: false })).toEqual({
      key: 'unsaved.dirty',
      canRestore: false,
      canDiscard: true,
    })
  })

  it('reports a buffer that came back from this session', () => {
    expect(statusLineFor({ dirty: true, hasHeld: true, hasOffered: false })).toEqual({
      key: 'unsaved.restored',
      canRestore: false,
      canDiscard: true,
    })
  })

  it('reports a buffer the file on disk has moved past, and offers it back', () => {
    expect(statusLineFor({ dirty: true, hasHeld: false, hasOffered: true })).toEqual({
      key: 'unsaved.stale',
      canRestore: true,
      canDiscard: true,
    })
  })

  it('ranks the sharper buffer state above the others', () => {
    // A stale buffer is both "offered" and unsaved work, and it must not be
    // reported as the milder restored case.
    expect(statusLineFor({ dirty: false, hasHeld: true, hasOffered: true })?.key).toBe('unsaved.stale')
    expect(statusLineFor({ dirty: true, hasHeld: true, hasOffered: false })?.key).toBe('unsaved.restored')
  })

  it('never leaves unsaved work without a way out', () => {
    const states = [
      { dirty: true, hasHeld: false, hasOffered: false },
      { dirty: true, hasHeld: true, hasOffered: false },
      { dirty: true, hasHeld: false, hasOffered: true },
    ]
    for (const state of states) {
      expect(statusLineFor(state)?.canDiscard, JSON.stringify(state)).toBe(true)
    }
    // The one case that offers nothing is the one with nothing pending.
    expect(statusLineFor({ dirty: false, hasHeld: false, hasOffered: false })).toBeUndefined()
  })
})
