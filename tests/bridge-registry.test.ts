import { describe, expect, it, vi } from 'vitest'
import { createBridgeRegistry, type SpreadjsBridgeEntry } from '../src/client/bridge-registry.ts'

function entry(id: string, title = id): SpreadjsBridgeEntry {
  return { id, title: () => title, attach: () => () => undefined }
}

describe('the bridge registry', () => {
  it('lists what has been registered, in registration order', () => {
    const registry = createBridgeRegistry()
    registry.register(entry('a'))
    registry.register(entry('b'))

    expect(registry.list().map(item => item.id)).toEqual(['a', 'b'])
  })

  it('refuses a duplicate id instead of letting the later one win', () => {
    const registry = createBridgeRegistry()
    registry.register(entry('a'))

    // Two plugins claiming one id is a collision somebody has to fix; a silent
    // last-wins is how a plugin the user meant to replace keeps being used.
    expect(() => registry.register(entry('a'))).toThrow(/already registered/)
  })

  it('removes an entry when its disposer runs, and notifies', () => {
    const registry = createBridgeRegistry()
    const listener = vi.fn()
    registry.subscribe(listener)
    const release = registry.register(entry('a'))

    release()

    expect(registry.list()).toEqual([])
    expect(listener).toHaveBeenCalled()
  })

  it('is idempotent, and only removes the entry it owns', () => {
    const registry = createBridgeRegistry()
    const release = registry.register(entry('a'))
    release()
    // A plugin unloading twice, or during a teardown, must not throw…
    expect(() => release()).not.toThrow()

    // …and a re-registration of the same id survives the stale disposer.
    registry.register(entry('a'))
    release()
    expect(registry.list().map(item => item.id)).toEqual(['a'])
  })

  it('stops notifying after unsubscribe', () => {
    const registry = createBridgeRegistry()
    const listener = vi.fn()
    const off = registry.subscribe(listener)
    off()

    registry.register(entry('a'))

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('selection', () => {
  it('starts with nothing selected', () => {
    const registry = createBridgeRegistry()
    registry.register(entry('a'))

    expect(registry.selected()).toBeUndefined()
    expect(registry.current()).toBeUndefined()
  })

  it('resolves the chosen entry', () => {
    const registry = createBridgeRegistry()
    const a = entry('a')
    registry.register(a)

    registry.select('a')

    expect(registry.selected()).toBe('a')
    expect(registry.current()).toBe(a)
  })

  it('clears the choice with undefined', () => {
    const registry = createBridgeRegistry()
    registry.register(entry('a'))
    registry.select('a')

    registry.select(undefined)

    expect(registry.selected()).toBeUndefined()
    expect(registry.current()).toBeUndefined()
  })

  it('notifies on a real change but not on a no-op', () => {
    const registry = createBridgeRegistry()
    registry.register(entry('a'))
    const listener = vi.fn()
    registry.subscribe(listener)

    registry.select('a')
    expect(listener).toHaveBeenCalledTimes(1)

    registry.select('a')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('KEEPS a choice that is not registered yet, and resolves it when it arrives', () => {
    // The boot-order case: the saved choice is read before the provider has
    // registered itself. Dropping it here would look like the setting did not
    // stick; resolving it late is what makes the saved choice work at all.
    const registry = createBridgeRegistry()
    registry.select('later')

    expect(registry.selected()).toBe('later')
    expect(registry.current()).toBeUndefined()

    const late = entry('later')
    registry.register(late)

    expect(registry.current()).toBe(late)
  })

  it('reports the choice but no entry once the chosen bridge goes away', () => {
    // Uninstalling the chosen provider leaves the user's choice intact — it is
    // still what they picked — but there is nothing to hand the workbook to, so
    // the caller attaches to nothing rather than to the wrong thing.
    const registry = createBridgeRegistry()
    const release = registry.register(entry('a'))
    registry.select('a')

    release()

    expect(registry.selected()).toBe('a')
    expect(registry.current()).toBeUndefined()
  })
})
