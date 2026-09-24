import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { Readable } from 'node:stream'
import { Writable } from 'node:stream'
import { apply, inject, name, type Config } from '../src/index.ts'
import type { Context } from '@deepseek-ai/cordis'

interface MockResponse {
  status: number
  headers: Record<string, string>
  body: string
}

interface Target {
  targetKey: string
  displayPath: string
}

function makeRes(onFinish: () => void): MockResponse & { writeHead: (s: number, h?: object) => void } {
  const chunks: Buffer[] = []
  let status = 200
  let headers: Record<string, string> = {}
  let headersSent = false
  const res = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      cb()
    },
    final(cb) {
      onFinish()
      cb()
    },
  })
  const obj = res as unknown as MockResponse & {
    writeHead: (s: number, h?: object) => void
    headersSent: boolean
    destroy: () => void
  }
  obj.writeHead = (s, h) => {
    status = s
    if (h !== undefined) headers = h as Record<string, string>
    headersSent = true
  }
  Object.defineProperty(obj, 'headersSent', { get: () => headersSent })
  Object.defineProperties(obj, {
    status: { get: () => status },
    headers: { get: () => headers },
    body: { get: () => Buffer.concat(chunks).toString() },
  })
  return obj
}

/** A filesystem double whose targets are plain paths over one real temp root. */
function makeFsService(root: string, existing?: Uint8Array) {
  return {
    resolve: vi.fn(async (path: string, opts?: { cwd?: string }): Promise<Target> => ({
      targetKey: path,
      displayPath: path.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(path) ? path : join(opts?.cwd ?? root, path),
    })),
    processPath: (target: Target): string => target.displayPath,
    contains: (parent: Target, child: Target): boolean =>
      child.displayPath === parent.displayPath || child.displayPath.startsWith(parent.displayPath + sep),
    stat: vi.fn(async () => (existing === undefined ? undefined : { type: 'file', size: existing.length })),
    readBytes: vi.fn(async () => existing ?? new Uint8Array()),
  }
}

interface RequestInit {
  method?: string
  headers?: Record<string, string>
  body?: Uint8Array
}

/** Build a harness-like ctx around a captured /spreadjs handler. */
function harness(config?: Config, services: Record<string, unknown> = {}) {
  let capturedHandler: (req: any, res: any) => void = () => {}
  const disposers: Array<() => void> = []
  const ctx = {
    webServer: {
      register: vi.fn((route: { handler: (req: any, res: any) => void }) => {
        capturedHandler = route.handler
        const d = () => {}
        disposers.push(d)
        return d
      }),
    },
    effect: vi.fn((fn: () => void) => {
      disposers.push(fn)
    }),
    get: (serviceName: string) => services[serviceName],
  } as unknown as Context

  apply(ctx, config)

  async function request(url: string, init: RequestInit = {}): Promise<MockResponse> {
    let finished = false
    const res = makeRes(() => {
      finished = true
    })
    const req = Readable.from(init.body === undefined ? [] : [Buffer.from(init.body)]) as any
    req.url = url
    req.method = init.method ?? 'GET'
    req.headers = init.headers ?? {}
    await capturedHandler(req, res)
    if (!finished) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
    }
    return res as unknown as MockResponse
  }

  return { ctx, request, disposers }
}

const LOOPBACK = { host: '127.0.0.1:3080' }

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('plugin manifest', () => {
  it('exports name and required inject', () => {
    expect(name).toBe('dsh-spreadjs-editor')
    expect(inject).toContain('webServer')
  })

  it('registers the /spreadjs prefix route and an effect disposer', () => {
    const { ctx, disposers } = harness()
    const registerMock = ctx.webServer.register as ReturnType<typeof vi.fn>
    const call = registerMock.mock.calls[0]?.[0]
    expect(call).toMatchObject({ kind: 'prefix', path: '/spreadjs' })
    expect(typeof call.handler).toBe('function')
    expect(ctx.effect).toHaveBeenCalled()
    expect(disposers.length).toBe(2)
    for (const d of disposers) expect(typeof d).toBe('function')
  })
})

