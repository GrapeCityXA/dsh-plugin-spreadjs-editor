import { useEffect, useState } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  construct: vi.fn(), designerDestroy: vi.fn(), watch: vi.fn(), stopWatch: vi.fn(),
  workbook: undefined as any,
  constructorError: undefined as Error | undefined,
  themeListener: undefined as (() => void) | undefined,
}))

// Exercise the real Host hooks, effects, ref lifetime and error boundary with
// React's reconciler. Only the vendor DOM/canvas runtime is replaced.
vi.mock('@grapecity-software/spread-sheets', () => ({
  Spread: { Sheets: { FileType: { ssjson: 'ssjson' } } },
}))
vi.mock('@grapecity-software/spread-excelio', () => ({ IO: class {} }))
vi.mock('@grapecity-software/spread-sheets-designer', () => ({ Spread: { Sheets: { Designer: { Designer: class {
  constructor() { h.construct(); if (h.constructorError) throw h.constructorError }
  getWorkbook() { return h.workbook }
  destroy() { h.designerDestroy(); h.workbook.destroy() }
} } } } }))
vi.mock('@grapecity-software/spread-sheets-io', () => ({}))
vi.mock('@grapecity-software/spread-sheets-resources-zh', () => ({}))
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
vi.mock('../src/client/styles.ts', () => ({ setEditorTheme() {} }))
vi.mock('../src/client/ds-theme.ts', () => ({
  harnessThemeIsDark: () => false,
  onHarnessThemeChange: (listener: () => void) => {
    h.themeListener = listener
    return () => { h.themeListener = undefined }
  },
}))
vi.mock('../src/client/about.ts', () => ({ installDesignerAbout: () => ({ installed: true }) }))
vi.mock('../src/client/designer-save-command.ts', () => ({
  redirectDesignerSave: () => true,
  registerDesignerSaveTarget: () => () => {},
}))
vi.mock('../src/client/workbook-dirty.ts', () => ({
  resolveDirtyEvents: () => [],
  watchWorkbookChanges: () => { h.watch(); return { stop: () => h.stopWatch() } },
}))
// The boundary module also exports the document wrapper. This test mounts the
// actual Host directly so the document's network and tab adapter are irrelevant.
vi.mock('../src/client/SpreadsheetDocument.tsx', () => ({ SpreadsheetDocument: () => null }))

import { SpreadsheetHost, type SpreadsheetHostHandle, type SpreadsheetHostProps } from '../src/client/SpreadsheetHost.tsx'
import { EditorErrorBoundary } from '../src/client/editor-failure.tsx'

let root: ReactTestRenderer | undefined
const siblingUnmount = vi.fn()
function SidebarSibling(): React.JSX.Element {
  const [clicks, setClicks] = useState(0)
  useEffect(() => siblingUnmount, [])
  return <button onClick={() => setClicks(value => value + 1)}>sidebar clicks: {clicks}</button>
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  h.constructorError = undefined
  h.themeListener = undefined
  h.construct.mockReset(); h.designerDestroy.mockReset(); h.watch.mockReset(); h.stopWatch.mockReset()
  siblingUnmount.mockReset()
  h.workbook = {
    options: {}, fromJSON: vi.fn(async () => {}), toJSON: vi.fn(() => ({ cells: ['in progress'] })),
    suspendPaint() {}, resumePaint() {}, refresh: vi.fn(), destroy: vi.fn(),
  }
})
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  vi.restoreAllMocks()
})

async function mountHost() {
  const handles: SpreadsheetHostHandle[] = []
  let current: SpreadsheetHostHandle | null = null
  const hostNode = { querySelector: () => null, replaceChildren: vi.fn(), inert: false }
  const props: SpreadsheetHostProps = {
    source: { name: 'book.ssjson', path: 'book.ssjson', bytes: new Uint8Array() },
    load: { kind: 'buffer', workbook: {} }, ready: true, licenseKey: '',
    fileAccess: { save: vi.fn(async () => 'saved' as const), saveTo: vi.fn(async () => {}) },
    onStatus: vi.fn(), onLoadingChange: vi.fn(), onNewWorkbook: vi.fn(), onDirtyChange: vi.fn(),
    onUnsaved: vi.fn(), onSaved: vi.fn(), onDriverBusyChange: vi.fn(),
  }
  const setHost = (value: SpreadsheetHostHandle | null): void => {
    current = value
    if (value !== null) handles.push(value)
  }
  await act(async () => {
    root = create(<><SidebarSibling /><EditorErrorBoundary><SpreadsheetHost {...props} ref={setHost} /></EditorErrorBoundary></>, {
      createNodeMock: element => element.type === 'div' ? hostNode : null,
    })
  })
  return { tree: root!, handles, hostNode, props, get current() { return current } }
}

