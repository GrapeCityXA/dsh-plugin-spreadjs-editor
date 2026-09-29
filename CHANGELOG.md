# Release Notes / 版本记录

## 0.2.2（未发布）

### 中文

- **切走标签页不再丢掉未保存的改动**：DSH 在标签页被切走时会卸载文档主体，此前这等于销毁工作簿——未保存的编辑就此消失，而且没有任何提示。平台也没有能拦下的关闭钩子（关闭是同步的，文档定义里没有任何生命周期或否决点），所以这里不做「确认离开」的拦截，改为一律不丢：脏工作簿在主体卸载前留成快照，切回来即恢复；标签页真正关闭后，快照按文件路径继续保留，重新打开同一文件时可以恢复；若文件在磁盘上已被改动，则不会默默套用快照，而是给出「恢复 / 丢弃」两个选择。整页刷新或关闭时浏览器会提示一次。保存成功即清空该文件的全部快照。
- **未保存状态是右下角一个浮动胶囊，不占布局**：悬浮在表格右下角，只在有话说时出现——有未保存改动时显示「未保存的改动」并带一颗「丢弃」，保存成功后自己消失。（这一版中途曾做成面板顶部常驻的一行，实装后发现它虽然不高，却始终占着表格的纵向空间，于是改了回来；`0.1.5/0.1.6` 上文档头部还没有动作槽，这个胶囊就是唯一的状态提示，所以它必须保留。）「丢弃」同时覆盖两种未保存内容：本会话的缓存，以及只存在于编辑器里的改动（尚无缓存可清），所以它每次都重新从磁盘载入当前版本。
- **工作簿不再被当作文本提供查看**：为 `.xlsm`、`.sjs`、`.ssjson` 声明「二进制后缀」（`.xlsx` 一并声明），DSH 因此不会再把它们列进纯文本查看方式——此前打开这类文件，可能选到把工作簿当文本渲染的方式，看到的是一屏乱码。该声明需要 DSH `0.1.7` 及以上才生效；`0.1.5-rc.3` 会忽略这个字段，行为与之前一致，不影响编辑与保存。
- **查看器名称跟随 DSH 的语言，并与内置的只读预览区分开**：DSH `0.1.7` 起自带了只读的「表格」预览，会与本插件并列出现在同一份查看方式列表里，所以这里的名称由固定的 `SpreadJS` 改为随语言变化的「SpreadJS 编辑器 / SpreadJS Editor」，一眼能看出哪个能编辑。DSH 未提供语言服务时，则用内置的「SpreadJS 编辑器」。
- **健康接口回报版本**：`/spreadjs/api/health` 现在返回插件版本与内置 SpreadJS 版本，`npm run probe:live` 因此能判断「正在运行的 DSH 里装的是不是这一版」——此前只能靠 404 猜测，进程里跑着旧版宿主半时其余检查都是一样的结果。
- **「保存」搬进 DSH 自己的文档工具栏，不再依赖 Designer 私有模板**：DSH `0.1.7` 起，文档预览头部有一个官方动作槽（`sidebar.right.tab.document.actions`），「保存」现在注册在那里——就排在文件名和其它查看器控件之后，有未保存改动时它前面会多一个标记点，像 Excel 标题栏的 `*`。此前只有改写 Designer「文件」菜单的私有模板才点得到保存，模板一变就失效；那处改写随后**整个删掉**了——既然保存已经另有正式入口，就没有理由再依赖 Designer 的内部模板结构，插件也因此少一处私有结构依赖。必须贴着文件解释的「恢复 / 丢弃」由面板右下角的浮动胶囊承载。
- **Designer 自带的「文件」标签页已从 Ribbon 上隐藏**：它里面的保存是**下载副本**，与头部那颗**写回**的保存只隔一次点击，两颗都在就是误存副本的来源——现在这个编辑器里只剩一处保存（文档头部「保存 / 另存为…」与 `Ctrl+S`）。隐藏用的是一条按产品**公开命令名**（`CommandNames.FileMenuButton`）加模板元素类名的 CSS，作用域限定在本插件面板内，有单测钉住，创建编辑器时控制台会回报命中元素数与它算出的 `display`，所以将来产品改名、规则失效会被看见。代价是「文件」页里的新建 / 打开 / 导入 / 导出 / 打印 / 信息也看不到了，需要哪一项可以单独接回 Ribbon。
- **新增「另存为」，把工作簿（包括重置成空白的新工作簿）写进工作区**：工具栏「另存为…」询问一个相对会话工作区的路径，默认是「同目录 + 同后缀 + 文件名加『副本』」；写成功后就地切换到那个文件继续编辑，不会另开标签页。同名文件不会被覆盖——宿主对没有版本基线的写入一律拒绝，对话框直接说「目标文件已存在，请换一个名字」。只接受本插件能打开的 5 种后缀（`.xlsx / .xlsm / .csv / .sjs / .ssjson`）：写出格式由后缀决定，别的后缀会写出打不开的文件，因此在提交前就拦下。
- **面板内残留的固定英文提示改走语言表**：新工作簿提示、载入中、缺少完整字节的提示原先固定为英文，现在随 DSH 语言切换。
- **头部两颗按钮改用 DSH 自己控件的规格**：28px 高、12px 字号、常态用次要色、悬停转主要色并给悬停底色、禁用转三级色——与文档头部自己的「查看器名称」和图标按钮同一套值（照抄数值而不是引用内部 UI 包：第三方客户端插件不能假定内部的 `@deepseek-ai/*` 在运行时一定可解析，解析失败会连编辑器一起挂掉）。有一条单测钉住这些数值。
- **头部两颗按钮只在表格文件上出现，并排在「用本地应用打开」之前**：动作槽对所有预览文件都渲染，因此按钮现在只在插件自己的编辑器占据屏幕时才画出来（此前打开任意 Markdown、图片也会看到两颗按不动的按钮）；顺序改用槽位公开的 `order`（`-10`，DSH 自己给「头部动作排第一」用的值），不再由插件加载顺序决定，未保存标记点也因此落在这一组的第一项。
- 构建与验收基线升到 DSH `0.1.7-rc.2`（`npm run typecheck`、157 项单测、两个 smoke、`verify:package`、`probe:live` 全部通过）。插件在 `0.1.5-rc.3` 上仍可运行（该版本没有文档头部动作槽，保存入口只有 `Ctrl+S`，未保存状态靠面板右下角的浮动胶囊）。

