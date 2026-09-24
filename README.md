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
- 编辑后可直接保存回原文件：原子写入、限制在会话工作区内、带冲突检测。
- 编辑器跟随系统切换浅色和深色主题。

### 内置版本与文件兼容性

| 组件 | 内置版本 |
| --- | --- |
| SpreadJS | 19.1.4 |
| SpreadJS Designer | 19.1.4 |

编辑器底部显示 SpreadJS 版本号。低版本 SpreadJS 可能无法打开本版本保存的 `.sjs` 或 `.ssjson` 文件；与旧版系统交换文件时，建议保留原文件并确认兼容性。

### 安装

需要 DSH `>=0.1.5-rc.3`。插件使用 DSH 自带的右侧栏，**不需要安装任何第三方侧边栏插件**。

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

### 保存

面板顶部有 **Save** 按钮，Designer 的「文件」菜单也收敛成同一个动作——你想按哪个都行。改动写回你打开的那个文件，不会再问你"要不要保存"，因为按下保存本身就是你的意图。

- **「文件」菜单只剩一个保存动作。** Designer 默认的保存是"弹框下载到本地"（文件菜单里那套「SpreadJS 文件 + 文件名 + .sjs」就是它的另存操作）。插件在构造设计器前改写文件菜单模板：左侧只保留「保存」一项，右侧该面板只保留标题和我们的「保存到工作区」按钮，其余分类（新建/打开/导入/导出/打印/信息）与分隔线整类移除。需要一份副本时，用 DSH 自己的文件下载即可。
- **工作簿还没载入完时不让保存。** 载入中的工作簿是空的，此时保存会用空表覆盖原文件；按钮在载入完成前不可用，保存命令也会拒绝并说明。
- **不会冲掉别人的修改。** 打开文件时插件记下其内容哈希；保存前重新比对，若磁盘上的文件在此期间被改过（Agent 改过、你在别处存过），保存会被拒绝并说明原因，而不是覆盖掉那些改动。
- **不会写出半个文件。** 同目录临时文件写完后 rename 覆盖，其他程序任何时候读到的都是完整文件。
- **写不出工作区。** 目标必须在当前会话的工作区内，越界（含 `..` 逃逸）直接拒绝。
- **只有循环回环地址可用。** 保存接口与 DSH 其它接口一样只服务本机来源；通过局域网地址访问时，需要把该地址加进 `trustedHosts`。

### 配合 AI 使用：让 Agent 改你正在看的表

