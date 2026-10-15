/**
 * Offer this plugin's live Designer to whichever bridge the user selected.
 *
 * The shape is "publish a roster and hand the workbook to the chosen entry", not
 * "inject the one service that exists" — see `bridge-registry.ts` for why the
 * latter can never offer a choice.
 *
 * What did NOT change, and matters more than the plumbing:
 *
 *  - **This plugin owns the workbook, so it decides who may operate on it.** The
 *    roster is a list of candidates, not a broadcast: exactly one entry is handed
 *    the document, the one the user picked in Settings.
 *  - **The workbook is offered, never discovered.** There is no way for another
 *    plugin to reach a document it was not handed.
 *  - **It is a live reference, never a copy.** The workbook never leaves the page
 *    and is never serialized, which is exactly why a style written through it
 *    appears in the Designer the moment it lands.
 *
 * The bridge is optional. With no provider installed the roster is simply empty,
 * nothing attaches, and the editor behaves as it does without one.
 */
import type { Context } from '@deepseek-ai/cordis'
import { parseSessionFileAddress } from './session-file-address.ts'
import {
  BRIDGE_REGISTRY_SERVICE,
  createBridgeRegistry,
  type SpreadjsBridgeEntry,
  type SpreadjsBridgeRegistry,
  type SpreadjsWorkbookProvider,
} from './bridge-registry.ts'

// Re-exported so a caller that already imports from this module — the document
// body does — keeps one import site. The type itself has one definition, in
// `bridge-registry.ts`, where the roster contract lives.
export type { SpreadjsWorkbookProvider }

/** The provider id a bridge will see. */
export const PROVIDER_ID = 'spreadjs-designer'

/**
 * The panel currently showing a workbook. The sidebar renders one file viewer at
 * a time, so a single slot is enough: the last panel to mount wins, and a panel
 * that unmounts only clears the slot while it still owns it.
 */
let active: SpreadjsWorkbookProvider | undefined
const leaseOwners = new Map<string, SpreadjsWorkbookProvider>()
interface EditorNavigation {
  mounted: { getSnapshot(): string | undefined }
  openResource(address: string): void
}
let navigation: EditorNavigation | undefined
let opening = false

/** Offer `provider` to the roster until the returned function is called. */
export function publishWorkbook(provider: SpreadjsWorkbookProvider): () => void {
  active = provider
  let released = false
  return () => {
    if (released) return
    released = true
    if (active === provider) active = undefined
  }
}

/**
 * The provider a bridge holds. It reads through to whichever panel is mounted,
 * so a panel that opens or closes later never needs a re-attach — and a bridge
 * selected *after* the panel mounted still finds the workbook.
 */
const DESIGNER: SpreadjsWorkbookProvider = {
  id: PROVIDER_ID,
  getWorkbook: () => active?.getWorkbook(),
  getNamespace: () => active?.getNamespace?.(),
  getActivePath: () => active?.getActivePath?.(),
  getWorkbookIdentity: () => active?.getWorkbookIdentity?.(),
  getSessionId: () => navigation?.mounted.getSnapshot(),
  openWorkbook: async (address: string, timeoutMs: number) => {
    const file = parseSessionFileAddress(address)
    const owner = navigation
    if (file === undefined || owner === undefined || owner.mounted.getSnapshot() !== file.sessionId) {
      throw new Error('The requested session must be visible in the DSH web UI')
    }
    if (opening || active?.isDriverBusy?.()) throw new Error('The editor is already busy')
    opening = true
    try {
      owner.openResource(address)
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        if (navigation !== owner || owner.mounted.getSnapshot() !== file.sessionId) {
          throw new Error('The editor session changed while opening the workbook')
        }
        if (active?.getActivePath?.() === address && active.getWorkbook() != null) return
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      throw new Error('The editor did not finish loading the requested workbook in time')
    } finally {
      opening = false
    }
  },
  acquireDriverLease: () => {
    const provider = active
    if (provider?.acquireDriverLease === undefined) throw new Error('the editor does not support Driver leases')
    const lease = provider.acquireDriverLease()
    leaseOwners.set(lease, provider)
    return lease
  },
  releaseDriverLease: (lease: string) => {
    const owner = leaseOwners.get(lease)
    leaseOwners.delete(lease)
    owner?.releaseDriverLease?.(lease)
  },
  isDriverBusy: () => active?.isDriverBusy?.() ?? false,
  getDriverLeaseSignal: (lease: string) => leaseOwners.get(lease)?.getDriverLeaseSignal?.(lease),
  save: async (lease?: string, options?: { signal?: AbortSignal; beforeWrite?: () => Promise<void> }) => {
    const provider = active
    if (lease !== undefined && leaseOwners.get(lease) !== provider) {
      throw new Error('the editor holding this Driver lease is no longer active')
    }
    // Rejects when there is nobody to save through. The optional chaining this
    // replaces resolved successfully in that case, which told the agent a file
    // had been written when no write was even attempted.
    if (provider === undefined || provider.save === undefined) {
      throw new Error('no designer panel is showing a workbook, so there is nothing to save')
    }
    await provider.save(lease, options)
  },
}

/**
 * Publish the roster and keep the Designer attached to the selected entry.
 *
 * No injection and no ordering assumption: the selection is made through this
 * same object by the settings page, so reacting to the roster and to the
 * selection alike — and re-attaching when either changes — is the whole job.
 */
export function provideBridgeRegistry(ctx: Context): SpreadjsBridgeRegistry {
  const registry = createBridgeRegistry()
  ctx.provide(BRIDGE_REGISTRY_SERVICE, registry)
  ctx.inject(['sidebarRight'], (scope) => {
    scope.effect(() => {
      const service = scope.get('sidebarRight') as EditorNavigation | undefined
      if (typeof service?.openResource !== 'function' || typeof service.mounted?.getSnapshot !== 'function') return () => {}
      navigation = service
      return () => { if (navigation === service) navigation = undefined }
    }, 'dsh-spreadjs-editor: workbook navigation')
  })

  ctx.effect(() => {
    let attachedTo: SpreadjsBridgeEntry | undefined
    let release: (() => void) | undefined

    const sync = (): void => {
      const wanted = registry.current()
      if (wanted === attachedTo) return

      // Released before the next attaches, so two bridges never hold the same
      // document at once.
      try { release?.() } catch { /* already released */ }
      release = undefined
      attachedTo = wanted
      if (wanted === undefined) return

      try {
        release = wanted.attach(DESIGNER)
      } catch (error) {
        // Reported, not retried. An attach that throws is a defect in the
        // provider, and re-running it on every roster change would turn one
        // broken bridge into a stream of identical failures.
        console.error(`[dsh-spreadjs-editor] bridge "${wanted.id}" refused the designer:`, error)
      }
    }

    const off = registry.subscribe(sync)
    sync()
    return () => {
      off()
      try { release?.() } catch { /* already released */ }
    }
  }, 'dsh-spreadjs-editor: designer to selected bridge')

  return registry
}
