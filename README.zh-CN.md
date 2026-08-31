# dsh-spreadjs-editor

[English README](README.md)

一个 view-first 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI 插件，用于在 `dsh-plugin-web-editors` 拥有的 editor 面板中渲染 SpreadJS 工作簿。本包只贡献 SpreadJS 能力和 `/spreadjs` host 文件桥；面板与 chat 文件行由通用插件管理。

浏览器端使用当前 GrapeCity npm scope 和 **19.1.4** 包组：`@grapecity-software/spread-sheets`、`spread-sheets-io`、`spread-excelio`、Designer、中文资源、PivotTable、TableSheet、charts、shapes、slicers、sparklines、print/PDF、barcode、formula panel、data charts、GanttSheet、ReportSheet 和 language packages。

- **Node 端**（`lib/index.js`）—— 在 host web server（`ctx.webServer`）上注册 `/spreadjs` 文件桥。它会在 root 下列出 spreadsheet 文件、流式读取文件字节，并用 `PUT` 写回，始终限制在该 root 内。
- **浏览器端**（`lib/client.js`）—— 通过 `ctx.get('webFileEditors').register(...)` 注册 SpreadJS editor。如果 `webFileEditors` 不存在，浏览器端仍会安全加载，但不会注册任何内容。

## 开源与授权

本仓库中的插件代码使用 MIT 许可证。SpreadJS 本身是 GrapeCity 的商业产品；部署时需要遵守 GrapeCity 许可，并且通常需要提供部署 `licenseKey`。

本仓库有意不提交、不发布生成的 `lib/` 目录。GrapeCity 包声明为 `peerDependencies` 和 `devDependencies`，不作为打包后的运行时产物分发，因此开源 clone 不会重新分发商业二进制。请本地构建后，再把本地 checkout 交给 `dsh plugin` 使用。

## 环境要求

- 同一个 Web profile 中挂载 `dsh-plugin-web-editors`（通用 editor 框架）。
- 兼容的 DeepSeek Harness 版本。
- Node.js 20+。
- 能访问 `@grapecity-software` 19.1.4 npm 包，并持有有效的 GrapeCity 部署许可。

## 从源码安装

```sh
git clone <你的-dsh-plugin-web-editors-仓库>
git clone <你的-dsh-spreadjs-editor-仓库>

cd dsh-plugin-web-editors
npm install
npm run build

cd ../dsh-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-plugin-web-editors
dsh plugin --profile web add ../dsh-spreadjs-editor
```

然后验证并启动：

```sh
dsh --profile web --dump-config
dsh --profile web
```

打开 Web UI、刷新页面，再从 chat 或 editor 面板打开支持的文件。

> **core 扩展点注意：** 完整的 chat `openFile -> webFileEditors` 路由依赖 DeepSeek Harness core 中的 `shell.editor` / `webFileEditors` 扩展点。如果需要 DSH 自己的 chat 文件链接打开 editor 面板，请先 upstream `feat/web-editor-extension-points` 改动，或运行打过 patch 的 DSH 构建。没有该 patch 时，通用插件的 produced-file chips 和面板仍然可用。

## 配置

bundle 的 patch row 接受 `config` 对象（在 `cordis.patch.yml` 中编辑，或在 profile 的 `cordis.patch.yml` 中覆盖该 row）：

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `defaultRoot` | `!!js process.cwd()` | 文件请求没有显式 `root` 时使用的目录。 |
| `licenseKey` | `''` | SpreadJS + Designer 部署 license key。留空时使用 evaluation 构建。 |

通用 editor 会把解析后的文件路径和 session cwd（`root`）传给组件，因此 `/spreadjs` 桥可以始终限制在该 root 内。

## 支持的文件

| 扩展名 | Loader |
| --- | --- |
| `.xlsx` / `.xlsm` | `ExcelIO.IO().open()` -> `fromJSON()` |
| `.sjs` | `spread.open()` / `spread.save()`（SpreadJS 原生格式） |
| `.ssjson` | `fromJSON()` |
| `.csv` | `spread.import()` / `spread.export()` |

文件通过 `/spreadjs/api/file?root=...&path=...` 从 harness host 提供；保存使用同一端点的 `PUT`。Host 会相对所选 root 解析路径，并拒绝任何越界路径（`403`）。

## Editor 行为

- View-first：没有自定义插件工具条；Designer ribbon、公式栏、sheet tabs、右键菜单和工作簿画布就是编辑表面。
- Designer / PivotTable / TableSheet / chart / shape / slicer / print / PDF / barcode / formula panel / data chart / GanttSheet / ReportSheet add-on 会打包进本地构建的 client module。
- Designer 界面通过 `GC.Spread.Sheets.Designer.setTheme` 跟随系统 light/dark 偏好。

## 架构

```
Harness Web profile
 ├─ dsh-plugin-web-editors          通用面板 + webFileEditors 服务
 ├─ cordis.patch.yml                bundle layer：一个 spreadjs-editor host row
 └─ dsh-spreadjs-editor
     ├─ lib/index.js                Node 端 — /spreadjs prefix route（文件桥）
     │    ├─ /api/health            liveness
     │    ├─ /api/roots             默认浏览 root（cwd）
     │    ├─ /api/config            license key
     │    ├─ /api/list?root=        递归列出 spreadsheet 文件
     │    └─ /api/file?root=&path=  读取（GET）与写回（PUT）
     └─ lib/client.js               浏览器端 — closure-factory bundle
          └─ SpreadsheetEditor      webFileEditors.register({ id: 'spreadjs', ... })
```

## 开发

```sh
npm install
npm run typecheck          # tsc --noEmit (strict)
npm test                   # vitest：fs-bridge + node-half routes + client registration
npm run build              # tsdown -> lib/index.js + lib/client.js
node scripts/smoke-node.mjs     # 加载构建后的 node half，驱动所有端点
node scripts/smoke-client.mjs   # 对构建后的 browser half 做结构检查
```

## License

本插件代码使用 MIT。SpreadJS 是 GrapeCity 的商业产品；真实部署 license key 的配置位置见 `cordis.patch.yml` / `/spreadjs/api/config`。
