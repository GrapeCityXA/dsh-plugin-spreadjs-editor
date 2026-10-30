import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Keep the document's real callbacks and recovery store while supplying its child
// host and React lifecycle without SpreadJS's browser runtime.
const h = vi.hoisted(() => ({
  refs: [] as Array<{ current: any }>, states: [] as any[],
  memos: [] as Array<{ deps: any[]; value: any }>,
  effects: [] as Array<{ deps: any[]; cleanup?: () => void }>,
  pending: [] as Array<() => void>,
  refIndex: 0, stateIndex: 0, memoIndex: 0, effectIndex: 0,
  panel: undefined as any,
}))
vi.mock('react', () => ({
  useRef: (value: any) => {
    const index = h.refIndex++
    return h.refs[index] ?? (h.refs[index] = { current: value })
  },
  useState: (value: any) => {
    const index = h.stateIndex++
    if (!(index in h.states)) h.states[index] = value
    return [h.states[index], (next: any) => {
      h.states[index] = typeof next === 'function' ? next(h.states[index]) : next
    }]
  },
  useMemo: (create: () => any, deps: any[]) => {
    const index = h.memoIndex++
    const old = h.memos[index]
    if (!old || deps.length !== old.deps.length || deps.some((value, n) => !Object.is(value, old.deps[n]))) {
      h.memos[index] = { deps, value: create() }
    }
    return h.memos[index]!.value
  },
  useCallback: (callback: any) => callback,
  useEffect: (create: () => (() => void) | undefined, deps: any[]) => {
    const index = h.effectIndex++
    const old = h.effects[index]
    if (old && deps.length === old.deps.length && deps.every((value, n) => Object.is(value, old.deps[n]))) return
    h.pending.push(() => { old?.cleanup?.(); h.effects[index] = { deps, cleanup: create() } })
  },
}))
vi.mock('../src/client/SpreadsheetHost.tsx', () => ({
  SpreadsheetHost: 'SpreadsheetHost',
  WorkbookNotReadyError: class extends Error {},
}))
vi.mock('../src/client/SaveAsPrompt.tsx', () => ({ SaveAsPrompt: 'SaveAsPrompt' }))
vi.mock('../src/client/bridge.ts', () => ({ PROVIDER_ID: 'editor', publishWorkbook: () => () => {} }))
vi.mock('../src/client/panel-actions.ts', () => ({
  refreshPanel() {},
  publishPanel: (panel: unknown) => { h.panel = panel; return () => { h.panel = undefined } },
}))
vi.mock('../src/client/locales.ts', () => ({ editorText: (key: string) => key }))
vi.mock('../src/client/session-file-address.ts', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/client/session-file-address.ts')>(),
  contentHash: async () => 'disk-hash',
}))

import { SpreadsheetDocument } from '../src/client/SpreadsheetDocument.tsx'
import type { SpreadsheetHostProps } from '../src/client/SpreadsheetHost.tsx'
import { hasRecoveryBuffer, resetUnsavedWork } from '../src/client/unsaved.ts'

const resourceAddress = 'dsh-resource://file/session/chat/book.ssjson'
const snapshot = { cells: ['newer edit'] }
const settle = async () => { for (let i = 0; i < 16; i++) await Promise.resolve() }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(yes => { resolve = yes })
  return { promise, resolve }
}
function findElement(tree: any, type: string): any {
  if (tree?.type === type) return tree
  const children = tree?.props?.children
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null) continue
    const found = findElement(child, type)
    if (found) return found
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  resetUnsavedWork()
  h.refs = []; h.states = []; h.memos = []; h.effects = []; h.pending = []; h.panel = undefined
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ licenseKey: '' }) })))
})
afterEach(() => {
  for (const effect of h.effects.splice(0)) effect?.cleanup?.()
  resetUnsavedWork()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function document() {
  const openResource = vi.fn()
  const host = { saveAs: vi.fn(async (): Promise<boolean> => true) }
  const props = {
    resourceAddress, content: { kind: 'bytes', data: new Uint8Array([1]) },
    useTabInfo: () => ({ tab: { id: 'tab', actions: { openResource } } }),
  }
  let tree: any
  let hostProps!: SpreadsheetHostProps
  const render = () => {
    h.refIndex = 0; h.stateIndex = 0; h.memoIndex = 0; h.effectIndex = 0
    tree = SpreadsheetDocument(props as never)
    const element = findElement(tree, 'SpreadsheetHost')
    hostProps = element.props
    element.ref.current = host
    for (const effect of h.pending.splice(0)) effect()
  }
  render()
  return {
    host, openResource,
    get hostProps() { return hostProps },
    async submitSaveAs() {
      h.panel.requestSaveAs()
      render()
      findElement(tree, 'SaveAsPrompt').props.onSubmit('copy.ssjson')
      await settle()
    },
    unmount() { for (const effect of h.effects.splice(0)) effect?.cleanup?.() },
  }
}

describe('document save lifecycle', () => {
  it('keeps the buffer stashed during unmount when an earlier write later succeeds', async () => {
    const doc = document()
    const write = deferred<any>()
    vi.mocked(fetch).mockImplementationOnce(() => write.promise)
    const saving = doc.hostProps.fileAccess.save(new Blob(['{}']), doc.hostProps.source!)
    await settle()
    expect(fetch).toHaveBeenCalledTimes(2)
    doc.hostProps.onUnsaved(snapshot)
    doc.unmount()
    write.resolve({ ok: true, json: async () => ({ ok: true, hash: 'written-hash' }) })
    await saving
    doc.hostProps.onSaved?.()
    expect(hasRecoveryBuffer(resourceAddress)).toBe(true)
  })

  it('retains later edits and stays on the original file after Save As writes an older revision', async () => {
    const doc = document()
    const write = deferred<boolean>()
    doc.host.saveAs.mockImplementation(() => write.promise)
    doc.hostProps.onUnsaved(snapshot)
    await doc.submitSaveAs()
    expect(doc.host.saveAs).toHaveBeenCalledWith('copy.ssjson')
    write.resolve(false)
    await settle()
    expect(hasRecoveryBuffer(resourceAddress)).toBe(true)
    expect(doc.openResource).not.toHaveBeenCalled()
  })

  it('does not navigate or clear recovery after an unmounted Save As finishes', async () => {
    const doc = document()
    const write = deferred<boolean>()
    doc.host.saveAs.mockImplementation(() => write.promise)
    await doc.submitSaveAs()
    doc.hostProps.onUnsaved(snapshot)
    doc.unmount()
    write.resolve(true)
    await settle()
    expect(hasRecoveryBuffer(resourceAddress)).toBe(true)
    expect(doc.openResource).not.toHaveBeenCalled()
  })

  it('clears the previous buffer and navigates after saving the current revision', async () => {
    const doc = document()
    doc.hostProps.onUnsaved(snapshot)
    await doc.submitSaveAs()
    expect(hasRecoveryBuffer(resourceAddress)).toBe(false)
    expect(doc.openResource).toHaveBeenCalledWith('dsh-resource://file/session/chat/copy.ssjson', { replaceTab: true })
  })
})
