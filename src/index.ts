/**
 * dsh-spreadjs-editor — node half.
 *
 * Two responsibilities:
 *
 *  1. Supply the SpreadJS license/config handshake on the `/spreadjs` prefix.
 *  2. Save an edited workbook back to the file it came from.
 *
 * Why this plugin carries the write at all: the harness filesystem seam reads
 * bytes but mutates text only (`ctx.fs.writeText`/`editText`, and
 * `writeFileAtomic` takes a string), so neither the harness nor an agent can
 * write a workbook. The capability therefore has to live in the document's own
 * plugin — and this is the shape to keep when the platform grows a byte write:
 * every decision below is already delegated to harness services, and only the
 * final byte replacement is local.
 *
 * Policy is never invented here:
 *
 *  - the session's workspace root is resolved exactly as
 *    `@deepseek-ai/dsh-api-workspace-files` resolves it: live session header cwd,
 *    persistent header as fallback, deployment sandbox root last;
 *  - containment is decided by `ctx.fs.contains` on resolved targets, so a write
 *    can never leave that root;
 *  - the freshness guard uses the complete current bytes, so a file edited
 *    elsewhere between open and save is reported instead of overwritten;
 *  - every missing service refuses the write. There is no unguarded path.
 *
 * The request fence mirrors the harness browser-trust posture: a request is
 * served only when its Host header names a loopback authority (or one the
 * deployment lists in `trustedHosts`).
 */

import { createHash } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-spreadjs-editor'

/** Required service: the web server whose route table this plugin extends. */
export const inject = ['webServer']

/** Plugin configuration (patch layer). */
export interface Config {
  /** SpreadJS license key; empty runs the evaluation build. @default '' */
  licenseKey?: string
  /** Separate SpreadJS Designer key; empty keeps Designer in evaluation mode. */
  designerLicenseKey?: string
  /**
   * Largest workbook, in bytes, this plugin will accept for a save or read back
   * for the freshness guard. A larger payload is refused rather than truncated.
   * @default 67108864
   */
  maxSaveBytes?: number
  /**
   * Extra authorities (host or host:port) allowed to call the save route, for
   * deployments reached through a LAN address. Loopback is always allowed.
   * @default []
   */
  trustedHosts?: readonly string[]
}

const DEFAULT_MAX_SAVE_BYTES = 64 * 1024 * 1024

/** A failure with an HTTP status, so handlers stay flat. */
class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

/* ------------------------------------------------------------------ *
 * Service shapes this file reads.
 *
 * Declared structurally, with the official source of each shape, so the plugin
 * depends on the behaviour it actually uses rather than on a package's full
 * surface. Every one of these is a harness service resolved per request and
 * refused when absent.
 * ------------------------------------------------------------------ */

/** `ctx.fs` — @deepseek-ai/dsh-fs `FileSystem`. */
interface FileSystemLike {
  resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<FsTargetLike>
  /** Canonical absolute path a local process can open (@see FileSystem.processPath). */
  processPath(target: FsTargetLike): string
  contains(parent: FsTargetLike, child: FsTargetLike): boolean
  stat(target: FsTargetLike, signal?: AbortSignal): Promise<{ type: string; size?: number } | undefined>
  readBytes(target: FsTargetLike, signal: AbortSignal | undefined, maxBytes: number): Promise<Uint8Array>
}

/** `FsTarget` — opaque identity; consumers must not parse `targetKey`. */
interface FsTargetLike {
  readonly targetKey: unknown
  readonly displayPath: string
}

/** `ctx.sessions` — @deepseek-ai/dsh-session `SessionStore`, read for its header. */
interface SessionStoreLike {
  get(sessionId: string): { header?: { cwd?: string } } | undefined
}

/** `ctx.sandboxPolicy` — @deepseek-ai/dsh-sandbox `SandboxPolicy`. */
interface SandboxPolicyLike {
  readonly workspaceRoot: string
}

function serviceOf<T>(ctx: Context, serviceName: string): T | undefined {
  const bag = ctx as unknown as { get?: (name: string) => unknown }
  if (typeof bag.get !== 'function') return undefined
  return (bag.get(serviceName) as T | undefined) ?? undefined
}

