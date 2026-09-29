// Release gate: run the acceptance suite, stamp the changelog, commit the
// version bump, tag it, push `--follow-tags`, and open the GitHub release.
//
// It deliberately does NOT run `npm publish`. That is the one irreversible step
// and it stays a human keystroke.
//
// Why this exists: `prepublishOnly` already runs the same acceptance suite, so
// the suite is not missing — it fires at publish time, which is *after* the
// version commit, the tag and the release have been pushed. A failure there
// leaves a tag and a release pointing at a commit that never shipped. This
// script moves the same suite in front of the bookkeeping, so a red suite
// aborts before anything leaves the machine.
//
// It also takes the release notes from CHANGELOG.md itself, so the two cannot
// drift, and it is the only place that has to be touched to keep "version in
// package.json" and "tag on the commit" in sync — `npm publish` does not tag
// anything by itself.
//
// Usage:
//   npm run release                       # release the version package.json already declares
//   npm run release -- 0.2.3              # or bump to 0.2.3 as part of the release
//   npm run release -- --dry-run          # run the suite, print the plan, change nothing
//   npm run release -- --yes              # skip the confirmation prompt
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('..', import.meta.url))
const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const assumeYes = argv.includes('--yes') || argv.includes('-y')
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/
const STEPS = 6

const manifestPath = join(repo, 'package.json')
const changelogPath = join(repo, 'CHANGELOG.md')

// The version is usually already declared in package.json before a release —
// that is how a batch of work gets its number — so an argument is optional and
// means "bump to this" rather than "this is the release".
const requested = argv.find(argument => !argument.startsWith('-'))
const declared = JSON.parse(readFileSync(manifestPath, 'utf8')).version
const version = requested ?? declared

