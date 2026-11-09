import { describe, expect, it, vi } from 'vitest'

// SpreadJS is not loadable in a Node test environment (it touches DOM/canvas
// at import). Stub the packages so we can exercise client apply() registration
// and the file-type mapping helpers.
vi.mock('@grapecity-software/spread-sheets', () => ({
  Spread: {
    Sheets: {
      Workbook: class {},
      FileType: { excel: 0, ssjson: 1, csv: 2 },
    },
  },
}))
vi.mock('@grapecity-software/spread-sheets-io', () => ({}))
vi.mock('@grapecity-software/spread-sheets-resources-zh', () => ({}))
vi.mock('@grapecity-software/spread-sheets-designer', () => ({}))
vi.mock('@grapecity-software/spread-sheets-designer-resources-cn', () => ({}))
vi.mock('@grapecity-software/spread-sheets-shapes', () => ({}))
vi.mock('@grapecity-software/spread-sheets-charts', () => ({}))
vi.mock('@grapecity-software/spread-sheets-slicers', () => ({}))
vi.mock('@grapecity-software/spread-sheets-sparklines', () => ({}))
vi.mock('@grapecity-software/spread-sheets-print', () => ({}))
vi.mock('@grapecity-software/spread-sheets-pdf', () => ({}))
vi.mock('@grapecity-software/spread-sheets-barcode', () => ({}))
vi.mock('@grapecity-software/spread-sheets-formula-panel', () => ({}))
vi.mock('@grapecity-software/spread-sheets-pivot-addon', () => ({}))
vi.mock('@grapecity-software/spread-sheets-tablesheet', () => ({}))
vi.mock('@grapecity-software/spread-sheets-datacharts-addon', () => ({}))
vi.mock('@grapecity-software/spread-sheets-ganttsheet', () => ({}))
vi.mock('@grapecity-software/spread-sheets-reportsheet-addon', () => ({}))
vi.mock('@grapecity-software/spread-sheets-languagepackages', () => ({}))

import {
  BRIDGE_SETTINGS_ID,
  BRIDGE_SETTINGS_ORDER,
  BRIDGE_SETTINGS_SLOT,
  SPREADSHEET_BINARY_EXTENSIONS,
  SPREADSHEET_DOCUMENT_ID,
  SPREADSHEET_EXTENSIONS,
  apply,
  inject,
  name,
} from '../src/client/index.ts'
import { BRIDGE_REGISTRY_SERVICE } from '../src/client/bridge-registry.ts'
import { EDITOR_LOCALE_NAMESPACE, EDITOR_TITLE_FALLBACK } from '../src/client/locales.ts'
import { workbookFileType } from '../src/client/SpreadsheetHost.tsx'
import { ProtectedSpreadsheetDocument } from '../src/client/editor-failure.tsx'

/** One light snapshot, in the shape `ctx.theme.getTheme()` returns. */
const themeSnapshot = {
  preference: 'system',
  fontSize: 14,
  active: { id: 'light', colorScheme: 'light', tokens: {} },
  themes: [],
  revision: 0,
}

interface CtxDouble {
  ctx: Record<string, unknown>
  disposers: Array<() => unknown>
  previewRegister: ReturnType<typeof vi.fn>
  previewDispose: ReturnType<typeof vi.fn>
  slotInject: ReturnType<typeof vi.fn>
  slotRegister: ReturnType<typeof vi.fn>
  themeGet: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  inject: ReturnType<typeof vi.fn>
  provide: ReturnType<typeof vi.fn>
  /** The services `provide` was called with, by name. */
  provided: Map<string, unknown>
}

/** Options the double needs to make an optional service present or absent. */
interface CtxOptions {
  locale?: unknown
  /**
   * The settings service the bridge page is filed through. Absent by default,
   * which is the state a profile without a settings surface has.
   */
  configForms?: unknown
}

