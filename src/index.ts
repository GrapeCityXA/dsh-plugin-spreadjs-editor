/**
 * dsh-spreadjs-editor — node half.
 *
 * Registers the `/spreadjs` prefix route on the harness web server. The
 * better-sidebar browser half reads and writes files through ui-all's session
 * routes; this host half only supplies the SpreadJS license/config handshake.
 *
 * Security posture: the server binds to 127.0.0.1 by default and this plugin
 * adds no external exposure of its own.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-spreadjs-editor'

/** Required service: the web server whose route table this plugin extends. */
export const inject = ['webServer']

/** Plugin configuration (patch layer). */
export interface Config {
  /** SpreadJS license key; empty runs the evaluation build. @default '' */
  licenseKey?: string
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
  })
  res.end(data)
}

function readPathname(req: IncomingMessage): string {
  return new URL(req.url ?? '/', 'http://localhost').pathname
}

export function apply(ctx: Context, config: Config = {}): void {
  const webServer = ctx.webServer

  const disposer = webServer.register({
    kind: 'prefix',
    path: '/spreadjs',
    handler: (req: IncomingMessage, res: ServerResponse): void => {
      try {
        const pathname = readPathname(req)
        if (pathname === '/spreadjs/api/health') {
          sendJson(res, 200, { ok: true })
          return
        }
        if (pathname === '/spreadjs/api/config') {
          sendJson(res, 200, { licenseKey: config.licenseKey ?? '' })
          return
        }
        sendJson(res, 404, { error: 'unknown endpoint' })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!res.headersSent) sendJson(res, 500, { error: message })
        else res.destroy()
      }
    },
  })

  ctx.effect(() => disposer, 'dsh-spreadjs-editor: /spreadjs routes')
}
