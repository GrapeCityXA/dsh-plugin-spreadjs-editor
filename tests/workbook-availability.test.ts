import { describe, expect, it, vi } from 'vitest'

// Exercise the real host's lifecycle without loading SpreadJS's DOM/canvas runtime.
const h = vi.hoisted(() => ({
  refs: [] as Array<{ current: any }>, effects: [] as Array<{ deps: any[]; cleanup?: () => void }>,
  pending: [] as Array<() => void>, refIndex: 0, effectIndex: 0,
  fromJSON: vi.fn(), workbook: undefined as any,
}))
vi.mock('react', () => ({
  forwardRef: (render: any) => render,
  useRef: (value: any) => {
    const i = h.refIndex++
    return h.refs[i] ?? (h.refs[i] = { current: i === 0 ? { querySelector: () => null } : value })
  },
  useState: (value: any) => [value, () => {}],
  useEffect: (fn: () => (() => void) | undefined, deps: any[]) => {
    const i = h.effectIndex++
    const old = h.effects[i]
    if (old && deps.length === old.deps.length && deps.every((v, n) => Object.is(v, old.deps[n]))) return
    h.pending.push(() => { old?.cleanup?.(); h.effects[i] = { deps, cleanup: fn() } })
  },
  useImperativeHandle: (ref: any, create: () => any) => { ref.current = create() },
}))
vi.mock('@grapecity-software/spread-sheets', () => ({ Spread: { Sheets: { FileType: { ssjson: 'ssjson' } } } }))
vi.mock('@grapecity-software/spread-excelio', () => ({ IO: class {} }))
vi.mock('@grapecity-software/spread-sheets-io', () => ({}))
vi.mock('@grapecity-software/spread-sheets-resources-zh', () => ({}))
vi.mock('@grapecity-software/spread-sheets-designer', () => ({ Spread: { Sheets: { Designer: { Designer: class {
  getWorkbook() { return h.workbook }
  destroy() {}
} } } } }))
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
vi.mock('../src/client/ds-theme.ts', () => ({ harnessThemeIsDark: () => false, onHarnessThemeChange: () => () => {} }))
vi.mock('../src/client/about.ts', () => ({ installDesignerAbout: () => ({ installed: true }) }))
vi.mock('../src/client/designer-save-command.ts', () => ({ redirectDesignerSave: () => true, registerDesignerSaveTarget: () => () => {} }))
vi.mock('../src/client/workbook-dirty.ts', () => ({ resolveDirtyEvents: () => [], watchWorkbookChanges: () => ({ stop() {} }) }))

import { SpreadsheetHost, type SpreadsheetHostHandle, type SpreadsheetHostProps } from '../src/client/SpreadsheetHost.tsx'

function deferred() { let resolve!: () => void; let reject!: (reason: Error) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

describe('editor Workbook availability for drivers', () => {
  it('exposes only the loaded instance, withdraws it for reload/save/failure, and releases it on unmount', async () => {
    h.refs = []; h.effects = []; h.pending = []
    h.workbook = { options: {}, export: (ok: (blob: Blob) => void) => ok(new Blob(['{}'])), fromJSON: h.fromJSON, suspendPaint() {}, resumePaint() {}, refresh() {}, destroy() {}, toJSON: () => ({}) }
    const ref = { current: null as SpreadsheetHostHandle | null }
    const save = deferred()
    const props: SpreadsheetHostProps = {
      source: undefined, load: undefined, ready: true, licenseKey: '',
      fileAccess: { save: () => save.promise.then(() => 'saved'), saveTo: async () => {} },
      onStatus() {}, onLoadingChange() {}, onNewWorkbook() {}, onDirtyChange() {}, onUnsaved() {},
    }
    const render = () => {
      h.refIndex = 0; h.effectIndex = 0
      ;(SpreadsheetHost as unknown as (props: SpreadsheetHostProps, ref: any) => unknown)(props, ref)
    }
    const flush = () => { for (const effect of h.pending.splice(0)) effect() }
    render(); flush()
    expect(ref.current!.getWorkbook()).toBeUndefined()

    const first = deferred(); h.fromJSON.mockReturnValueOnce(first.promise)
    props.source = { name: 'book.ssjson', bytes: new Uint8Array() }
    props.load = { kind: 'buffer', workbook: {} }
    render()
    expect(ref.current!.getWorkbook()).toBeUndefined()
    flush()
    expect(ref.current!.getWorkbook()).toBeUndefined()
    first.resolve(); await settle()
    expect(ref.current!.getWorkbook()).toBe(h.workbook)

    const old = deferred(); h.fromJSON.mockReturnValueOnce(old.promise)
    props.load = { kind: 'buffer', workbook: {} }; render()
    expect(ref.current!.getWorkbook()).toBeUndefined() // before the load effect runs
    flush()
    const failed = deferred(); h.fromJSON.mockReturnValueOnce(failed.promise)
    props.source = { name: 'other.ssjson', bytes: new Uint8Array() }
    props.load = { kind: 'buffer', workbook: {} }; render(); flush()
    old.resolve(); await settle()
    expect(ref.current!.getWorkbook()).toBeUndefined() // stale completion cannot reopen access
    failed.reject(new Error('bad workbook')); await settle()
    expect(ref.current!.getWorkbook()).toBeUndefined()

    h.fromJSON.mockResolvedValueOnce(undefined)
    props.load = { kind: 'buffer', workbook: {} }; render(); flush(); await settle()
    expect(ref.current!.getWorkbook()).toBe(h.workbook)
    const saving = ref.current!.save()
    expect(ref.current!.getWorkbook()).toBeUndefined()
    save.resolve(); await saving
    expect(ref.current!.getWorkbook()).toBe(h.workbook)

    for (const effect of h.effects) effect?.cleanup?.()
    expect(ref.current!.getWorkbook()).toBeUndefined()
  })
})
