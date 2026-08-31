/**
 * dsh-spreadjs-editor — node half.
 *
 * Registers the `/spreadjs` prefix route on the harness web server. The editor
 * (browser half) reads and writes spreadsheet files through these endpoints.
 *
 * Security posture: the server binds to 127.0.0.1 by default and this plugin
 * adds no external exposure of its own. Every file read is confined to the
 * requested root's subtree (see resolveWithinRoot); the editor receives the
 * resolved path and root from the generic webFileEditors service.
 */

import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { listSpreadsheetFiles, resolveWithinRoot } from './fs-bridge.ts'

export const name = 'dsh-spreadjs-editor'

/** Required service: the web server whose route table this plugin extends. */
export const inject = ['webServer']

/** Plugin configuration (patch layer). */
export interface Config {
  /** Directory scanned when the editor sends no explicit root. @default process.cwd() */
  defaultRoot?: string
  /** SpreadJS license key; empty runs the evaluation build. @default '' */
  licenseKey?: string
}

const MIME: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.main+xml',
  '.csv': 'text/csv; charset=utf-8',
  '.sjs': 'application/octet-stream',
  '.ssjson': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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

function readQuery(req: IncomingMessage): { pathname: string; params: URLSearchParams } {
  const url = new URL(req.url ?? '/', 'http://localhost')
  return { pathname: url.pathname, params: url.searchParams }
}

/** Resolve the effective browse root for one request. */
function effectiveRoot(params: URLSearchParams, fallback: string): string {
  const raw = params.get('root')
  return raw === null || raw === '' ? fallback : resolve(raw)
}

export function apply(ctx: Context, config: Config = {}): void {
  const defaultRoot = resolve(config.defaultRoot ?? process.cwd())
  const webServer = ctx.webServer

  const disposer = webServer.register({
    kind: 'prefix',
    path: '/spreadjs',
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      try {
        const { pathname, params } = readQuery(req)
        if (pathname === '/spreadjs/api/health') {
          sendJson(res, 200, { ok: true })
          return
        }
        if (pathname === '/spreadjs/api/roots') {
          sendJson(res, 200, { cwd: defaultRoot })
          return
        }
        if (pathname === '/spreadjs/api/config') {
          sendJson(res, 200, { licenseKey: config.licenseKey ?? '' })
          return
        }
        if (pathname === '/spreadjs/api/list') {
          const root = effectiveRoot(params, defaultRoot)
          const files = await listSpreadsheetFiles(root)
          sendJson(res, 200, { root, count: files.length, files })
          return
        }
        if (pathname === '/spreadjs/api/file') {
          const rawPath = params.get('path')
          if (rawPath === null || rawPath === '') {
            sendJson(res, 400, { error: 'missing "path" query parameter' })
            return
          }
          const root = effectiveRoot(params, defaultRoot)
          const abs = resolveWithinRoot(root, rawPath)
          if (abs === null) {
            sendJson(res, 403, { error: 'path escapes the requested root' })
            return
          }
          if (req.method === 'PUT') {
            await mkdir(dirname(abs), { recursive: true })
            await new Promise<void>((resolve, reject) => {
              const out = createWriteStream(abs)
              req.pipe(out)
              req.on('error', reject)
              out.on('error', reject)
              out.on('finish', resolve)
            })
            const info = await stat(abs)
            sendJson(res, 200, { ok: true, path: rawPath, size: info.size })
            return
          }
          let info
          try {
            info = await stat(abs)
          } catch {
            sendJson(res, 404, { error: 'file not found' })
            return
          }
          if (!info.isFile()) {
            sendJson(res, 400, { error: 'not a file' })
            return
          }
          res.writeHead(200, {
            'Content-Type': MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream',
            'Content-Length': info.size,
            'Cache-Control': 'no-store',
          })
          createReadStream(abs)
            .on('error', () => {
              if (!res.headersSent) sendJson(res, 500, { error: 'read failed' })
              else res.destroy()
            })
            .pipe(res)
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
