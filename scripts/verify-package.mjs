import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, readFileSync, realpathSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
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
    'package/CHANGELOG.md',
    'package/docs/bridge-contract.md',
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
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) {
    assert.equal(manifest.scripts?.[hook], undefined, `package must not use install-time hook ${hook}`)
  }
  assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0)
  assert.equal(manifest.peerDependencies?.['@grapecity-software/dsh-spreadjs-driver'], undefined,
    'editor must remain independently installable without a driver')

  // Give the consumer the bare specifiers the node half actually imports, the
  // way a profile gives them to a plugin installed into it.
  //
  // They are peers, not dependencies: DSH carries them at the profile root,
  // beside every plugin (`~/.dsh/profiles/node_modules/@deepseek-ai/…`), which
  // is what a bare import from here resolves against. `--omit=dev
  // --legacy-peer-deps` deliberately installs none of them, so without this
  // step the import below would exercise a layout no real install has, and
  // would fail for a reason that has nothing to do with this package.
  //
  // The specifiers are READ OFF the built artifact rather than copied from
  // `peerDependencies`: the question under test is what this file needs at
  // runtime, and a peer the bundle inlined — or never imported — is not part of
  // the answer.
  //
  // Each one's whole SCOPE is linked, not the package on its own, because a peer
  // has dependencies of its own (schemastery pulls cosmokit) and a package-by-
  // package copy lands a tree that resolves half way. The plugin installs under
  // a different scope, so nothing linked here can shadow it.
  const repository = fileURLToPath(new URL('..', import.meta.url))
  const nodeHalfSource = readFileSync(join(installed, 'lib/index.js'), 'utf8')
  const scopes = new Set(
    [...nodeHalfSource.matchAll(/\bfrom\s*"([^"]+)"/gu)]
      .map(match => match[1])
      .filter(specifier => !specifier.startsWith('.') && !specifier.startsWith('node:'))
      // `@scope/pkg/…` and bare `pkg` both reduce to the directory to link.
      .map(specifier => specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier),
  )
  for (const specifier of scopes) {
    const from = join(repository, 'node_modules', ...specifier.split('/'))
    if (!existsSync(from)) continue
    const to = join(consumer, 'node_modules', ...specifier.split('/'))
    if (existsSync(to)) continue
    mkdirSync(dirname(to), { recursive: true })
    symlinkSync(from, to, 'junction')
  }

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
  // The stub carries the two cordis members `apply` reaches for beyond the
  // route table: `inject`, which runs its callback against the same (empty)
  // service bag, so the settings branch is taken and finds no service — the
  // state a profile with no settings surface has — and `fiber`, the identity a
  // settings policy would be filed against.
  host.apply({
    webServer: { register(value) { route = value; return () => {} } },
    effect() {},
    fiber: { id: 'verify' },
    get() { return undefined },
    inject(_deps, callback) {
      callback({ effect() {}, get() { return undefined } })
      return { dispose() {} }
    },
  }, { licenseKey: 'TEST-SHEETS', designerLicenseKey: 'TEST-DESIGNER' })
  let body
  route.handler({ url: '/spreadjs/api/config' }, { writeHead() {}, end(value) { body = value } })
  assert.deepEqual(JSON.parse(body), { licenseKey: 'TEST-SHEETS', designerLicenseKey: 'TEST-DESIGNER' })
  console.log(`package verified: ${result.name}@${result.version}`)
  console.log('Fresh offline tarball install, client registration, and independent license config passed.')
} finally {
  rmSync(destination, { recursive: true, force: true })
  rmSync(cache, { recursive: true, force: true })
}
