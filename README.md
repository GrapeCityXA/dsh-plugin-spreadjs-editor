# dsh-spreadjs-editor

[中文 README](README.zh-CN.md)

A view-first [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI
plugin that registers SpreadJS into `dsh-better-sidebar`, the right-side file/editor
surface bundled by `@linxin666/dsh-web-all` (ui-all). It has no dependency on
`dsh-plugin-web-editors`; spreadsheets open from the ui-all file tree.

The browser half uses the current GrapeCity npm scope and **19.1.4** package set:
`@grapecity-software/spread-sheets`, `spread-sheets-io`, `spread-excelio`, the
Designer, Chinese resources, PivotTable, TableSheet, charts, shapes, slicers,
sparklines, print/PDF, barcode, formula panel, data charts, GanttSheet,
ReportSheet, and language packages.

- **Node half** (`lib/index.js`) — registers the `/spreadjs` prefix route for the
  license/config handshake.
- **Browser half** (`lib/client.js`) — waits for `ctx.betterSidebar` and registers
  `SpreadsheetViewer` through `registerFileViewer`.
- **Finding files** — open `.xlsx`, `.xlsm`, `.csv`, `.sjs`, and `.ssjson` from
  the right-side file tree.

## Requirements

- `@linxin666/dsh-web-all` (ui-all / `dsh-better-sidebar`) mounted in the same Web profile.
- A compatible DeepSeek Harness release.
- Node.js 20+.
- Access to the `@grapecity-software` 19.1.4 npm packages and a valid GrapeCity deployment license.

## Install from npm (source-only)

The npm package intentionally does not ship the generated SpreadJS client
bundle. It declares the GrapeCity 19.1.4 packages as install-time
dependencies, then builds `lib/client.js` from source. This keeps commercial
SpreadJS binaries out of our npm tarball; each user still installs and uses
them under GrapeCity's license.

DSH manages profiles with pnpm 10, which blocks dependency lifecycle scripts
by default. After adding the package, allow its build once and rebuild:

```sh
dsh plugin --profile web add dsh-spreadjs-editor
```

Add this to the Web profile's `pnpm-workspace.yaml`
(`$DSH_HOME/profiles/web/pnpm-workspace.yaml`, normally
`~/.dsh/profiles/web/pnpm-workspace.yaml`):

```yaml
onlyBuiltDependencies:
  - dsh-spreadjs-editor
```

Then run:

```sh
pnpm --dir ~/.dsh/profiles/web rebuild dsh-spreadjs-editor
dsh web
```

If you use npm directly instead of pnpm, `npm install` runs the package's
`postinstall` build automatically.

## Install from source

```sh
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

Open the Web UI, refresh the page, and open a supported file from the ui-all
right-side file tree.

No DSH core change is required. The plugin stays idle when
`dsh-better-sidebar` is not mounted and registers SpreadJS as soon as the
service appears.

## Configuration

The bundle's patch row accepts a `config` object (edit it in
`cordis.patch.yml`, or override the row in your profile's `cordis.patch.yml`):

| Key | Default | Description |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS + Designer deployment license key. Empty runs the evaluation build. |

## Supported files

| Extension | Loader |
| --- | --- |
| `.xlsx` / `.xlsm` | `ExcelIO.IO().open()` -> `fromJSON()` |
| `.sjs` | `spread.open()` / `spread.save()` (native SpreadJS format) |
| `.ssjson` | `fromJSON()` |
| `.csv` | `spread.import()` / `spread.export()` |

File bytes are read and written through better-sidebar's session routes
(`/sidebar/file` and `/sidebar/upload`), using the session cwd/path passed by
ui-all. The host `/spreadjs/api/config` endpoint supplies only the license key.

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
 ├─ @linxin666/dsh-web-all          ui-all file tree + ctx.betterSidebar
 ├─ cordis.patch.yml                bundle layer: one spreadjs-editor host row
 └─ dsh-spreadjs-editor
     ├─ lib/index.js                node half — /spreadjs license/config endpoint
     │    ├─ /api/health            liveness
     │    └─ /api/config            license key
     └─ lib/client.js               browser half — closure-factory bundle
          └─ SpreadsheetViewer      betterSidebar.registerFileViewer({ id: 'spreadjs', ... })
```

## Development

```sh
npm install
npm run typecheck          # tsc --noEmit (strict)
npm test                   # vitest: node-half routes + client registration
npm run build              # tsdown -> lib/index.js + lib/client.js
node scripts/smoke-node.mjs     # loads the BUILT node half, drives all endpoints
node scripts/smoke-client.mjs   # structural checks on the BUILT browser half
```

## License

MIT for this plugin's code. SpreadJS is a commercial product by GrapeCity;
see `cordis.patch.yml` / `/spreadjs/api/config` for where to set a real
deployment license key.
