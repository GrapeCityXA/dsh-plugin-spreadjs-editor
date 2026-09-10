import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
  console.log(`package verified: ${result.name}@${result.version}`)
  console.log(`client entry included: ${files.has('package/lib/client.js')}`)
} finally {
  rmSync(destination, { recursive: true, force: true })
  rmSync(cache, { recursive: true, force: true })
}
