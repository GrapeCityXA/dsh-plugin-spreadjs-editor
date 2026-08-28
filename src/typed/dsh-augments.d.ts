/**
 * Declaration-merging augmentations of REAL harness packages. This file is a
 * MODULE (it imports) so its `declare module` blocks AUGMENT the real packages
 * instead of shadowing them (a global-script declaration would replace the
 * package's own exports).
 *
 *  - @deepseek-ai/dsh-client-ui-slots: contribute the two consumer-side slots
 *    this plugin targets plus the useWorkspaces global standard hook.
 *  - @deepseek-ai/cordis: the ctx.slots and ctx.webServer services.
 *
 * New (non-existent) packages are declared in the sibling global-script
 * facade file dsh-facade.d.ts.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Sidebar footer action seat (declared by ui-sidebar in the harness). */
    'sidebar.footer.action': { kind: 'list'; scope: 'root'; owner: { wide: boolean } }
    /** Frame-wide overlay seat (declared by ui-layout in the harness). */
    'shell.overlay': { kind: 'list'; scope: 'root' }
  }
  interface GlobalStandardProps {
    /** Selector hook over the Workspace Controller snapshot (provided by ui-workspace). */
    useWorkspaces: import('@deepseek-ai/dsh-client-ui-slots').SnapshotSelectorHook<
      import('@deepseek-ai/dsh-api-workspace-controller/client').WorkspaceSnapshot
    >
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Slot registry service (ui-renderer). */
    slots: DshSpreadjsFacade.SlotsService
    /** HTTP route registry (dsh-host-webserver). */
    webServer: DshSpreadjsFacade.WebServer
  }
}
