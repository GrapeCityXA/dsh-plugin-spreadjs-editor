/**
 * Pull the harness packages' declaration merges into the TS program.
 *
 * The node half reads `ctx.webServer` from @deepseek-ai/dsh-host-webserver; the
 * browser half reads `ctx.documentPreviews` from the Sidebar's document-preview
 * package and `ctx.slots` from the UI renderer that owns the slot registry. This
 * module exists for the typechecker only and is never part of a bundle.
 */
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'

export {}
