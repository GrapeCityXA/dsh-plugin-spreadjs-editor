# dsh-spreadjs-editor

[English README](../README.md)

在 DeepSeek Harness Web UI 里，直接在右侧文件树中打开、查看和编辑 Excel / SpreadJS 文件。

## 功能

- 支持 `.xlsx`、`.xlsm`、`.csv`、`.sjs`、`.ssjson` 文件。
- 基于 GrapeCity 官方 SpreadJS 和 SpreadJS Designer，提供完整的表格编辑能力。
- 与 ui-all 文件树集成，打开文件后立即进入编辑界面，不需要单独的编辑器页面。
- Designer 界面自动跟随系统 light/dark 偏好。

## 快速开始

DSH 的 Web profile 使用 pnpm 10，而 pnpm 10 默认会拦截依赖包的生命周期脚本。安装前先把本包加入放行列表。

编辑 Web profile 的 `pnpm-workspace.yaml`，通常位于：

```text
~/.dsh/profiles/web/pnpm-workspace.yaml
```

加入以下内容：

```yaml
onlyBuiltDependencies:
  - dsh-spreadjs-editor
```

然后安装插件并启动：

```sh
dsh plugin --profile web add dsh-spreadjs-editor
dsh web
```

启动后，在 Web UI 右侧文件树中打开 `.xlsx`、`.xlsm`、`.csv`、`.sjs` 或 `.ssjson` 文件即可。

安装阶段会自动生成 SpreadJS 客户端，不需要再执行 `npm install` 或 `npm run build`。

如果使用 npx 运行 DSH，使用同样的命令：

```sh
npx --yes @deepseek-ai/dsh@latest plugin --profile web add dsh-spreadjs-editor
npx --yes @deepseek-ai/dsh@latest web
```

DeepSeek Harness CLI 是 `@deepseek-ai/dsh`，不要使用同名 npm 包 `dsh`。

如果插件已经装好、之后才补放行配置，补一次构建即可：

```sh
pnpm --dir ~/.dsh/profiles/web rebuild dsh-spreadjs-editor
```

## 常见问题

**我已经有 ui-all，还需要额外安装什么吗？**

不需要。ui-all 自带 `dsh-better-sidebar`，本插件会直接注册到它。

**安装完还需要手动构建吗？**

不需要。只要安装前放行过 `onlyBuiltDependencies`，`dsh plugin add` 会同时完成安装和构建。

**SpreadJS 会跟随每次安装自动升级吗？**

不会自动跨版本升级。所有 GrapeCity 官方包在 `package.json` 中锁定为同一版本；维护者会在发布新版时统一同步。

## 配置

正式部署时，在 profile 的 `cordis.patch.yml` 中配置 license key：

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS + Designer 部署 license key。留空时使用 evaluation 构建。 |

## 支持的文件

| 文件 | 说明 |
| --- | --- |
| `.xlsx` / `.xlsm` | Excel 工作簿 |
| `.csv` | CSV 文本 |
| `.sjs` | SpreadJS 原生工作簿格式 |
| `.ssjson` | SpreadJS JSON 工作簿 |

## 从源码安装

如果你需要从源码运行或参与开发：

```sh
git clone https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor.git

cd dsh-plugin-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-plugin-spreadjs-editor
```

## 许可

插件代码使用 MIT。SpreadJS 是 GrapeCity 的商业产品，正式部署时请配置真实 license key。

## 维护者

发布新版前，统一把所有 GrapeCity 依赖同步到最新版本：

```sh
npm run grapecity:update -- --latest
```
