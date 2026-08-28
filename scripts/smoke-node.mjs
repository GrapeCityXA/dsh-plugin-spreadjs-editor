// Smoke test for the BUILT node half (lib/index.js): load it exactly as the
// harness loader would, drive the /spreadjs handler with mock req/res, and
// verify the five endpoints + path containment against real temp files.
import { Writable } from 'node:stream'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
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

const root = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-smoke-'))
mkdirSync(join(root, 'nested'))
writeFileSync(join(root, 'top.csv'), 'a,b\n1,2\n')
writeFileSync(join(root, 'nested', 'deep.xlsx'), Buffer.from('xlsx-bytes'))
writeFileSync(join(root, 'ignore.txt'), 'no')

pkg.apply(ctx, { defaultRoot: root, licenseKey: 'SMOKE-KEY' })
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

r = await req('/spreadjs/api/roots')
check('roots -> defaultRoot', JSON.parse(r.body).cwd === resolve(root), r.body)

r = await req('/spreadjs/api/config')
check('config -> licenseKey', JSON.parse(r.body).licenseKey === 'SMOKE-KEY', r.body)

r = await req(`/spreadjs/api/list?root=${encodeURIComponent(root)}`)
const list = JSON.parse(r.body)
check('list -> count 2', list.count === 2, `got ${list.count}: ${r.body}`)
check(
  'list -> names',
  list.files.map(f => f.name).sort().join(',') === 'deep.xlsx,top.csv',
  JSON.stringify(list.files),
)

r = await req(`/spreadjs/api/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent('nested/deep.xlsx')}`)
check('file nested -> 200 xlsx mime', r.status === 200 && r.headers['Content-Type'].includes('spreadsheetml.sheet'), `${r.status} ${r.headers['Content-Type']}`)
check('file nested -> bytes', r.body === 'xlsx-bytes', r.body)

r = await req(`/spreadjs/api/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent('top.csv')}`)
check('file csv -> 200', r.status === 200 && r.body === 'a,b\n1,2\n', `${r.status} ${r.body}`)

r = await req(`/spreadjs/api/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent('../escape.xlsx')}`)
check('traversal -> 403', r.status === 403, `got ${r.status}`)

r = await req(`/spreadjs/api/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent('missing.xlsx')}`)
check('missing -> 404', r.status === 404, `got ${r.status}`)

r = await req('/spreadjs/api/unknown')
check('unknown -> 404', r.status === 404, `got ${r.status}`)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