function expectSidebarWorks(tree: ReactTestRenderer): void {
  expect(siblingUnmount).not.toHaveBeenCalled()
  const button = tree.root.findByType('button')
  act(() => { button.props.onClick() })
  expect(button.children).toEqual(['sidebar clicks: ', '1'])
}

describe('real Host initialization and boundary integration', () => {
  it('contains a Missing License constructor error and withdraws the failed host', async () => {
    h.constructorError = new Error('Missing License')
    const mounted = await mountHost()

    expect(mounted.tree.root.findByProps({ role: 'alert' })).toBeDefined()
    expect(JSON.stringify(mounted.tree.toJSON())).toContain('Missing License')
    expect(mounted.current).toBeNull()
    expect(mounted.handles).toHaveLength(1)
    expect(mounted.handles[0]!.getWorkbook()).toBeUndefined()
    expect(mounted.handles[0]!.getInstanceId()).toBeUndefined()
    await expect(mounted.handles[0]!.save()).rejects.toThrow(/not ready/)
    expect(mounted.props.fileAccess.save).not.toHaveBeenCalled()
    expect(h.workbook.fromJSON).not.toHaveBeenCalled()
    expect(h.construct).toHaveBeenCalledOnce()
    expect(mounted.hostNode.replaceChildren).toHaveBeenCalledOnce()
    expectSidebarWorks(mounted.tree)
  })

  it('keeps the original setup error isolated even when both partial destructors fail', async () => {
    h.watch.mockImplementation(() => { throw new Error('Failed to attach workbook events') })
    h.designerDestroy.mockImplementation(() => { throw new Error('Designer destruction failed') })
    h.workbook.destroy.mockImplementation(() => { throw new Error('Workbook destruction failed') })
    const mounted = await mountHost()

    expect(mounted.tree.root.findByProps({ role: 'alert' })).toBeDefined()
    expect(mounted.tree.root.findByType('pre').children).toEqual(['Failed to attach workbook events'])
    expect(mounted.current).toBeNull()
    expect(mounted.handles[0]!.getWorkbook()).toBeUndefined()
    expect(h.designerDestroy).toHaveBeenCalledOnce()
    expect(h.workbook.destroy).toHaveBeenCalledOnce()
    expect(h.workbook.fromJSON).not.toHaveBeenCalled()
    expect(mounted.hostNode.replaceChildren).toHaveBeenCalledOnce()
    expectSidebarWorks(mounted.tree)
  })

  it('turns a later theme callback failure into a local fallback and aborts the driver lease', async () => {
    const mounted = await mountHost()
    expect(mounted.current?.getWorkbook()).toBe(h.workbook)
    const handle = mounted.current!
    let lease!: string
    act(() => { lease = handle.acquireDriverLease() })
    const signal = handle.getDriverLeaseSignal(lease)!
    expect(signal.aborted).toBe(false)
    h.workbook.refresh.mockImplementation(() => { throw new Error('Workbook refresh failed') })

    await act(async () => { h.themeListener!() })

    expect(mounted.tree.root.findByProps({ role: 'alert' })).toBeDefined()
    expect(mounted.current).toBeNull()
    expect(handle.getWorkbook()).toBeUndefined()
    expect(handle.isDriverBusy()).toBe(false)
    expect(signal.aborted).toBe(true)
    expect(mounted.props.onUnsaved).toHaveBeenCalledWith({ cells: ['in progress'] })
    expect(h.stopWatch).toHaveBeenCalledOnce()
    expect(h.designerDestroy).toHaveBeenCalledOnce()
    expect(h.workbook.destroy).toHaveBeenCalledOnce()
    expectSidebarWorks(mounted.tree)
  })
})
