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
- 编辑器跟随 DSH 的浅色/深色主题，工具栏与工作表区域一起变；DSH 偏好设为「跟随系统」时自然跟着系统走。
- 「设置」标签里有「关于」按钮：内置版本、授权状态与版权信息在弹窗里。

### 内置版本与文件兼容性

| 组件 | 内置版本 |
| --- | --- |
| SpreadJS | 19.2.0 |
| SpreadJS Designer | 19.2.0 |

内置版本、授权状态与版权信息在 Designer「设置」标签的「关于」弹窗里。低版本 SpreadJS 可能无法打开本版本保存的 `.sjs` 或 `.ssjson` 文件；与旧版系统交换文件时，建议保留原文件并确认兼容性。

### 安装

需要 DSH `>=0.1.5-rc.3`。插件使用 DSH 自带的右侧栏，**不需要安装任何第三方侧边栏插件**。

| DSH 版本 | 状态 | 说明 |
| --- | --- | --- |
| `0.1.7-rc.2` | ✅ 构建与验收基线 | `typecheck`、119 项单测、两个 smoke、`verify:package`、`probe:live` 全部通过（`probe:live` 的版本核对需要先重启 DSH，见下文） |
| `0.1.6.x` | ⚪ 未验证 | 没有核对过这个区间的平台：既未逐项跑验收，也不确定它是否已提供下表中的两项能力 |
| `0.1.5-rc.3` | ✅ 上一版验收基线 | 插件最初就是对着它构建并验收的；它会忽略「二进制后缀」声明，查看方式列表里仍可能出现纯文本一项 |

`0.1.7` 起平台提供了两样本插件会用到的能力：文档定义里的**二进制后缀**声明（决定是否还提供纯文本查看方式），以及内置的只读 Excel 预览（会与本插件并列出现在查看方式列表里）。插件在 `0.1.5-rc.3` 上照常工作，只是拿不到这两点。

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

保存只有一处入口：Designer「文件」菜单里的「保存到工作区」，就在原本内置"另存为 .sjs"那颗按钮的位置上。改动写回你打开的那个文件，不会再问你"要不要保存"，因为按下保存本身就是你的意图。

- **「文件」菜单只剩一个保存动作。** Designer 原本的保存是「弹框下载到本地」；本插件把它换成写回你打开的那个文件，菜单里只保留这一个动作，新建、打开、导入、导出、打印、信息等分类一并移除。需要一份副本时，用 DSH 自己的文件下载即可。
- **工作簿还没载入完时不让保存。** 载入中的工作簿是空的，此时保存会用空表覆盖原文件；载入完成前保存命令会拒绝并说明。
- **不会冲掉别人的修改。** 打开文件时插件记下其内容哈希；保存前重新比对，若磁盘上的文件在此期间被改过（Agent 改过、你在别处存过），保存会被拒绝并说明原因，而不是覆盖掉那些改动。
- **不会写出半个文件。** 同目录临时文件写完后 rename 覆盖，其他程序任何时候读到的都是完整文件。
- **写不出工作区。** 目标必须在当前会话的工作区内，越界（含 `..` 逃逸）直接拒绝。
- **只有循环回环地址可用。** 保存接口与 DSH 其它接口一样只服务本机来源；通过局域网地址访问时，需要把该地址加进 `trustedHosts`。

### 未保存的改动

DSH 在标签页被切走时会卸载文档主体，平台也没有可供拦下的关闭钩子（关闭是同步的，文档定义里既无生命周期也没有否决点），所以这里**不做「确认离开」的拦截**，而是保证不丢：

