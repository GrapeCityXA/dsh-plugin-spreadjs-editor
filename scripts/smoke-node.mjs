// Smoke test for the BUILT node half (lib/index.js): load it exactly as the
// harness loader would and drive the /spreadjs handler with mock req/res.
//
// This release reaches for node:fs/promises and node:crypto from the bundled
// code for the first time (the binary save), so the save path is exercised
// against a real temporary directory rather than a stub: whatever the bundler
// did to those imports, a wrong result shows up as a missing file.
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { Readable, Writable } from 'node:stream'
import * as pkg from '../lib/index.js'

let pass = 0
let fail = 0
function check(label, cond, detail = '') {
  if (cond) {
    pass++
    console.log(`  ok  ${label}`)
  } else {
    fail++
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// --- capture the handler like the harness would ---------------------------
let handler
const disposers = []
/** Service bag behind `ctx.get`; the save cases fill it in as they need it. */
let services = {}
const ctx = {
  webServer: {
    register(route) {
      handler = route.handler
      const d = () => {}
      disposers.push(d)
      return d
    },
  },
  effect(fn) {
    disposers.push(fn)
  },
  get: name => services[name],
}

pkg.apply(ctx, { licenseKey: 'SMOKE-KEY', designerLicenseKey: 'DESIGNER-SMOKE-KEY' })
check('registers /spreadjs route', handler !== undefined)
check('registers effect disposers', disposers.length === 2)

function makeRes() {
  const chunks = []
  const state = { status: 200, headers: {}, headersSent: false, body: '' }
  const res = new Writable({
    write(chunk, _e, cb) {
      chunks.push(Buffer.from(chunk))
      cb()
    },
  })
  res.writeHead = (s, h) => {
    state.status = s
    if (h) state.headers = h
    state.headersSent = true
  }
  Object.defineProperty(res, 'headersSent', { get: () => state.headersSent })
  res.destroy = () => {}
  return {
    res,
    finish: new Promise(r => res.on('finish', r)),
    get state() {
      state.body = Buffer.concat(chunks).toString()
      return state
    },
  }
}

async function req(url, init = {}) {
  const r = makeRes()
  const request = Readable.from(init.body === undefined ? [] : [Buffer.from(init.body)])
  request.url = url
  request.method = init.method ?? 'GET'
  request.headers = init.host === undefined ? {} : { host: init.host }
  await handler(request, r.res)
  await r.finish
  return r.state
}

// --- drive the endpoints ---------------------------------------------------
let r = await req('/spreadjs/api/health')
check('health -> 200', r.status === 200, `got ${r.status}`)
const health = JSON.parse(r.body)
check('health -> ok', health.ok === true, r.body)
check('health -> reports the version of this build', health.plugin?.version === pkg.PLUGIN_VERSION, r.body)
// The built artifact must carry a substituted version: `unknown` here means the
// bundler dropped the `define`, and a probe could no longer tell which SpreadJS
// a running process is serving.
check('health -> reports the inlined SpreadJS version', pkg.SPREADJS_VERSION !== 'unknown', String(pkg.SPREADJS_VERSION))
check('health -> agrees with the manifest', health.spreadjs === pkg.SPREADJS_VERSION, r.body)

r = await req('/spreadjs/api/config')
check('config -> licenseKey', JSON.parse(r.body).licenseKey === 'SMOKE-KEY', r.body)
check('config -> designerLicenseKey', JSON.parse(r.body).designerLicenseKey === 'DESIGNER-SMOKE-KEY', r.body)

r = await req('/spreadjs/api/unknown')
check('unknown -> 404', r.status === 404, `got ${r.status}`)

// --- binary save over the BUILT artifact -----------------------------------
const root = await mkdtemp(join(tmpdir(), 'spreadjs-smoke-'))
const HOST = '127.0.0.1:3080'
const save = (query, init) => req(`/spreadjs/api/save?${query}`, init)
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

try {
  const body = new Uint8Array([80, 75, 3, 4, 7])
  const query = `sessionId=s1&path=nested%2Fsheet.xlsx&body=${digest(body)}`

  r = await save(query, { method: 'POST', host: HOST, body })
  check('save without services -> 503', r.status === 503, `got ${r.status}`)
  check('save fails closed with an error code', JSON.parse(r.body).error.code === 'unavailable', r.body)

  r = await save(query, { method: 'POST', host: 'evil.example.com', body })
  check('save from an untrusted host -> 403', r.status === 403, `got ${r.status}`)

  const existing = new Uint8Array([1, 1, 1])
  services = {
    fs: {
      resolve: async (path, opts) => ({
        targetKey: path,
        displayPath: /^[A-Za-z]:[\\/]|^\//u.test(path) ? path : join(opts?.cwd ?? root, path),
      }),
      processPath: target => target.displayPath,
      contains: (parent, child) =>
        child.displayPath === parent.displayPath || child.displayPath.startsWith(parent.displayPath + sep),
      stat: async () => (services.existing === undefined ? undefined : { type: 'file', size: services.existing.length }),
      readBytes: async () => services.existing ?? new Uint8Array(),
    },
    sessions: { get: () => ({ header: { cwd: root } }) },
    sandboxPolicy: { workspaceRoot: root },
    existing: undefined,
  }

  r = await save(query, { method: 'POST', host: HOST, body })
  check('save -> 200', r.status === 200, `got ${r.status} ${r.body}`)
  check('save reports the stored hash', JSON.parse(r.body).hash === digest(body), r.body)
  const written = new Uint8Array(await readFile(join(root, 'nested', 'sheet.xlsx')))
  check('save wrote the bytes to disk', written.length === body.length && written.every((b, i) => b === body[i]), String(written))

  services.existing = existing
  r = await save(`${query}&base=${digest(new Uint8Array([9, 9, 9]))}`, { method: 'POST', host: HOST, body })
  check('stale base hash -> 409', r.status === 409, `got ${r.status}`)
  check('conflict reports a code', JSON.parse(r.body).error.code === 'conflict', r.body)

  r = await save(`${query}&base=${digest(existing)}`, { method: 'POST', host: HOST, body })
  check('matching base hash -> 200', r.status === 200, `got ${r.status} ${r.body}`)

  r = await save(`sessionId=s1&path=..%2Fescape.xlsx&body=${digest(body)}`, { method: 'POST', host: HOST, body })
  check('workspace escape -> 403', r.status === 403, `got ${r.status}`)
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