再装上 [`@grapecity-software/dsh-spreadjs-driver`](https://www.npmjs.com/package/@grapecity-software/dsh-spreadjs-driver)，就可以直接对 Agent 说"把金额列改成红色"——改动**立刻出现在你正看着的这张表上**。

```sh
dsh plugin --profile web add @grapecity-software/dsh-spreadjs-driver
```

- **改的是同一个对象，不是文件副本。** 编辑器把当前工作簿交给该插件的 `spreadjsHostBridge` 服务；两个插件的浏览器半跑在同一个页面里，所以改动直接落在 Designer 正在渲染的那份文档上——**不会覆盖你尚未保存的编辑**（这一点是按文件走的路子给不了的）。
- **磁盘上的文件不动。** 改动只活在编辑器里，除非你明确要求保存——所以你有机会先看清楚，再决定要不要落盘。
- **只有它拿得到。** 工作簿是编辑器**主动交出去**的，不存在"查找别人的工作簿"这类入口，同页面上的其他插件够不到。
- 该插件本身还带一整套表格工具（新建、导入、导出 `.xlsx` / `.csv` / `.pdf`、截图），**不装编辑器也能单独使用**。

> 需要本插件 **0.2.0 或更高版本**——更早的版本里没有这个桥，装上 driver 也不会有联动。

### 配置

如已获得许可证，在 web profile 的 `cordis.patch.yml` 中添加以下配置：

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS 部署许可证。留空以带水印的试用模式运行。 |
| `designerLicenseKey` | `''` | 独立的 SpreadJS Designer 部署许可证。留空保持 Designer 试用状态。 |
| `maxSaveBytes` | `67108864` | 单次保存允许的最大字节数；超出直接拒绝，不做截断。 |
| `trustedHosts` | `[]` | 除本机回环地址外，额外允许调用保存接口的地址（局域网部署时使用）。 |

```yaml
- id: spreadjs-editor
  config:
    licenseKey: 'YOUR_SPREADJS_KEY'
    designerLicenseKey: 'YOUR_DESIGNER_KEY'
```

修改后重启 DSH 并刷新网页。

### 验证

| 命令 | 验证内容 |
| --- | --- |
| `npm run typecheck`、`npm test` | 类型契约，以及 53 个单元测试（保存路由的每条守卫、文件地址解析，以及保存命令重定向的每条分支） |
| `node scripts/smoke-client.mjs` | 构建后的浏览器半结构：loader 包装、内联的 SpreadJS 与样式、外部依赖只有 react |
| `node scripts/smoke-node.mjs` | 构建后的宿主半：路由注册、许可证配置，以及保存路径的真实写盘、冲突与越界拒绝 |
| `npm run probe:live` | **对着正在运行的 DSH** 跑一遍真实保存：真实 `ctx.fs` 的解析、落盘、冲突守卫、工作区越界 |

`npm run probe:live` 要求 DSH 已重启到本版本；如果它报 404，说明进程里还是旧的宿主半。可选参数：`--url`（默认 `http://127.0.0.1:3080`）、`--session <id>`、`--home <DSH_HOME>`。探针会在会话工作区内建一个临时文件，结束时删除。

### 许可

插件代码免费提供，采用 [MIT 许可证](LICENSE)。内置的 SpreadJS 和 Designer 是葡萄城商业产品，未配置许可证时可按其试用条款体验；插件免费不包含这两个产品的商业授权。

如用于正式部署或 SaaS 服务，请根据使用场景获取适用的 SpreadJS 和 Designer 授权。

---

## English

### Features

- Opens `.xlsx`, `.xlsm`, `.csv`, `.sjs`, and `.ssjson` files.
- Open workbooks from the file tree and edit them with SpreadJS Designer.
- Save edits straight back to the file: atomic, confined to the session workspace, with conflict detection.
- Follows the system's light or dark theme.

### Bundled Versions and File Compatibility

| Component | Bundled version |
| --- | --- |
| SpreadJS | 19.1.4 |
| SpreadJS Designer | 19.1.4 |

The editor status bar shows the SpreadJS version. Older SpreadJS versions may not open `.sjs` or `.ssjson` files saved by this version. When exchanging files with older systems, keep the original files and check compatibility.

### Installation

Requires DSH `>=0.1.5-rc.3`. The plugin uses the harness's own right Sidebar and needs **no third-party sidebar plugin**.

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

### Saving

The panel's header carries a **Save** button, and the Designer's File tab is reduced to the same action, so either one writes your changes back to the file you opened. There is no second prompt, because pressing Save *is* the intent.

- **The File tab is reduced to one Save action.** The Designer's default Save is a dialog that downloads a file — in the File tab that is the "SpreadJS file, filename, .sjs" form. Before building the Designer the plugin rewrites the menu template: the nav keeps only Save, that panel keeps its heading plus our **保存到工作区** (save to workspace) button, and the other categories (new, open, import, export, print, info) and their separators are removed outright. A copy is what the harness's own file download is for.
- **A workbook that is still loading cannot be saved.** It has no content yet, so saving would overwrite the file with an empty book; the button stays disabled until the load finishes, and the command refuses with an explanation.
- **It will not clobber someone else's edit.** The plugin records the file's content hash when it opens it and re-checks before writing; if the file changed in the meantime (an agent edited it, you saved it elsewhere), the save is refused with an explanation instead of overwriting those changes.
- **It never leaves half a file.** A same-directory temporary file is renamed over the target, so any other reader always sees a complete workbook.
- **It cannot write outside the workspace.** The target must sit inside the current session's workspace; anything else — including `..` escapes — is refused.
- **Loopback only.** The save endpoint serves the local machine like the rest of DSH. If you reach DSH through a LAN address, add that address to `trustedHosts`.

### Let the agent edit the sheet you are looking at

Install [`@grapecity-software/dsh-spreadjs-driver`](https://www.npmjs.com/package/@grapecity-software/dsh-spreadjs-driver) alongside this plugin, and you can simply ask the agent — "make the amount column red" — and **watch the change land on the sheet you have open**.

```sh
dsh plugin --profile web add @grapecity-software/dsh-spreadjs-driver
```

- **It edits the same object, not a copy of the file.** The editor hands its current workbook to that plugin's `spreadjsHostBridge` service. Both plugins' browser halves run in the same page, so the change lands on the very document the Designer is rendering — and it **does not clobber edits you have not saved**, which a file-based route cannot promise.
- **The file on disk is not touched.** The change lives in the editor until you explicitly ask for a save, so you get to look before deciding.
- **Only that plugin can reach it.** The workbook is handed over *by the editor*; there is no way to go looking for somebody else's workbook, so other plugins on the page cannot touch it.
- That plugin also brings a full set of spreadsheet tools of its own (create, import, export `.xlsx` / `.csv` / `.pdf`, screenshot) and **works on its own without the editor**.

> Requires this plugin **0.2.0 or later** — earlier versions have no bridge, so installing the driver alongside them changes nothing.

### Configuration

If you have licenses, add the following to the web profile's `cordis.patch.yml`:

| Key | Default | Description |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS deployment key. Empty runs in evaluation mode with a watermark. |
| `designerLicenseKey` | `''` | Separate SpreadJS Designer deployment key. Empty keeps Designer in evaluation mode. |
| `maxSaveBytes` | `67108864` | Largest payload one save may carry; a bigger one is refused, never truncated. |
| `trustedHosts` | `[]` | Extra authorities allowed to call the save endpoint, beyond loopback (for LAN deployments). |

```yaml
- id: spreadjs-editor
  config:
    licenseKey: 'YOUR_SPREADJS_KEY'
    designerLicenseKey: 'YOUR_DESIGNER_KEY'
```

Restart DSH and refresh the browser after changing the configuration.

### Verification

| Command | What it proves |
| --- | --- |
| `npm run typecheck`, `npm test` | The type contract, and 53 unit tests: every save guard, file-address parsing, and every branch of the Save-command redirect |
| `node scripts/smoke-client.mjs` | The built browser half's structure: loader wrapper, inlined SpreadJS and styles, react as the only runtime external |
| `node scripts/smoke-node.mjs` | The built host half: route registration, license config, and the save path writing real bytes plus refusing conflicts and escapes |
| `npm run probe:live` | A real save against a **running DSH**: the actual `ctx.fs` resolving, writing, refusing a stale base hash, and refusing a workspace escape |

`npm run probe:live` needs DSH restarted onto this version; a 404 from it means the running process still carries the old host half. Options: `--url` (default `http://127.0.0.1:3080`), `--session <id>`, `--home <DSH_HOME>`. The probe creates one temporary file inside the session workspace and deletes it.

### License

The plugin code is free under the [MIT license](LICENSE). Bundled SpreadJS and Designer are GrapeCity commercial products available for evaluation under their trial terms without license keys. The free plugin does not include commercial licenses for these products.

For production or SaaS deployments, obtain SpreadJS and Designer licenses appropriate to your use.
