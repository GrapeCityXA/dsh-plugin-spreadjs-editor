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
- 编辑后可直接保存回原文件：原子写入、限制在会话工作区内、带冲突检测。保存按钮在 DSH 文档头部自己的工具栏上，未保存时带一个标记点；它与「另存为…」的尺寸、字号、颜色都按 DSH 头部自身控件的规格绘制，而且**只在表格文件上出现**。
- 「另存为」可以把当前工作簿（含新建的空白工作簿）写进工作区的另一个路径，成功后就地切换到那个文件；同名文件不会被覆盖。
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
| `0.1.7-rc.2` | ✅ 构建与验收基线 | `typecheck`、164 项单测、两个 smoke、`verify:package`、`probe:live` 全部通过（`probe:live` 的版本核对需要先重启 DSH，见下文） |
| `0.1.6.x` | ⚪ 未验证 | 没有核对过这个区间的平台：既未逐项跑验收，也不确定它是否已提供下表中的能力 |
| `0.1.5-rc.3` | ✅ 上一版验收基线 | 插件最初就是对着它构建并验收的；它会忽略「二进制后缀」声明，查看方式列表里仍可能出现纯文本一项；文档头部没有动作槽，因此保存入口只有 `Ctrl+S`，未保存状态靠面板右下角的浮动胶囊 |

`0.1.7` 起平台提供了三样本插件会用到的能力：文档定义里的**二进制后缀**声明（决定是否还提供纯文本查看方式）、内置的只读 Excel 预览（会与本插件并列出现在查看方式列表里），以及文档头部**官方动作槽** `sidebar.right.tab.document.actions`（「保存 / 另存为」就注册在这里）。插件在 `0.1.5-rc.3` 上照常工作，只是拿不到这三点中的前两点，工具栏上的这两个按钮也不出现。

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

保存的正式入口是 **DSH 文档头部自己的工具栏**（打开工作簿后，文件名旁边那颗「保存」）。它注册在 DSH `0.1.7` 起的官方动作槽 `sidebar.right.tab.document.actions` 里，与其它查看器的控件排在一起；有未保存改动时，「保存」前会多一个标记点，像 Excel 标题栏的 `*`。改动写回你打开的那个文件，不会再问你"要不要保存"，因为按下保存本身就是你的意图。

同一份写回也挂在 **`Ctrl+S` 和 Designer 工具栏上的保存按钮**上：插件把 Designer 的 Save 命令重定向到写回，所以这两处按下都不会再弹出下载框。（「文件」标签页里的那一行不在其中，见本节末尾。）

这两颗头部按钮并不引用 DSH 的按钮组件——第三方客户端插件不能假定内部的 `@deepseek-ai/*` 包在运行时一定可解析，解析失败会连编辑器一起挂掉——而是照抄了邻居的规格：28px 高、`padding: 0 6px`、12px 字号、常态 `--dsw-alias-label-secondary`，悬停转 `--dsw-alias-label-primary` 并给 `--dsw-alias-interactive-bg-hover` 底色，禁用转 `--dsw-alias-label-tertiary` 且不再响应。也就是头部「查看器名称」与图标按钮的那一套；有一条单测钉住这些数值，避免以后悄悄漂移。

它们**只在本插件负责的文件上画出来**。这个动作槽对每个预览文件都会渲染，所以按钮要在插件自己的编辑器占据屏幕时才出现——否则工作区里每个 Markdown、图片、日志旁边都会多两颗按不动的按钮。产品自己的「用本地应用打开」也是这个形状：没有可打开的应用时就什么都不画。

顺序上它们排在「用本地应用打开」**之前**。槽位是 list，条目按公开的 `order` 排序（先 `priority`，再 `order`，最后才轮到注册顺序），插件注册在 `-10` —— 而这正是 DSH 自己给「头部动作里排第一」用的值（`dsh-client-ui-agent-preset` 注册会话头部标签时就是 `order: -10`）。这样「先保存、再考虑外部打开」是确定的阅读顺序，也不再受插件加载顺序影响；未保存的标记点也因此落在这一组的第一项上，一眼就能看到。

Designer「文件」标签页保持原样，插件不再改写它的私有菜单模板。那段改写曾经把这一页收敛成一颗「保存到工作区」，代价是依赖 Designer 的内部模板结构；现在没有必要了——保存的正式入口已经搬到文档头部，`Ctrl+S` 也照样写回，而「文件」页里的保存就按 Designer 的本义下载一份副本。少一处私有结构依赖，这条路径上唯一的代价是：从这里点保存得到的是副本，而不是写回。

