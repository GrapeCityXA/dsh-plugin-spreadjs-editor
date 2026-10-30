# Release Notes / 版本记录

## 0.2.6

### 中文

**放宽 DSH 兼容范围，修复保存与恢复中的数据丢失风险**

- DSH 兼容声明和 UI peer 范围调整为 `>=0.2.1-rc.3 <0.3.0-0`，开发依赖继续固定在 `0.2.1-rc.4`。同一范围内的 patch 和 RC 不再要求逐个发布插件；扩展到新的 DSH 次版本前先验证 API 和运行行为。
- 保存期间继续编辑时，新改动仍标为未保存；关闭或切换标签页后，稍后完成的旧保存不会清除新留下的恢复快照。
- 另存为只写入了较早内容时，保留当前文件和后续改动，并提示继续保存；文档已关闭或切走时，不再因旧任务完成而自动跳转。
- 串行载入同一工作簿，避免旧加载最后完成并覆盖新内容。载入失败或导出期间工作簿发生切换、重新加载时，拒绝写入过时内容。
- 在同一宿主进程内，串行执行同一文件的冲突检查与写回，拒绝基于旧文件版本的后续保存；读取文件状态失败时停止写入。
- 保留延迟加载或临时重载的桥选择，避免其他桥先注册时清空用户设置；设置页会提示所选桥暂不可用，并允许改选或选择「不使用」。
- 打开工作簿支持取消信号：导航前拒绝已取消的请求，取消后停止加载等待并释放打开锁。

**升级说明：** 建议与 Driver `0.1.4` 配套升级，完成打开任务的取消处理。恢复快照仍仅在当前页面生命周期内有效；取消不会撤销已发生的导航或已发送的写入。

**验证：** 类型检查、240 项单测、构建、两个 smoke 和独立离线包安装校验通过；用户在 DSH `0.2.1-rc.4` dev 环境做过基本回归，未发现问题。rc.3、rc.4、rc.5 相关 UI API 包实现比对无差异，桌面运行验证基线为 rc.4。

### English

**Broaden DSH compatibility and fix save and recovery data-loss risks**

- Declare DSH and UI peer compatibility as `>=0.2.1-rc.3 <0.3.0-0`, keeping development dependencies pinned to `0.2.1-rc.4`. Patch and RC updates within this range no longer require individual plugin releases; verify APIs and runtime behavior before supporting a new DSH minor.
- Keep edits made during a save marked as unsaved. An earlier upload finishing after a tab closes or switches no longer clears its newer recovery snapshot.
- Keep the current file and later edits when Save As wrote an older revision, and explain that another save is needed. A completed Save As no longer navigates after its document has closed or switched away.
- Serialize imports into one Workbook so an older load cannot overwrite newer contents. Refuse stale exports after a load failure, workbook switch or reload.
- Serialize conflict checks and writes to each file within the same host process, rejecting subsequent saves based on an outdated version. Stop writes when file metadata cannot be read.
- Preserve bridge selections during delayed registration and temporary reloads. Settings explains unavailable selections and lets users choose another bridge or None.
- Accept cancellation signals when opening workbooks: refuse cancelled requests before navigation, stop readiness waits and release the opening lock.

**Upgrade notes:** Update together with Driver `0.1.4` for complete opening cancellation support. Recovery snapshots remain limited to the current page lifetime. Cancellation does not undo navigation or writes already sent.

**Validation:** Typecheck, 240 tests, build, both smokes and an independent offline package installation passed. The user completed basic development desktop checks on DSH `0.2.1-rc.4` without finding issues. Relevant UI API implementations compare without differences across rc.3, rc.4 and rc.5; desktop runtime validation is on rc.4.

## 0.2.5

