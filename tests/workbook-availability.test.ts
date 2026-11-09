import { describe, expect, it, vi } from 'vitest'

// Exercise the real host's lifecycle without loading SpreadJS's DOM/canvas runtime.
const h = vi.hoisted(() => ({
  refs: [] as Array<{ current: any }>, effects: [] as Array<{ deps: any[]; cleanup?: () => void }>,
  pending: [] as Array<() => void>, refIndex: 0, effectIndex: 0,
  fromJSON: vi.fn(), workbook: undefined as any,
  markDirty: undefined as (() => void) | undefined,
  constructorError: undefined as Error | undefined,
  workbookError: undefined as Error | undefined,
  runtimeLicenseError: undefined as Error | undefined,
  designerLicenseError: undefined as Error | undefined,
  initializationError: undefined as Error | undefined,
  designerDestroy: vi.fn(), stopWatch: vi.fn(), construct: vi.fn(),
  themeListener: undefined as (() => void) | undefined,
}))
vi.mock('react', () => ({
  forwardRef: (render: any) => render,
  useRef: (value: any) => {
    const i = h.refIndex++
    return h.refs[i] ?? (h.refs[i] = { current: i === 0 ? { querySelector: () => null, replaceChildren: vi.fn() } : value })
  },
  useState: (value: any) => [value, (next: any) => { if (next instanceof Error) h.initializationError = next }],
  useEffect: (fn: () => (() => void) | undefined, deps: any[]) => {
    const i = h.effectIndex++
    const old = h.effects[i]
    if (old && deps.length === old.deps.length && deps.every((v, n) => Object.is(v, old.deps[n]))) return
    h.pending.push(() => { old?.cleanup?.(); h.effects[i] = { deps, cleanup: fn() } })
  },
  useImperativeHandle: (ref: any, create: () => any) => { ref.current = create() },
}))
vi.mock('@grapecity-software/spread-sheets', () => ({ Spread: { Sheets: {
  FileType: { ssjson: 'ssjson', excel: 'excel', csv: 'csv' },
  set LicenseKey(_value: string) { if (h.runtimeLicenseError) throw h.runtimeLicenseError },
} } }))
vi.mock('@grapecity-software/spread-sheets-io', () => ({}))
vi.mock('@grapecity-software/spread-sheets-resources-zh', () => ({}))
vi.mock('@grapecity-software/spread-sheets-designer', () => ({ Spread: { Sheets: { Designer: { Designer: class {
  constructor() { h.construct(); if (h.constructorError) throw h.constructorError }
  getWorkbook() { if (h.workbookError) throw h.workbookError; return h.workbook }
  destroy() { h.designerDestroy(); h.workbook?.destroy?.() }
}, set LicenseKey(_value: string) { if (h.designerLicenseError) throw h.designerLicenseError } } } } }))
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
vi.mock('../src/client/ds-theme.ts', () => ({ harnessThemeIsDark: () => false, onHarnessThemeChange: (fn: () => void) => {
  h.themeListener = fn
  return () => { h.themeListener = undefined }
} }))
vi.mock('../src/client/about.ts', () => ({ installDesignerAbout: () => ({ installed: true }) }))
vi.mock('../src/client/designer-save-command.ts', () => ({ redirectDesignerSave: () => true, registerDesignerSaveTarget: () => () => {} }))
vi.mock('../src/client/workbook-dirty.ts', () => ({
  resolveDirtyEvents: () => [],
  watchWorkbookChanges: (_workbook: unknown, onDirty: () => void) => {
    h.markDirty = onDirty
    return { stop: () => h.stopWatch() }
  },
}))

import { SpreadsheetHost, type SpreadsheetHostHandle, type SpreadsheetHostProps } from '../src/client/SpreadsheetHost.tsx'
import { stashWorkbook, resetUnsavedWork } from '../src/client/unsaved.ts'
import { decideLoad } from '../src/client/load-decision.ts'