- **工作簿还没载入完时不让保存。** 载入中的工作簿是空的，此时保存会用空表覆盖原文件；载入完成前保存命令会拒绝并说明。
- **不会冲掉别人的修改。** 打开文件时插件记下其内容哈希；保存前重新比对，若磁盘上的文件在此期间被改过（Agent 改过、你在别处存过），保存会被拒绝并说明原因，而不是覆盖掉那些改动。
- **不会写出半个文件。** 同目录临时文件写完后 rename 覆盖，其他程序任何时候读到的都是完整文件。
- **写不出工作区。** 目标必须在当前会话的工作区内，越界（含 `..` 逃逸）直接拒绝。
- **只有循环回环地址可用。** 保存接口与 DSH 其它接口一样只服务本机来源；通过局域网地址访问时，需要把该地址加进 `trustedHosts`。

### 另存为

头部工具栏上的「另存为…」把当前工作簿写到工作区的**另一个**路径——包括在 Designer 里重新置空的空白工作簿。它不碰原来那个文件。

- **默认目标**：同目录、同后缀，文件名后面加「副本」（`报表.xlsx` → `报表-副本.xlsx`）。
- **成功后就地切换**：这个标签页会直接开到刚写下的文件上继续编辑，不会另开一个标签页。
- **同名不覆盖**：目标已存在时宿主会拒绝写入（写回要求带版本基线，另存为没有），对话框直接说「目标文件已存在，请换一个名字」，而不是默默覆盖。
- **只接受 5 种后缀**：`.xlsx`、`.xlsm`、`.csv`、`.sjs`、`.ssjson`。写出格式由后缀决定，其它后缀会写出打不开的文件，所以在提交前就拦下。
- **越界同样被拒**：路径解析与围栏由宿主按写回那一套规则判定，工作区之外一律拒绝。
- **写不进去的另一种可能**：正在载入或另一次保存尚未结束时，对话框会说「编辑器还没准备好」，不会假装成功。

### 未保存的改动

DSH 在标签页被切走时会卸载文档主体，平台也没有可供拦下的关闭钩子（关闭是同步的，文档定义里既无生命周期也没有否决点），所以这里**不做「确认离开」的拦截**，而是保证不丢：

