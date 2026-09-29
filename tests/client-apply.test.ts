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
vi.mock('@grapecity-software/spread-excelio', () => ({ IO: class {} }))
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

import { SPREADSHEET_DOCUMENT_ID, SPREADSHEET_EXTENSIONS, apply, inject, name } from '../src/client/index.ts'
import { exportFileType, workbookFileType } from '../src/client/SpreadsheetHost.tsx'

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
}

/**
 * A cordis-shaped double carrying everything the plugin reads: the two
 * registries it writes to, the theme service it follows, and the event bus.
 *
 * `ctx.effect` runs its callback immediately and records the returned disposer,
 * which is how the real client runtime applies a plugin body.
 */
function makeCtx(): CtxDouble {
  const disposers: Array<() => unknown> = []
  const previewDispose = vi.fn()
  const previewRegister = vi.fn((_definition: unknown) => previewDispose)
  const slotDispose = vi.fn()
  const slotRegister = vi.fn((_seat: unknown, _component: unknown) => slotDispose)
  const slotInject = vi.fn((_name: string, callback: () => unknown) => callback())
  const themeGet = vi.fn(() => themeSnapshot)
  const on = vi.fn(() => () => {})

  const ctx = {
    effect: vi.fn((execute: unknown) => {
      const result = (execute as () => unknown)()
      if (typeof result === 'function') disposers.push(result as () => unknown)
      return result
    }),
    documentPreviews: { register: previewRegister },
    slots: { inject: slotInject, register: slotRegister },
    theme: { getTheme: themeGet },
    on,
    inject: vi.fn(() => ({ dispose: () => {} })),
  }
  apply(ctx as never)

  return { ctx, disposers, previewRegister, previewDispose, slotInject, slotRegister, themeGet, on }
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

  it('maps file extensions and export formats to SpreadJS FileType enums', () => {
    expect(workbookFileType('a.xlsx')).toBe(0)
    expect(workbookFileType('a.xlsm')).toBe(0)
    expect(workbookFileType('a.csv')).toBe(2)
    expect(workbookFileType('a.ssjson')).toBe(1)
    expect(workbookFileType('a.json')).toBe(1)
    expect(exportFileType('xlsx')).toBe(0)
    expect(exportFileType('csv')).toBe(2)
    expect(exportFileType('ssjson')).toBe(1)
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
    // Omitted on purpose: the registry's default `extension` band is what puts
    // this implementation ahead of the product's own builtins.
    expect(definition.priority).toBeUndefined()
    expect(definition.loading).toBe('bytes-complete')
    expect(definition.wrap).toBe(false)
    expect((definition.title as () => string)()).toBe('SpreadJS')
  })

  it('binds the body to the same identity in the document slot', () => {
    const { slotInject, slotRegister } = makeCtx()

    expect(slotInject).toHaveBeenCalledWith('sidebar.right.tab.document', expect.any(Function))
    expect(slotRegister).toHaveBeenCalledTimes(1)
    const seat = slotRegister.mock.calls[0]?.[0] as unknown as { name?: unknown; key?: unknown }
    expect(seat.name).toBe('sidebar.right.tab.document')
    expect(seat.key).toBe(SPREADSHEET_DOCUMENT_ID)
    expect(typeof slotRegister.mock.calls[0]?.[1]).toBe('function')
  })

  it('disposes both registrations with the plugin fiber', () => {
    const { disposers, previewDispose, slotRegister } = makeCtx()

    for (const disposer of disposers) disposer()

    expect(previewDispose).toHaveBeenCalled()
    const slotDispose = slotRegister.mock.results[0]?.value as ReturnType<typeof vi.fn>
    expect(slotDispose).toHaveBeenCalled()
  })
})