function deferred() { let resolve!: () => void; let reject!: (reason: Error) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

describe('editor Workbook availability for drivers', () => {
  async function loadedHost(configure?: (props: SpreadsheetHostProps) => void) {
    h.refs = []; h.effects = []; h.pending = []
    h.constructorError = h.workbookError = h.runtimeLicenseError = h.designerLicenseError = h.initializationError = undefined
    h.construct.mockReset(); h.designerDestroy.mockReset(); h.stopWatch.mockReset()
    h.fromJSON.mockReset().mockResolvedValue(undefined)
    h.workbook = {
      options: {}, fromJSON: h.fromJSON, toJSON: vi.fn(() => ({ cells: ['AI edit'] })),
      import: vi.fn((_file: File, success: () => void) => success()),
      export: (ok: (blob: Blob) => void) => ok(new Blob(['{}'])),
      suspendPaint() {}, resumePaint() {}, refresh() {}, destroy: vi.fn(),
    }
    const ref = { current: null as SpreadsheetHostHandle | null }
    const props: SpreadsheetHostProps = {
      source: { name: 'book.ssjson', path: 'book.ssjson', bytes: new Uint8Array() },
      load: { kind: 'buffer', workbook: {} }, ready: true, licenseKey: '',
      fileAccess: { save: vi.fn(async () => 'saved' as const), saveTo: vi.fn(async () => {}) },
      onStatus() {}, onLoadingChange() {}, onDirtyChange: vi.fn(),
      onUnsaved: vi.fn(), onSaved: vi.fn(), onDriverBusyChange: vi.fn(),
    }
    configure?.(props)
    h.refIndex = 0; h.effectIndex = 0
    ;(SpreadsheetHost as unknown as (props: SpreadsheetHostProps, ref: any) => unknown)(props, ref)
    for (const effect of h.pending.splice(0)) effect()
    await settle()
    return { host: ref.current!, props, unmount: () => { for (const effect of h.effects) effect?.cleanup?.() } }
  }

  it.each(['constructor', 'runtime license', 'Designer license', 'workbook getter'] as const)(
    'contains a failing %s without exposing or loading a partial workbook', async (stage) => {
      const error = new Error(`Missing License: ${stage}`)
      const { host, props, unmount } = await loadedHost(props => {
        if (stage === 'constructor') h.constructorError = error
        if (stage === 'workbook getter') h.workbookError = error
        if (stage === 'runtime license') { h.runtimeLicenseError = error; props.licenseKey = 'test-key' }
        if (stage === 'Designer license') { h.designerLicenseError = error; props.designerLicenseKey = 'test-key' }
      })
      expect(h.initializationError).toBe(error)
      expect(host.getWorkbook()).toBeUndefined()
      expect(host.getInstanceId()).toBeUndefined()
      expect(h.fromJSON).not.toHaveBeenCalled()
      await expect(host.save()).rejects.toThrow(/not ready/)
      expect(props.fileAccess.save).not.toHaveBeenCalled()
      expect(() => unmount()).not.toThrow()
      expect(h.designerDestroy).toHaveBeenCalledTimes(stage === 'workbook getter' ? 1 : 0)
      expect(h.refs[0]!.current.replaceChildren).toHaveBeenCalledOnce()
    },
  )

  it('cleans up a constructed workbook when attaching its edit watch fails', async () => {
    const { host, unmount } = await loadedHost(() => {
      Object.defineProperty(h.workbook.options, 'tabStripVisible', { set() { throw new Error('SDK initialization failed') } })
    })
    expect(h.initializationError?.message).toBe('SDK initialization failed')
    expect(host.getWorkbook()).toBeUndefined()
    expect(h.workbook.destroy).toHaveBeenCalledOnce()
    expect(h.designerDestroy).toHaveBeenCalledOnce()
    unmount()
    expect(h.workbook.destroy).toHaveBeenCalledOnce()
    expect(h.designerDestroy).toHaveBeenCalledOnce()
  })

  it('withdraws a workbook after a theme refresh fails without throwing into DSH', async () => {
    const { host, unmount } = await loadedHost()
    h.workbook.refresh = () => { throw new Error('runtime stopped') }
    expect(() => h.themeListener!()).not.toThrow()
    expect(host.getWorkbook()).toBeUndefined()
    expect(h.initializationError?.message).toBe('runtime stopped')
    unmount()
  })

  it('revokes leases and runs all cleanup steps even when the SDK is broken', async () => {
    const { host, props, unmount } = await loadedHost()
    const lease = host.acquireDriverLease()
    const signal = host.getDriverLeaseSignal(lease)!
    h.workbookError = new Error('broken getter')
    h.stopWatch.mockImplementation(() => { throw new Error('broken event cleanup') })
    h.workbook.destroy.mockImplementation(() => { throw new Error('broken workbook destruction') })
    h.designerDestroy.mockImplementation(() => { throw new Error('broken Designer destruction') })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => unmount()).not.toThrow()
      expect(host.getWorkbook()).toBeUndefined()
      expect(host.isDriverBusy()).toBe(false)
      expect(signal.aborted).toBe(true)
      expect(props.onUnsaved).toHaveBeenCalledOnce()
      expect(props.onDriverBusyChange).toHaveBeenLastCalledWith(false)
      expect(h.workbook.destroy).toHaveBeenCalledOnce()
      expect(h.designerDestroy).toHaveBeenCalledOnce()
      expect(h.refs[0]!.current.replaceChildren).toHaveBeenCalledOnce()
      expect(log).toHaveBeenCalledTimes(3)
    } finally { log.mockRestore() }
  })

  it.each(['save', 'saveAs'] as const)('keeps edits made during %s dirty and recoverable', async (operation) => {
    const { host, props, unmount } = await loadedHost()
    const write = deferred()
    props.fileAccess.save = vi.fn(() => write.promise.then(() => 'saved' as const))
    props.fileAccess.saveTo = vi.fn(() => write.promise)
    const saving = operation === 'save' ? host.save() : host.saveAs('copy.ssjson')
    await settle()
    // Export has finished, but the host has not confirmed the write. The Designer
    // remains editable, and this later edit is absent from the exported bytes.
    h.markDirty!()
    write.resolve()
    const result = await saving
    if (operation === 'saveAs') expect(result).toBe(false)
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(props.onSaved).not.toHaveBeenCalled()
    unmount()
    expect(props.onUnsaved).toHaveBeenCalledWith({ cells: ['AI edit'] })
  })

  it('marks an unchanged workbook clean after saving', async () => {
    const { host, props, unmount } = await loadedHost()
    await host.save()
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(false)
    expect(props.onSaved).toHaveBeenCalledOnce()
    unmount()
    expect(props.onUnsaved).not.toHaveBeenCalled()
  })

  it.each(['book.xlsx', 'book.xlsm'])('imports %s through the Workbook IO plugin', async name => {
    const { host, props, unmount } = await loadedHost(current => {
      current.source = { name, path: name, bytes: new Uint8Array([1, 2, 3]) }
      current.load = { kind: 'file' }
    })

    expect(h.workbook.import).toHaveBeenCalledOnce()
    const [file, _success, _failure, options] = h.workbook.import.mock.calls[0]!
    expect(file).toBeInstanceOf(File)
    expect(options).toEqual({ fileType: 'excel' })
    expect(h.fromJSON).not.toHaveBeenCalled()
    expect(host.getWorkbook()).toBe(h.workbook)
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(false)
    unmount()
  })

  it('refuses to save when Excel import fails', async () => {
    const { host, props, unmount } = await loadedHost(current => {
      current.source = { name: 'book.xlsx', path: 'book.xlsx', bytes: new Uint8Array([1]) }
      current.load = { kind: 'file' }
      h.workbook.import = vi.fn((_file, _success, fail) => fail(new Error('Import failed')))
    })

    expect(host.getWorkbook()).toBeUndefined()
    await expect(host.save()).rejects.toThrow(/not ready/)
    await expect(host.saveAs('copy.xlsx')).rejects.toThrow(/not ready/)
    expect(props.fileAccess.save).not.toHaveBeenCalled()
    expect(props.fileAccess.saveTo).not.toHaveBeenCalled()
    unmount()
  })

  it.each(['save', 'saveAs'] as const)('does not clear recovery when %s completes after unmount', async (operation) => {
    const { host, props, unmount } = await loadedHost()
    const write = deferred()
    props.fileAccess.save = vi.fn(() => write.promise.then(() => 'saved' as const))
    props.fileAccess.saveTo = vi.fn(() => write.promise)
    const saving = operation === 'save' ? host.save() : host.saveAs('copy.ssjson')
    await settle()
    unmount()
    write.resolve()
    const result = await saving
    if (operation === 'saveAs') expect(result).toBe(false)
    expect(props.onSaved).not.toHaveBeenCalled()
    expect(props.onUnsaved).toHaveBeenCalledOnce()
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('refuses Save As after a failed load', async () => {
    const { host, props, unmount } = await loadedHost()
    h.fromJSON.mockRejectedValueOnce(new Error('invalid workbook'))
    props.load = { kind: 'buffer', workbook: { invalid: true } }
    h.refIndex = 0; h.effectIndex = 0
    ;(SpreadsheetHost as unknown as (props: SpreadsheetHostProps, ref: any) => unknown)(props, { current: null })
    for (const effect of h.pending.splice(0)) effect()
    await settle()
    await expect(host.saveAs('copy.ssjson')).rejects.toThrow(/not ready/)
    expect(props.fileAccess.saveTo).not.toHaveBeenCalled()
    unmount()
  })

  it('refuses Save As when the editor unmounts during export', async () => {
    const { host, props, unmount } = await loadedHost()
    let finishExport!: (blob: Blob) => void
    h.workbook.export = (ok: (blob: Blob) => void) => { finishExport = ok }
    const saving = host.saveAs('copy.ssjson')
    unmount()
    finishExport(new Blob(['{}']))
    await expect(saving).rejects.toThrow(/closed or changed/)
    expect(props.fileAccess.saveTo).not.toHaveBeenCalled()
  })

  it.each(['save', 'saveAs'] as const)('refuses stale %s bytes when the same source reloads during export', async (operation) => {
    const { host, props, unmount } = await loadedHost()
    let finishExport!: (blob: Blob) => void
    h.workbook.export = (ok: (blob: Blob) => void) => { finishExport = ok }
    const saving = operation === 'save' ? host.save() : host.saveAs('copy.ssjson')
    props.load = { kind: 'buffer', workbook: { latest: true } }
    h.refIndex = 0; h.effectIndex = 0
    ;(SpreadsheetHost as unknown as (props: SpreadsheetHostProps, ref: any) => unknown)(props, { current: null })
    for (const effect of h.pending.splice(0)) effect()
    await settle()
    finishExport(new Blob(['obsolete export']))
    await expect(saving).rejects.toThrow(/closed or changed/)
    expect(props.fileAccess.save).not.toHaveBeenCalled()
    expect(props.fileAccess.saveTo).not.toHaveBeenCalled()
    expect(props.onSaved).not.toHaveBeenCalled()
    unmount()
  })

  it('leases are exclusive, guard every write entry, and only their holder can save', async () => {
    const { host, props, unmount } = await loadedHost()
    const lease = host.acquireDriverLease()
    expect(host.isDriverBusy()).toBe(true)
    expect(h.refs[0]!.current.inert).toBe(true)
    expect(() => host.acquireDriverLease()).toThrow(/busy/)
    await expect(host.save()).rejects.toThrow(/Driver/)
    await expect(host.save('wrong')).rejects.toThrow(/Driver/)
    await expect(host.saveAs('copy.ssjson')).rejects.toThrow(/Driver/)
    host.releaseDriverLease('wrong')
    expect(host.isDriverBusy()).toBe(true)
    await host.save(lease)
    expect(props.fileAccess.save).toHaveBeenCalledOnce()
    host.releaseDriverLease(lease)
    expect(host.isDriverBusy()).toBe(false)
    expect(h.refs[0]!.current.inert).toBe(false)
    await expect(host.save(lease)).rejects.toThrow()
    unmount()
  })

  it('a revoked save permission after export prevents write-back', async () => {
    const { host, props, unmount } = await loadedHost()
    const lease = host.acquireDriverLease()
    let finishExport!: (blob: Blob) => void
    h.workbook.export = (ok: (blob: Blob) => void) => { finishExport = ok }
    const abort = new AbortController()
    const saving = host.save(lease, { signal: abort.signal, beforeWrite: async () => { abort.signal.throwIfAborted() } })
    abort.abort()
    finishExport(new Blob(['{}']))
    await expect(saving).rejects.toThrow()
    expect(props.fileAccess.save).not.toHaveBeenCalled()
    expect(host.isDriverBusy()).toBe(true)
    host.releaseDriverLease(lease)
    unmount()
  })

  it('renewing contents in the same Workbook object changes its instance identity', async () => {
    const { host, props, unmount } = await loadedHost()
    const firstId = host.getInstanceId()
    expect(firstId).toBeTruthy()
    const workbook = host.getWorkbook()
    props.load = { kind: 'buffer', workbook: { replacement: true } }
    h.refIndex = 0; h.effectIndex = 0
    ;(SpreadsheetHost as unknown as (props: SpreadsheetHostProps, ref: any) => unknown)(props, { current: null })
    expect(host.getInstanceId()).toBeUndefined()
    for (const effect of h.pending.splice(0)) effect()
    await settle()
    expect(host.getWorkbook()).toBe(workbook)
    expect(host.getInstanceId()).toBeTruthy()
    expect(host.getInstanceId()).not.toBe(firstId)
    unmount()
  })

  it('a slow obsolete load cannot overwrite a newer completed load', async () => {
    const { host, props, unmount } = await loadedHost()
    const first = deferred()
    let contents = 'initial'
    h.fromJSON.mockImplementationOnce(() => first.promise.then(() => { contents = 'obsolete' }))
    h.fromJSON.mockImplementationOnce(async () => { contents = 'latest' })
    const reload = (workbook: object) => {
      props.load = { kind: 'buffer', workbook }
      h.refIndex = 0; h.effectIndex = 0
      ;(SpreadsheetHost as unknown as (props: SpreadsheetHostProps, ref: any) => unknown)(props, { current: null })
      for (const effect of h.pending.splice(0)) effect()
    }
    reload({ obsolete: true })
    await settle()
    reload({ latest: true })
    await settle()
    first.resolve()
    await settle()
    expect(contents).toBe('latest')
    expect(host.getWorkbook()).toBe(h.workbook)
    unmount()
  })

  it.each([false, true])('unmount revokes the lease even when snapshot fails=%s', async (fail) => {
    const { host, props, unmount } = await loadedHost()
    const lease = host.acquireDriverLease()
    const signal = host.getDriverLeaseSignal(lease)!
    expect(signal.aborted).toBe(false)
    if (fail) h.workbook.toJSON.mockImplementation(() => { throw new Error('snapshot failed') })
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    unmount()
    expect(host.isDriverBusy()).toBe(false)
    expect(signal.aborted).toBe(true)
    expect(host.getWorkbook()).toBeUndefined()
    expect(props.onDriverBusyChange).toHaveBeenLastCalledWith(false)
    expect(h.workbook.destroy).toHaveBeenCalledOnce()
    if (fail) {
      expect(errorLog).toHaveBeenCalled()
      expect(props.onUnsaved).not.toHaveBeenCalled()
    } else {
      expect(props.onUnsaved).toHaveBeenCalledWith({ cells: ['AI edit'] })
      expect(vi.mocked(props.onUnsaved).mock.invocationCallOrder[0]).toBeLessThan(h.workbook.destroy.mock.invocationCallOrder[0])
    }
    errorLog.mockRestore()
  })

  it('a closed Driver workbook is recovered from the existing cache on a new tab', async () => {
    resetUnsavedWork()
    const first = await loadedHost()
    first.props.onUnsaved = snapshot => stashWorkbook({ resourceAddress: 'book.ssjson', tabId: 'old', baseline: 'disk', workbook: snapshot, at: Date.now() })
    // Refresh the callback ref exactly as a component render does.
    h.refIndex = 0; h.effectIndex = 0
    ;(SpreadsheetHost as unknown as (props: SpreadsheetHostProps, ref: any) => unknown)(first.props, { current: null })
    first.host.acquireDriverLease()
    first.unmount()
    const decision = decideLoad('new-tab', 'book.ssjson', 'disk')
    expect(decision.kind).toBe('buffer')
    if (decision.kind !== 'buffer') throw new Error('missing recovery buffer')
    const recovered = await loadedHost()
    recovered.props.load = { kind: 'buffer', workbook: decision.buffer.workbook }
    h.refIndex = 0; h.effectIndex = 0
    ;(SpreadsheetHost as unknown as (props: SpreadsheetHostProps, ref: any) => unknown)(recovered.props, { current: null })
    for (const effect of h.pending.splice(0)) effect()
    await settle()
    expect(h.fromJSON).toHaveBeenLastCalledWith({ cells: ['AI edit'] })
    expect(recovered.host.getWorkbook()).toBe(h.workbook)
    recovered.unmount()
    resetUnsavedWork()
  })

  it('defers an arriving file reload until the script releases its original instance', async () => {
    const { host, props, unmount } = await loadedHost()
    const lease = host.acquireDriverLease()
    h.fromJSON.mockClear()
    props.load = { kind: 'buffer', workbook: { cells: ['refreshed file'] } }
    h.refIndex = 0; h.effectIndex = 0
    ;(SpreadsheetHost as unknown as (props: SpreadsheetHostProps, ref: any) => unknown)(props, { current: null })
    for (const effect of h.pending.splice(0)) effect()
    expect(host.getWorkbook()).toBeUndefined()
    expect(h.fromJSON).not.toHaveBeenCalled()
    host.releaseDriverLease(lease)
    expect(props.onUnsaved).toHaveBeenCalledWith({ cells: ['AI edit'] })
    unmount()
  })

  it('exposes only the loaded instance, withdraws it for reload/save/failure, and releases it on unmount', async () => {
    h.refs = []; h.effects = []; h.pending = []
    h.workbook = { options: {}, export: (ok: (blob: Blob) => void) => ok(new Blob(['{}'])), fromJSON: h.fromJSON, suspendPaint() {}, resumePaint() {}, refresh() {}, destroy() {}, toJSON: () => ({}) }
    const ref = { current: null as SpreadsheetHostHandle | null }
    const save = deferred()
    const props: SpreadsheetHostProps = {
      source: undefined, load: undefined, ready: true, licenseKey: '',
      fileAccess: { save: () => save.promise.then(() => 'saved'), saveTo: async () => {} },
      onStatus() {}, onLoadingChange() {}, onDirtyChange() {}, onUnsaved() {}, onDriverBusyChange() {},
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
    flush(); await settle()
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
