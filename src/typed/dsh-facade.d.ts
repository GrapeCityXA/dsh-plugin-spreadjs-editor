/**
 * Minimal type facade for the DeepSeek Harness APIs this plugin consumes.
 *
 * Why it exists: the harness packages that carry these surfaces (dsh-client-store,
 * the ui-slot / host-slot service merges, api-workspace-controller) are not all
 * published to npm at their current dev versions, so a standalone plugin cannot
 * depend on their published type declarations. Instead this file declares the
 * exact surfaces the plugin relies on — each verified against the harness
 * source (packages/client/*, packages/host/webserver) — so the build stays
 * type-correct while the RUNTIME external imports (`@deepseek-ai/dsh-client-store`
 * for defineStore, react for components) keep resolving from the harness's
 * module table. Everything declared here is type-only and erased at build.
 *
 * THIS FILE MUST STAY A GLOBAL SCRIPT (no top-level import/export):
 *  - `declare module '<name>'` here CREATES an ambient module, so it is only
 *    used for packages that do not exist on disk (dsh-client-store,
 *    api-workspace-controller). Declaring a REAL package here would shadow it
 *    and break its own `export *` re-exports.
 *  - The augmentations of real packages (@deepseek-ai/dsh-client-ui-slots,
 *    @deepseek-ai/cordis) live in the sibling module file dsh-augments.d.ts.
 */

// ---------------------------------------------------------------------------
// @deepseek-ai/dsh-client-store — baseline module-table key (defineStore).
// ---------------------------------------------------------------------------
declare module '@deepseek-ai/dsh-client-store' {
  export function defineStore<T, A extends import('@deepseek-ai/dsh-client-ui-slots').ActionsDecl<T>>(
    spec: import('@deepseek-ai/dsh-client-ui-slots').StoreSpec<T, A>,
  ): import('@deepseek-ai/dsh-client-ui-slots').StoreHandle<T, A>
}

// ---------------------------------------------------------------------------
// @deepseek-ai/dsh-api-workspace-controller/client — Workspace snapshot types
// (the `useWorkspaces` global hook's snapshot; verified against
// packages/api/workspace-controller/src/types.ts).
// ---------------------------------------------------------------------------
declare module '@deepseek-ai/dsh-api-workspace-controller/client' {
  export interface WorkspaceView {
    workspaceId: string
    title: string
    /** Canonical host directory path. */
    path: string
    createdAt: string
    updatedAt: number
    sessionIds: string[]
  }
  export interface WorkspaceSnapshot {
    items: readonly WorkspaceView[]
  }
}

// ---------------------------------------------------------------------------
// Helper types for the Cordis Context service merges consumed at runtime
// (ctx.slots — ui-renderer; ctx.webServer — dsh-host-webserver). Namespaced
// to avoid leaking generic names into the global scope. Consumed by
// dsh-augments.d.ts and by the plugin sources via the merged Context.
// ---------------------------------------------------------------------------
declare namespace DshSpreadjsFacade {
  interface RegisterOptions {
    name: string
    /** Child-slot declaration table (declaration = render authority). */
    children?: Record<string, { kind: 'single' | 'list' | 'keyed' | 'chain'; scope: 'root' | 'session' | 'session-maybe' }>
    /** Shared store handle (apply-constructed) or exclusive factory. */
    store?: unknown
    /** Registrant business-face factory. */
    inject?: () => object
    /** Locale namespace for the component's `t` seat. */
    locale?: string
    /** List slots: unique entry id. */
    id?: string
    /** List slots: display order (ascending). */
    order?: number
    /** Keyed slots: dispatch key. */
    key?: string
    /** Chain slots: routing selector. */
    select?: (owner: object) => unknown
    priority?: number
    label?: string | (() => string)
  }

  interface StoredEntry {
    component: unknown
    options: Record<string, unknown>
  }

  interface SlotsService {
    register(options: RegisterOptions, component: unknown): () => void
    inject(key: string, callback: () => (() => void) | Iterable<() => void>): () => void
    entries(key: string): readonly StoredEntry[]
    subscribe(key: string, fn: () => void): () => void
    spec(key: string): unknown
    getVersion(key: string): number
    /** Provide root-scope global hooks (the `useWorkspaces` seat, etc.). */
    provideRoot(options: {
      hooks?: Record<string, { getSnapshot: () => unknown; subscribe: (fn: () => void) => () => void }>
    }): void
  }

  interface WebServer {
    readonly port: number
    readonly host: '127.0.0.1' | '0.0.0.0'
    register(route: {
      kind: 'exact' | 'prefix'
      path: string
      handler: (
        req: import('node:http').IncomingMessage,
        res: import('node:http').ServerResponse,
      ) => void | Promise<void>
    }): () => void
    registerUpgrade(route: unknown): () => void
    registerFallback(handler: (req: unknown, res: unknown) => void | Promise<void>): () => void
    tapIndex(transform: (html: string) => string): () => void
  }
}
