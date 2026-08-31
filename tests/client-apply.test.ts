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
vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({}))

import { apply, inject, name } from '../src/client/index.ts'
import { exportFileType, workbookFileType } from '../src/client/SpreadsheetHost.tsx'

interface EditorServiceMock {
  register: ReturnType<typeof vi.fn>
}

function makeCtx(editors?: EditorServiceMock) {
  const disposers: Array<() => unknown> = []
  const ctx = {
    get: vi.fn((key: string) => key === 'webFileEditors' ? editors : undefined),
    effect: vi.fn((execute: unknown) => {
      const result = (execute as () => unknown)()
      if (typeof result === 'function') disposers.push(result as () => unknown)
      return result
    }),
  }
  return { ctx, disposers }
}

describe('client plugin manifest', () => {
  it('exports the stable plugin name', () => {
    expect(name).toBe('dsh-spreadjs-editor')
  })

  it('declares webFileEditors as a hard client dependency', () => {
    expect(inject).toEqual(['webFileEditors'])
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

  it('registers the SpreadJS editor through webFileEditors', () => {
    const disposeEditor = vi.fn()
    const register = vi.fn((_editor: unknown) => disposeEditor)
    const { ctx, disposers } = makeCtx({ register })

    apply(ctx as never)

    expect(register).toHaveBeenCalledTimes(1)
    const registration = register.mock.calls[0]?.[0] as unknown as {
      id?: unknown
      title?: unknown
      extensions?: readonly unknown[]
      component?: unknown
    }
    expect(registration.id).toBe('spreadjs')
    expect(registration.title).toBe('SpreadJS')
    expect(registration.extensions).toEqual(['.xlsx', '.xlsm', '.csv', '.sjs', '.ssjson'])
    expect(typeof registration.component).toBe('function')
    expect(disposers).toContain(disposeEditor)
    for (const disposer of disposers) expect(typeof disposer).toBe('function')
  })

  it('does not crash when webFileEditors is absent', () => {
    const { ctx } = makeCtx(undefined)

    expect(() => apply(ctx as never)).not.toThrow()
    expect(ctx.get).toHaveBeenCalledWith('webFileEditors')
    expect(ctx.effect).toHaveBeenCalledTimes(1)
  })
})
