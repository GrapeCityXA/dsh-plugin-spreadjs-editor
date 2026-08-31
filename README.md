# dsh-spreadjs-editor

[中文 README](README.zh-CN.md)

A view-first [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI
plugin that renders SpreadJS workbooks in the editor panel owned by
`dsh-plugin-web-editors`. It contributes only the SpreadJS capability and the
`/spreadjs` host file bridge; the generic plugin owns the panel and chat file rows.

The browser half uses the current GrapeCity npm scope and **19.1.4** package set:
`@grapecity-software/spread-sheets`, `spread-sheets-io`, `spread-excelio`, the
Designer, Chinese resources, PivotTable, TableSheet, charts, shapes, slicers,
sparklines, print/PDF, barcode, formula panel, data charts, GanttSheet,
ReportSheet, and language packages.

- **Node half** (`lib/index.js`) — registers the `/spreadjs` file bridge on the
  host web server (`ctx.webServer`). It lists spreadsheet files under a root,
  streams file bytes, and writes edited files back with `PUT`, always confined
  to that root.
- **Browser half** (`lib/client.js`) — registers the SpreadJS editor through
  `ctx.get('webFileEditors').register(...)`. If `webFileEditors` is absent, the
  browser half still loads safely but registers nothing.

## Open-source and licensing

The plugin code in this repository is MIT licensed. SpreadJS itself is a
commercial product by MESCIUS (formerly GrapeCity); deploying it requires
complying with MESCIUS's license and usually requires a deployment `licenseKey`.

The repository intentionally does **not** commit or publish the generated
`lib/` directory. GrapeCity packages are declared as `peerDependencies` and
`devDependencies`, not shipped as bundled runtime artifacts, so an open-source
clone does not redistribute commercial binaries. Build locally, then point
`dsh plugin` at your local checkout.

## Requirements

- `dsh-plugin-web-editors` (the generic editor framework) mounted in the same Web profile.
- A compatible DeepSeek Harness release.
- Node.js 20+.
- Access to the `@grapecity-software` 19.1.4 npm packages and a valid MESCIUS/GrapeCity deployment license.

## Install from source

```sh
git clone <your-dsh-plugin-web-editors-repo>
git clone <your-dsh-spreadjs-editor-repo>

cd dsh-plugin-web-editors
npm install
npm run build

cd ../dsh-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-plugin-web-editors
dsh plugin --profile web add ../dsh-spreadjs-editor
```

Then verify and boot:

```sh
dsh --profile web --dump-config
dsh --profile web
```

Open the Web UI, refresh the page, and open a supported file from the chat or
editor panel.

> **Core extension-point caveat:** full chat `openFile` -> `webFileEditors`
> routing depends on the `shell.editor` / `webFileEditors` extension points in
> DeepSeek Harness core. Upstream the `feat/web-editor-extension-points`
> changes or run a patched DSH build if you need DSH's own chat file links to
> open the editor panel. Without that patch, the generic plugin's produced-file
> chips and panel still work.

## Configuration

The bundle's patch row accepts a `config` object (edit it in
`cordis.patch.yml`, or override the row in your profile's `cordis.patch.yml`):

| Key | Default | Description |
| --- | --- | --- |
| `defaultRoot` | `!!js process.cwd()` | Directory used when a file request has no explicit `root`. |
| `licenseKey` | `''` | SpreadJS + Designer deployment license key. Empty runs the evaluation build. |

The generic editor passes the resolved file path and session cwd (`root`) to the
component, so the `/spreadjs` bridge can stay confined to that root.

## Supported files

| Extension | Loader |
| --- | --- |
| `.xlsx` / `.xlsm` | `ExcelIO.IO().open()` -> `fromJSON()` |
| `.sjs` | `spread.open()` / `spread.save()` (native SpreadJS format) |
| `.ssjson` | `fromJSON()` |
| `.csv` | `spread.import()` / `spread.export()` |

Files are served from the harness host over `/spreadjs/api/file?root=...&path=...`.
The host resolves paths against the chosen root and rejects anything that
escapes it (`403`).

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
 ├─ dsh-plugin-web-editors          generic panel + webFileEditors service
 ├─ cordis.patch.yml                bundle layer: one spreadjs-editor host row
 └─ dsh-spreadjs-editor
     ├─ lib/index.js                node half — /spreadjs prefix route (file bridge)
     │    ├─ /api/health            liveness
     │    ├─ /api/roots             default browse root (cwd)
     │    ├─ /api/config            license key
     │    ├─ /api/list?root=        recursive spreadsheet file listing
     │    └─ /api/file?root=&path=  stream/read (GET) and write-back (PUT)
     └─ lib/client.js               browser half — closure-factory bundle
          └─ SpreadsheetEditor      webFileEditors.register({ id: 'spreadjs', ... })
```

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

MIT for this plugin's code. SpreadJS is a commercial product by MESCIUS
(formerly GrapeCity); see `cordis.patch.yml` / `/spreadjs/api/config` for where
to set a real deployment license key.
