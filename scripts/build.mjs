/** Build with the project's installed tsdown and config loader. */
// Resolve tsdown by package location so pnpm's isolated store layout works:
// the dependency may live in a parent node_modules layer, and tsdown does not
// export its dist/run.mjs entry through package exports.
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const tsdownPackage = require.resolve('tsdown/package.json')

// tsdown's default TS config loader hits a known Node.js bug when the config
// lives under node_modules. Keep unrun for that layout.
process.argv.push('--config-loader', 'unrun')

await import(pathToFileURL(join(dirname(tsdownPackage), 'dist/run.mjs')).href)
