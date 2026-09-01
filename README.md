# dsh-spreadjs-editor

[GitHub](https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor) | [中文完整版](https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor/blob/main/docs/README.zh-CN.md)

DeepSeek Harness Web UI 插件：在右侧文件树中直接打开和编辑 Excel / SpreadJS 文件。

A DeepSeek Harness Web UI plugin for opening and editing Excel / SpreadJS files from the right-side file tree.

---

## 中文说明

### 功能

- 支持 `.xlsx`、`.xlsm`、`.csv`、`.sjs`、`.ssjson` 文件。
- 基于 GrapeCity 官方 SpreadJS 和 SpreadJS Designer，提供完整编辑界面。
- 文件来自 ui-all 右侧文件树，不需要额外的编辑器入口。
- Designer 界面自动跟随系统 light/dark 偏好。

### 环境要求

- 需要 `dsh-better-sidebar` 服务；最简单的方式是挂载 `@linxin666/dsh-web-all`（ui-all）。
- 兼容的 DeepSeek Harness 版本。
- Node.js 20+。

### 安装

DSH 的 Web profile 使用 pnpm 10，而 pnpm 10 默认会拦截依赖包的生命周期脚本。安装前先放行本包：

```yaml
# ~/.dsh/profiles/web/pnpm-workspace.yaml
onlyBuiltDependencies:
  - dsh-spreadjs-editor
```

然后添加插件并启动：

```sh
dsh plugin --profile web add dsh-spreadjs-editor
dsh web
```

安装时会自动构建 SpreadJS 客户端，用户不需要手动执行 `npm run build`。如果已经先装好插件、后来才补放行配置，执行一次：

```sh
pnpm --dir ~/.dsh/profiles/web rebuild dsh-spreadjs-editor
```

如果使用 npx 运行 DSH：

```sh
npx --yes @deepseek-ai/dsh@latest plugin --profile web add dsh-spreadjs-editor
npx --yes @deepseek-ai/dsh@latest web
```

DeepSeek Harness CLI 是 `@deepseek-ai/dsh`，不要使用同名包 `dsh`。

对 DSH 用户来说，上面的 `dsh plugin --profile web add` 就是安装插件的命令，它已经通过 pnpm 完成依赖安装和自动构建，不需要再单独运行 `npm install`。只有在普通 Node 项目中通过 npm 直接引入这个包时，`npm install` 才会自动触发同样的构建。

### 从源码安装

```sh
git clone https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor.git

cd dsh-plugin-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-plugin-spreadjs-editor
```

### 配置

在 profile 的 `cordis.patch.yml` 中给插件配置 license key：

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS + Designer 部署 license key。留空时使用 evaluation 构建。 |

### 支持的文件

| 扩展名 | 说明 |
| --- | --- |
| `.xlsx` / `.xlsm` | Excel 工作簿 |
| `.csv` | CSV 文本 |
| `.sjs` | SpreadJS 原生工作簿格式 |
| `.ssjson` | SpreadJS JSON 工作簿 |

### 许可

插件代码使用 MIT。SpreadJS 是 GrapeCity 的商业产品，部署时请按 GrapeCity 许可配置真实 license key。

---

## English

### Features

- Opens `.xlsx`, `.xlsm`, `.csv`, `.sjs`, and `.ssjson` files.
- Built on GrapeCity's official SpreadJS and SpreadJS Designer with a full editing surface.
- Files come from the ui-all right-side file tree; no separate editor entry point is required.
- The Designer follows the OS light/dark preference.

### Requirements

- `dsh-better-sidebar` must be available; mounting `@linxin666/dsh-web-all` (ui-all) is the easiest way.
- A compatible DeepSeek Harness release.
- Node.js 20+.

### Install

DSH's Web profile uses pnpm 10, which blocks dependency lifecycle scripts by default. Allow this package before installing:

```yaml
# ~/.dsh/profiles/web/pnpm-workspace.yaml
onlyBuiltDependencies:
  - dsh-spreadjs-editor
```

Then add the plugin and start DSH:

```sh
dsh plugin --profile web add dsh-spreadjs-editor
dsh web
```

The SpreadJS client is built automatically during install; users do not need to run `npm run build`. If the package was already installed before the allow-list entry was added, run once:

```sh
pnpm --dir ~/.dsh/profiles/web rebuild dsh-spreadjs-editor
```

If you run DSH through npx:

```sh
npx --yes @deepseek-ai/dsh@latest plugin --profile web add dsh-spreadjs-editor
npx --yes @deepseek-ai/dsh@latest web
```

Use `@deepseek-ai/dsh`, not the unrelated npm package `dsh`.

For DSH users, `dsh plugin --profile web add` is the install command; it installs dependencies through pnpm and runs the automatic build, so no separate `npm install` is needed. The npm note only applies if you add this package directly to a normal Node project, where `npm install` triggers the same build automatically.

### Install from GitHub

```sh
git clone https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor.git

cd dsh-plugin-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-plugin-spreadjs-editor
```

### Configuration

Set the license key for this plugin in the profile's `cordis.patch.yml`:

| Key | Default | Description |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS + Designer deployment license key. Empty runs the evaluation build. |

### Supported files

| Extension | Description |
| --- | --- |
| `.xlsx` / `.xlsm` | Excel workbook |
| `.csv` | CSV text |
| `.sjs` | SpreadJS native workbook format |
| `.ssjson` | SpreadJS JSON workbook |

### License

MIT for the plugin code. SpreadJS is a commercial product by GrapeCity; configure a real license key for deployment.

### Maintainers

Before a new release, sync all GrapeCity dependencies to the latest version:

```sh
npm run grapecity:update -- --latest
```
