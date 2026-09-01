# dsh-spreadjs-editor

[English README](README.md)

一个 view-first 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI 插件，把 SpreadJS 注册到 `dsh-better-sidebar`（由 `@linxin666/dsh-web-all`，即 ui-all 聚合）。它不依赖 `dsh-plugin-web-editors`；spreadsheet 文件直接由 ui-all 右侧文件树打开。

浏览器端使用当前 GrapeCity npm scope 和 **19.1.4** 包组：`@grapecity-software/spread-sheets`、`spread-sheets-io`、`spread-excelio`、Designer、中文资源、PivotTable、TableSheet、charts、shapes、slicers、sparklines、print/PDF、barcode、formula panel、data charts、GanttSheet、ReportSheet 和 language packages。

- **Node 端**（`lib/index.js`）—— 在 host web server（`ctx.webServer`）上注册 `/spreadjs` license/config 配置端点。
- **浏览器端**（`lib/client.js`）—— 等待 `ctx.betterSidebar` 服务，然后通过 `registerFileViewer` 注册 `SpreadsheetViewer`。
- **查找文件** —— 从右侧文件树打开 `.xlsx`、`.xlsm`、`.csv`、`.sjs` 和 `.ssjson`。

## 环境要求

- 同一个 Web profile 中挂载 `@linxin666/dsh-web-all`（ui-all / `dsh-better-sidebar`）。
- 兼容的 DeepSeek Harness 版本。
- Node.js 20+。
- 能访问 `@grapecity-software` 19.1.4 npm 包，并持有有效的 GrapeCity 部署许可。

## 从 npm 安装（源码构建模式）

npm 包有意不携带生成后的 SpreadJS client bundle。包内把 GrapeCity 19.1.4 系列声明为安装时依赖，安装阶段从源码构建 `lib/client.js`。这样我们的 npm tarball 不包含商业 SpreadJS 二进制；用户仍然在自己本机按 GrapeCity 许可安装和使用这些包。

DSH 使用 pnpm 10 管理 profile，而 pnpm 10 默认会拦截依赖包的生命周期脚本。添加包后需要放行一次并重新构建：

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

## 从源码安装

```sh
git clone <你的-dsh-spreadjs-editor-仓库>

cd dsh-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-spreadjs-editor
```

然后验证并启动：

```sh
dsh --profile web --dump-config
dsh --profile web
```

打开 Web UI、刷新页面，再从 ui-all 右侧文件树打开支持的文件。

不需要任何 DSH core 改动。当 `dsh-better-sidebar` 未挂载时插件保持空闲；服务出现后会自动注册 SpreadJS。

## 配置

bundle 的 patch row 接受 `config` 对象（在 `cordis.patch.yml` 中编辑，或在 profile 的 `cordis.patch.yml` 中覆盖该 row）：

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS + Designer 部署 license key。留空时使用 evaluation 构建。 |

## 支持的文件

| 扩展名 | Loader |
| --- | --- |
| `.xlsx` / `.xlsm` | `ExcelIO.IO().open()` -> `fromJSON()` |
| `.sjs` | `spread.open()` / `spread.save()`（SpreadJS 原生格式） |
| `.ssjson` | `fromJSON()` |
| `.csv` | `spread.import()` / `spread.export()` |

文件读取和写回都走 better-sidebar 的 session 路由（`/sidebar/file` 和 `/sidebar/upload`），使用 ui-all 传入的 session cwd/path。Host 端的 `/spreadjs/api/config` 只负责提供 license key。

## Editor 行为

- View-first：没有自定义插件工具条；Designer ribbon、公式栏、sheet tabs、右键菜单和工作簿画布就是编辑表面。
- Designer / PivotTable / TableSheet / chart / shape / slicer / print / PDF / barcode / formula panel / data chart / GanttSheet / ReportSheet add-on 会打包进本地构建的 client module。
- Designer 界面通过 `GC.Spread.Sheets.Designer.setTheme` 跟随系统 light/dark 偏好。

## 架构

```
Harness Web profile
 ├─ @linxin666/dsh-web-all          ui-all 右侧文件树 + ctx.betterSidebar
 ├─ cordis.patch.yml                bundle layer：一个 spreadjs-editor host row
 └─ dsh-spreadjs-editor
     ├─ lib/index.js                Node 端 — /spreadjs license/config 端点
     │    ├─ /api/health            liveness
     │    └─ /api/config            license key
     └─ lib/client.js               浏览器端 — closure-factory bundle
          └─ SpreadsheetViewer      betterSidebar.registerFileViewer({ id: 'spreadjs', ... })
```

## 开发

```sh
npm install
npm run typecheck          # tsc --noEmit (strict)
npm test                   # vitest：node-half routes + client registration
npm run build              # tsdown -> lib/index.js + lib/client.js
node scripts/smoke-node.mjs     # 加载构建后的 node half，驱动所有端点
node scripts/smoke-client.mjs   # 对构建后的 browser half 做结构检查
```

## License

本插件代码使用 MIT。SpreadJS 是 GrapeCity 的商业产品；真实部署 license key 的配置位置见 `cordis.patch.yml` / `/spreadjs/api/config`。
