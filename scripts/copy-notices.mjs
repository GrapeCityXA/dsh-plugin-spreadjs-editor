import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
for (const name of Object.keys(manifest.devDependencies)) {
  if (!name.startsWith('@grapecity-software/')) continue
  const root = dirname(require.resolve(`${name}/package.json`))
  for (const file of readdirSync(root, { withFileTypes: true })) {
    if (!file.isFile() || !(/license|notice|eula/i.test(file.name) || file.name.endsWith('.pdf'))) continue
    const target = new URL(`../lib/licenses/${name.split('/')[1]}/`, import.meta.url)
    mkdirSync(target, { recursive: true })
    copyFileSync(join(root, file.name), new URL(file.name, target))
  }
}