/* ------------------------------------------------------------------ *
 * Request plumbing
 * ------------------------------------------------------------------ */

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
  })
  res.end(data)
}

function sendError(res: ServerResponse, error: unknown): void {
  const failure = error instanceof HttpError
    ? error
    : new HttpError(500, 'internal', error instanceof Error ? error.message : String(error))
  if (!res.headersSent) sendJson(res, failure.status, { ok: false, error: { code: failure.code, message: failure.message } })
  else res.destroy()
}

function readPathname(req: IncomingMessage): string {
  return new URL(req.url ?? '/', 'http://localhost').pathname
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/**
 * The harness browser-trust fence: serve only a request whose Host header names
 * a loopback authority (any port), or one the deployment lists explicitly.
 *
 * @param req - the incoming request.
 * @param trustedHosts - extra allowed authorities from the plugin config.
 * @returns whether the request may be served.
 */
function isTrustedRequest(req: IncomingMessage, trustedHosts: readonly string[]): boolean {
  const host = req.headers.host
  if (host === undefined || host === '') return false
  const authority = host.toLowerCase()
  const hostname = authority.startsWith('[')
    ? authority.slice(0, (authority.indexOf(']') + 1) || undefined)
    : authority.split(':')[0] ?? ''
  if (LOOPBACK_HOSTS.has(hostname)) return true
  return trustedHosts.some(allowed => allowed.toLowerCase() === authority || allowed.toLowerCase() === hostname)
}

/** Read a request body, refusing anything above `limit` instead of truncating. */
async function readBody(req: IncomingMessage, limit: number): Promise<Uint8Array> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    total += buffer.length
    if (total > limit) throw new HttpError(413, 'too_large', `Workbook exceeds the ${limit} byte save limit`)
    chunks.push(buffer)
  }
  const body = Buffer.concat(chunks)
  if (body.length === 0) throw new HttpError(400, 'empty_body', 'Save request carried no workbook bytes')
  return body
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function required(params: URLSearchParams, key: string): string {
  const value = params.get(key)
  if (value === null || value === '') throw new HttpError(400, 'bad_request', `Missing "${key}"`)
  return value
}

/* ------------------------------------------------------------------ *
 * Saving
 * ------------------------------------------------------------------ */

/**
 * Resolve the workspace root of one session, exactly as the harness's own
 * workspace-file service does: the live header's cwd wins, the persisted header
 * is consulted when the session is not live, and the deployment sandbox root is
 * the last resort.
 *
 * @param ctx - the plugin context.
 * @param sessionId - the session the document belongs to.
 * @returns the workspace root, or undefined when nothing can establish one.
 */
async function resolveWorkspaceRoot(ctx: Context, sessionId: string): Promise<string | undefined> {
  const sessions = serviceOf<SessionStoreLike>(ctx, 'sessions')
  const live = sessions?.get(sessionId)?.header
  if (live?.cwd !== undefined && live.cwd !== '') return live.cwd
  if (live === undefined) {
    const persistence = serviceOf<{ stat(id: string): Promise<{ header?: { cwd?: string } } | undefined> }>(ctx, 'sessionPersistence')
    const stored = await persistence?.stat(sessionId).catch(() => undefined)
    const cwd = stored?.header?.cwd
    if (cwd !== undefined && cwd !== '') return cwd
  }
  const sandboxPolicy = serviceOf<SandboxPolicyLike>(ctx, 'sandboxPolicy')
  const root = sandboxPolicy?.workspaceRoot
  return root === undefined || root === '' ? undefined : root
}

/**
 * Write `bytes` over `target` atomically.
 *
 * The harness's own atomic writer takes text, so the binary case is done here in
 * the same shape: an exclusively created random-suffix sibling, then a rename
 * over the target, so a reader never observes a partial workbook.
 *
 * @param targetPath - the canonical absolute path to replace.
 * @param bytes - the complete new file contents.
 */
