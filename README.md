# dsh-spreadjs-editor

[中文 README](README.zh-CN.md)

A view-first [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI
plugin that adapts SpreadJS to both `dsh-better-sidebar` (the file/editor
surface shipped by ui-all) and `dsh-plugin-web-editors`. Install one adapter per
profile; dual-mode support exists only for migration and temporary validation,
not for daily use.

The browser half uses the current GrapeCity npm scope and **19.1.4** package set:
`@grapecity-software/spread-sheets`, `spread-sheets-io`, `spread-excelio`, the
Designer, Chinese resources, PivotTable, TableSheet, charts, shapes, slicers,
sparklines, print/PDF, barcode, formula panel, data charts, GanttSheet,
ReportSheet, and language packages.

- **Node half** (`lib/index.js`) — registers the `/spreadjs` prefix route for
  the license/config endpoint and the file bridge used by the webFileEditors
  adapter.
- **Browser half** (`lib/client.js`) — registers through
  `ctx.get('betterSidebar').registerFileViewer(...)` for ui-all and
  `ctx.get('webFileEditors').register(...)` for the clean web-editors panel.
  Both services are optional and registered lazily.
- **Finding files** — ui-all opens spreadsheet files from the right sidebar
  file tree; web-editors opens them from the generic file picker. Both modes
  contribute `.xlsx`, `.xlsm`, `.csv`, `.sjs`, and `.ssjson`.

## Choose One Adapter (Important)

**Do not install ui-all and `dsh-plugin-web-editors` together just for
SpreadJS.** With both mounted, the file tree, chat-produced links, and header
actions each expose a SpreadJS opener, so users have to guess which one to use
and the save paths/panel behavior differ.

Pick one based on the deployment:

| Scenario | Install | `preferViewer` |
| --- | --- | --- |
| Commercial / clean / controlled UX | `dsh-plugin-web-editors` | `webFileEditors` |
| Personal / ui-all / file-tree UX | `@linxin666/dsh-web-all` | `betterSidebar` |

Dual-adapter code is kept for migration from web-editors to ui-all. If both
services really are present in one profile, only `webFileEditors` is used by
default; set `preferViewer: betterSidebar` for ui-all. `auto` registers both
entries and is for migration testing only.

## Open-source and licensing

The plugin code in this repository is MIT licensed. SpreadJS itself is a
commercial product by GrapeCity; deploying it requires complying with
GrapeCity's license and usually requires a deployment `licenseKey`.

The repository intentionally does **not** commit or publish the generated
`lib/` directory. GrapeCity packages are declared as `peerDependencies` and
`devDependencies`, not shipped as bundled runtime artifacts, so an open-source
clone does not redistribute commercial binaries. Build locally, then point
`dsh plugin` at your local checkout.

## Requirements

- `@linxin666/dsh-web-all` (ui-all / `dsh-better-sidebar`) or `dsh-plugin-web-editors` mounted in the same Web profile. Install one, not both.
- A compatible DeepSeek Harness release.
- Node.js 20+.
- Access to the `@grapecity-software` 19.1.4 npm packages and a valid GrapeCity deployment license.

## Install from source

```sh
# choose ui-all or dsh-plugin-web-editors; do not install both
git clone <your-dsh-spreadjs-editor-repo>

cd dsh-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-spreadjs-editor
```

Then verify and boot:

```sh
dsh --profile web --dump-config
dsh --profile web
```

Open the Web UI, refresh the page, and open a supported file from the chat or
editor panel.

No DSH core change is required. The plugin watches both optional client
services and registers SpreadJS into whichever is available. When both are
installed, only `webFileEditors` is used by default; set
`preferViewer: betterSidebar` for ui-all.

## Configuration

The bundle's patch row accepts a `config` object (edit it in
`cordis.patch.yml`, or override the row in your profile's `cordis.patch.yml`):

| Key | Default | Description |
| --- | --- | --- |
| `defaultRoot` | `!!js process.cwd()` | Directory used when a file request has no explicit `root`. |
| `licenseKey` | `''` | SpreadJS + Designer deployment license key. Empty runs the evaluation build. |
| `preferViewer` | `webFileEditors` | Adapter selection when both are mounted: `webFileEditors` (default, commercial/clean), `betterSidebar` (ui-all), or `auto` (registers both, migration testing only). |

The ui-all adapter builds `/sidebar/file` and `/sidebar/upload` requests from
the session cwd/path passed by better-sidebar; the legacy `webFileEditors`
adapter keeps the `/spreadjs` bridge's root confinement.

## Supported files

| Extension | Loader |
| --- | --- |
| `.xlsx` / `.xlsm` | `ExcelIO.IO().open()` -> `fromJSON()` |
| `.sjs` | `spread.open()` / `spread.save()` (native SpreadJS format) |
| `.ssjson` | `fromJSON()` |
| `.csv` | `spread.import()` / `spread.export()` |

ui-all mode reads/writes through better-sidebar's session routes
(`/sidebar/file` / `/sidebar/upload`); web-editors mode uses
`/spreadjs/api/file?root=...&path=...`. The host resolves paths against the
chosen root and rejects anything that escapes it (`403`).

## Editor behavior

- View-first: no custom plugin toolbar; the Designer ribbon, formula bar, sheet
  tabs, context menus, and the workbook canvas are the editing surface.
- Designer / PivotTable / TableSheet / chart / shape / slicer / print / PDF /
  barcode / formula panel / data chart / GanttSheet / ReportSheet add-ons are
  bundled into the locally built client module.
- The Designer chrome follows the OS light/dark preference through
  `GC.Spread.Sheets.Designer.setTheme`.

## Architecture

```
Harness Web profile
 ├─ @linxin666/dsh-web-all          optional: ui-all file tree + ctx.betterSidebar
 ├─ dsh-plugin-web-editors          optional: clean webFileEditors panel
 ├─ cordis.patch.yml                bundle layer: one spreadjs-editor host row
 └─ dsh-spreadjs-editor
     ├─ lib/index.js                node half — /spreadjs prefix route (license/config + web-editors bridge)
     │    ├─ /api/health            liveness
     │    ├─ /api/roots             default browse root (cwd)
     │    ├─ /api/config            license key
     │    ├─ /api/list?root=        recursive spreadsheet file listing (web-editors)
     │    └─ /api/file?root=&path=  stream/read and write-back (web-editors)
     └─ lib/client.js               browser half — closure-factory bundle
          ├─ SpreadsheetViewer      betterSidebar.registerFileViewer({ id: 'spreadjs', ... })
          └─ SpreadsheetEditor      webFileEditors.register({ id: 'spreadjs', ... })
```

The two optional client paths above correspond to two deployment choices; a
production profile normally keeps only one. If both are mounted for migration,
`webFileEditors` is used by default; set `preferViewer: betterSidebar` for
ui-all.

## Development

```sh
npm install
npm run typecheck          # tsc --noEmit (strict)
npm test                   # vitest: fs-bridge + node-half routes + client registration
npm run build              # tsdown -> lib/index.js + lib/client.js
node scripts/smoke-node.mjs     # loads the BUILT node half, drives all endpoints
node scripts/smoke-client.mjs   # structural checks on the BUILT browser half
```

## License

MIT for this plugin's code. SpreadJS is a commercial product by GrapeCity;
see `cordis.patch.yml` / `/spreadjs/api/config` for where to set a real
deployment license key.
