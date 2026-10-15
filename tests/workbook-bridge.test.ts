import { afterEach, describe, expect, it, vi } from 'vitest'
import { provideBridgeRegistry, publishWorkbook, type SpreadjsWorkbookProvider } from '../src/client/bridge.ts'

const disposers: Array<() => void> = []
afterEach(() => { for (const dispose of disposers.splice(0).reverse()) dispose() })

function bridge(session = 'chat') {
  let mounted: string | undefined = session
  const navigation = { mounted: { getSnapshot: () => mounted }, openResource: vi.fn() }
  const effect = (fn: () => unknown) => {
    const dispose = fn()
    if (typeof dispose === 'function') disposers.push(dispose as () => void)
  }
  const registry = provideBridgeRegistry({
    provide() {}, effect,
    inject(_names: string[], callback: (scope: unknown) => void) {
      callback({ effect, get: () => navigation })
    },
  } as never)
  let provider!: SpreadjsWorkbookProvider
  registry.register({ id: 'test', title: () => 'test', attach: next => { provider = next; return () => {} } })
  registry.select('test')
  return { provider, navigation, switchSession: () => { mounted = 'another-chat' } }
}

describe('editor workbook bridge', () => {
  it('passes the lease through save and releases its original owner after switching', async () => {
    const { provider } = bridge()
    const owner = {
      id: 'first', getWorkbook: () => ({}), acquireDriverLease: () => 'first-lease',
      save: vi.fn(async (_lease?: string) => {}), releaseDriverLease: vi.fn(),
    }
    disposers.push(publishWorkbook(owner))
    const lease = provider.acquireDriverLease!()
    await provider.save!(lease)
    expect(owner.save).toHaveBeenCalledWith(lease)
    const replacement = { ...owner, id: 'second', save: vi.fn(async () => {}), releaseDriverLease: vi.fn() }
    disposers.push(publishWorkbook(replacement))
    await expect(provider.save!(lease)).rejects.toThrow(/no longer active/)
    provider.releaseDriverLease!(lease)
    expect(owner.releaseDriverLease).toHaveBeenCalledWith(lease)
    expect(replacement.releaseDriverLease).not.toHaveBeenCalled()
    expect(replacement.save).not.toHaveBeenCalled()
  })

  it('opens through the host and waits for the requested workbook to load', async () => {
    const { provider, navigation } = bridge()
    const address = 'dsh-resource://file/session/chat/new.xlsx'
    let ready = false
    navigation.openResource.mockImplementation(() => {
      disposers.push(publishWorkbook({ id: 'editor', getActivePath: () => address, getWorkbook: () => ready ? {} : undefined }))
    })
    let finished = false
    const opening = provider.openWorkbook!(address, 2000).then(() => { finished = true })
    await Promise.resolve()
    expect(finished).toBe(false)
    ready = true
    await opening
    expect(navigation.openResource).toHaveBeenCalledWith(address)
  })

  it('refuses navigation in another session and interrupts a session switch', async () => {
    const { provider, navigation, switchSession } = bridge()
    await expect(provider.openWorkbook!('dsh-resource://file/session/other/new.xlsx', 1000)).rejects.toThrow(/visible/)
    expect(navigation.openResource).not.toHaveBeenCalled()
    const opening = provider.openWorkbook!('dsh-resource://file/session/chat/new.xlsx', 1000)
    switchSession()
    await expect(opening).rejects.toThrow(/session changed/)
  })
})