/**
 * A cordis-shaped double carrying everything the plugin reads: the two
 * registries it writes to, the theme service it follows, the optional locale
 * service, and the event bus.
 *
 * `ctx.effect` runs its callback immediately and records the returned disposer,
 * which is how the real client runtime applies a plugin body. `ctx.inject` runs
 * its callback in a child scope when the requested services exist; a requested
 * `locale` that the caller did not supply leaves the callback unrun, exactly as
 * the real injection does, which is what makes the fallback name testable.
 */
function makeCtx(options: CtxOptions = {}): CtxDouble {
  const disposers: Array<() => unknown> = []
  const previewDispose = vi.fn()
  const previewRegister = vi.fn((_definition: unknown) => previewDispose)
  const slotDispose = vi.fn()
  const slotRegister = vi.fn((_seat: unknown, _component: unknown) => slotDispose)
  const slotInject = vi.fn((_name: string, callback: () => unknown) => callback())
  const themeGet = vi.fn(() => themeSnapshot)
  const on = vi.fn(() => () => {})

  const effect = vi.fn((execute: unknown) => {
    const result = (execute as () => unknown)()
    if (typeof result === 'function') disposers.push(result as () => unknown)
    return result
  })

  // The services a child scope resolves, which is what `ctx.inject` hands its
  // callback. `slots` is the same object the top-level ctx carries, so a
  // registration made through a child lands where the real one would.
  const services: Record<string, unknown> = {
    slots: { inject: slotInject, register: slotRegister },
    configForms: options.configForms,
    locale: options.locale,
  }
  const child = {
    effect,
    get: (serviceName: string) => services[serviceName],
    ...services,
  }
  const inject = vi.fn((deps: readonly string[], callback: (scope: unknown) => unknown) => {
    if (deps.includes('locale') && options.locale === undefined) return { dispose: () => {} }
    callback(child)
    return { dispose: () => {} }
  })

  const provided = new Map<string, unknown>()
  const provide = vi.fn((serviceName: string, value: unknown) => {
    provided.set(serviceName, value)
  })

  const ctx = {
    effect,
    documentPreviews: { register: previewRegister },
    slots: { inject: slotInject, register: slotRegister },
    theme: { getTheme: themeGet },
    on,
    inject,
    provide,
  }
  apply(ctx as never)

  return {
    ctx, disposers, provided, provide,
    previewRegister, previewDispose, slotInject, slotRegister, themeGet, on, inject,
  }
}

/**
 * A locale service double: dictionaries are registered all at once and the bound
 * translator reads the active language at call time, so a switch must be visible
 * without re-registering anything.
 */
function makeLocale(active = 'zh') {
  const dictionaries = new Map<string, Record<string, Record<string, string>>>()
  let language = active
  const register = vi.fn((namespace: string, dicts: Record<string, Record<string, string>>) => {
    dictionaries.set(namespace, dicts)
    return vi.fn()
  })
  const bind = vi.fn((namespace: string) => (key: string) => dictionaries.get(namespace)?.[language]?.[key] ?? key)
  return {
    locale: { register, bind },
    register,
    bind,
    switchTo: (next: string) => { language = next },
  }
}

describe('client plugin manifest', () => {
  it('exports the stable plugin name', () => {
    expect(name).toBe('dsh-spreadjs-editor')
  })

  it('requires the harness document registries and the theme service', () => {
    expect(inject).toEqual(['documentPreviews', 'slots', 'theme'])
  })

  it('subscribes to the harness palette for the plugin lifetime', () => {
    const { themeGet, on } = makeCtx()

    // The editor cannot read the palette from CSS (SpreadJS needs one of two
    // stylesheets), so the subscription is the only way it learns the scheme.
    expect(themeGet).toHaveBeenCalled()
    expect(on).toHaveBeenCalledWith('theme/change', expect.any(Function))
  })

  it('maps file extensions to SpreadJS FileType enums', () => {
    expect(workbookFileType('a.xlsx')).toBe(0)
    expect(workbookFileType('a.xlsm')).toBe(0)
    expect(workbookFileType('a.csv')).toBe(2)
    expect(workbookFileType('a.ssjson')).toBe(1)
    expect(workbookFileType('a.json')).toBe(1)
  })
})

