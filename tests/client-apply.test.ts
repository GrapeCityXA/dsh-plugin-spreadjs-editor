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

interface CtxDouble {
  ctx: Record<string, unknown>
  disposers: Array<() => unknown>
  emitService: (name: string, value?: unknown) => void
  sidebarRegister: ReturnType<typeof vi.fn>
  sidebarDispose: ReturnType<typeof vi.fn>
}

interface InjectionEntry {
  deps: string[]
  callback: (child: Record<string, unknown>) => void
  disposed: boolean
  active: boolean
  childEffects: Array<() => unknown>
}

function makeCtx(
  services: Record<string, unknown> = {},
  withDefaults = true,
): CtxDouble {
  const disposers: Array<() => unknown> = []
  const injections: InjectionEntry[] = []
  const sidebarDispose = vi.fn()
  const sidebarRegister = vi.fn((_viewer: unknown) => sidebarDispose)

  const runInjection = (entry: InjectionEntry): void => {
    if (entry.disposed || entry.active) return
    if (!entry.deps.every(name => services[name] !== undefined)) return
    entry.active = true
    const child = {
      get: (key: string) => services[key],
      effect: (execute: () => unknown) => {
        const result = execute()
        if (typeof result === 'function') entry.childEffects.push(result as () => unknown)
        return result
      },
    }
    entry.callback(child)
  }

  const ctx = {
    effect: vi.fn((execute: unknown) => {
      const result = (execute as () => unknown)()
      if (typeof result === 'function') disposers.push(result as () => unknown)
      return result
    }),
    inject: vi.fn((deps: string[], callback: (child: Record<string, unknown>) => void) => {
      const entry: InjectionEntry = {
        deps,
        callback,
        disposed: false,
        active: false,
        childEffects: [],
      }
      injections.push(entry)
      runInjection(entry)
      return {
        dispose: () => {
          entry.disposed = true
          for (const effect of entry.childEffects.splice(0)) effect()
        },
        await: async () => undefined,
      }
    }),
  }
  const emitService = (name: string, value?: unknown): void => {
    if (value === undefined) delete services[name]
    else services[name] = value
    for (const entry of injections) runInjection(entry)
  }

  if (withDefaults) {
    services.betterSidebar ??= { registerFileViewer: sidebarRegister }
  }
  apply(ctx as never)

  return {
    ctx,
    disposers,
    emitService,
    sidebarRegister,
    sidebarDispose,
  }
}

describe('client plugin manifest', () => {
  it('exports the stable plugin name', () => {
    expect(name).toBe('dsh-spreadjs-editor')
  })

  it('declares no hard client dependency', () => {
    expect(inject).toEqual([])
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

describe('betterSidebar registration', () => {
  it('registers the SpreadJS viewer when better-sidebar is present', () => {
    const { sidebarRegister } = makeCtx()

    expect(sidebarRegister).toHaveBeenCalledTimes(1)
    const viewer = sidebarRegister.mock.calls[0]?.[0] as unknown as {
      id?: unknown
      title?: unknown
      exts?: readonly unknown[]
      fetchStrategy?: unknown
      priority?: unknown
      component?: unknown
    }
    expect(viewer.id).toBe('spreadjs')
    expect(viewer.title).toBe('SpreadJS')
    expect(viewer.exts).toEqual(['xlsx', 'xlsm', 'csv', 'sjs', 'ssjson'])
    expect(viewer.fetchStrategy).toBe('mediaUrl')
    expect(viewer.priority).toBe(0)
    expect(typeof viewer.component).toBe('function')
  })

  it('registers when better-sidebar appears late', () => {
    const { emitService, sidebarRegister } = makeCtx({}, false)

    expect(sidebarRegister).not.toHaveBeenCalled()
    emitService('betterSidebar', { registerFileViewer: sidebarRegister })
    expect(sidebarRegister).toHaveBeenCalledTimes(1)
  })

  it('stays idle when better-sidebar is absent', () => {
    const { sidebarRegister } = makeCtx({}, false)

    expect(sidebarRegister).not.toHaveBeenCalled()
  })

  it('disposes the viewer registration with the plugin fiber', () => {
    const { disposers, sidebarDispose } = makeCtx()

    for (const disposer of disposers) disposer()

    expect(sidebarDispose).toHaveBeenCalled()
  })
})
