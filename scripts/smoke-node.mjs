// Smoke test for the BUILT node half (lib/index.js): load it exactly as the
// harness loader would and drive the /spreadjs config/health handler with mock
// req/res.
import { Writable } from 'node:stream'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../lib/index.js')

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
}

pkg.apply(ctx, { licenseKey: 'SMOKE-KEY' })
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

async function req(url) {
  const r = makeRes()
  await handler({ url }, r.res)
  await r.finish
  return r.state
}

// --- drive the endpoints ---------------------------------------------------
let r = await req('/spreadjs/api/health')
check('health -> 200', r.status === 200, `got ${r.status}`)
check('health body', r.body === JSON.stringify({ ok: true }), r.body)

r = await req('/spreadjs/api/config')
check('config -> licenseKey', JSON.parse(r.body).licenseKey === 'SMOKE-KEY', r.body)

r = await req('/spreadjs/api/unknown')
check('unknown -> 404', r.status === 404, `got ${r.status}`)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
