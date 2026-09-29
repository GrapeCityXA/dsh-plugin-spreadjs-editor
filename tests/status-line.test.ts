import { describe, expect, it } from 'vitest'
import { statusLineFor } from '../src/client/status-line.ts'

describe('the panel state line', () => {
  it('reports a saved file and offers nothing to decide', () => {
    expect(statusLineFor({ dirty: false, hasHeld: false, hasOffered: false })).toEqual({
      key: 'unsaved.saved',
      tone: 'clean',
      canRestore: false,
      canDiscard: false,
    })
  })

  it('reports live edits that no buffer holds', () => {
    expect(statusLineFor({ dirty: true, hasHeld: false, hasOffered: false })).toEqual({
      key: 'unsaved.dirty',
      tone: 'dirty',
      canRestore: false,
      canDiscard: true,
    })
  })

  it('reports a buffer that came back from this session', () => {
    expect(statusLineFor({ dirty: true, hasHeld: true, hasOffered: false })).toEqual({
      key: 'unsaved.restored',
      tone: 'dirty',
      canRestore: false,
      canDiscard: true,
    })
  })

  it('reports a buffer the file on disk has moved past, and offers it back', () => {
    expect(statusLineFor({ dirty: true, hasHeld: false, hasOffered: true })).toEqual({
      key: 'unsaved.stale',
      tone: 'dirty',
      canRestore: true,
      canDiscard: true,
    })
  })

  it('ranks the sharper buffer state above the others', () => {
    // A stale buffer is both "offered" and unsaved work, and it must not be
    // reported as the milder restored case.
    expect(statusLineFor({ dirty: false, hasHeld: true, hasOffered: true }).key).toBe('unsaved.stale')
    expect(statusLineFor({ dirty: true, hasHeld: true, hasOffered: false }).key).toBe('unsaved.restored')
  })

  it('never leaves a dirty state without a way out', () => {
    const states = [
      { dirty: true, hasHeld: false, hasOffered: false },
      { dirty: true, hasHeld: true, hasOffered: false },
      { dirty: true, hasHeld: false, hasOffered: true },
    ]
    for (const state of states) {
      expect(statusLineFor(state).canDiscard).toBe(true)
      expect(statusLineFor(state).tone).toBe('dirty')
    }
    // The one case that offers nothing is the one with nothing pending.
    expect(statusLineFor({ dirty: false, hasHeld: false, hasOffered: false }).canDiscard).toBe(false)
  })
})