- **切走再切回不丢。** 有未保存改动的工作簿会在主体卸载前留成一份快照，切回同一个标签页时原样恢复，不需要重新读盘。
- **关掉标签页也不丢。** 快照同时按文件路径保留；重新打开同一个文件时，只要磁盘上的文件仍是快照写下的那一版，就自动恢复，并在面板右下角的胶囊里说明来源。
- **文件被外部改过时不默默套用。** 若磁盘上的文件已经变了（Agent 改过、你在别处存过），面板右下角会浮出一个胶囊提示「存在未保存的改动缓存，但文件已在磁盘上被修改」，由你选择**恢复**（用缓存继续，之后保存即写入磁盘）或**丢弃**（重新读盘）。
- **看得见，而且有两处。** 头部工具栏的「保存」在有未保存改动时带一个标记点（像 Excel 标题栏的 `*`），这是 DSH `0.1.7` 及以上才有的位置；面板右下角另有一个浮动胶囊：有未保存改动时显示「未保存的改动」并带一颗「丢弃」，保存成功后自己消失。它悬浮在表格上方、不占任何布局高度——这是它从「面板顶部常驻一行」改回来的原因——而 `0.1.5/0.1.6` 上文档头部还没有动作槽，这个胶囊就是唯一的状态提示，所以它必须留着。改动只会替换胶囊里的文字与按钮，且它只在有话说时出现。
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
| `npm run typecheck`、`npm test` | 类型契约，以及 154 个单元测试（保存路由的每条守卫、文件地址解析与地址构造、另存为的目标校验、默认名与失败文案、保存命令重定向的每条分支、编辑器主题桥的每条分支、查看器名称与二进制后缀声明的边界、未保存改动的缓存规则与脏状态跟踪的边界、打开时「用文件还是用缓存」的每个分支、面板状态胶囊的状态与操作矩阵、文档头部动作的发布/订阅/命令路由、按钮的尺寸字号颜色规格、以及「只在表格文件上出现」的判定与注册顺序） |
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
- Save edits straight back to the file: atomic, confined to the session workspace, with conflict detection. Save lives in the harness's own document header, with a mark while anything is unsaved.
- **Save As** writes the workbook — including a new blank one — to another path in the workspace and moves the tab onto it; an existing name is never overwritten. Both header buttons follow the spec of the header's own controls (see Saving below) and appear on this plugin's own files only.
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
| `0.1.7-rc.2` | ✅ build and verification baseline | `typecheck`, 154 unit tests, both smokes, `verify:package` and `probe:live` all green (the probe's version check needs DSH restarted first, see below) |
| `0.1.6.x` | ⚪ not verified | This range was never checked: neither point-by-point acceptance nor whether it already offers the capabilities below |
| `0.1.5-rc.3` | ✅ previous verification baseline | The release this plugin was originally built and accepted against; it ignores the binary-suffix declaration, so a plain-text entry may still appear among the viewer choices, and its document header has no actions slot — so `Ctrl+S` is the only Save entry and unsaved work shows in the panel's floating pill |

From `0.1.7` the platform offers three things this plugin uses: the **binary-suffix** declaration on a document definition (which is what removes the plain-text viewer choice), its own read-only Excel preview (which is listed beside this plugin), and the document header's **actions slot** `sidebar.right.tab.document.actions`, where Save and Save As are registered. The plugin still works on `0.1.5-rc.3`; it simply does not get the first two, and the two header buttons do not appear.

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

Save's official entry point is **the harness's own document header** — the Save button beside the file name once a workbook is open. It is registered in the actions slot `sidebar.right.tab.document.actions` that DSH publishes from `0.1.7` on, next to the other viewers' own controls, and it carries a mark while anything is unsaved, like the `*` in Excel's title bar. It writes your changes back to the file you opened, and there is no second prompt, because pressing Save *is* the intent.

The same write-back is also on **`Ctrl+S` and the Save button on the Designer's own toolbar**: the plugin redirects the Designer's Save command, so neither of those reaches a download dialog any more. (The row in the File tab is the exception — see the end of this section.)

These two header buttons do not import the harness's button component — a third-party client plugin cannot assume an internal `@deepseek-ai/*` package resolves at runtime, and a failure there would take the whole editor down — so they copy the values from the controls beside them instead: 28px tall, `padding: 0 6px`, 12px text, `--dsw-alias-label-secondary` at rest, `--dsw-alias-label-primary` with the `--dsw-alias-interactive-bg-hover` background on hover, and `--dsw-alias-label-tertiary` with no response when disabled. That is exactly what the header's own viewer-name button and icon buttons do, and a unit test pins those values so they cannot drift unnoticed.

They are drawn **only on the files this plugin handles**. The slot renders for every previewed file, so the buttons appear only while this plugin's own editor is the body on screen — otherwise every markdown file, image and log in the workspace would carry two buttons that cannot do anything. The product's own open-in-app control works the same way: it draws nothing when there is no application to offer.

They are ordered **before** open-in-app. The slot is a list, and its entries sort by the documented `order` (priority first, then order, then registration sequence), where this plugin registers at `-10` — the very value the harness itself uses for "first in a header actions list" (`dsh-client-ui-agent-preset` registers its session-header label at `order: -10`). That makes "save first, think about opening elsewhere second" a decided reading order rather than a side effect of plugin load order, and it puts the unsaved mark on the first item of the group, where the eye lands.

The Designer's File tab is left exactly as it ships: the plugin no longer rewrites its private menu template. That rewrite once collapsed the page to a single **保存到工作区** row, at the price of depending on the Designer's internal template structure; nothing needs it now — Save's official home is the document header and `Ctrl+S` writes back — so the File tab's Save means what it always meant to a Designer that owns no session file: it downloads a copy. One private-structure dependency fewer, and the only cost on that path is that saving from there gives you a copy rather than a write-back.

- **A workbook that is still loading cannot be saved.** It has no content yet, so saving would overwrite the file with an empty book; the save command refuses, with an explanation, until the load finishes.
- **It will not clobber someone else's edit.** The plugin records the file's content hash when it opens it and re-checks before writing; if the file changed in the meantime (an agent edited it, you saved it elsewhere), the save is refused with an explanation instead of overwriting those changes.
- **It never leaves half a file.** A same-directory temporary file is renamed over the target, so any other reader always sees a complete workbook.
- **It cannot write outside the workspace.** The target must sit inside the current session's workspace; anything else — including `..` escapes — is refused.
- **Loopback only.** The save endpoint serves the local machine like the rest of DSH. If you reach DSH through a LAN address, add that address to `trustedHosts`.

### Save As

**另存为…** in the same document header writes the workbook to a *different* path in the workspace — including a workbook that was reset to blank inside the Designer. The file it came from is left untouched.

- **Suggested target**: same directory, same suffix, with the localized word for a copy appended (`report.xlsx` → `report-copy.xlsx`).
- **It switches this tab.** On success the tab navigates to the file just written and keeps editing there; no second tab is opened.
- **An existing name is never overwritten.** The host refuses the write (a write-back needs a version baseline, and a Save As has none) and the dialog says so — "that file already exists; choose another name" — instead of replacing what is there.
- **Only five suffixes are accepted**: `.xlsx`, `.xlsm`, `.csv`, `.sjs`, `.ssjson`. The written format follows the suffix, so anything else would produce a file this editor cannot reopen; it is refused before the write.
- **Containment is judged by the host**, on the same rule as a write-back: a path outside the session workspace is refused.
- **A busy editor says so.** While a load or another save is running the dialog reports that the editor is not ready rather than pretending to have written.

### Unsaved work

The harness unmounts a document body when its tab is hidden, and the platform offers no close hook to intercept (a close is synchronous, and a document definition has neither a lifecycle nor a veto point). So leaving is never blocked — and nothing is dropped either:

- **Switching away and back keeps the edits.** A dirty workbook is kept as a snapshot just before its body unmounts, and restored as-is when the same tab returns, without re-reading the file.
- **Closing the tab keeps them too.** The snapshot is also kept under the file's path, so reopening that file restores it — and says so in the pill at the panel's bottom-right — as long as the file on disk is still the version the snapshot was written from.
- **A file changed elsewhere is never silently replaced.** If the file on disk changed since the snapshot (an agent, another editor), the panel offers it instead in that same pill: **Restore** carries on from the buffer (a later save writes it to disk), **Discard** re-reads the file.
- **It is visible, in two places.** The header's Save carries a mark while edits are pending (like Excel's title-bar `*`) — a position DSH `0.1.7` and later offer. The panel's own floating pill at the bottom-right shows `Unsaved changes` with a Discard action while edits are pending, and disappears once everything is saved. It hovers over the sheet and costs no layout height — which is why it went back from a permanent row at the top of the panel to a pill — and on `0.1.5`/`0.1.6`, where the document header has no actions slot, it is the only state indicator there is. Editing only swaps the text and the buttons inside it, and it appears only when it has something to say.
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
| `npm run typecheck`, `npm test` | The type contract, and 154 unit tests: every save guard, file-address parsing and address building, the Save As target rules, suggested name and failure wording, every branch of the Save-command redirect, every branch of the editor theme bridge, the viewer-name and binary-suffix edge cases, the unsaved-buffer and dirty-tracking rules, every branch of the file-versus-buffer decision at open, the panel state pill's state/action matrix, and the document header actions' publication, subscription, command routing, button spec, "spreadsheets only" rule and registration order |
| `node scripts/smoke-client.mjs` | The built browser half's structure: loader wrapper, inlined SpreadJS and styles, react as the only runtime external |
| `node scripts/smoke-node.mjs` | The built host half: route registration, license config, and the save path writing real bytes plus refusing conflicts and escapes |
| `npm run probe:live` | A real save against a **running DSH**: the actual `ctx.fs` resolving, writing, refusing a stale base hash, and refusing a workspace escape — plus a check that the process carries *this* build (plugin and bundled SpreadJS versions) |

`npm run probe:live` needs DSH restarted onto this version. The host half reports the plugin and bundled SpreadJS versions on `/spreadjs/api/health`, so the probe can tell whether the running process is this build: a version that disagrees with this build fails outright, a host half old enough to omit the field is reported as needing a restart, and a 404 means the host half predates the save route. Options: `--url` (default `http://127.0.0.1:3080`), `--session <id>`, `--home <DSH_HOME>`. The probe creates one temporary file inside the session workspace and deletes it.

### License

The plugin code is free under the [MIT license](LICENSE). Bundled SpreadJS and Designer are GrapeCity commercial products available for evaluation under their trial terms without license keys. The free plugin does not include commercial licenses for these products.

For production or SaaS deployments, obtain SpreadJS and Designer licenses appropriate to your use.
