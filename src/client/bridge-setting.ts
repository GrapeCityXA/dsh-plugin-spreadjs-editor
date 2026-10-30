/**
 * Bind the bridge choice to this plugin's settings namespace.
 *
 * Direction matters here and is deliberately one-way. **The settings document is
 * the source of truth; the registry mirrors it.**
 *
 * The other way round — registry authoritative, settings a write-behind cache —
 * would mean the roster and the persisted value could disagree after a reload, a
 * second browser, or a failed write, and there would be no way to say which was
 * right. With one direction there is always an answer: whatever the settings
 * document says is what is chosen.
 *
 * The one exception is the moment the user clicks. `choose` applies the choice
 * to the registry FIRST and persists second, so the UI responds immediately and a
 * write that fails leaves a chosen bridge rather than a dead control. The
 * subscriber then sees its own value come back and does nothing.
 *
 * A note on what "persist" can mean: `dsh-client-ui-settings` binds a scope in
 * `mode: 'memory'` when the page is not on loopback, and such a scope never
 * reaches the settings file. That is a supported outcome, not an error — the
 * choice still applies for the session, and `persisted()` is how the page can
 * say so rather than pretending.
 */
import { BRIDGE_FIELD, NO_BRIDGE, SETTINGS_NAMESPACE } from '../shared/settings.ts'
import type { SpreadjsBridgeRegistry } from './bridge-registry.ts'

/**
 * The slice of one namespace's form this plugin uses.
 *
 * A subset of DSH's `ConfigForm`, declared structurally so this module stays
 * testable with a plain object. The full face also carries `mutate`, `unset`,
 * `base`, `user` and `revision`; nothing here needs them.
 *
 * The snapshot fields are the ones the choice depends on: `status` decides
 * whether a value has loaded at all, and `mode` distinguishes a Host-backed form
 * from a process-local one that can never reach the settings file.
 */
export interface ConfigFormLike {
  getSnapshot(): {
    readonly status: 'loading' | 'ready' | 'unavailable'
    readonly value?: unknown
    readonly writable?: boolean
    readonly mode?: 'host' | 'memory'
  }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<unknown>
}

/**
 * The service a browser half reaches a namespace's form through.
 *
 * In DSH 0.1.7 this is `ctx.configForms`, and the entry id it takes IS the
 * settings namespace. It replaced the older `ctx.settingsScope.bind({namespace})`
 * — a service that no longer exists in any form, which is why this plugin's
 * settings page silently stopped appearing on 0.1.7: cordis parks a fiber whose
 * declared service is missing, so the whole `inject` callback never ran.
 */
export interface ConfigFormsLike {
  get(entryId: string): ConfigFormLike
}

/**
 * Why the last write did not reach the settings document.
 *
 * A code rather than a sentence, so the page owns the copy and it goes through
 * the same dictionary as the rest of the UI: `refused` is the Host declining
 * (a resolved `false`), `failed` is the write throwing.
 */
export type StorageNote = 'refused' | 'failed' | undefined

/** The choice, and how to change it. */
export interface BridgeSetting {
  /**
   * Choose a bridge by id, or `undefined` for none.
   *
   * Applies at once; persistence is attempted afterwards and its failure is
   * reported, never rolled back into the UI.
   */
  choose(id: string | undefined): void
  /**
   * What the settings document says, once it has loaded.
   *
   * `undefined` means "not loaded yet", which is different from
   * {@link NO_BRIDGE} ("loaded, and nothing is chosen").
   */
  persisted(): string | undefined
  /**
   * The reason the last write did not reach the settings document, or undefined
   * when it was accepted.
   *
   * This exists because the failure is otherwise invisible. `set` reports a
   * refused or skipped write by RESOLVING `false`, not by rejecting, so a
   * `.catch` sees nothing — which is how a schema that forbade the write
   * entirely (`Config field "bridge" is not volatile`) looked like a working
   * control whose choice evaporated on the next start.
   */
  storageNote(): StorageNote
  /** Observe the choice and the storage note together. */
  subscribe(listener: () => void): () => void
  dispose(): void
}

/** Read the chosen id out of a form snapshot, or undefined when it has not loaded. */
function readChoice(form: ConfigFormLike): string | undefined {
  const snapshot = form.getSnapshot()
  if (snapshot.status !== 'ready') return undefined
  const section = snapshot.value
  if (typeof section !== 'object' || section === null) return undefined
  const value = (section as Record<string, unknown>)[BRIDGE_FIELD]
  return typeof value === 'string' ? value : undefined
}

/**
 * Wire this plugin's settings namespace to the registry.
 *
 * @param forms - the `configForms` service.
 * @param registry - the roster being kept in step with the document.
 */
export function connectBridgeSetting(
  forms: ConfigFormsLike,
  registry: SpreadjsBridgeRegistry,
): BridgeSetting {
  const scope = forms.get(SETTINGS_NAMESPACE)
  let lastSeen: string | undefined
  /** The last write's outcome, when it was not accepted. */
  let storage: StorageNote
  const listeners = new Set<() => void>()

  const sync = (): void => {
    const value = readChoice(scope)
    if (value === undefined || value === lastSeen) return
    lastSeen = value
    registry.select(value === NO_BRIDGE ? undefined : value)
  }

  const choose = (id: string | undefined): void => {
    // Applied before it is stored: the control must not depend on a round trip
    // to a settings file to look like it did something.
    registry.select(id)
    lastSeen = id ?? NO_BRIDGE
    const settle = (note: StorageNote): void => {
      storage = note
      for (const listener of [...listeners]) listener()
    }
    void scope.set(BRIDGE_FIELD, id ?? NO_BRIDGE).then(
      (accepted) => {
        // `false` is a REFUSAL, not a rejection: the Host declined or skipped the
        // write. Treating only rejections as failure is how a choice that never
        // persisted looked like a working control.
        settle(accepted === false ? 'refused' : undefined)
      },
      (error: unknown) => {
        // Reported, not undone. The choice is live for this session either way,
        // and silently reverting it would be the more confusing outcome.
        console.error('[dsh-spreadjs-editor] could not save the bridge choice:', error)
        settle('failed')
      },
    )
  }

  const off = scope.subscribe(sync)
  sync()

  // Registration has no "roster complete" event: another bridge may arrive
  // before the selected one at startup, or remain while it temporarily reloads.
  // Preserve the saved id until the user changes it. The registry exposes no
  // current bridge while it is absent, and Settings explains that state.

  return {
    choose,
    persisted(): string | undefined {
      return lastSeen
    },
    storageNote(): StorageNote {
      return storage
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    dispose(): void {
      listeners.clear()
      off()
    },
  }
}