describe('api endpoints', () => {
  it('GET /spreadjs/api/health', async () => {
    const { request } = harness()
    const res = await request('/spreadjs/api/health')
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
  })

  it('GET /spreadjs/api/config returns the license key', async () => {
    const { request } = harness({ licenseKey: 'abc123' })
    const res = await request('/spreadjs/api/config')
    expect(JSON.parse(res.body)).toEqual({ licenseKey: 'abc123', designerLicenseKey: '' })
  })

  it('GET /spreadjs/api/config defaults to empty key', async () => {
    const { request } = harness()
    const res = await request('/spreadjs/api/config')
    expect(JSON.parse(res.body)).toEqual({ licenseKey: '', designerLicenseKey: '' })
  })

  it.each([
    { licenseKey: 'SHEETS-KEY', designerLicenseKey: 'DESIGNER-KEY' },
    { designerLicenseKey: 'DESIGNER-ONLY' },
  ])('returns independent keys for %j', async config => {
    const { request } = harness(config)
    const res = await request('/spreadjs/api/config')
    expect(JSON.parse(res.body)).toEqual({ licenseKey: '', ...config })
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  it('unknown endpoints return 404', async () => {
    const { request } = harness()
    const res = await request('/spreadjs/api/nope')
    expect(res.status).toBe(404)
  })
})

describe('POST /spreadjs/api/save', () => {
  async function withRoot<T>(run: (root: string) => Promise<T>): Promise<T> {
    const root = await mkdtemp(join(tmpdir(), 'spreadjs-save-'))
    try {
      return await run(root)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }

  function services(root: string, existing?: Uint8Array): Record<string, unknown> {
    return {
      fs: makeFsService(root, existing),
      sessions: { get: () => ({ header: { cwd: root } }) },
      sandboxPolicy: { workspaceRoot: root },
    }
  }

  function saveUrl(params: Record<string, string>): string {
    return `/spreadjs/api/save?${new URLSearchParams(params).toString()}`
  }

  it('rejects a request whose Host header is not trusted', async () => {
    await withRoot(async root => {
      const { request } = harness(undefined, services(root))
      const res = await request(saveUrl({ sessionId: 's1', path: 'a.xlsx', body: 'x' }), {
        method: 'POST',
        headers: { host: 'evil.example.com' },
        body: new Uint8Array([1]),
      })
      expect(res.status).toBe(403)
      expect(JSON.parse(res.body).error.code).toBe('forbidden')
    })
  })

  it('accepts a configured trusted host', async () => {
    await withRoot(async root => {
      const { request } = harness({ trustedHosts: ['dsh.internal:3080'] }, services(root))
      const body = new Uint8Array([1, 2, 3])
      const res = await request(saveUrl({ sessionId: 's1', path: 'a.xlsx', body: sha256(body) }), {
        method: 'POST',
        headers: { host: 'dsh.internal:3080' },
        body,
      })
      expect(res.status).toBe(200)
    })
  })

  it('refuses a non-POST method', async () => {
    await withRoot(async root => {
      const { request } = harness(undefined, services(root))
      const res = await request(saveUrl({ sessionId: 's1', path: 'a.xlsx', body: 'x' }), { headers: LOOPBACK })
      expect(res.status).toBe(405)
    })
  })

  it('refuses a request missing required parameters', async () => {
    await withRoot(async root => {
      const { request } = harness(undefined, services(root))
      const res = await request('/spreadjs/api/save?sessionId=s1', {
        method: 'POST',
        headers: LOOPBACK,
        body: new Uint8Array([1]),
      })
      expect(res.status).toBe(400)
      expect(JSON.parse(res.body).error.code).toBe('bad_request')
    })
  })

  it('fails closed when the filesystem service is absent', async () => {
    const { request } = harness(undefined, {})
    const res = await request(saveUrl({ sessionId: 's1', path: 'a.xlsx', body: 'x' }), {
      method: 'POST',
      headers: LOOPBACK,
      body: new Uint8Array([1]),
    })
    expect(res.status).toBe(503)
    expect(JSON.parse(res.body).error.code).toBe('unavailable')
  })

  it('fails closed when no workspace root can be resolved', async () => {
    await withRoot(async root => {
      const fs = makeFsService(root)
      const { request } = harness(undefined, { fs, sessions: { get: () => undefined } })
      const res = await request(saveUrl({ sessionId: 's1', path: 'a.xlsx', body: 'x' }), {
        method: 'POST',
        headers: LOOPBACK,
        body: new Uint8Array([1]),
      })
      expect(res.status).toBe(503)
    })
  })

  it('refuses a target outside the session workspace', async () => {
    await withRoot(async root => {
      const { request } = harness(undefined, services(root))
      const outside = join(root, '..', 'elsewhere.xlsx')
      const body = new Uint8Array([1, 2, 3])
      const res = await request(saveUrl({ sessionId: 's1', path: outside, body: sha256(body) }), {
        method: 'POST',
        headers: LOOPBACK,
        body,
      })
      expect(res.status).toBe(403)
      expect(JSON.parse(res.body).error.code).toBe('outside_workspace')
    })
  })

  it('refuses bytes that do not match the declared body hash', async () => {
    await withRoot(async root => {
      const { request } = harness(undefined, services(root))
      const res = await request(saveUrl({ sessionId: 's1', path: 'a.xlsx', body: sha256(new Uint8Array([9])) }), {
        method: 'POST',
        headers: LOOPBACK,
        body: new Uint8Array([1, 2, 3]),
      })
      expect(res.status).toBe(400)
      expect(JSON.parse(res.body).error.code).toBe('hash_mismatch')
    })
  })

  it('creates a new workbook inside the workspace', async () => {
    await withRoot(async root => {
      const { request } = harness(undefined, services(root))
      const body = new Uint8Array([80, 75, 3, 4, 7])
      const res = await request(saveUrl({ sessionId: 's1', path: 'nested/new.xlsx', body: sha256(body) }), {
        method: 'POST',
        headers: LOOPBACK,
        body,
      })
      expect(res.status).toBe(200)
      expect(JSON.parse(res.body)).toMatchObject({ ok: true, hash: sha256(body) })
      expect(new Uint8Array(await readFile(join(root, 'nested', 'new.xlsx')))).toEqual(body)
    })
  })

  it('replaces an unchanged file when the base hash matches', async () => {
    await withRoot(async root => {
      const original = new Uint8Array([1, 1, 1])
      const { request } = harness(undefined, services(root, original))
      const body = new Uint8Array([2, 2, 2])
      const res = await request(
        saveUrl({ sessionId: 's1', path: 'book.xlsx', body: sha256(body), base: sha256(original) }),
        { method: 'POST', headers: LOOPBACK, body },
      )
      expect(res.status).toBe(200)
      expect(new Uint8Array(await readFile(join(root, 'book.xlsx')))).toEqual(body)
    })
  })

  it('refuses to clobber a file that changed since it was opened', async () => {
    await withRoot(async root => {
      const current = new Uint8Array([7, 7, 7])
      const { request } = harness(undefined, services(root, current))
      const body = new Uint8Array([2, 2, 2])
      const res = await request(
        saveUrl({ sessionId: 's1', path: 'book.xlsx', body: sha256(body), base: sha256(new Uint8Array([1, 1, 1])) }),
        { method: 'POST', headers: LOOPBACK, body },
      )
      expect(res.status).toBe(409)
      expect(JSON.parse(res.body).error.code).toBe('conflict')
      // The guard refused before writing: the target was never created on disk.
      await expect(readFile(join(root, 'book.xlsx'))).rejects.toThrow()
    })
  })
})