- **切走再切回不丢。** 有未保存改动的工作簿会在主体卸载前留成一份快照，切回同一个标签页时原样恢复，不需要重新读盘。
- **关掉标签页也不丢。** 快照同时按文件路径保留；重新打开同一个文件时，只要磁盘上的文件仍是快照写下的那一版，就自动恢复，并在面板顶部说明来源。
- **文件被外部改过时不默默套用。** 若磁盘上的文件已经变了（Agent 改过、你在别处存过），面板顶部会提示「存在未保存的改动缓存，但文件已在磁盘上被修改」，由你选择**恢复**（用缓存继续，之后保存即写入磁盘）或**丢弃**（重新读盘）。
- **看得见。** 面板顶部有一行常驻状态：有未保存改动时显示「未保存的改动」并提供「丢弃」，保存成功后回到「已保存」。这行始终占位，所以开始编辑的那一刻不会把编辑器顶动。
- **整页关闭会提示。** 刷新或关闭页面时，只要还有未保存的改动（含已留存的缓存），浏览器会弹出一次自己的离开确认。
- **保存即清空。** 保存成功后，该文件的快照全部清除。

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
| `npm run typecheck`、`npm test` | 类型契约，以及 119 个单元测试（保存路由的每条守卫、文件地址解析、保存命令重定向的每条分支、编辑器主题桥的每条分支、查看器名称与二进制后缀声明的边界、未保存改动的缓存规则与脏状态跟踪的边界、打开时「用文件还是用缓存」的每个分支、面板状态行的状态与操作矩阵） |
| `node scripts/smoke-client.mjs` | 构建后的浏览器半结构：loader 包装、内联的 SpreadJS 与样式、外部依赖只有 react |
| `node scripts/smoke-node.mjs` | 构建后的宿主半：路由注册、许可证配置，以及保存路径的真实写盘、冲突与越界拒绝 |
| `npm run probe:live` | **对着正在运行的 DSH** 跑一遍真实保存：真实 `ctx.fs` 的解析、落盘、冲突守卫、工作区越界；并核对进程里装的是不是本构建（插件版本与内置 SpreadJS 版本） |

`npm run probe:live` 要求 DSH 已重启到本版本。宿主半会在 `/spreadjs/api/health` 回报插件版本与内置 SpreadJS 版本，探针据此判断「正在跑的进程是不是这一版」——回报的版本与本构建不一致会直接判失败；如果进程里是很早的宿主半（连版本字段都没有），探针会说明需要重启，如果连保存路由都报 404，则说明那更是旧版。可选参数：`--url`（默认 `http://127.0.0.1:3080`）、`--session <id>`、`--home <DSH_HOME>`。探针会在会话工作区内建一个临时文件，结束时删除。

### 许可

插件代码免费提供，采用 [MIT 许可证](LICENSE)。内置的 SpreadJS 和 Designer 是葡萄城商业产品，未配置许可证时可按其试用条款体验；插件免费不包含这两个产品的商业授权。

如用于正式部署或 SaaS 服务，请根据使用场景获取适用的 SpreadJS 和 Designer 授权。

---

## English

### Features

- Opens `.xlsx`, `.xlsm`, `.csv`, `.sjs`, and `.ssjson` files.
- Open workbooks from the file tree and edit them with SpreadJS Designer.
- Save edits straight back to the file: atomic, confined to the session workspace, with conflict detection.
- Follows the harness's light or dark theme, toolbars and worksheet alike; a harness preference of `system` still tracks the OS.
- An **About** button in the settings tab reports the bundled versions, the licence state and the copyright.

### Bundled Versions and File Compatibility

| Component | Bundled version |
| --- | --- |
| SpreadJS | 19.2.0 |
| SpreadJS Designer | 19.2.0 |

The **About** button in the Designer's settings tab shows the bundled versions, the licence state and the copyright. Older SpreadJS versions may not open `.sjs` or `.ssjson` files saved by this version. When exchanging files with older systems, keep the original files and check compatibility.

### Installation

Requires DSH `>=0.1.5-rc.3`. The plugin uses the harness's own right Sidebar and needs **no third-party sidebar plugin**.

