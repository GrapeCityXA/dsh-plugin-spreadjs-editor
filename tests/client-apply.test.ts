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

import { apply, inject, name, type ClientConfig } from '../src/client/index.ts'
import { exportFileType, workbookFileType } from '../src/client/SpreadsheetHost.tsx'

interface SidebarServiceMock {
  registerFileViewer: ReturnType<typeof vi.fn>
}

interface WebFileEditorsMock {
  register: ReturnType<typeof vi.fn>
}

interface CtxDouble {
  ctx: Record<string, unknown>
  disposers: Array<() => unknown>
  emitService: (name: string, value?: unknown) => void
  sidebarRegister: ReturnType<typeof vi.fn>
  sidebarDispose: ReturnType<typeof vi.fn>
  webRegister: ReturnType<typeof vi.fn>
  webDispose: ReturnType<typeof vi.fn>
}

function makeCtx(
  services: Record<string, unknown> = {},
  config?: ClientConfig,
  withDefaults = true,
): CtxDouble {
  const disposers: Array<() => unknown> = []
  const listeners = new Set<(name: string, value?: unknown) => void>()
  const sidebarDispose = vi.fn()
  const sidebarRegister = vi.fn((_viewer: unknown) => sidebarDispose)
  const webDispose = vi.fn()
  const webRegister = vi.fn((_editor: unknown) => webDispose)
  const ctx = {
    get: vi.fn((key: string) => services[key]),
    effect: vi.fn((execute: unknown) => {
      const result = (execute as () => unknown)()
      if (typeof result === 'function') disposers.push(result as () => unknown)
      return result
    }),
    on: vi.fn((event: string, handler: (name: string, value?: unknown) => void) => {
      if (event === 'internal/service') listeners.add(handler)
      return () => listeners.delete(handler)
    }),
  }
  const emitService = (name: string, value?: unknown): void => {
    if (value === undefined) delete services[name]
    else services[name] = value
    for (const listener of [...listeners]) listener(name, value)
  }

  if (withDefaults) {
    services.betterSidebar ??= { registerFileViewer: sidebarRegister }
    services.webFileEditors ??= { register: webRegister }
  }
  apply(ctx as never, config)

  return {
    ctx,
    disposers,
    emitService,
    sidebarRegister,
    sidebarDispose,
    webRegister,
    webDispose,
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

  it('defaults to webFileEditors when both services are present', () => {
    const { sidebarRegister, webRegister } = makeCtx()

    expect(sidebarRegister).not.toHaveBeenCalled()
    expect(webRegister).toHaveBeenCalledTimes(1)
  })

  it('registers both adapters only when preferViewer is auto', () => {
    const { sidebarRegister, webRegister } = makeCtx({}, { preferViewer: 'auto' })

    expect(sidebarRegister).toHaveBeenCalledTimes(1)
    expect(webRegister).toHaveBeenCalledTimes(1)

    const sidebar = sidebarRegister.mock.calls[0]?.[0] as unknown as {
      id?: unknown
      title?: unknown
      exts?: readonly unknown[]
      fetchStrategy?: unknown
      component?: unknown
    }
    expect(sidebar.id).toBe('spreadjs')
    expect(sidebar.title).toBe('SpreadJS')
    expect(sidebar.exts).toEqual(['xlsx', 'xlsm', 'csv', 'sjs', 'ssjson'])
    expect(sidebar.fetchStrategy).toBe('mediaUrl')
    expect(typeof sidebar.component).toBe('function')

    const web = webRegister.mock.calls[0]?.[0] as unknown as {
      id?: unknown
      title?: unknown
      extensions?: readonly unknown[]
      component?: unknown
    }
    expect(web.id).toBe('spreadjs')
    expect(web.title).toBe('SpreadJS')
    expect(web.extensions).toEqual(['.xlsx', '.xlsm', '.csv', '.sjs', '.ssjson'])
    expect(typeof web.component).toBe('function')
  })

  it('registers only the default webFileEditors service when it appears late', () => {
    const { emitService, sidebarRegister, webRegister } = makeCtx({}, undefined, false)

    expect(sidebarRegister).not.toHaveBeenCalled()
    expect(webRegister).not.toHaveBeenCalled()

    emitService('webFileEditors', { register: webRegister })
    emitService('betterSidebar', { registerFileViewer: sidebarRegister })

    expect(sidebarRegister).not.toHaveBeenCalled()
    expect(webRegister).toHaveBeenCalledTimes(1)
  })

  it('registers late services for both adapters in auto mode', () => {
    const { emitService, sidebarRegister, webRegister } = makeCtx(
      {},
      { preferViewer: 'auto' },
      false,
    )

    emitService('betterSidebar', { registerFileViewer: sidebarRegister })
    emitService('webFileEditors', { register: webRegister })

    expect(sidebarRegister).toHaveBeenCalledTimes(1)
    expect(webRegister).toHaveBeenCalledTimes(1)
  })

  it('honors preferViewer when both adapters are present', () => {
    const onlySidebar = makeCtx({}, { preferViewer: 'betterSidebar' })
    expect(onlySidebar.sidebarRegister).toHaveBeenCalledTimes(1)
    expect(onlySidebar.webRegister).not.toHaveBeenCalled()

    const onlyWeb = makeCtx({}, { preferViewer: 'webFileEditors' })
    expect(onlyWeb.sidebarRegister).not.toHaveBeenCalled()
    expect(onlyWeb.webRegister).toHaveBeenCalledTimes(1)
  })

  it('disposes adapter registrations with the plugin fiber', () => {
    const { disposers, sidebarDispose, webDispose } = makeCtx()

    for (const disposer of disposers) disposer()

    expect(sidebarDispose).not.toHaveBeenCalled()
    expect(webDispose).toHaveBeenCalled()
  })
})
