# dsh-spreadjs-editor

[GitHub](https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor) | [中文完整版](https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor/blob/main/docs/README.zh-CN.md)

DeepSeek Harness Web UI 插件，通过 `dsh-better-sidebar`（ui-all 自带）注册 SpreadJS，在右侧文件树中打开和编辑 `.xlsx`、`.xlsm`、`.csv`、`.sjs`、`.ssjson` 文件。不依赖 `dsh-plugin-web-editors`。

A DeepSeek Harness Web UI plugin that registers SpreadJS through `dsh-better-sidebar` (bundled by ui-all), so spreadsheet files open from the right-side file tree. It does not depend on `dsh-plugin-web-editors`.

---

## 中文说明

### 功能

- 通过 better-sidebar 在 Web UI 右侧文件树中打开 spreadsheet 文件。
- 浏览器端使用 GrapeCity 官方 npm 包组（所有 SpreadJS 相关包由 `package.json` 统一锁定同一版本）：SpreadJS、ExcelIO、Designer、中文资源、PivotTable、TableSheet、图表、形状、切片器、迷你图、打印/PDF、条码、公式面板、数据图表、GanttSheet、ReportSheet 等。
- View-first：没有自定义插件工具条，Designer ribbon、公式栏、sheet tabs、右键菜单和工作簿画布就是编辑表面。
- Designer 界面跟随系统 light/dark 偏好。

### 环境要求

- 必须提供 `dsh-better-sidebar` 服务；最简单的方式是挂载 `@linxin666/dsh-web-all`（ui-all），ui-all 自带 better-sidebar。
- 兼容的 DeepSeek Harness 版本。
- Node.js 20+。
- 能访问 `@grapecity-software` 官方 npm 包，并持有有效的 GrapeCity 部署许可。

### 从 npm 安装（源码构建模式）

本包由 GrapeCity 官方 npm 账号发布。SpreadJS 和 Designer 等组件不在插件包内二次打包，而是通过官方 `@grapecity-software` npm 包作为安装时依赖分发，安装阶段从这些官方包构建 `lib/client.js`。所有 GrapeCity 依赖在 `package.json` 中统一锁定同一版本；发布新版前可用 `npm run grapecity:update -- --latest` 一次性同步到最新版。用户始终直接使用官方 npm 包，便于按 GrapeCity 许可部署、升级和定位问题。

DSH 使用 pnpm 10 管理 profile，而 pnpm 10 默认会拦截依赖包的生命周期脚本。安装前先给 Web profile 放行本包一次（通常是 `~/.dsh/profiles/web/pnpm-workspace.yaml`）：

```yaml
onlyBuiltDependencies:
  - dsh-spreadjs-editor
```

然后直接添加插件：

```sh
dsh plugin --profile web add dsh-spreadjs-editor
dsh web
```

放行后 pnpm 会在安装阶段自动运行 `postinstall` 构建，不需要用户手动执行 `npm run build` 或 `pnpm rebuild`。只有在你已经先装过包、后来才补放行配置时，才需要手动补一次：

```sh
pnpm --dir ~/.dsh/profiles/web rebuild dsh-spreadjs-editor
```

如果你没有全局安装 `dsh`，而是通过 npx 运行 DSH，把上面的命令改成：

```sh
npx --yes @deepseek-ai/dsh@latest plugin --profile web add dsh-spreadjs-editor
npx --yes @deepseek-ai/dsh@latest web
```

需要补构建时：

```sh
npx --yes pnpm --dir ~/.dsh/profiles/web rebuild dsh-spreadjs-editor
```

注意：不要用 `npx dsh`，那是另一个同名包；DeepSeek Harness CLI 是 `@deepseek-ai/dsh`。

如果你直接使用 npm 而不是 pnpm，`npm install` 本来就会自动运行包的 `postinstall` 构建。

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
- Uses the GrapeCity official npm package set (all SpreadJS-related packages are pinned to the same version in `package.json`): SpreadJS, ExcelIO, Designer, Chinese resources, PivotTable, TableSheet, charts, shapes, slicers, sparklines, print/PDF, barcode, formula panel, data charts, GanttSheet, ReportSheet, and language packages.
- View-first: the Designer ribbon, formula bar, sheet tabs, context menus, and workbook canvas are the editing surface.
- The Designer chrome follows the OS light/dark preference.

### Requirements

- `dsh-better-sidebar` must be available. The easiest way is to mount `@linxin666/dsh-web-all` (ui-all), which bundles better-sidebar.
- A compatible DeepSeek Harness release.
- Node.js 20+.
- Access to the official `@grapecity-software` npm packages and a valid GrapeCity deployment license.

### Install from npm (source-only)

This package is published by GrapeCity's official npm account. SpreadJS and the Designer are not bundled into the plugin artifact; they are installed directly from the official `@grapecity-software` npm packages as install-time dependencies, and `lib/client.js` is built from those official packages during installation. All GrapeCity dependencies are pinned to the same version in `package.json`; before a new release you can run `npm run grapecity:update -- --latest` to sync them all at once. Users stay on official npm packages, which keeps deployment under the GrapeCity license clear and makes upgrades and troubleshooting simpler.

DSH manages profiles with pnpm 10, which blocks dependency lifecycle scripts by default. Add this to the Web profile's `pnpm-workspace.yaml` before installing (normally `~/.dsh/profiles/web/pnpm-workspace.yaml`):

```yaml
onlyBuiltDependencies:
  - dsh-spreadjs-editor
```

Then add the plugin and start DSH:

```sh
dsh plugin --profile web add dsh-spreadjs-editor
dsh web
```

Once the build is allowed, pnpm runs the package's `postinstall` build automatically during install. Users do not need to run `npm run build` or `pnpm rebuild` manually. The manual rebuild command is only needed if the package was already installed before the allow-list entry was added:

```sh
pnpm --dir ~/.dsh/profiles/web rebuild dsh-spreadjs-editor
```

If you do not have `dsh` installed globally and run it through npx, use the same commands through the official npm package:

```sh
npx --yes @deepseek-ai/dsh@latest plugin --profile web add dsh-spreadjs-editor
npx --yes @deepseek-ai/dsh@latest web
```

For the manual rebuild case:

```sh
npx --yes pnpm --dir ~/.dsh/profiles/web rebuild dsh-spreadjs-editor
```

Do not use `npx dsh`; that is a different npm package. The DeepSeek Harness CLI is `@deepseek-ai/dsh`.

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