| DSH version | Status | Notes |
| --- | --- | --- |
| `0.1.7-rc.2` | ✅ build and verification baseline | `typecheck`, 119 unit tests, both smokes, `verify:package` and `probe:live` all green (the probe's version check needs DSH restarted first, see below) |
| `0.1.6.x` | ⚪ not verified | This range was never checked: neither point-by-point acceptance nor whether it already offers the two capabilities below |
| `0.1.5-rc.3` | ✅ previous verification baseline | The release this plugin was originally built and accepted against; it ignores the binary-suffix declaration, so a plain-text entry may still appear among the viewer choices |

From `0.1.7` the platform offers two things this plugin uses: the **binary-suffix** declaration on a document definition (which is what removes the plain-text viewer choice), and its own read-only Excel preview (which is listed beside this plugin). The plugin still works on `0.1.5-rc.3`; it simply does not get those two.

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

Save has a single entry point: the **保存到工作区** button in the Designer's File tab, in the place the built-in "save as .sjs" button used to occupy. It writes your changes back to the file you opened, and there is no second prompt, because pressing Save *is* the intent.

- **The File tab is reduced to one Save action.** The Designer's own Save is a dialog that downloads a file; this plugin replaces it with a write-back to the file you opened, and the File tab keeps only that one action — new, open, import, export, print and info are removed outright. A copy is what the harness's own file download is for.
- **A workbook that is still loading cannot be saved.** It has no content yet, so saving would overwrite the file with an empty book; the save command refuses, with an explanation, until the load finishes.
- **It will not clobber someone else's edit.** The plugin records the file's content hash when it opens it and re-checks before writing; if the file changed in the meantime (an agent edited it, you saved it elsewhere), the save is refused with an explanation instead of overwriting those changes.
- **It never leaves half a file.** A same-directory temporary file is renamed over the target, so any other reader always sees a complete workbook.
- **It cannot write outside the workspace.** The target must sit inside the current session's workspace; anything else — including `..` escapes — is refused.
- **Loopback only.** The save endpoint serves the local machine like the rest of DSH. If you reach DSH through a LAN address, add that address to `trustedHosts`.

### Unsaved work

The harness unmounts a document body when its tab is hidden, and the platform offers no close hook to intercept (a close is synchronous, and a document definition has neither a lifecycle nor a veto point). So leaving is never blocked — and nothing is dropped either:

- **Switching away and back keeps the edits.** A dirty workbook is kept as a snapshot just before its body unmounts, and restored as-is when the same tab returns, without re-reading the file.
- **Closing the tab keeps them too.** The snapshot is also kept under the file's path, so reopening that file restores it — and says so in a banner — as long as the file on disk is still the version the snapshot was written from.
- **A file changed elsewhere is never silently replaced.** If the file on disk changed since the snapshot (an agent, another editor), the panel offers it instead: **Restore** carries on from the buffer (a later save writes it to disk), **Discard** re-reads the file.
- **It is visible.** A row at the top of the panel is always there: `Unsaved changes` with a Discard action while edits are pending, back to `Saved` after a successful save. The row holds its space, so beginning to edit never shifts the editor.
- **Closing the page warns.** A reload or close raises the browser's own prompt once, as long as anything is unsaved or still cached.
- **Saving clears it.** A successful save drops every snapshot for that file, so reopening starts from disk.

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
| `npm run typecheck`, `npm test` | The type contract, and 119 unit tests: every save guard, file-address parsing, every branch of the Save-command redirect, every branch of the editor theme bridge, the viewer-name and binary-suffix edge cases, the unsaved-buffer and dirty-tracking rules, every branch of the file-versus-buffer decision at open, and the panel state line's state/action matrix |
| `node scripts/smoke-client.mjs` | The built browser half's structure: loader wrapper, inlined SpreadJS and styles, react as the only runtime external |
| `node scripts/smoke-node.mjs` | The built host half: route registration, license config, and the save path writing real bytes plus refusing conflicts and escapes |
| `npm run probe:live` | A real save against a **running DSH**: the actual `ctx.fs` resolving, writing, refusing a stale base hash, and refusing a workspace escape — plus a check that the process carries *this* build (plugin and bundled SpreadJS versions) |

`npm run probe:live` needs DSH restarted onto this version. The host half reports the plugin and bundled SpreadJS versions on `/spreadjs/api/health`, so the probe can tell whether the running process is this build: a version that disagrees with this build fails outright, a host half old enough to omit the field is reported as needing a restart, and a 404 means the host half predates the save route. Options: `--url` (default `http://127.0.0.1:3080`), `--session <id>`, `--home <DSH_HOME>`. The probe creates one temporary file inside the session workspace and deletes it.

### License

The plugin code is free under the [MIT license](LICENSE). Bundled SpreadJS and Designer are GrapeCity commercial products available for evaluation under their trial terms without license keys. The free plugin does not include commercial licenses for these products.

For production or SaaS deployments, obtain SpreadJS and Designer licenses appropriate to your use.
