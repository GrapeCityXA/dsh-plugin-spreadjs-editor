/**
 * The bridge choice, and what happens when it cannot be stored.
 *
 * These exist because the bug that motivated this module was invisible: DSH
 * reports a REFUSED settings write by resolving `false`, not by rejecting, so a
 * `.catch`-only handler saw a control that looked like it worked while every
 * click was being declined. What is asserted here is the pair of facts that
 * failure depended on — the direction of truth, and that a refusal is reported.
 */
import { describe, expect, it, vi } from 'vitest'
import { connectBridgeSetting, type ConfigFormLike } from '../src/client/bridge-setting.ts'
import { createBridgeRegistry, type SpreadjsBridgeEntry } from '../src/client/bridge-registry.ts'
import { BRIDGE_FIELD, NO_BRIDGE, SETTINGS_NAMESPACE } from '../src/shared/settings.ts'

/**
 * A settings form double for one namespace.
 *
 * Mutable on purpose: a test drives it the way the Host does — by changing the
 * stored value and notifying — rather than by reaching into the plugin.
 */
function makeForm(initial?: string) {
  const value: Record<string, unknown> = initial === undefined ? {} : { [BRIDGE_FIELD]: initial }
  const listeners = new Set<() => void>()
  /** What the next `set` answers with; `false` is the Host's refusal. */
  let answer: unknown = true

  const form: ConfigFormLike = {
    getSnapshot: () => ({ status: 'ready', value }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: vi.fn(async (field: string, next: unknown) => {
      const verdict = answer
      // One-shot: a test that arms a refusal is describing one write, and a
      // later accepted write is exactly what "the warning clears" needs.
      answer = true
      if (verdict === true) value[field] = next
      return verdict
    }),
  }

  return {
    form,
    /** The entry id the service was asked for. */
    set: form.set as ReturnType<typeof vi.fn>,
    /** Make the NEXT write be refused, or throw. */
    refuse: () => { answer = false },
    fail: () => { answer = Promise.reject(new Error('offline')) },
    /** Change the stored value the way a second browser, or a reload, would. */
    store: (next: string) => {
      value[BRIDGE_FIELD] = next
      for (const listener of [...listeners]) listener()
    },
  }
}

function makeForms(initial?: string) {
  const double = makeForm(initial)
  const get = vi.fn((_entryId: string) => double.form)
  return { forms: { get }, get, ...double }
}

function makeEntry(id: string): SpreadjsBridgeEntry & { attached: number } {
  const entry = {
    id,
    title: () => id,
    attached: 0,
    attach: () => {
      entry.attached += 1
      return () => {}
    },
  }
  return entry
}

describe('the settings document is the source of truth', () => {
  it('binds to the namespace the host derives from the loader entry id', () => {
    const { forms, get } = makeForms()
    connectBridgeSetting(forms, createBridgeRegistry())

    expect(get).toHaveBeenCalledWith(SETTINGS_NAMESPACE)
  })

  it('adopts the stored choice on connect', () => {
    const registry = createBridgeRegistry()
    const driver = makeEntry('spreadjs-driver')
    registry.register(driver)

    const { forms } = makeForms('spreadjs-driver')
    connectBridgeSetting(forms, registry)

    expect(registry.selected()).toBe('spreadjs-driver')
    expect(registry.current()?.id).toBe('spreadjs-driver')
  })

  it('follows a change made elsewhere, without re-registering anything', () => {
    const registry = createBridgeRegistry()
    registry.register(makeEntry('a'))
    registry.register(makeEntry('b'))

    const { forms, store } = makeForms('a')
    connectBridgeSetting(forms, registry)
    expect(registry.selected()).toBe('a')

    store('b')
    expect(registry.selected()).toBe('b')
  })

  it('treats the empty string as a real choice — none — not as "not loaded"', () => {
    const registry = createBridgeRegistry()
    registry.register(makeEntry('a'))

    const { forms } = makeForms(NO_BRIDGE)
    connectBridgeSetting(forms, registry)

    expect(registry.selected()).toBeUndefined()
    expect(registry.current()).toBeUndefined()
  })

  it('leaves the selection alone while the form has not loaded', () => {
    const registry = createBridgeRegistry()
    registry.register(makeEntry('a'))
    registry.select('a')

    const { form } = makeForm('a')
    const loading: ConfigFormLike = { ...form, getSnapshot: () => ({ status: 'loading' }) }
    connectBridgeSetting({ get: () => loading }, registry)

    // A form that has not loaded yet says nothing, so it must not be read as
    // "nothing is chosen" and clear a selection that is on its way.
    expect(registry.selected()).toBe('a')
  })
})

describe('a choice that cannot be stored is reported, not swallowed', () => {
  it('reports a write the host REFUSED — which resolves false rather than throwing', async () => {
    const registry = createBridgeRegistry()
    registry.register(makeEntry('a'))
    const { forms, refuse } = makeForms()
    const setting = connectBridgeSetting(forms, registry)
    refuse()

    setting.choose('a')
    await vi.waitFor(() => { expect(setting.storageNote()).toBe('refused') })

    // Applied anyway: the control responds now, and the choice is live for this
    // session. Only its persistence failed, and that is what is reported.
    expect(registry.selected()).toBe('a')
    expect(setting.persisted()).toBe('a')
  })

  it('reports a write that threw', async () => {
    const registry = createBridgeRegistry()
    registry.register(makeEntry('a'))
    const { forms, fail } = makeForms()
    const setting = connectBridgeSetting(forms, registry)
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    fail()

    setting.choose('a')
    await vi.waitFor(() => { expect(setting.storageNote()).toBe('failed') })
    quiet.mockRestore()
  })

  it('clears the note once a write is accepted, so a stale warning does not linger', async () => {
    const registry = createBridgeRegistry()
    registry.register(makeEntry('a'))
    const { forms, refuse } = makeForms()
    const setting = connectBridgeSetting(forms, registry)

    refuse()
    setting.choose('a')
    await vi.waitFor(() => { expect(setting.storageNote()).toBe('refused') })

    setting.choose(undefined)
    await vi.waitFor(() => { expect(setting.storageNote()).toBeUndefined() })
  })

  it('applies the choice before the write settles, so the UI never waits on the file', () => {
    const registry = createBridgeRegistry()
    registry.register(makeEntry('a'))
    const { forms } = makeForms()
    const setting = connectBridgeSetting(forms, registry)

    setting.choose('a')

    expect(registry.selected()).toBe('a')
  })

  it('notifies subscribers of both the choice and the note', async () => {
    const registry = createBridgeRegistry()
    registry.register(makeEntry('a'))
    const { forms } = makeForms()
    const setting = connectBridgeSetting(forms, registry)
    const seen = vi.fn()
    setting.subscribe(seen)

    setting.choose('a')
    await vi.waitFor(() => { expect(seen).toHaveBeenCalled() })
  })
})

describe('saved choices survive asynchronous bridge registration', () => {
  it('keeps the selected bridge when another bridge registers first', async () => {
    const registry = createBridgeRegistry()
    const { forms, set } = makeForms('spreadjs-driver')
    const setting = connectBridgeSetting(forms, registry)

    registry.register(makeEntry('another-driver'))
    await Promise.resolve()
    expect(registry.selected()).toBe('spreadjs-driver')
    expect(registry.current()).toBeUndefined()
    expect(setting.persisted()).toBe('spreadjs-driver')
    expect(set).not.toHaveBeenCalled()

    const driver = makeEntry('spreadjs-driver')
    registry.register(driver)
    expect(registry.current()).toBe(driver)
    expect(set).not.toHaveBeenCalled()
  })

  it('restores a temporarily unloaded selection while another bridge stays registered', () => {
    const registry = createBridgeRegistry()
    registry.register(makeEntry('another-driver'))
    const remove = registry.register(makeEntry('spreadjs-driver'))
    const { forms, set } = makeForms('spreadjs-driver')
    connectBridgeSetting(forms, registry)

    remove()
    expect(registry.selected()).toBe('spreadjs-driver')
    expect(registry.current()).toBeUndefined()
    const replacement = makeEntry('spreadjs-driver')
    registry.register(replacement)

    expect(registry.current()).toBe(replacement)
    expect(set).not.toHaveBeenCalled()
  })

  it('keeps an explicit None choice when the unavailable bridge later registers', async () => {
    const registry = createBridgeRegistry()
    const { forms, set } = makeForms('spreadjs-driver')
    const setting = connectBridgeSetting(forms, registry)
    setting.choose(undefined)
    registry.register(makeEntry('spreadjs-driver'))
    await Promise.resolve()

    expect(registry.selected()).toBeUndefined()
    expect(registry.current()).toBeUndefined()
    expect(setting.persisted()).toBe(NO_BRIDGE)
    expect(set).toHaveBeenCalledExactlyOnceWith(BRIDGE_FIELD, NO_BRIDGE)
  })

  it('keeps a stored id while the roster is still empty', async () => {
    const registry = createBridgeRegistry()
    const { forms, set } = makeForms('spreadjs-driver')
    const setting = connectBridgeSetting(forms, registry)

    await Promise.resolve()

    // Boot order: the saved choice is read before any provider has registered,
    // and "no provider yet" is indistinguishable from "the provider is gone".
    // Clearing on that would throw away the very setting this protects —
    // including one that a reinstall is about to restore.
    expect(set).not.toHaveBeenCalled()
    expect(setting.persisted()).toBe('spreadjs-driver')
  })

  it('keeps a stored id that IS on the roster', async () => {
    const registry = createBridgeRegistry()
    const { forms, set } = makeForms('spreadjs-driver')
    connectBridgeSetting(forms, registry)

    registry.register(makeEntry('spreadjs-driver'))
    await Promise.resolve()

    expect(set).not.toHaveBeenCalled()
  })
})
