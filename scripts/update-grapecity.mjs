import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url))
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

let version = process.argv[2]
if (version === '--latest') {
  const res = await fetch(
    'https://registry.npmjs.org/@grapecity-software/spread-sheets/latest',
  )
  if (!res.ok) throw new Error(`npm registry returned ${res.status}`)
  version = (await res.json()).version
}

if (!version) {
  console.error('Usage: node scripts/update-grapecity.mjs <version> | --latest')
  process.exit(1)
}

let changed = 0
for (const [name, spec] of Object.entries(pkg.dependencies ?? {})) {
  if (name.startsWith('@grapecity-software/') && spec !== version) {
    pkg.dependencies[name] = version
    changed += 1
  }
}

if (changed === 0) {
  console.log(`GrapeCity dependencies already at ${version}`)
} else {
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(`Updated ${changed} GrapeCity dependencies to ${version}`)
}
