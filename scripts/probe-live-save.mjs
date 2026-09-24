// Runtime probe against a RUNNING DeepSeek Harness: drives the save endpoint
// over HTTP and verifies the bytes on disk.
//
// Why this exists: the unit tests drive the save handler with a filesystem
// double, so they cannot prove that the real `ctx.fs` service answers the exact
// calls this plugin makes (resolve → contains → stat → readBytes → atomic
// write). This probe is the check that does, and it needs no browser.
//
// Usage:
//   node scripts/probe-live-save.mjs [--url http://127.0.0.1:3080] [--session <id>] [--home <dir>]
//
// The probe creates one uniquely named file inside the session workspace, then
// deletes it. Nothing else is touched.
import { createHash } from 'node:crypto'
import { readdir, readFile, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

function argOf(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 || process.argv[index + 1] === undefined ? fallback : process.argv[index + 1]
}

const baseUrl = argOf('url', 'http://127.0.0.1:3080').replace(/\/+$/u, '')
const forcedSession = argOf('session', undefined)
const dshHome = argOf('home', process.env.DSH_HOME ?? join(homedir(), '.dsh'))

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
function note(message) {
  console.log(`  --  ${message}`)
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

/** Every session id DSH keeps on disk, newest first, in both id spellings. */
async function candidateSessions() {
  const sessionsRoot = join(dshHome, 'sessions')
  const slugs = await readdir(sessionsRoot, { withFileTypes: true }).catch(() => [])
  const found = []
  for (const slug of slugs) {
    if (!slug.isDirectory()) continue
    const entries = await readdir(join(sessionsRoot, slug.name), { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('session-')) continue
      const info = await stat(join(sessionsRoot, slug.name, entry.name)).catch(() => undefined)
      found.push({ dir: entry.name, uuid: entry.name.slice('session-'.length), mtime: info?.mtimeMs ?? 0 })
    }
  }
  found.sort((left, right) => right.mtime - left.mtime)
  return found
}

async function postSave(sessionId, relativePath, body, base) {
  const query = new URLSearchParams({ sessionId, path: relativePath, body: sha256(body) })
  if (base !== undefined) query.set('base', base)
  const response = await fetch(`${baseUrl}/spreadjs/api/save?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body,
  })
  const text = await response.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { raw: text.slice(0, 200) }
  }
  return { status: response.status, body: parsed }
}

/** Same bytes, read back from the resolved path the server reported. */
async function readBack(path, body) {
  const written = await readFile(path).catch(() => undefined)
  return written !== undefined && Buffer.compare(written, Buffer.from(body)) === 0
}

console.log(`probing ${baseUrl} (DSH home: ${dshHome})\n`)

const health = await fetch(`${baseUrl}/spreadjs/api/health`).then(r => r.status).catch(error => error.message)
check('the plugin host half answers', health === 200, String(health))

const probeName = `.dsh-save-probe-${process.pid}-${Date.now()}.bin`
const payloadA = new Uint8Array(64).map((_, index) => (index * 7 + 3) % 251)
const payloadB = new Uint8Array(96).map((_, index) => (index * 13 + 5) % 241)

const candidates = forcedSession === undefined
  ? (await candidateSessions()).flatMap(entry => [entry.dir, entry.uuid])
  : [forcedSession]
if (candidates.length === 0) note(`no session directories under ${join(dshHome, 'sessions')}`)
else note(`trying ${candidates.length} session id candidate(s), newest first`)

let sessionId
let resolvedPath
let firstAttempt
for (const candidate of candidates.slice(0, 12)) {
  const attempt = await postSave(candidate, probeName, payloadA)
  firstAttempt ??= attempt
  if (attempt.status === 200) {
    sessionId = candidate
    resolvedPath = attempt.body.path
    break
  }
  if (attempt.status === 404) break // the route itself is missing: no candidate will help
}

if (sessionId === undefined) {
  const status = firstAttempt?.status ?? 'no request'
  const failure = firstAttempt?.body?.error
  const code = (typeof failure === 'object' && failure !== null ? failure.code : undefined)
    ?? (typeof failure === 'string' ? failure : '')
    ?? ''
  check('the save route exists', status !== 404, `HTTP ${status} ${code}`.trim())
  if (status === 404) {
    note('the running host half predates the save endpoint — restart DSH, then run this again')
  } else if (status === 503) {
    note('the route exists but a harness service it needs is unavailable; the code above names which')
  } else if (status === 403) {
    note('refused by the trust fence: call this probe with the same host you use in the browser')
  }
} else {
  check('the save route exists', true)
  check('the real ctx.fs accepted the write', resolvedPath !== undefined, String(resolvedPath))
  check('the bytes reached the disk', resolvedPath !== undefined && (await readBack(resolvedPath, payloadA)))
  note(`wrote ${resolvedPath} (session ${sessionId})`)

  // A base hash that is definitely not the real one, whichever hex digit it starts with.
  const realHash = sha256(payloadA)
  const wrongHash = `${realHash.startsWith('0') ? '1' : '0'}${realHash.slice(1)}`
  const conflict = await postSave(sessionId, probeName, payloadB, wrongHash)
  check('a stale base hash is refused', conflict.status === 409, `HTTP ${conflict.status}`)
  check('the refusal names the conflict', conflict.body?.error?.code === 'conflict', JSON.stringify(conflict.body))
  check('the refused write changed nothing', resolvedPath !== undefined && (await readBack(resolvedPath, payloadA)))

  const replace = await postSave(sessionId, probeName, payloadB, sha256(payloadA))
  check('a matching base hash replaces the file', replace.status === 200, `HTTP ${replace.status}`)
  check('the replacement is on disk', resolvedPath !== undefined && (await readBack(resolvedPath, payloadB)))

  const escape = await postSave(sessionId, `../${probeName}`, payloadA)
  check('a workspace escape is refused', escape.status === 403, `HTTP ${escape.status}`)
}

if (resolvedPath !== undefined) await rm(resolvedPath, { force: true })

console.log(`\n${pass} passed, ${fail} failed`)
// Exit code only: calling process.exit() here tears the process down while
// undici's keep-alive sockets are still closing, which trips a libuv assertion
// on Windows.
process.exitCode = fail === 0 ? 0 : 1
