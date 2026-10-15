/**
 * The registry that lets a user choose which plugin drives the workbook on
 * screen.
 *
 * WHY A REGISTRY AND NOT A SERVICE NAME
 *
 * This replaces `spreadjsHostBridge` — a single Cordis service the driver
 * published and this plugin injected by name. That worked, and it was already
 * provider-agnostic in the sense that nothing here named the driver's package.
 * What it could not do is offer a CHOICE, and the reason is structural rather
 * than incidental:
 *
 *   A second `provide` of a live service name THROWS
 *   (`service "…" has been registered at <fiber>`), and because the throw lands
 *   inside the second plugin's `apply`, that plugin never activates. There is no
 *   chain, no last-wins, no fan-out — `get`/`inject` see exactly one value.
 *   Empirically: 0 of 239 shipped packages shares a service name with another.
 *
 * So "let the user pick among bridges" cannot be built by having several plugins
 * provide one name. It is built the way DSH builds every other many-contributors
 * feature — `ctx.tools.register`, `ctx.llm.registerAdapter`, `ctx.slots.register`
 * — as ONE service that many plugins register INTO, where the service owns the
 * roster.
 *
 * WHY THIS PLUGIN OWNS IT
 *
 * A registry has to be published by somebody, and there is no neutral party in a
 * plugin world. The editor owns the workbook, so it owns the list of who may be
 * handed that workbook — which also keeps the security property this plugin was
 * designed around: the editor is the gatekeeper, and it hands the live document
 * only to one entry, the one the user selected. The cost is that a bridge
 * provider must inject a service this plugin publishes (the dependency now runs
 * provider → editor). That is the honest description of the relationship: a
 * provider IS a consumer of this plugin's workbooks. It stays optional — a
 * profile without the editor simply never fires the injection.
 *
 * Selection is kept beside the roster rather than in a separate store so that one
 * object answers both questions a settings page has to ask ("what is on offer"
 * and "which is chosen"), and a single subscription covers both.
 */

/** The service name this plugin publishes. */
export const BRIDGE_REGISTRY_SERVICE = 'spreadjsBridgeRegistry'

/**
 * A live workbook offered to a bridge, plus the few facts it needs.
 *
 * This is the editor's side of the contract and travels in the same direction it
 * always did: the owner hands over a reference, never a copy, and never a
 * serialized document.
 */
export interface SpreadjsWorkbookProvider {
  /** Stable identity, used to address one attached workbook among several. */
  readonly id: string
  /** The live workbook, or undefined when nothing is open. */
  getWorkbook(): unknown | undefined
  /**
   * The SpreadJS namespace the owner imported, injected into user code as `GC`
   * so enums (UsedRangeType, HorizontalAlign, chart types …) are reachable.
   * Without it, code that needs an enum cannot run.
   */
  getNamespace?(): unknown
  /** Absolute path of the open file, when there is one. */
  getActivePath?(): string | undefined
  /** Identity of this loaded document, renewed whenever its contents are loaded again. */
  getWorkbookIdentity?(): { sessionId: string; file: string; instanceId: string } | undefined
  /** Session currently visible in the host; permits opening before a panel exists. */
  getSessionId?(): string | undefined
  /** Open through the owner's public sidebar navigation and wait for its workbook. */
  openWorkbook?(address: string, timeoutMs: number): Promise<void>
  /** Ask the owner to persist the live workbook to its file. */
  save?(lease?: string, options?: { signal?: AbortSignal; beforeWrite?: () => Promise<void> }): Promise<void>
  /** Acquire an exclusive lease while a bridge is executing against the workbook. */
  acquireDriverLease?(): string
  /** Release a lease acquired by this provider. */
  releaseDriverLease?(lease: string): void
  /** Whether the editor is currently owned by a bridge. */
  isDriverBusy?(): boolean
  /** Aborted by the owner after snapshotting an instance that is being destroyed. */
  getDriverLeaseSignal?(lease: string): AbortSignal | undefined
}

/**
 * One bridge a plugin has registered — what a provider implements to be
 * selectable.
 */
export interface SpreadjsBridgeEntry {
  /** Unique within the registry. A second registration of the same id throws. */
  readonly id: string
  /**
   * Name shown in the settings list. A thunk, so it can be localized by whoever
   * registers it rather than frozen at registration time.
   */
  readonly title: () => string
  /**
   * Take custody of a live workbook.
   * @returns a disposer the caller MUST invoke when it unloads, so the bridge
   *          stops holding a reference to a destroyed document.
   */
  attach(provider: SpreadjsWorkbookProvider): () => void
}

/** The registry service. */
export interface SpreadjsBridgeRegistry {
  /** Add a bridge; returns a disposer. Throws when `entry.id` is already taken. */
  register(entry: SpreadjsBridgeEntry): () => void
  /** Registered bridges, in registration order. */
  list(): readonly SpreadjsBridgeEntry[]
  /** Notified when the roster or the selection changes. */
  subscribe(listener: () => void): () => void
  /**
   * The id the user chose, whether or not it is currently registered.
   *
   * Deliberately not filtered by the roster: at boot the saved choice is read
   * before a provider has necessarily registered itself, and a selection that
   * silently evaporated because of load order would look like the setting did
   * not stick.
   */
  selected(): string | undefined
  /** The chosen entry, or undefined when nothing is chosen or it is not here. */
  current(): SpreadjsBridgeEntry | undefined
  /** Choose an entry by id; `undefined` clears the choice. */
  select(id: string | undefined): void
}

/** Create a registry. Pure in-memory; persistence is the caller's business. */
export function createBridgeRegistry(): SpreadjsBridgeRegistry {
  const entries = new Map<string, SpreadjsBridgeEntry>()
  const listeners = new Set<() => void>()
  let chosen: string | undefined

  const notify = (): void => {
    // Copied before iterating: a listener may unsubscribe while being called.
    for (const listener of [...listeners]) listener()
  }

  return {
    register(entry: SpreadjsBridgeEntry): () => void {
      // Loud rather than last-wins. Two plugins claiming one id is a collision
      // somebody has to fix, and silently letting the later one win is how an
      // uninstalled-anyway plugin keeps getting used.
      if (entries.has(entry.id)) {
        throw new Error(`spreadjsBridgeRegistry: "${entry.id}" is already registered`)
      }
      entries.set(entry.id, entry)
      notify()

      let live = true
      return () => {
        // Idempotent, and it only removes itself: a plugin that unloads during a
        // reload must not drop a newer registration that reused the same id.
        if (!live) return
        live = false
        if (entries.get(entry.id) === entry) entries.delete(entry.id)
        notify()
      }
    },

    list(): readonly SpreadjsBridgeEntry[] {
      return [...entries.values()]
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    selected(): string | undefined {
      return chosen
    },

    current(): SpreadjsBridgeEntry | undefined {
      return chosen === undefined ? undefined : entries.get(chosen)
    },

    select(id: string | undefined): void {
      if (id === chosen) return
      chosen = id
      notify()
    },
  }
}