### English

- **Switching tabs no longer throws unsaved edits away**: the harness unmounts a document body as soon as its tab is hidden, which used to destroy the workbook and silently take every unsaved edit with it — and the platform offers no close hook to intercept (a close is synchronous, and a document definition has no lifecycle or veto point). So leaving is still never blocked; nothing is dropped either. A dirty workbook is kept as a snapshot before its body goes away and put back when the tab returns, the snapshot also survives a real tab close under the file's path so reopening that file can restore it, and a file that changed on disk since the snapshot is *offered* rather than silently applied (restore or discard). Closing or reloading the page raises the browser's own prompt once, and a successful save clears every snapshot for that file.
- **The unsaved state is a floating pill in the bottom-right corner, costing no layout**: it hovers over the sheet and appears only while it has something to say — `Unsaved changes` with a Discard action while edits are pending, and gone once everything is saved. (This release first turned it into a permanent row at the top of the panel; in use that row kept vertical space away from the spreadsheet for the whole session, so it became a pill again. On `0.1.5`/`0.1.6`, where the document header has no actions slot, the pill is the only state indicator there is — which is why it stays.) Discard covers both shapes of pending work, a buffer from this session and edits that only exist inside the Designer, so it always reloads the file's current bytes.
- **Workbooks are no longer offered as text**: `.xlsm`, `.sjs` and `.ssjson` (and `.xlsx`) are now declared as binary suffixes, so the harness stops listing a plain-text view for them — until now that view could render a workbook as a screenful of mojibake. The declaration takes effect on DSH `0.1.7` and later; `0.1.5-rc.3` ignores the field and behaves exactly as before, editing and saving unaffected.
- **The viewer name follows the harness language and no longer collides with the built-in preview**: from DSH `0.1.7` the product ships its own read-only spreadsheet preview, listed beside this plugin, so the name changes from a fixed `SpreadJS` to a localized "SpreadJS 编辑器 / SpreadJS Editor" that says which one edits. Without a locale service the shipped Chinese name is used.
- **The health endpoint reports versions**: `/spreadjs/api/health` now returns the plugin and bundled SpreadJS versions, so `npm run probe:live` can tell whether the running DSH carries this build — previously only a 404 distinguished an old host half, and every other check looked the same.
- **Save moved into the harness's own document header, off the Designer's private template**: from DSH `0.1.7` a document header publishes an official actions slot (`sidebar.right.tab.document.actions`), and Save is now registered there — after the file name and the other viewers' controls, carrying a mark while anything is unsaved, like Excel's title-bar `*`. Until now Save was only reachable through a rewrite of the Designer's private File-menu template, which stops working the moment that template changes; that rewrite has since been **deleted outright** — with Save having a home of its own there was no reason left to depend on the Designer's internal template structure, and the plugin carries one private-structure dependency fewer. The Restore/Discard decision that has to be explained next to the file lives in the panel's floating pill.
- **The Designer's own File tab is hidden from the ribbon**: its Save *downloads a copy*, one click away from the header's Save that writes the file back, and having both is how the wrong one gets pressed — this editor now has exactly one place to save (the header's Save / Save As…, plus `Ctrl+S`). The hiding is one CSS rule keyed on the product's **public** command name (`CommandNames.FileMenuButton`) and the class its template draws, scoped to this plugin's panel; a unit test pins it and creating the editor logs how many elements matched and what `display` they compute to, so a rename in a future build shows up as a dead rule. The cost is that the File tab's new / open / import / export / print / info entries are gone from the UI too — ask and we will wire back the one you need.
- **New Save As writes the workbook — including one reset to blank — into the workspace**: the header's **另存为…** asks for a path relative to the session workspace (suggesting the same directory and suffix with a localized "copy" in the name) and, on success, moves this tab onto the file just written instead of opening a second tab. An existing name is never overwritten — the host refuses any write that carries no version baseline — and the dialog says so plainly. Only the five suffixes this plugin opens (`.xlsx / .xlsm / .csv / .sjs / .ssjson`) are accepted, because the written format follows the suffix and anything else would produce a file that cannot be reopened here.
- **The remaining hard-coded English panel strings now go through the locale table**: the new-workbook notice, the loading notice and the "complete file contents" notice.
- **The two header buttons now follow the harness's own control spec**: 28px tall, 12px text, secondary colour at rest, turning primary with the hover background on hover, and tertiary when disabled — the same values the document header's own viewer-name button and icon buttons use. The values are copied rather than imported, because a third-party client plugin cannot assume an internal `@deepseek-ai/*` package resolves at runtime and a failure there would take the whole editor down; one unit test pins them.
- **The two header buttons appear on spreadsheets only, and before open-in-app**: the actions slot renders for every previewed file, so the buttons are now drawn only while this plugin's own editor is the body on screen — previously every markdown file and image in the workspace carried two buttons that could not do anything. Their position now uses the slot's documented `order` (`-10`, the value DSH itself uses for "first in a header actions list") instead of plugin load order, which also puts the unsaved mark on the first item of the group.
- Built and verified against DSH `0.1.7-rc.2` (`npm run typecheck`, 157 unit tests, both smokes, `verify:package`, `probe:live` all green). The plugin still runs on `0.1.5-rc.3`, which has no document-header actions slot — there, `Ctrl+S` is the only Save entry and unsaved work shows in the panel's floating pill.

## 0.2.1

### 中文

- **编辑器跟随 DSH 的主题，而不是操作系统**：此前深色与否取决于系统的 `prefers-color-scheme`，所以在 DSH 里选「浅色 / 深色」时编辑器毫无反应——两者不一致时最明显。现在改为订阅 DSH 的主题服务；DSH 偏好设为「跟随系统」时，仍然随系统一起切换。
- **面板自身配色改用 DSH 真实存在的主题 token**：原先用的几个 `--dsw-*` 变量 DSH 并未定义，那些规则实际一直落在硬编码的浅色回退值上，深色下会出现白色底块。

### English

- **The editor follows the harness theme, not the operating system**: toolbars, sheet area and panel used to darken according to the system's `prefers-color-scheme`, so choosing light or dark inside the harness changed nothing here — most visible when the two disagreed. The plugin now subscribes to the harness theme service, and a harness preference of `system` still tracks the OS.
- **The panel's own chrome reads real harness theme tokens**: several `--dsw-*` variables it used are not defined by DSH, so those rules were silently falling back to hard-coded light colours and left white patches in dark mode.

## 0.2.0

> 破坏性变更：本版要求 DSH `>=0.1.5-rc.3`，并改用 DSH 自带的右侧栏，不再需要任何第三方侧边栏插件；升级前请先升级 DSH。仓库里准备过的 `0.1.5` 从未发布，其内容已并入本版。

### 中文

- **编辑后可以直接保存回原文件**：Designer「文件」菜单里点「保存到工作区」即可。写回限定在会话工作区内，带冲突检测（文件被外部改过会拒绝并说明原因），按下即写入、不再二次确认。「文件」菜单里只保留这一个动作，其余分类（新建、打开、导入、导出、打印、信息）已移除，需要副本时用 DSH 自己的文件下载。
- **浅色/深色完整跟随系统**：此前只有工具栏和面板变深、工作表区域仍是白底，现在一起切换。
- **界面更干净**：去掉面板顶部的文件名标题栏（DSH 标签页已有）和底部状态栏，保存与冲突提示改为右下角浮层。
- **新增「关于」**：Designer「设置」标签里可查看插件版本、内置 SpreadJS 与 Designer 版本、授权状态和版权信息。
- 内置 SpreadJS 升级到 19.2.0；新增配置项 `maxSaveBytes`（默认 64 MB）与 `trustedHosts`。

### English

- **Save your edits straight back to the file you opened**: press `保存到工作区` (save to workspace) in the Designer's File tab. The write stays inside the session workspace and is guarded against conflicts (a file changed on disk is refused, with a reason), and it writes immediately with no second prompt. That is now the File tab's only action — new, open, import, export, print and info are gone, so use the harness's own file download for a copy.
- **Light and dark follow the system all the way**: previously only the toolbars and panels darkened while the sheet stayed white.
- **A cleaner panel**: the file-name title bar (the harness tab already shows it) and the status bar are gone, and save or conflict messages appear as a floating notice in the corner.
- **A new About dialog**: the Designer's settings tab shows the plugin and bundled versions, the licence state and the copyright.
- Bundled SpreadJS moved to 19.2.0; new configuration `maxSaveBytes` (default 64 MB) and `trustedHosts`.

## 0.1.4

### 中文

- 移除安装期 `prepare` 钩子。npm 包继续以预构建方式分发，发布打包改用 `prepack`，用户安装时不会执行任何脚本。
- 打包校验新增检查：禁止 `preinstall`、`install`、`postinstall`、`prepare` 等安装期钩子。

### English

- Remove the `prepare` install hook. The npm package stays prebuilt; release packing now uses `prepack`, so no script runs during user installation.
- Add a package check that rejects `preinstall`, `install`, `postinstall`, or `prepare` hooks.

## 0.1.3

- 精简安装、配置和版本说明，方便查阅。
- Simplify installation, configuration, and release documentation.

## 0.1.2

### 中文

- 修复 DSH 启动失败和网页中编辑器无法加载的问题。
- 简化安装：内置 SpreadJS 19.1.4 及配套 Designer，无需本地编译或安装旧的 web-editors 前置插件。
- 编辑器底部显示 SpreadJS 版本，便于确认文件兼容性。
- 支持分别配置 SpreadJS 和 Designer 许可证。

升级要求：DSH `>=0.1.2-rc.1`。旧用户需移除 `dsh-plugin-web-editors` 及其 profile patch；已有 SpreadJS 许可证配置保持不变，Designer 许可证需单独配置。详见 [安装说明](README.md#安装)和[配置说明](README.md#配置)。

### English

- Fix issues that prevented DSH from starting or the editor from loading in the browser.
- Simplify installation: bundle SpreadJS 19.1.4 and its matching Designer, with no local build or former web-editors prerequisite required.
- Show the SpreadJS version in the editor status bar to help identify file compatibility.
- Support separate SpreadJS and Designer license configuration.

Upgrade requirements: DSH `>=0.1.2-rc.1`. Existing users should remove `dsh-plugin-web-editors` and its profile patch. Existing SpreadJS license configuration stays the same; configure the Designer license separately. See [Installation](README.md#installation) and [Configuration](README.md#configuration).

## 0.1.1

- 更新 README 中的编辑器截图。
- Update the editor screenshot in the README.

## 0.1.0

- 首次发布：支持从 DSH 文件树打开、查看和编辑 `.xlsx`、`.xlsm`、`.csv`、`.sjs` 和 `.ssjson` 文件。
- Initial release: open, view, and edit `.xlsx`, `.xlsm`, `.csv`, `.sjs`, and `.ssjson` files from the DSH file tree.
