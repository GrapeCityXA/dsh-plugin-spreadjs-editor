# dsh-spreadjs-editor

[English README](README.md)

一个 view-first 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI 插件，同时适配 `dsh-better-sidebar`（ui-all 自带）和 `dsh-plugin-web-editors` 两套文件编辑表面。推荐每个 profile 只装其中一套；双适配模式保留给迁移和临时验证，不推荐用户同时使用。

浏览器端使用当前 GrapeCity npm scope 和 **19.1.4** 包组：`@grapecity-software/spread-sheets`、`spread-sheets-io`、`spread-excelio`、Designer、中文资源、PivotTable、TableSheet、charts、shapes、slicers、sparklines、print/PDF、barcode、formula panel、data charts、GanttSheet、ReportSheet 和 language packages。

- **Node 端**（`lib/index.js`）—— 在 host web server（`ctx.webServer`）上注册 `/spreadjs` 配置端点，并为 `webFileEditors` 适配保留文件桥。
- **浏览器端**（`lib/client.js`）—— 通过 `ctx.get('betterSidebar').registerFileViewer(...)` 注册 ui-all viewer，通过 `ctx.get('webFileEditors').register(...)` 注册纯净 web-editors editor。两个服务都按需等待，没有硬依赖。
- **查找文件** —— ui-all 模式下从右侧文件树打开 spreadsheet 文件；web-editors 模式下从通用文件选择器打开。两种模式都注册 `.xlsx`、`.xlsm`、`.csv`、`.sjs` 和 `.ssjson`。

## 适配器选择（重要）

**不要为了 SpreadJS 同时安装 ui-all 和 `dsh-plugin-web-editors`。** 两个组件同时存在时，文件树、chat 产物链接、header 入口会各自出现一套 SpreadJS 打开方式，用户很难判断当前应该用哪一个，保存路径和面板行为也不一致。

请按部署场景二选一：

| 场景 | 安装 | `preferViewer` |
| --- | --- | --- |
| 商业 / 纯净 / 交互可控 | `dsh-plugin-web-editors` | `webFileEditors` |
| 个人 / ui-all / 文件树体验 | `@linxin666/dsh-web-all` | `betterSidebar` |

双适配代码保留给从 web-editors 迁移到 ui-all 的过渡期。如果 profile 里确实同时存在两套服务，默认只注册 `webFileEditors`；需要 ui-all 时显式设置 `preferViewer: betterSidebar`。`auto` 会同时注册两个入口，只用于迁移测试。

## 开源与授权

本仓库中的插件代码使用 MIT 许可证。SpreadJS 本身是 GrapeCity 的商业产品；部署时需要遵守 GrapeCity 许可，并且通常需要提供部署 `licenseKey`。

本仓库有意不提交、不发布生成的 `lib/` 目录。GrapeCity 包声明为 `peerDependencies` 和 `devDependencies`，不作为打包后的运行时产物分发，因此开源 clone 不会重新分发商业二进制。请本地构建后，再把本地 checkout 交给 `dsh plugin` 使用。

## 环境要求

- 同一个 Web profile 中挂载 `@linxin666/dsh-web-all`（ui-all / `dsh-better-sidebar`）或 `dsh-plugin-web-editors`；建议只装其中一套，不要两套同时启用。
- 兼容的 DeepSeek Harness 版本。
- Node.js 20+。
- 能访问 `@grapecity-software` 19.1.4 npm 包，并持有有效的 GrapeCity 部署许可。

## 从源码安装

```sh
# ui-all 和 dsh-plugin-web-editors 二选一，不要同时安装
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

打开 Web UI、刷新页面，再从 chat 或 editor 面板打开支持的文件。

不需要任何 DSH core 改动。插件会监听两个可选 client service，出现哪个就把 SpreadJS 注册到哪个。两套都被安装时默认只使用 `webFileEditors`；ui-all 环境请显式配置 `preferViewer: betterSidebar`。

## 配置

bundle 的 patch row 接受 `config` 对象（在 `cordis.patch.yml` 中编辑，或在 profile 的 `cordis.patch.yml` 中覆盖该 row）：

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `defaultRoot` | `!!js process.cwd()` | 文件请求没有显式 `root` 时使用的目录。 |
| `licenseKey` | `''` | SpreadJS + Designer 部署 license key。留空时使用 evaluation 构建。 |
| `preferViewer` | `webFileEditors` | 双装时的适配器选择：`webFileEditors`（默认，商业/纯净）、`betterSidebar`（ui-all）或 `auto`（两者都注册，仅迁移测试）。 |

ui-all 适配层使用 better-sidebar 传入的 session cwd 和路径构造 `/sidebar/file` 与 `/sidebar/upload` 请求；旧版 `webFileEditors` 适配保留 `/spreadjs` 桥的 root 限制。

## 支持的文件

| 扩展名 | Loader |
| --- | --- |
| `.xlsx` / `.xlsm` | `ExcelIO.IO().open()` -> `fromJSON()` |
| `.sjs` | `spread.open()` / `spread.save()`（SpreadJS 原生格式） |
| `.ssjson` | `fromJSON()` |
| `.csv` | `spread.import()` / `spread.export()` |

ui-all 模式通过 better-sidebar 的 `/sidebar/file` / `/sidebar/upload` session 路由读取和写回；web-editors 模式通过 `/spreadjs/api/file?root=...&path=...` 读取与保存。Host 会相对所选 root 解析路径，并拒绝任何越界路径（`403`）。

## Editor 行为

- View-first：没有自定义插件工具条；Designer ribbon、公式栏、sheet tabs、右键菜单和工作簿画布就是编辑表面。
- Designer / PivotTable / TableSheet / chart / shape / slicer / print / PDF / barcode / formula panel / data chart / GanttSheet / ReportSheet add-on 会打包进本地构建的 client module。
- Designer 界面通过 `GC.Spread.Sheets.Designer.setTheme` 跟随系统 light/dark 偏好。

## 架构

```
Harness Web profile
 ├─ @linxin666/dsh-web-all          可选：ui-all 右侧文件树 + ctx.betterSidebar
 ├─ dsh-plugin-web-editors          可选：纯净 webFileEditors 面板
 ├─ cordis.patch.yml                bundle layer：一个 spreadjs-editor host row
 └─ dsh-spreadjs-editor
     ├─ lib/index.js                Node 端 — /spreadjs prefix route（license/config + web-editors 文件桥）
     │    ├─ /api/health            liveness
     │    ├─ /api/roots             默认浏览 root（cwd）
     │    ├─ /api/config            license key
     │    ├─ /api/list?root=        递归列出 spreadsheet 文件（web-editors）
     │    └─ /api/file?root=&path=  读取与写回（web-editors）
     └─ lib/client.js               浏览器端 — closure-factory bundle
          ├─ SpreadsheetViewer      betterSidebar.registerFileViewer({ id: 'spreadjs', ... })
          └─ SpreadsheetEditor      webFileEditors.register({ id: 'spreadjs', ... })
```

上图中的两条可选客户端路径分别对应两套部署；生产 profile 通常只保留其中一条。只有迁移/临时验证时才同时挂载；默认只注册 `webFileEditors`，ui-all 环境需显式设 `preferViewer: betterSidebar`。

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
