# SpreadJS Editor for DeepSeek Harness

[GitHub](https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor) · npm: `@grapecity-software/dsh-spreadjs-editor`

[版本记录 / Release Notes](CHANGELOG.md)

在 DeepSeek Harness Web UI 里，直接在右侧文件树中打开、查看和编辑 Excel / SpreadJS 文件。

A DeepSeek Harness Web UI plugin that opens, views, and edits Excel / SpreadJS files directly from the right-side file tree.

![SpreadJS editor opened in DeepSeek Harness Web UI](https://raw.githubusercontent.com/GrapeCityXA/dsh-plugin-spreadjs-editor/main/assets/dsh-spreadjs-editor.png)

---

## 中文说明

### 功能

- 支持 `.xlsx`、`.xlsm`、`.csv`、`.sjs`、`.ssjson` 文件。
- 从文件树打开工作簿，使用 SpreadJS Designer 编辑表格。
- 编辑器跟随系统切换浅色和深色主题。

### 内置版本与文件兼容性

| 组件 | 内置版本 |
| --- | --- |
| SpreadJS | 19.1.4 |
| SpreadJS Designer | 19.1.4 |

编辑器底部显示 SpreadJS 版本号。低版本 SpreadJS 可能无法打开本版本保存的 `.sjs` 或 `.ssjson` 文件；与旧版系统交换文件时，建议保留原文件并确认兼容性。

### 安装

需要 DSH `>=0.1.2-rc.1`，并已安装 `@linxin666/dsh-web-all`（ui-all）。

插件内置 SpreadJS 和 Designer，无需编译。使用已安装的 DSH CLI 安装并启动：

```sh
dsh plugin --profile web add @grapecity-software/dsh-spreadjs-editor
dsh --profile web
```

启动后，在 Web UI 右侧文件树中打开 `.xlsx`、`.xlsm`、`.csv`、`.sjs` 或 `.ssjson` 文件即可。

也可以通过 npx 安装并启动：

```sh
npx --yes @deepseek-ai/dsh@latest plugin --profile web add @grapecity-software/dsh-spreadjs-editor
npx --yes @deepseek-ai/dsh@latest --profile web
```

旧版本用户请参阅[升级说明](CHANGELOG.md)。

### 配合 AI 使用：让 Agent 改你正在看的表

再装上 [`@grapecity-software/dsh-spreadjs-driver`](https://www.npmjs.com/package/@grapecity-software/dsh-spreadjs-driver)，就可以直接对 Agent 说"把金额列改成红色"——改动**立刻出现在你正看着的这张表上**。

```sh
dsh plugin --profile web add @grapecity-software/dsh-spreadjs-driver
```

- **改的是同一个对象，不是文件副本。** 编辑器把当前工作簿交给该插件的 `spreadjsHostBridge` 服务；两个插件的浏览器半跑在同一个页面里，所以改动直接落在 Designer 正在渲染的那份文档上——**不会覆盖你尚未保存的编辑**（这一点是按文件走的路子给不了的）。
- **磁盘上的文件不动。** 改动只活在编辑器里，除非你明确要求保存——所以你有机会先看清楚，再决定要不要落盘。
- **只有它拿得到。** 工作簿是编辑器**主动交出去**的，不存在"查找别人的工作簿"这类入口，同页面上的其他插件够不到。
- 该插件本身还带一整套表格工具（新建、导入、导出 `.xlsx` / `.csv` / `.pdf`、截图），**不装编辑器也能单独使用**。

> 需要本插件 **0.1.5 或更高版本**——更早的版本里没有这个桥，装上 driver 也不会有联动。

### 配置

如已获得许可证，在 web profile 的 `cordis.patch.yml` 中添加以下配置：

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS 部署许可证。留空以带水印的试用模式运行。 |
| `designerLicenseKey` | `''` | 独立的 SpreadJS Designer 部署许可证。留空保持 Designer 试用状态。 |

```yaml
- id: spreadjs-editor
  config:
    licenseKey: 'YOUR_SPREADJS_KEY'
    designerLicenseKey: 'YOUR_DESIGNER_KEY'
```

修改后重启 DSH 并刷新网页。

### 许可

插件代码免费提供，采用 [MIT 许可证](LICENSE)。内置的 SpreadJS 和 Designer 是葡萄城商业产品，未配置许可证时可按其试用条款体验；插件免费不包含这两个产品的商业授权。

如用于正式部署或 SaaS 服务，请根据使用场景获取适用的 SpreadJS 和 Designer 授权。

---

## English

### Features

- Opens `.xlsx`, `.xlsm`, `.csv`, `.sjs`, and `.ssjson` files.
- Open workbooks from the file tree and edit them with SpreadJS Designer.
- Follows the system's light or dark theme.

### Bundled Versions and File Compatibility

| Component | Bundled version |
| --- | --- |
| SpreadJS | 19.1.4 |
| SpreadJS Designer | 19.1.4 |

The editor status bar shows the SpreadJS version. Older SpreadJS versions may not open `.sjs` or `.ssjson` files saved by this version. When exchanging files with older systems, keep the original files and check compatibility.

### Installation

Requires DSH `>=0.1.2-rc.1` with `@linxin666/dsh-web-all` (ui-all) installed.

The plugin includes SpreadJS and Designer, with no build step required. With the DSH CLI installed:

```sh
dsh plugin --profile web add @grapecity-software/dsh-spreadjs-editor
dsh --profile web
```

After startup, open `.xlsx`, `.xlsm`, `.csv`, `.sjs`, or `.ssjson` from the right-side file tree.

Alternatively, install and start through npx:

```sh
npx --yes @deepseek-ai/dsh@latest plugin --profile web add @grapecity-software/dsh-spreadjs-editor
npx --yes @deepseek-ai/dsh@latest --profile web
```

For upgrades, see the [release notes](CHANGELOG.md).

### Let the agent edit the sheet you are looking at

Install [`@grapecity-software/dsh-spreadjs-driver`](https://www.npmjs.com/package/@grapecity-software/dsh-spreadjs-driver) alongside this plugin, and you can simply ask the agent — "make the amount column red" — and **watch the change land on the sheet you have open**.

```sh
dsh plugin --profile web add @grapecity-software/dsh-spreadjs-driver
```

- **It edits the same object, not a copy of the file.** The editor hands its current workbook to that plugin's `spreadjsHostBridge` service. Both plugins' browser halves run in the same page, so the change lands on the very document the Designer is rendering — and it **does not clobber edits you have not saved**, which a file-based route cannot promise.
- **The file on disk is not touched.** The change lives in the editor until you explicitly ask for a save, so you get to look before deciding.
- **Only that plugin can reach it.** The workbook is handed over *by the editor*; there is no way to go looking for somebody else's workbook, so other plugins on the page cannot touch it.
- That plugin also brings a full set of spreadsheet tools of its own (create, import, export `.xlsx` / `.csv` / `.pdf`, screenshot) and **works on its own without the editor**.

> Requires this plugin **0.1.5 or later** — earlier versions have no bridge, so installing the driver alongside them changes nothing.

### Configuration

If you have licenses, add the following to the web profile's `cordis.patch.yml`:

| Key | Default | Description |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS deployment key. Empty runs in evaluation mode with a watermark. |
| `designerLicenseKey` | `''` | Separate SpreadJS Designer deployment key. Empty keeps Designer in evaluation mode. |

```yaml
- id: spreadjs-editor
  config:
    licenseKey: 'YOUR_SPREADJS_KEY'
    designerLicenseKey: 'YOUR_DESIGNER_KEY'
```

Restart DSH and refresh the browser after changing the configuration.

### License

The plugin code is free under the [MIT license](LICENSE). Bundled SpreadJS and Designer are GrapeCity commercial products available for evaluation under their trial terms without license keys. The free plugin does not include commercial licenses for these products.

For production or SaaS deployments, obtain SpreadJS and Designer licenses appropriate to your use.
