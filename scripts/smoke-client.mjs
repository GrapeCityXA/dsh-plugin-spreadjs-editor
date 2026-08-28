// Structural smoke check for the BUILT browser half (lib/client.js).
//
// A full runtime load (factory → apply → slot registration) requires a real
// browser: SpreadJS touches DOM + canvas at module init, which jsdom cannot
// satisfy without the native `canvas` package. That end-to-end load is left to
// the harness browser (see README "Verification"). What we CAN assert here
// without a browser is every structural contract of the artifact:
//   - the __ModuleLoader__.load closure factory wrapper with the plugin id
//   - the module-table externals stay require()'d (not inlined)
//   - SpreadJS + its stylesheets are inlined (no @grapecity require remains)
//   - the injected style strings are embedded
import { readFileSync } from 'node:fs'

const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

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

const EXTERNALS = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-store',
]

check('loader wrapper opens with plugin id', /window\.__ModuleLoader__\.load\(\{\s*id: "dsh-spreadjs-editor"/.test(code))
check('loader factory signature', /factory: \(require\) =>/.test(code))
check('closure return (module.exports)', /return module\.exports;/.test(code))
for (const ext of EXTERNALS) {
  check(`external require("${ext}") present`, new RegExp(`require\\("${ext.replace(/[/.]/g, '\\$&')}"\\)`).test(code))
}
check('no @grapecity require remains (inlined)', !/require\("@grapecity/.test(code))
check('spread-sheets css string embedded', code.includes('gc-spread-sheets'))
check('viewer css string embedded', code.includes('.dsh-spreadjs-backdrop'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
