/**
 * Pull the harness packages' declaration merges into the TS program.
 *
 * The node half reads `ctx.webServer` from @deepseek-ai/dsh-host-webserver;
 * the browser half imports `ClientContext` directly from
 * @deepseek-ai/dsh-client-runtime/client. This module exists for the
 * typechecker only and is never part of a bundle.
 */
import type {} from '@deepseek-ai/dsh-host-webserver'

export {}