function fail(message) {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

function step(number, title) {
  console.log(`\n[${number}/${STEPS}] ${title}`)
}

/** git with captured output: only for queries whose answer we need to see. */
function git(...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
}

/** git with the terminal's own output: for the commands whose output is the point. */
function gitLive(...args) {
  execFileSync('git', args, { cwd: repo, stdio: 'inherit' })
}

// npm is spawned through its own JS entry (the same trick verify-package.mjs
// uses) so there is no shell and therefore no quoting problem on Windows.
const npmCli = process.env.npm_execpath
function npmRun(script) {
  execFileSync(process.execPath, [npmCli, 'run', script], { cwd: repo, stdio: 'inherit' })
}

function nodeScript(file) {
  execFileSync(process.execPath, [file], { cwd: repo, stdio: 'inherit' })
}

function compare(left, right) {
  const parse = value => value.split('-')[0].split('.').map(Number)
  const [a, b] = [parse(left), parse(right)]
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

/** The `## <version>` section of CHANGELOG.md, without its heading line. */
function changelogSection(text) {
  // Compare trimmed lines: a Windows checkout gives this file CRLF endings, and
  // an exact `line === heading` comparison silently matches nothing there.
  const lines = text.split(/\r?\n/)
  const headings = [`## ${version}`, `## ${version}（未发布）`, `## ${version} (unreleased)`]
  const start = lines.findIndex(line => headings.includes(line.trimEnd()))
  if (start === -1) return undefined
  const rest = lines.slice(start + 1)
  const end = rest.findIndex(line => line.startsWith('## '))
  // Joined with \n on purpose: the notes go to gh as a fresh file.
  return rest.slice(0, end === -1 ? rest.length : end).join('\n').trim()
}

// ---------------------------------------------------------------- 1. preconditions
step(1, '前置检查')
if (!npmCli) fail('请用 `npm run release` 运行，脚本需要 npm 的 CLI 路径。')
if (!VERSION_PATTERN.test(version)) fail(`版本号不合法：${version}`)

const manifestText = readFileSync(manifestPath, 'utf8')
if (compare(version, declared) < 0) {
  fail(`版本 ${version} 低于 package.json 里已声明的 ${declared}，不做降级发布。`)
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branch !== 'main') fail(`当前分支是 ${branch}，发布只从 main 走。`)

const dirty = git('status', '--porcelain')
if (dirty) fail(`工作区不干净，先提交或 stash：\n${dirty}`)

const section = changelogSection(readFileSync(changelogPath, 'utf8'))
if (section === undefined) fail(`CHANGELOG.md 里没有 "## ${version}" 这一节，先写版本记录。`)

if (git('tag', '--list', `v${version}`)) fail(`本地已存在 tag v${version}。`)
const remoteTag = git('ls-remote', '--tags', 'origin', `v${version}`)
if (remoteTag) fail(`远端已存在 tag v${version}。`)

console.log(`  package.json 声明 ${declared} → 本次发布 ${version}${version === declared ? '（同号：按已声明的版本发布）' : '（会顺带改 package.json）'}`)
console.log(`  分支 ${branch}，工作区干净，CHANGELOG 有对应小节，tag 未被占用`)

// ---------------------------------------------------------------- 2. acceptance suite
// Same commands as prepublishOnly, on purpose: a second, different gate would
// just be a second thing to trust.
step(2, '验收（与 prepublishOnly 同一套）')
const suite = [
  ['npm run typecheck', () => npmRun('typecheck')],
  ['npm test', () => npmRun('test')],
  ['npm run build', () => npmRun('build')],
  ['node scripts/smoke-client.mjs', () => nodeScript('scripts/smoke-client.mjs')],
  ['node scripts/smoke-node.mjs', () => nodeScript('scripts/smoke-node.mjs')],
  ['npm run verify:package', () => npmRun('verify:package')],
]
for (const [label, run] of suite) {
  console.log(`\n  → ${label}`)
  try {
    run()
  } catch {
    fail(`验收失败：${label}。未做任何版本动作，可以修完再跑。`)
  }
}

// The suite builds into lib/ (ignored) and packs into a temp dir, so the tree
// must still be clean. If it is not, something new appeared and it is not our
// job to guess what.
const dirtyAfter = git('status', '--porcelain')
if (dirtyAfter) fail(`验收之后工作区变脏了，请检查：\n${dirtyAfter}`)
console.log('\n  验收全绿')

// ---------------------------------------------------------------- 3. plan + confirmation
step(3, dryRun ? '计划（--dry-run，不会改动任何东西）' : '计划')
console.log(`  · CHANGELOG.md：把 "## ${version}（未发布）" 定版为 "## ${version}"（如已是该形式则不动）`)
console.log(version === declared
  ? `  · package.json：不变（已经是 ${version}）`
  : `  · package.json：version ${declared} → ${version}`)
console.log(`  · 提交：chore(release): ${version}（若无改动则直接给当前 HEAD 打 tag）`)
console.log(`  · 打 tag：v${version}（annotated）`)
console.log(`  · 推送：git push --follow-tags`)
console.log(`  · 建 Release：gh release create v${version} --verify-tag --notes-file <CHANGELOG 那一节>`)
console.log(`  · 不执行 npm publish（留给你手动敲）`)

if (dryRun) {
  console.log('\n--dry-run 结束：验收跑过了，其余什么都没做。')
  process.exit(0)
}

if (!assumeYes) {
  if (!process.stdin.isTTY) fail('非交互环境请加 --yes。')
  const answer = await new Promise(resolve => {
    const prompt = createInterface({ input: process.stdin, output: process.stdout })
    prompt.question(`\n继续发布 ${version}？（y/N）`, reply => {
      prompt.close()
      resolve(reply.trim().toLowerCase())
    })
  })
  if (answer !== 'y' && answer !== 'yes') fail('已取消，未做任何改动。')
}

// ---------------------------------------------------------------- 4. version commit + tag
step(4, '定版并提交')
if (version !== declared) {
  const stamped = manifestText.replace(/("version":\s*")[^"]+(")/u, `$1${version}$2`)
  if (stamped === manifestText) fail('package.json 里没有找到 version 字段。')
  writeFileSync(manifestPath, stamped)
}

const changelogText = readFileSync(changelogPath, 'utf8')
const released = changelogText.replace(`## ${version}（未发布）`, `## ${version}`)
if (released !== changelogText) writeFileSync(changelogPath, released)

// A release whose number was already declared, and whose changelog section was
// already stamped, has nothing left to commit. Tag the current HEAD instead of
// inventing an empty commit.
if (git('status', '--porcelain')) {
  gitLive('add', 'package.json', 'CHANGELOG.md')
  gitLive('commit',
    '-m', `chore(release): ${version}`,
    '-m', `由 scripts/release.mjs 发布：验收（typecheck / 单测 / build / 两个 smoke / verify:package）全绿后定版。`)
} else {
  console.log(`  没有需要提交的改动，直接给当前 HEAD 打 tag`)
}
gitLive('tag', '-a', `v${version}`, '-m', version)
console.log(`  已提交并打 tag v${version}（${git('rev-parse', '--short', 'HEAD')}）`)

// ---------------------------------------------------------------- 5. push
step(5, '推送提交与 tag')
try {
  gitLive('push', '--follow-tags')
} catch {
  fail(`推送失败。版本提交与 tag 已在本地产出，修好远端后执行：git push --follow-tags`)
}

// ---------------------------------------------------------------- 6. GitHub release
step(6, '创建 GitHub Release')
const notesDir = mkdtempSync(join(tmpdir(), `dsh-spreadjs-${version}-`))
const notesPath = join(notesDir, 'notes.md')
writeFileSync(notesPath, `${changelogSection(readFileSync(changelogPath, 'utf8'))}\n`)

try {
  execFileSync('gh', ['release', 'create', `v${version}`, '--verify-tag',
    '--title', version, '--notes-file', notesPath], { cwd: repo, stdio: 'inherit' })
  rmSync(notesDir, { recursive: true, force: true })
} catch {
  console.error(`\n! gh 创建 Release 失败。tag 已经推送成功，重新执行即可：`)
  console.error(`  gh release create v${version} --verify-tag --title ${version} --notes-file ${notesPath}`)
  console.error(`  （说明文字也可以直接从 CHANGELOG.md 的 "## ${version}" 一节复制）`)
}

console.log(`
发布记录已就位。剩下一步必须手动：

  npm publish        # prepublishOnly 会再跑一遍同一套验收，这是最后一道防线

发布之后：

  重启 DSH → npm run probe:live    # 确认正在跑的进程就是 ${version}`)
