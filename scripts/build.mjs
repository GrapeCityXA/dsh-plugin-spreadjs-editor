/**
 * Build entry. tsdown 0.22 uses `Promise.withResolvers` (ES2024), which is
 * missing on Node 20; polyfill it here, then run the real tsdown CLI.
 */
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve
    let reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

// Resolve tsdown by package location so pnpm's isolated store layout works:
// the dependency may live in a parent node_modules layer, and tsdown does not
// export its dist/run.mjs entry through package exports.
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const tsdownPackage = require.resolve('tsdown/package.json')

// tsdown's default TS config loader hits a known Node.js bug when the config
// lives under node_modules. unrun handles that path on Node 20-24.
process.argv.push('--config-loader', 'unrun')

await import(pathToFileURL(join(dirname(tsdownPackage), 'dist/run.mjs')).href)
