import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import assert from 'node:assert/strict'

const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Run this check with npm run verify:package')
const destination = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-package-'))
const cache = mkdtempSync(join(tmpdir(), 'dsh-spreadjs-npm-cache-'))

try {
  const output = execFileSync(process.execPath, [
    npmCli,
    'pack', '--ignore-scripts', '--json', '--pack-destination', destination, '--cache', cache,
  ], { encoding: 'utf8' })
  const result = JSON.parse(output)[0]
  const files = new Set(result.files.map(file => `package/${file.path}`))
  const required = [
    'package/lib/client.js',
    'package/lib/index.js',
    'package/cordis.patch.yml',
    'package/package.json',
  ]
  const missing = required.filter(file => !files.has(file))
  if (missing.length > 0) {
    throw new Error(`package is missing required files: ${missing.join(', ')}`)
  }
  if (!result.name || !result.version) {
    throw new Error('npm pack did not return package identity')
  }
  assert(!result.files.some(file => file.path.endsWith('.map') || file.path.startsWith('src/')),
    'prebuilt package must exclude source maps and sources')
  assert(result.files.some(file => file.path.startsWith('lib/licenses/')), 'vendor notices must be included')

  const consumer = join(destination, 'consumer')
  execFileSync(process.execPath, [npmCli, 'install', join(destination, result.filename),
    '--prefix', consumer, '--omit=dev', '--legacy-peer-deps', '--offline', '--no-audit', '--no-fund',
    '--cache', cache,
  ], { encoding: 'utf8' })
  const installed = join(consumer, 'node_modules', ...result.name.split('/'))
  assert(realpathSync(installed).startsWith(realpathSync(consumer)), 'must install a copy, not a source link')
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
  assert.equal(manifest.version, result.version)
  assert.equal(manifest.scripts?.postinstall, undefined)
  assert.equal(manifest.scripts?.install, undefined)
  assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0)

  // Execute the installed wrapper without invoking its DOM-dependent factory.
  const entries = []
  runInNewContext(readFileSync(join(installed, 'lib/client.js'), 'utf8'), {
    window: { __ModuleLoader__: { load: entry => entries.push(entry) } },
  }, { timeout: 10000 })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].id, manifest.name)
  assert.equal(typeof entries[0].factory, 'function')

  const host = await import(pathToFileURL(join(installed, 'lib/index.js')).href)
  let route
  host.apply({ webServer: { register(value) { route = value; return () => {} } }, effect() {} },
    { licenseKey: 'TEST-SHEETS', designerLicenseKey: 'TEST-DESIGNER' })
  let body
  route.handler({ url: '/spreadjs/api/config' }, { writeHead() {}, end(value) { body = value } })
  assert.deepEqual(JSON.parse(body), { licenseKey: 'TEST-SHEETS', designerLicenseKey: 'TEST-DESIGNER' })
  console.log(`package verified: ${result.name}@${result.version}`)
  console.log('Fresh offline tarball install, client registration, and independent license config passed.')
} finally {
  rmSync(destination, { recursive: true, force: true })
  rmSync(cache, { recursive: true, force: true })
}
