# dsh-spreadjs-editor

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds a
SpreadJS-powered spreadsheet viewer to the harness **Web UI**. From the sidebar you can open
any Excel / CSV / SJS / SSJSON file inside a task workspace and preview it read-only.

- **Node half** (`lib/index.js`) — registers the `/spreadjs` file bridge on the host web
  server (`ctx.webServer`). It lists spreadsheet files under a root and streams file bytes,
  confined to that root (no path traversal).
- **Browser half** (`lib/client.js`) — a closure-factory bundle loaded by the harness client
  module system. It injects a `sidebar.footer.action` trigger and a full-screen
  `shell.overlay` viewer, sharing one view-state store handle.

SpreadJS **18.2.5** is inlined into the browser bundle; `react` and
`@deepseek-ai/dsh-client-runtime/client` resolve from the harness module table at runtime.

## Compatibility

This branch targets the **published** DeepSeek Harness CLI (`@deepseek-ai/dsh` `0.1.1-rc.2`,
the version `npx @deepseek-ai/dsh` installs today), whose web stack ships the
`ctx.webServer` service and the `sidebar.footer.action` / `shell.overlay` slot seats.

> The plugin was originally written against the harness `master` architecture (unpublished,
> `0.1.2-alpha.1`). That version is preserved on the `target/master` branch — the two branches
> differ only in the harness surfaces they consume.

## Requirements

- `@deepseek-ai/dsh` `0.1.1-rc.2` (or a compatible published `rc`), run however you like —
  global `dsh`, or `npx @deepseek-ai/dsh`.
- A Web profile to install into.

## Install

From the directory that contains this checkout:

```sh
# global install:
dsh plugin --profile web add ./dsh-spreadjs-editor
# …or if you run the CLI via npx:
npx @deepseek-ai/dsh plugin --profile web add ./dsh-spreadjs-editor
```

This pnpm-links the checkout, appends the bundle to `dsh.profile.bundles`, and activates the
`cordis.patch.yml` layer (one `spreadjs-editor` row that injects `webServer`). Verify the layer
without booting, then boot:

```sh
dsh --profile web --dump-config   # shows a "# == dsh-spreadjs-editor" layer
dsh --profile web
```

Open the Web UI. A **▦ Spreadsheets** button appears at the bottom of the sidebar; click it to
open the viewer.

## Configuration

The bundle's patch row accepts a `config` object (edit it in
`cordis.patch.yml`, or override the row in your profile's `cordis.patch.yml` — a later patch
replaces the row's **whole** `config`, so restate every key you keep):

| Key | Default | Description |
| --- | --- | --- |
| `defaultRoot` | `!!js process.cwd()` | Directory scanned when the viewer is opened with no explicit workspace root selected. |
| `licenseKey` | `''` | Your SpreadJS **deployment** license key. Empty runs the evaluation (watermarked) build. |

The viewer also lists every workspace (from the `useWorkspaces` global hook) in a root dropdown
next to the title bar, so you can browse any task workspace without touching configuration.

## Supported files

| Extension | Loader |
| --- | --- |
| `.xlsx` / `.xlsm` | `ExcelIO.IO().open(blob)` → `workbook.fromJSON` |
| `.sjs` | `workbook.open(File)` (native SpreadJS format) |
| `.ssjson` / `.json` | `workbook.fromJSON` |
| `.csv` | Local RFC-4180 parser → cell fill (delimiter auto-detected, numeric cells inferred) |

Files are served from the harness host over `/spreadjs/api/file?root=…&path=…`. The host
resolves relative paths against the chosen root and rejects anything that escapes it (`403`).

## Architecture

```
Harness Web profile
 ├─ cordis.patch.yml            bundle layer: one spreadjs-editor row (inject: [webServer])
 └─ dsh-spreadjs-editor
     ├─ lib/index.js            node half — /spreadjs prefix route (file bridge)
     │    ├─ /api/health        liveness
     │    ├─ /api/roots         default browse root (cwd)
     │    ├─ /api/config        license key
     │    ├─ /api/list?root=    recursive spreadsheet file listing
     │    └─ /api/file?root=&path=  stream file bytes (root-confined)
     └─ lib/client.js           browser half — closure-factory bundle
          ├─ ViewerTrigger      sidebar.footer.action → opens the overlay
          └─ SpreadsheetViewer  shell.overlay → file list + SpreadJS host
          (both share one createViewerStore() handle)
```

External keys in the browser bundle: `react`, `react/jsx-runtime`, `react-dom`,
`react-dom/client`, `@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-runtime/client`,
`@deepseek-ai/dsh-client-ui-slots`. Everything else (SpreadJS, ExcelIO, the Chinese resource
dictionary, both stylesheets) is bundled.

## Development

```sh
pnpm install            # use pnpm; npm 10.8 arborist is broken
pnpm typecheck          # tsc --noEmit (strict)
pnpm test               # vitest: fs-bridge + node-half routes + client apply()
pnpm build              # tsdown → lib/index.js + lib/client.js
node scripts/smoke-node.mjs     # loads the BUILT node half, drives all endpoints
node scripts/smoke-client.mjs   # structural checks on the BUILT browser half
```

The build needs Node ≥ 20 with a `Promise.withResolvers` polyfill (provided by
`scripts/build.mjs`); tsdown 0.22 itself requires the polyfill on Node 20.

## Verification status

- **Typecheck** — passes (`tsc --noEmit`, strict). Types come from the published harness
  packages (`@deepseek-ai/dsh-client-runtime`, `@deepseek-ai/dsh-client-ui-slots`,
  `@deepseek-ai/dsh-client-ui-sidebar`, `@deepseek-ai/dsh-client-ui-layout`,
  `@deepseek-ai/dsh-host-webserver`); `src/augment.ts` pulls their `SlotMap` / `Context`
  declaration merges into the program.
- **Tests** — 30 pass: fs-bridge path-containment/listing, node-half endpoints
  (health/roots/config/list/file, traversal → 403, missing → 404), client `apply()`
  registers both slot seats.
- **Built artifacts** — node half smoke-tested end-to-end against a mock host; browser half
  structurally verified (loader wrapper, externals, inlined SpreadJS + styles). A full
  in-browser load requires the real harness Web UI (SpreadJS touches DOM/canvas at module
  init, which a plain Node/jsdom test environment cannot provide) — do that once after
  install: open the sidebar trigger and load a workbook.
- **Not covered** — actual `dsh plugin add` in a real profile, and the license-key-free
  evaluation watermark rendering in the harness browser.

## License

MIT. SpreadJS is a commercial product by MESCIUS (formerly GrapeCity); deploying without a
license key runs the evaluation build with a watermark — see `cordis.patch.yml` /
`/spreadjs/api/config` for where to set a real key.
