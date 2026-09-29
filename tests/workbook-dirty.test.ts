import { describe, expect, it, vi } from 'vitest'
import {
  DIRTY_EVENT_NAMES,
  resolveDirtyEvents,
  watchWorkbookChanges,
} from '../src/client/workbook-dirty.ts'

/** A workbook double that records how it was watched and can fire its own events. */
function workbookDouble() {
  const listeners = new Map<string, Array<() => void>>()
  const original = vi.fn((options: unknown) => options !== 'refused')
  const manager = { execute: original }
  const bound: string[] = []
  const unbound: string[] = []

  return {
    manager,
    original,
    bound,
    unbound,
    workbook: {
      commandManager: () => manager,
      bind: (type: string, _data?: unknown, fn?: () => void) => {
        bound.push(type)
        listeners.set(type, fn === undefined ? [] : [...listeners.get(type) ?? [], fn])
      },
      unbind: (type: string, fn?: () => void) => {
        unbound.push(type)
        const current = listeners.get(type) ?? []
        listeners.set(type, fn === undefined ? [] : current.filter(entry => entry !== fn))
      },
    },
    fire: (type: string) => { for (const fn of listeners.get(type) ?? []) fn() },
    listenerCount: (type: string) => listeners.get(type)?.length ?? 0,
  }
}

describe('workbook edit watch', () => {
  it('treats an executed command as an edit, and a refused one as none', () => {
    const double = workbookDouble()
    const onDirty = vi.fn()
    const watch = watchWorkbookChanges(double.workbook, onDirty, [])

    double.manager.execute({ cmd: 'editCell' } as never)
    expect(onDirty).toHaveBeenCalledTimes(1)
    // SpreadJS answers false for a command it did not run: not an edit.
    double.manager.execute('refused' as never)
    expect(onDirty).toHaveBeenCalledTimes(1)

    watch.stop()
  })

  it('treats a declared workbook event as an edit', () => {
    const double = workbookDouble()
    const onDirty = vi.fn()
    const watch = watchWorkbookChanges(double.workbook, onDirty, ['RangeChanged', 'SheetChanged'])

    expect(double.bound).toEqual(['RangeChanged', 'SheetChanged'])
    expect(double.listenerCount('RangeChanged')).toBe(1)
    double.fire('SheetChanged')
    expect(onDirty).toHaveBeenCalledTimes(1)

    watch.stop()
  })

  it('stops watching: the command manager is restored and the events are unbound', () => {
    const double = workbookDouble()
    const onDirty = vi.fn()
    const watch = watchWorkbookChanges(double.workbook, onDirty, ['RangeChanged'])

    // While watching, the instance method is this plugin's wrapper instead.
    expect(double.manager.execute).not.toBe(double.original)
    watch.stop()
    expect(double.manager.execute).toBe(double.original)
    expect(double.unbound).toEqual(['RangeChanged'])
    expect(double.listenerCount('RangeChanged')).toBe(0)

    double.manager.execute({ cmd: 'editCell' } as never)
    double.fire('RangeChanged')
    expect(onDirty).not.toHaveBeenCalled()
    // Stopping twice is not an error and does not double-unbind.
    watch.stop()
    expect(double.unbound).toEqual(['RangeChanged'])
  })

  it('watches a workbook that has no command manager, and one that cannot bind', () => {
    const onDirty = vi.fn()
    // Nothing to wrap and nothing to bind: a watch that does nothing is still a
    // watch, and stopping it must not throw.
    const watchBare = watchWorkbookChanges({}, onDirty)
    expect(() => watchBare.stop()).not.toThrow()

    // A build that refuses an unknown event name must not take the watch down with
    // it: the command path still reports edits.
    const double = workbookDouble()
    const refusing = {
      commandManager: double.workbook.commandManager,
      bind: () => { throw new Error('unknown event') },
      unbind: () => { throw new Error('unknown event') },
    }
    const watch = watchWorkbookChanges(refusing, onDirty, ['NotAnEvent'])
    double.manager.execute({ cmd: 'editCell' } as never)
    expect(onDirty).toHaveBeenCalledTimes(1)
    expect(() => watch.stop()).not.toThrow()
  })

  it('resolves only the event constants a build actually declares', () => {
    expect(resolveDirtyEvents(undefined)).toEqual([])
    expect(resolveDirtyEvents({ RangeChanged: 'RangeChanged', ValueChanged: 'ValueChanged' }))
      .toEqual(['RangeChanged', 'ValueChanged'])
    // Nothing is invented for a name the build has no constant for.
    expect(resolveDirtyEvents({ ValueChanged: 'ValueChanged' })).toEqual(['ValueChanged'])
    expect(DIRTY_EVENT_NAMES).toContain('SheetChanged')
  })
})