- 将 DSH 开发依赖、宿主 peer 与兼容声明更新至 `0.2.1-rc.4`，补齐安装器读取的顶层 `engines.dsh`，解决在该 RC 中安装时的版本不兼容拦截。
- 用户已确认 DSH `0.2.1-rc.4` 的 dev 环境运行正常。请配套使用 Driver `0.1.3`。
- Target DSH `0.2.1-rc.4` in development dependencies, host peers and compatibility declarations, including the top-level `engines.dsh` read by the installer, so this RC accepts the plugin.
- The user confirmed the DSH `0.2.1-rc.4` development environment works. Use companion Driver `0.1.3`.

## 0.2.4

- 更新 editor 与配套 driver 的 DSH 支持基线至 `0.2.1-rc.2`，并升级对应的 Cordis、Schemastery 与 UI/host 开发依赖。
- Move the editor and companion driver support baseline to DSH `0.2.1-rc.2`, and update the matching Cordis, Schemastery and UI/host development dependencies.

## 0.2.3

### 中文

**增强 AI 协作与工作簿恢复**

- 完善桥接协议，支持兼容 Driver 接入；由用户在「设置 → 电子表格编辑器」中明确选择。
- 支持 Driver 请求打开工作区文件，等待工作簿加载完成后执行操作。
- 增加 AI 执行期间的独占编辑保护，以及关闭、切换后的未保存内容恢复；恢复缓存仅在当前页面生命周期内有效。
- 按聊天、文件和加载实例隔离任务与恢复缓存；完善取消检查，阻止取消后的后续自动保存。
- 中文版 SpreadJS、Designer、IO、语言资源及全部扩展升级至 `19.2.1`。
- 适配 DSH `0.2.0-rc.2`，需要 Node.js ≥22.19。

**升级提示：** 本版支持范围统一为 DSH `0.2.0-rc.2`。请同步升级配套 Driver，使用完整的实例身份、独占锁与恢复协议。低版本 SpreadJS 打开本版保存的文件前，请确认格式兼容性。

### English

**Improve AI collaboration and workbook recovery**

- Extend the bridge contract for compatible drivers, selected explicitly under Settings → Spreadsheet Editor.
- Allow drivers to request a workspace file and wait until its Workbook is ready.
- Protect the editor with an exclusive lease during AI work; preserve unsaved snapshots when the editor closes or switches. Recovery lasts only for the current page lifetime.
- Isolate tasks and recovery by chat, file and load instance; check cancellation before subsequent automatic saves.
- Upgrade the complete Chinese SpreadJS / Designer / IO / resources / extension suite to `19.2.1`.
- Target DSH `0.2.0-rc.2` and require Node.js ≥22.19.

**Upgrade notes:** This version supports DSH `0.2.0-rc.2`. Update the companion Driver together for the complete identity, lease and recovery protocol. Check file-format compatibility before opening files saved by this build in an older SpreadJS version.

