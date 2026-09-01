# dsh-spreadjs-editor

[GitHub](https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor)

DeepSeek Harness Web UI 插件，通过 `dsh-better-sidebar`（ui-all 自带）注册 SpreadJS，在右侧文件树中打开和编辑 `.xlsx`、`.xlsm`、`.csv`、`.sjs`、`.ssjson` 文件。不依赖 `dsh-plugin-web-editors`。

A DeepSeek Harness Web UI plugin that registers SpreadJS through `dsh-better-sidebar` (bundled by ui-all), so spreadsheet files open from the right-side file tree. It does not depend on `dsh-plugin-web-editors`.

---

## 中文说明

### 功能

- 通过 better-sidebar 在 Web UI 右侧文件树中打开 spreadsheet 文件。
- 浏览器端使用 GrapeCity npm scope 的 **19.1.4** 包组：SpreadJS、ExcelIO、Designer、中文资源、PivotTable、TableSheet、图表、形状、切片器、迷你图、打印/PDF、条码、公式面板、数据图表、GanttSheet、ReportSheet 等。
- View-first：没有自定义插件工具条，Designer ribbon、公式栏、sheet tabs、右键菜单和工作簿画布就是编辑表面。
- Designer 界面跟随系统 light/dark 偏好。

### 环境要求

- 同一个 Web profile 中挂载 `@linxin666/dsh-web-all`（ui-all / `dsh-better-sidebar`）。
- 兼容的 DeepSeek Harness 版本。
- Node.js 20+。
- 能访问 `@grapecity-software` 19.1.4 npm 包，并持有有效的 GrapeCity 部署许可。

### 从 npm 安装（源码构建模式）

npm 包不携带生成后的 SpreadJS client bundle，而是把 GrapeCity 19.1.4 系列声明为安装时依赖，安装阶段自动构建 `lib/client.js`。这样 npm tarball 不包含商业 SpreadJS 二进制；用户仍按 GrapeCity 许可安装和使用这些包。

DSH 使用 pnpm 10 管理 profile，pnpm 10 默认会拦截依赖包的生命周期脚本。添加后需要放行一次并重新构建：

```sh
dsh plugin --profile web add dsh-spreadjs-editor
```

在 Web profile 的 `pnpm-workspace.yaml` 中追加（通常是 `~/.dsh/profiles/web/pnpm-workspace.yaml`）：

```yaml
onlyBuiltDependencies:
  - dsh-spreadjs-editor
```

然后执行：

```sh
pnpm --dir ~/.dsh/profiles/web rebuild dsh-spreadjs-editor
dsh web
```

如果你直接使用 npm 而不是 pnpm，`npm install` 会自动运行包的 `postinstall` 构建。

### 从 GitHub 安装

```sh
git clone https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor.git

cd dsh-plugin-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-plugin-spreadjs-editor
```

### 配置

bundle 的 patch row 接受 `config` 对象，在 `cordis.patch.yml` 中编辑，或在 profile 的 `cordis.patch.yml` 中覆盖该 row：

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS + Designer 部署 license key。留空时使用 evaluation 构建。 |

### 支持的文件

| 扩展名 | Loader |
| --- | --- |
| `.xlsx` / `.xlsm` | `ExcelIO.IO().open()` -> `fromJSON()` |
| `.sjs` | `spread.open()` / `spread.save()`（SpreadJS 原生格式） |
| `.ssjson` | `fromJSON()` |
| `.csv` | `spread.import()` / `spread.export()` |

文件读取和写回走 better-sidebar 的 session 路由（`/sidebar/file` 和 `/sidebar/upload`），使用 ui-all 传入的 session cwd/path。Host 端的 `/spreadjs/api/config` 只负责提供 license key。

### 许可

本插件代码使用 MIT。SpreadJS 是 GrapeCity 的商业产品；真实部署 license key 的配置位置见 `cordis.patch.yml` / `/spreadjs/api/config`。

---

## English

### Features

- Opens spreadsheet files from the ui-all right-side file tree through better-sidebar.
- Uses the GrapeCity npm **19.1.4** package set: SpreadJS, ExcelIO, Designer, Chinese resources, PivotTable, TableSheet, charts, shapes, slicers, sparklines, print/PDF, barcode, formula panel, data charts, GanttSheet, ReportSheet, and language packages.
- View-first: the Designer ribbon, formula bar, sheet tabs, context menus, and workbook canvas are the editing surface.
- The Designer chrome follows the OS light/dark preference.

### Requirements

- `@linxin666/dsh-web-all` (ui-all / `dsh-better-sidebar`) mounted in the same Web profile.
- A compatible DeepSeek Harness release.
- Node.js 20+.
- Access to the `@grapecity-software` 19.1.4 npm packages and a valid GrapeCity deployment license.

### Install from npm (source-only)

The npm package intentionally does not ship the generated SpreadJS client bundle. It declares the GrapeCity 19.1.4 packages as install-time dependencies and builds `lib/client.js` from source. This keeps commercial SpreadJS binaries out of the npm tarball; each user still installs and uses them under GrapeCity's license.

DSH manages profiles with pnpm 10, which blocks dependency lifecycle scripts by default. After adding the package, allow its build once and rebuild:

```sh
dsh plugin --profile web add dsh-spreadjs-editor
```

Add this to the Web profile's `pnpm-workspace.yaml` (normally `~/.dsh/profiles/web/pnpm-workspace.yaml`):

```yaml
onlyBuiltDependencies:
  - dsh-spreadjs-editor
```

Then run:

```sh
pnpm --dir ~/.dsh/profiles/web rebuild dsh-spreadjs-editor
dsh web
```

If you use npm directly instead of pnpm, `npm install` runs the package's `postinstall` build automatically.

### Install from GitHub

```sh
git clone https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor.git

cd dsh-plugin-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-plugin-spreadjs-editor
```

### Configuration

The bundle's patch row accepts a `config` object (edit it in `cordis.patch.yml`, or override the row in your profile's `cordis.patch.yml`):

| Key | Default | Description |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS + Designer deployment license key. Empty runs the evaluation build. |

### Supported files

| Extension | Loader |
| --- | --- |
| `.xlsx` / `.xlsm` | `ExcelIO.IO().open()` -> `fromJSON()` |
| `.sjs` | `spread.open()` / `spread.save()` (native SpreadJS format) |
| `.ssjson` | `fromJSON()` |
| `.csv` | `spread.import()` / `spread.export()` |

File bytes are read and written through better-sidebar's session routes (`/sidebar/file` and `/sidebar/upload`), using the session cwd/path passed by ui-all. The host `/spreadjs/api/config` endpoint supplies only the license key.

### License

MIT for this plugin's code. SpreadJS is a commercial product by GrapeCity; see `cordis.patch.yml` / `/spreadjs/api/config` for where to set a real deployment license key.
