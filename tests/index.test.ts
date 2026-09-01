import { describe, expect, it, vi } from 'vitest'
import { Writable } from 'node:stream'
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
  } as unknown as Context

  apply(ctx, config)

  async function request(url: string): Promise<MockResponse> {
    let finished = false
    const res = makeRes(() => {
      finished = true
    })
    await capturedHandler({ url, method: 'GET' } as any, res)
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

  it('unknown endpoints return 404', async () => {
    const { request } = harness()
    const res = await request('/spreadjs/api/nope')
    expect(res.status).toBe(404)
  })
})
