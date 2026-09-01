# dsh-spreadjs-editor

[English README](../README.md)

一个 DeepSeek Harness Web UI 插件，用来在右侧文件树中直接打开和编辑 Excel / SpreadJS 文件。

## 功能

- 支持 `.xlsx`、`.xlsm`、`.csv`、`.sjs`、`.ssjson` 文件。
- 基于 GrapeCity 官方 SpreadJS 和 SpreadJS Designer，提供完整编辑界面。
- 文件来自 ui-all 右侧文件树，不需要额外的编辑器入口。
- Designer 界面自动跟随系统 light/dark 偏好。

## 环境要求

- 需要 `dsh-better-sidebar` 服务；最简单的方式是挂载 `@linxin666/dsh-web-all`（ui-all）。
- 兼容的 DeepSeek Harness 版本。
- Node.js 20+。

## 安装

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

如果直接使用 npm 而不是 pnpm，`npm install` 会自动完成构建。

## 从源码安装

```sh
git clone https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor.git

cd dsh-plugin-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-plugin-spreadjs-editor
```

## 配置

在 profile 的 `cordis.patch.yml` 中给插件配置 license key：

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS + Designer 部署 license key。留空时使用 evaluation 构建。 |

## 支持的文件

| 扩展名 | 说明 |
| --- | --- |
| `.xlsx` / `.xlsm` | Excel 工作簿 |
| `.csv` | CSV 文本 |
| `.sjs` | SpreadJS 原生工作簿格式 |
| `.ssjson` | SpreadJS JSON 工作簿 |

## 许可

插件代码使用 MIT。SpreadJS 是 GrapeCity 的商业产品，部署时请按 GrapeCity 许可配置真实 license key。

## 维护者

发布新版前，统一把所有 GrapeCity 依赖同步到最新版本：

```sh
npm run grapecity:update -- --latest
```
