import { describe, expect, it, vi } from 'vitest'
import { Readable, Writable } from 'node:stream'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, inject, name } from '../src/index.ts'
import type { Context } from '@deepseek-ai/cordis'

interface MockResponse {
  status: number
  headers: Record<string, string>
  body: string
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

/** Build a harness-like ctx around a captured /spreadjs handler. */
function harness(config?: Record<string, string>) {
  let capturedHandler: (req: any, res: any) => Promise<void> | void = () => {}
  const disposers: Array<() => void> = []
  const ctx = {
    webServer: {
      register: vi.fn((route: { handler: (req: any, res: any) => Promise<void> | void }) => {
        capturedHandler = route.handler
        const d = () => {}
        disposers.push(d)
        return d
      }),
    },
    effect: vi.fn((fn: () => void) => {
      disposers.push(fn)
    }),
  } as unknown as Context

  apply(ctx, config)

  async function request(url: string, options?: { method?: string; body?: string }): Promise<MockResponse> {
    let finished = false
    const res = makeRes(() => {
      finished = true
    })
    const req = options === undefined
      ? { url, method: 'GET' } as any
      : Object.assign(Readable.from([options.body ?? '']), { url, method: options.method ?? 'GET' })
    await capturedHandler(req, res)
    if (!finished) {
      await new Promise<void>((resolve) => setTimeout(resolve, 20))
    }
    return res as unknown as MockResponse
  }

  return { ctx, request, disposers }
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

  it('GET /spreadjs/api/roots returns the configured default root', async () => {
    const { request } = harness({ defaultRoot: process.cwd() })
    const res = await request('/spreadjs/api/roots')
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ cwd: process.cwd() })
  })

  it('GET /spreadjs/api/config returns the license key', async () => {
    const { request } = harness({ licenseKey: 'abc123' })
    const res = await request('/spreadjs/api/config')
    expect(JSON.parse(res.body)).toEqual({ licenseKey: 'abc123' })
  })

  it('GET /spreadjs/api/config defaults to empty key', async () => {
    const { request } = harness()
    const res = await request('/spreadjs/api/config')
    expect(JSON.parse(res.body)).toEqual({ licenseKey: '' })
  })

  it('GET /spreadjs/api/list enumerates spreadsheet files under the root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-list-'))
    writeFileSync(join(root, 'a.xlsx'), 'x')
    writeFileSync(join(root, 'b.csv'), 'y')
    const { request } = harness({ defaultRoot: root })
    const res = await request(`/spreadjs/api/list?root=${encodeURIComponent(root)}`)
    expect(res.status).toBe(200)
    const json = JSON.parse(res.body)
    expect(json.count).toBe(2)
    expect(json.files.map((f: { name: string }) => f.name).sort()).toEqual(['a.xlsx', 'b.csv'])
  })

  it('GET /spreadjs/api/list with no root falls back to defaultRoot', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-list2-'))
    writeFileSync(join(root, 'only.csv'), 'x')
    const { request } = harness({ defaultRoot: root })
    const res = await request('/spreadjs/api/list')
    expect(JSON.parse(res.body).root).toBe(root)
  })

  it('GET /spreadjs/api/list with a missing root returns 500', async () => {
    const { request } = harness({ defaultRoot: join(tmpdir(), 'dsh-spreadjs-missing-xyz') })
    const res = await request('/spreadjs/api/list')
    expect(res.status).toBe(500)
  })

  it('GET /spreadjs/api/file streams a file with the right content type', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-file-'))
    writeFileSync(join(root, 'data.csv'), 'a,b\n1,2\n')
    const { request } = harness({ defaultRoot: root })
    const res = await request(
      `/spreadjs/api/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent('data.csv')}`,
    )
    expect(res.status).toBe(200)
    expect(res.headers['Content-Type'] ?? '').toContain('text/csv')
    expect(res.body).toBe('a,b\n1,2\n')
  })

  it('GET /spreadjs/api/file with a traversal path is rejected with 403', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-safe-'))
    const { request } = harness({ defaultRoot: root })
    const res = await request(
      `/spreadjs/api/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent('../outside.xlsx')}`,
    )
    expect(res.status).toBe(403)
  })

  it('GET /spreadjs/api/file without a path returns 400', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-safe2-'))
    const { request } = harness({ defaultRoot: root })
    const res = await request(`/spreadjs/api/file?root=${encodeURIComponent(root)}`)
    expect(res.status).toBe(400)
  })

  it('GET /spreadjs/api/file for a missing file returns 404', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-safe3-'))
    const { request } = harness({ defaultRoot: root })
    const res = await request(
      `/spreadjs/api/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent('nope.xlsx')}`,
    )
    expect(res.status).toBe(404)
  })

  it('PUT /spreadjs/api/file writes bytes back inside the root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-save-'))
    const target = join(root, 'data.xlsx')
    writeFileSync(target, 'old')
    const { request } = harness({ defaultRoot: root })
    const res = await request(
      `/spreadjs/api/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent('data.xlsx')}`,
      { method: 'PUT', body: 'new-content' },
    )
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ ok: true, path: 'data.xlsx', size: 'new-content'.length })
    expect(readFileSync(target, 'utf8')).toBe('new-content')
  })

  it('PUT /spreadjs/api/file with a traversal path is rejected with 403', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-save-safe-'))
    const { request } = harness({ defaultRoot: root })
    const res = await request(
      `/spreadjs/api/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent('../outside.xlsx')}`,
      { method: 'PUT', body: 'x' },
    )
    expect(res.status).toBe(403)
  })

  it('unknown endpoints return 404', async () => {
    const { request } = harness()
    const res = await request('/spreadjs/api/nope')
    expect(res.status).toBe(404)
  })
})