describe('viewer name', () => {
  it('falls back to the shipped name when no locale service is composed in', () => {
    const { previewRegister, disposers } = makeCtx()
    const definition = previewRegister.mock.calls[0]?.[0] as { title: () => string }

    expect(definition.title()).toBe(EDITOR_TITLE_FALLBACK)
    for (const dispose of disposers) dispose()
  })

  it('follows the harness locale, reading it at call time', () => {
    const { locale, register, bind, switchTo } = makeLocale('zh')
    const { previewRegister, disposers } = makeCtx({ locale })
    const definition = previewRegister.mock.calls[0]?.[0] as { title: () => string }

    expect(register).toHaveBeenCalledWith(EDITOR_LOCALE_NAMESPACE, {
      zh: expect.any(Object),
      en: expect.any(Object),
    })
    expect(bind).toHaveBeenCalledWith(EDITOR_LOCALE_NAMESPACE)
    // "SpreadJS 编辑器", not "SpreadJS": the product's own Excel preview is
    // listed as "表格" beside it, so the name has to say which one edits.
    expect(definition.title()).toBe('SpreadJS 编辑器')

    switchTo('en')
    expect(definition.title()).toBe('SpreadJS Editor')

    // Releasing the plugin drops the translation rather than keeping a stale one.
    for (const dispose of disposers) dispose()
    expect(definition.title()).toBe(EDITOR_TITLE_FALLBACK)
  })
})

