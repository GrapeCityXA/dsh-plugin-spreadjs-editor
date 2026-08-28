/**
 * Pull the harness packages' declaration merges into the TS program.
 *
 * The slot seats this plugin targets are declared by OTHER packages:
 *  - `sidebar.footer.action` — @deepseek-ai/dsh-client-ui-sidebar (SlotMap + owner props)
 *  - `shell.overlay`         — @deepseek-ai/dsh-client-ui-layout (SlotMap)
 *  - `ctx.webServer`         — @deepseek-ai/dsh-host-webserver (Context service)
 *
 * Those `declare module` merges only apply when the declaring .d.ts is part of
 * the program, so this module references them explicitly. All imports are
 * type-only and erased at build; this file exists for the typechecker only and
 * is never part of a bundle.
 */
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-host-webserver'

export {}