## 0.2.2

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
- **新增「SpreadJS 桥」设置页：决定由谁来使用屏幕上打开的那份工作簿**：编辑器把它手里的**活工作簿**交给用户在设置里选中的那一个「桥」（bridge）——装上 `@grapecity-software/dsh-spreadjs-driver` 之后，AI 就能直接改你正在看的这张表，而不是另开一个文件去写。名册是**登记制**：任何插件都可以报名，但**只有一个**会拿到工作簿，就是用户选中的那个；工作簿是**递出去的引用，不是副本**，所以通过它改的样式会立刻出现在表格里。没装任何桥时名册为空，编辑器行为与没有这项功能时完全一样。
- **这个选择一定留得住**：存在 DSH 自己的设置文档里（本插件那条 Loader 记录，命名空间 `spreadjs-editor`，字段 `bridge`）。让写入被接受要靠 schema 里声明 `.volatile()`——DSH 只接受对 volatile 字段的设置写入，否则每次点选都被宿主拒绝；而**拒绝是以 resolve `false` 的形式回来的，不是抛错**，所以只挂 `.catch` 会让它看起来一切正常、重启后却变回「不使用」。设置页现在两种失败都会说明（`refused` / `failed`），因为后果要到下次启动才看得见。字段**故意不给默认值**：「从没选过」与「明确选了不使用」是两个不同状态，将来若要加「默认选中唯一的桥」只能靠这个区分。指向已被卸载的桥的旧选择，会在名册确实拿到条目且其中没有它时清掉；**名册为空时一律保留**——插件还没加载完和桥被卸载两种情况长得一样，那时清掉就等于把重装本该恢复的选择扔掉。
- **保存失败不再被报告成保存成功**：从页面外驱动编辑器的那条路（桥，以及任何等在 promise 上的调用方）现在拿到的是真话。此前四种情况都会被吞掉——工作簿还没载入、已有另一次保存在进行、写盘失败、以及「没有文件可写、只能下载一份」——前两种静默返回，后两种只写进面板右下角的状态栏，而 promise 照样 resolve，于是调用方会以为文件已经写好。现在这四种都抛错；状态栏照旧先说给人看，两处并不重复：一处说给看着面板的人，一处说给等在 promise 上的人。面板头部与 Designer 自己的保存命令没有 promise 可传，仍然只报状态栏，但那一处吞掉失败是有名有姓、写了原因的。
- **设置页按 DSH 自己设置页的行规格重画，不再是裸按钮**：这一页最初**只有类名、一条样式都没有**，所以浏览器按默认 `<button>` 画——灰底、居中、内缩；标题与「使用中」是两个相邻的行内元素、中间没有间距，于是挤成了「SpreadJS Driver使用中」。现在整页照 DSH 自己设置页的行规格（`.5px` 分隔线、每行 16px 纵向留白、标签与右侧之间 24px、标题 14px/20px、说明 12px/18px），颜色全部走 `--dsw-*` 令牌，因此跟随浅色/深色。**选中改成右侧一个对勾，不再写「使用中」**：这一页知道的是「选了谁」，不是「谁正握着工作簿」——桥随面板开关而变，而设置文档只记一个选择，写「使用中」超出了它实际知道的事；对勾是形状，顺带省掉一处翻译。
- **这一页现在是一组单选，不是三个开关**：容器 `role="radiogroup"`、每行 `role="radio"` + `aria-checked`，整组只有一个 Tab 停靠点，方向键在组内移动并选中。此前用的是 `aria-pressed`，那等于说「这个按钮被按下了」，对「选一个即排除其余」是错的语义；这也正是 DSH 自己画同类列表的方式。空名册时的说明文字也改走了语言表（此前写死英文）。
- 构建与验收基线升到 DSH `0.2.0-rc.2`（`npm run typecheck`、201 项单测、两个 smoke、`verify:package`、`probe:live` 全部通过）。升它的直接原因是「SpreadJS 桥」设置页：`settings.section` 这个槽位在 `0.2.0` 由**设置领域包**（`@deepseek-ai/dsh-client-ui-settings`）通过 declaration merging 扩展 `ui-slots` 的 `SlotMap` 来声明，而仓库此前的 devDeps 钉在 `0.1.7-rc.2`，编译期根本不认识这个槽位名——于是 `package.json` 补上了该包，并在注册处加了一行 type-only import 把 augmentation 带进程序（`./client` 子入口才是声明所在的那条链，编译期擦除，不进产物、不增加运行时依赖）。插件在 `0.1.5-rc.3` 上仍可运行（该版本没有文档头部动作槽，保存入口只有 `Ctrl+S`，未保存状态靠面板右下角的浮动胶囊）；`0.1.7-rc.2` 上文档头部与预览行为都在，只是设置里没有「SpreadJS 桥」这一页。

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
- **New Settings page: a "SpreadJS bridge" chooses who may drive the open workbook**: the editor hands the **live workbook** to whichever bridge the user selects in Settings — with `@grapecity-software/dsh-spreadjs-driver` installed, that lets the AI edit the very sheet on screen instead of writing a separate file. The roster is a **register**, not a broadcast: any plugin may enter, but exactly one holds the workbook, the one the user picked. What is handed over is a **live reference, never a copy**, which is why a style written through it appears in the sheet immediately. With no bridge installed the roster is empty and the editor behaves exactly as it does without the feature.
- **The choice is kept.** It lives in DSH's own settings document (this plugin's Loader entry: namespace `spreadjs-editor`, field `bridge`). Making the write *accepted* needs the field declared `.volatile()` in the schema — DSH accepts a settings write only for a volatile field — and a refusal comes back as a **resolved `false` rather than a rejection**, so handling only the rejection made every click look fine while the choice evaporated on the next start. The page now reports both kinds of failure (`refused` / `failed`), because the consequence is not visible until the next launch. The field deliberately carries **no default**: "never chosen" and "chosen None" are different states, and only that difference lets a future default-if-unset rule exist. A stored id that no longer names anything is cleared once the roster has entries and none of them is it — while the roster is **empty** it is kept, because "no provider has loaded yet" and "the provider is gone" look identical, and clearing on that would throw away a choice a reinstall should restore.
- **A failed save is no longer reported as a save**: the path that drives the editor from outside the page — the bridge, and any caller waiting on the promise — now hears the truth. Four cases used to be swallowed: a workbook that is not ready, another save already running, a failed write, and "there is no file to write, so the bytes went to a download". The first two returned silently; the last two only reached the status line while the promise still resolved, so the caller went on to describe a file that was never written. All four throw now. The status line still reports first, for the person looking at the panel: one voice for them, one for whoever is waiting on the promise. The header button and the Designer's own Save command have no promise to carry a rejection, so they still report only to the status line — but that is now one named, explained place rather than a habit.
- **The Settings page was redrawn to the harness's own settings-row spec, off bare buttons**: the page shipped with class names and **no rule for any of them**, so the browser drew its default `<button>` — grey, centred, inset — and the title and the "In use" tag were two adjacent inline spans with no gap between them, collapsing into `SpreadJS Driver使用中`. It now follows the product's own settings rows (a `.5px` separator, 16px of vertical padding, 24px between the label and the right-hand side, a 14px/20px title and 12px/18px prose) and every colour is a `--dsw-*` token, so it follows light and dark. **The selection is now a tick on the right rather than the words "In use"**: what this page knows is *which bridge was chosen*, not *which one is holding a workbook right now* — a bridge comes and goes with the panel, while the settings document records only a choice — so the words claimed more than the page can know. A tick is also a shape, which saves a translation.
- **The page is now one radio group rather than three toggles**: `role="radiogroup"` over `role="radio"` rows with `aria-checked`, a single tab stop for the group, and the arrow keys moving the selection within it. It used `aria-pressed` before, which says "this button is currently pressed" — the wrong claim about a choice that excludes the others. It is also how the harness draws its own lists of this kind. The no-bridge prose also goes through the locale table now (it was hard-coded English).
- Built and verified against DSH `0.2.0-rc.2` (`npm run typecheck`, 201 unit tests, both smokes, `verify:package`, `probe:live` all green). The immediate reason to move it is the SpreadJS bridge settings page: in `0.2.0` the `settings.section` slot is declared by the **settings domain package** (`@deepseek-ai/dsh-client-ui-settings`), which extends ui-slots' `SlotMap` through declaration merging — and the repo's devDeps were still pinned to `0.1.7-rc.2`, so the compiler did not know that name at all. `package.json` now carries that package, and the registration site has one type-only import bringing the augmentation into the program (the `./client` subpath is the chain that reaches the declaring file; erased at build time, so it adds nothing to the bundle and no runtime dependency). The plugin still runs on `0.1.5-rc.3`, which has no document-header actions slot — there, `Ctrl+S` is the only Save entry and unsaved work shows in the panel's floating pill — and on `0.1.7-rc.2` the header and preview behaviour are all there, Settings just has no SpreadJS bridge page.

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