describe('document registration', () => {
  it('claims the workbook suffixes as an external implementation', () => {
    const { previewRegister } = makeCtx()

    expect(previewRegister).toHaveBeenCalledTimes(1)
    const definition = previewRegister.mock.calls[0]?.[0] as unknown as {
      id?: unknown
      extensions?: readonly unknown[]
      priority?: unknown
      title?: unknown
      loading?: unknown
      wrap?: unknown
    }
    expect(definition.id).toBe(SPREADSHEET_DOCUMENT_ID)
    expect(definition.extensions).toEqual([...SPREADSHEET_EXTENSIONS])
    // Omitted on purpose: the registry's default `extension` band is what keeps
    // this implementation ahead of the product's own Excel preview — a builtin
    // that claims `xlsx`/`xls`/`csv`/`tsv` from DSH 0.1.7 on.
    expect(definition.priority).toBeUndefined()
    expect(definition.loading).toBe('bytes-complete')
    expect(definition.wrap).toBe(false)
  })

  it('declares the workbook suffixes whose bytes are not text', () => {
    const { previewRegister } = makeCtx()
    const definition = previewRegister.mock.calls[0]?.[0] as {
      extensions: readonly string[]
      binaryExtensions?: readonly string[]
    }

    expect(definition.binaryExtensions).toEqual([...SPREADSHEET_BINARY_EXTENSIONS])
    // A stray suffix is not a warning: the registry throws on it, which would
    // cost the whole editor rather than one file type.
    for (const suffix of definition.binaryExtensions ?? []) {
      expect(definition.extensions).toContain(suffix)
    }
    // Text, and the product's own registration splits it the same way.
    expect(definition.binaryExtensions).not.toContain('csv')
  })

  it('binds the body to the same identity in the document slot', () => {
    const { slotInject, slotRegister } = makeCtx()

    expect(slotInject).toHaveBeenCalledWith('sidebar.right.tab.document', expect.any(Function))
    const seat = slotRegister.mock.calls[0]?.[0] as unknown as { name?: unknown; key?: unknown }
    expect(seat.name).toBe('sidebar.right.tab.document')
    expect(seat.key).toBe(SPREADSHEET_DOCUMENT_ID)
    expect(slotRegister.mock.calls[0]?.[1]).toBe(ProtectedSpreadsheetDocument)
  })

  it('registers the file actions in the harness document header', () => {
    const { slotInject, slotRegister } = makeCtx()

    expect(slotInject).toHaveBeenCalledWith('sidebar.right.tab.document.actions', expect.any(Function))
    // The second seat, in registration order: Save is a file action, so it belongs
    // in the header the platform draws above the previewed file.
    const seat = slotRegister.mock.calls[1]?.[0] as unknown as {
      name?: unknown
      id?: unknown
      key?: unknown
      order?: unknown
    }
    expect(seat.name).toBe('sidebar.right.tab.document.actions')
    // A list slot identifies a contribution by id; `key` is the keyed-slot form.
    expect(seat.id).toBe('spreadjs-save')
    expect(seat.key).toBeUndefined()
    // The list slot's documented display order ("List display order"), pinned at the
    // value the harness itself uses for "first in a header actions list". Left at the
    // default 0 this entry ties with the product's own `open-in-app` contribution and
    // plugin load order — an accident — decides which of the two draws first.
    expect(seat.order).toBe(-10)
    expect(typeof slotRegister.mock.calls[1]?.[1]).toBe('function')
  })

  it('claims exactly those two seats: no tab type, pane, store or layout', () => {
    const { slotRegister } = makeCtx()

    expect(slotRegister).toHaveBeenCalledTimes(2)
  })

  it('disposes both registrations with the plugin fiber', () => {
    const { disposers, previewDispose, slotRegister } = makeCtx()

    for (const disposer of disposers) disposer()

    expect(previewDispose).toHaveBeenCalled()
    for (const result of slotRegister.mock.results) {
      expect((result.value as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    }
    expect(slotRegister.mock.results).toHaveLength(2)
  })
})

describe('bridge registry', () => {
  it('publishes the roster under the name another plugin reads it by', () => {
    const { provided } = makeCtx()

    const registry = provided.get(BRIDGE_REGISTRY_SERVICE)

    expect(registry).toBeDefined()
    // A roster with nobody on it is a valid state, not a failure: the editor is
    // complete without a bridge.
    expect((registry as { list(): unknown[] }).list()).toEqual([])
  })

  it('offers no bridge until one is chosen, then hands over the chosen one', () => {
    const { provided } = makeCtx()
    const registry = provided.get(BRIDGE_REGISTRY_SERVICE) as {
      register(entry: unknown): () => void
      current(): { id: string } | undefined
      select(id: string | undefined): void
    }
    let attachments = 0
    registry.register({ id: 'a-bridge', title: () => 'A', attach: () => { attachments += 1; return () => {} } })

    expect(registry.current()).toBeUndefined()

    registry.select('a-bridge')

    expect(attachments).toBe(1)
    expect(registry.current()?.id).toBe('a-bridge')
  })
})

describe('bridge settings page', () => {
  it('registers a page in the settings nav when the settings surface is present', () => {
    const form = {
      getSnapshot: () => ({ status: 'ready' as const, value: {} }),
      subscribe: () => () => {},
      set: async () => true,
    }
    const { slotRegister } = makeCtx({ configForms: { get: () => form } })

    const seats = slotRegister.mock.calls.map(call => call[0] as Record<string, unknown>)
    const page = seats.find(seat => seat.name === BRIDGE_SETTINGS_SLOT)

    expect(page).toMatchObject({ id: BRIDGE_SETTINGS_ID, order: BRIDGE_SETTINGS_ORDER })
    // A thunk, so the nav text follows the active locale without re-registering.
    expect(typeof page?.label).toBe('function')
  })

  it('costs nothing when the profile has no settings surface', () => {
    // A headless profile has no `configForms`. The document body must still
    // mount; only this page is missing, and nothing may throw on the way.
    expect(() => makeCtx()).not.toThrow()
    const { slotRegister } = makeCtx()

    expect(slotRegister.mock.calls.map(call => (call[0] as { name: string }).name))
      .not.toContain(BRIDGE_SETTINGS_SLOT)
  })
})