async function replaceFile(targetPath: string, bytes: Uint8Array): Promise<void> {
  const directory = dirname(targetPath)
  await mkdir(directory, { recursive: true })
  const temporary = join(directory, `.${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.dsh-save`)
  try {
    await writeFile(temporary, bytes, { flag: 'wx' })
    await rename(temporary, targetPath)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}

/**
 * Save one workbook posted by the document panel.
 *
 * Guards, in order: trusted request, complete parameters, a resolvable session
 * workspace, an available filesystem, a target inside that workspace, a body
 * whose hash matches what the caller claimed, and — when the file already exists
 * — a base hash matching the file's current contents.
 *
 * @param req - the POST request carrying raw workbook bytes.
 * @param res - the response.
 * @param ctx - the plugin context.
 * @param config - resolved plugin configuration.
 */
async function handleSave(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: Context,
  config: Config,
): Promise<void> {
  if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Save accepts POST only')
  const trustedHosts = config.trustedHosts ?? []
  if (!isTrustedRequest(req, trustedHosts)) throw new HttpError(403, 'forbidden', 'Untrusted Host header')

  const limit = config.maxSaveBytes ?? DEFAULT_MAX_SAVE_BYTES
  const url = new URL(req.url ?? '/', 'http://localhost')
  const sessionId = required(url.searchParams, 'sessionId')
  const path = required(url.searchParams, 'path')
  const claimedHash = required(url.searchParams, 'body')
  const baseHash = url.searchParams.get('base')

  const fs = serviceOf<FileSystemLike>(ctx, 'fs')
  if (fs === undefined) throw new HttpError(503, 'unavailable', 'The harness filesystem service is unavailable')

  const workspaceRoot = await resolveWorkspaceRoot(ctx, sessionId)
  if (workspaceRoot === undefined) {
    throw new HttpError(503, 'unavailable', `Cannot resolve a workspace root for session "${sessionId}"`)
  }

  const rootTarget = await fs.resolve(workspaceRoot)
  const target = await fs.resolve(path, { cwd: workspaceRoot })
  if (!fs.contains(rootTarget, target)) {
    throw new HttpError(403, 'outside_workspace', `Refusing to write outside the session workspace: ${target.displayPath}`)
  }

  const bytes = await readBody(req, limit)
  const hash = sha256Hex(bytes)
  if (hash !== claimedHash.toLowerCase()) {
    throw new HttpError(400, 'hash_mismatch', 'The uploaded bytes do not match the declared body hash')
  }

  const existing = await fs.stat(target).catch(() => undefined)
  if (existing !== undefined) {
    if (existing.type !== 'file') throw new HttpError(400, 'not_a_file', `${target.displayPath} is not a regular file`)
    if (baseHash === null || baseHash === '') {
      throw new HttpError(409, 'conflict', 'The file already exists but the editor did not state what it opened')
    }
    const current = await fs.readBytes(target, undefined, limit)
    if (sha256Hex(current) !== baseHash.toLowerCase()) {
      throw new HttpError(409, 'conflict', 'The file changed on disk since it was opened; nothing was written')
    }
  } else if (baseHash !== null && baseHash !== '') {
    throw new HttpError(409, 'conflict', 'The editor expected an existing file but none is there')
  }

  await replaceFile(fs.processPath(target), bytes)
  sendJson(res, 200, { ok: true, hash, path: target.displayPath })
}

/* ------------------------------------------------------------------ *
 * Plugin body
 * ------------------------------------------------------------------ */

export function apply(ctx: Context, config: Config = {}): void {
  const webServer = ctx.webServer

  const disposer = webServer.register({
    kind: 'prefix',
    path: '/spreadjs',
    handler: (req: IncomingMessage, res: ServerResponse): void => {
      const pathname = readPathname(req)
      if (pathname === '/spreadjs/api/save') {
        void handleSave(req, res, ctx, config).catch(error => { sendError(res, error) })
        return
      }
      try {
        if (pathname === '/spreadjs/api/health') {
          sendJson(res, 200, { ok: true })
          return
        }
        if (pathname === '/spreadjs/api/config') {
          sendJson(res, 200, {
            licenseKey: config.licenseKey ?? '',
            designerLicenseKey: config.designerLicenseKey ?? '',
          })
          return
        }
        sendJson(res, 404, { error: 'unknown endpoint' })
      } catch (error) {
        sendError(res, error)
      }
    },
  })

  ctx.effect(() => disposer, 'dsh-spreadjs-editor: /spreadjs routes')
}
