# Release Notes / 版本记录

## 0.2.0

> 从 `0.1.4` 升级属于破坏性变更。仓库里准备过的 `0.1.5` 从未发布，其内容已并入本版。

### 中文

- **改用 DSH 自带的右侧栏**：不再依赖第三方 `dsh-better-sidebar`（`@linxin666/dsh-web-all`），改为注册到官方文档扩展点（`ctx.documentPreviews` + `sidebar.right.tab.document` 插槽）。安装本插件不再需要任何第三方侧边栏插件。
- **文件读取交给 DSH**：文件内容由官方文档宿主读好后交给插件（`bytes-complete`），插件不再使用 `/sidebar/file` 路由。
- **新增保存能力**：编辑后可直接写回原文件（`POST /spreadjs/api/save`）。
  - 保存只有一处入口：Designer「文件」菜单里的「保存到工作区」，位置就是原本内置"另存为 .sjs"那颗按钮；按钮按内置按钮的尺寸重建（`margin:10px 50px`、`height:30`、显式宽度），不再被挤到边框上折行。
  - 文件菜单走的是它自己的派发（`FileMenuHandler.processPropertyChanged`），不是命令表，所以改命令表对文件菜单无效。插件改为在构造设计器前改写文件菜单模板：左侧只保留 `SaveSJS` 一项，右侧只保留该内容面板（`data-activeCategory_main=SaveSJS`），并把面板里的内置操作（文件名框 + `.sjs` 下载按钮）换成我们自己的按钮，其余分类与分隔线整类移除；需要副本时走 DSH 自己的文件下载。
  - 工作簿载入完成前拒绝保存：此时工作簿还是空的，保存会用空表覆盖原文件；载入完成前该命令会拒绝并说明。
  - 写入目标必须位于会话工作区内，越界直接拒绝；
  - 使用「打开时的内容哈希」做冲突守卫：磁盘文件在此期间被改过则拒绝覆盖并说明原因，不会静默冲掉别人的修改；
  - 同目录临时文件 + rename 原子替换，读者不会看到半个文件；
  - 不弹二次确认——按下保存即用户意图。
- **运行时主题也跟着系统走**：Designer 自身的深浅色一直由 `setTheme()` 处理，但它只覆盖设计器自己的 Ribbon 与面板；工作簿那一层用的是 SpreadJS 的运行时样式表，之前一直停在白底。现在该样式表会随主题在 `excel2013white` / `excel2016black` 之间**就地互换**（不会多出第二个样式表），并调用 `workbook.refresh()` 重绘。
- **修复深色下 Designer 图标颜色不对**：根因是只换了 `setTheme()` 的颜色变量，而图标是烘焙在样式表里的 SVG 资源——例如文件菜单的返回箭头在浅色预设里是白箭头，靠 `filter:invert(1)` 在浅底上呈现为黑；颜色变量把背景压暗却换不掉资源，于是成了黑底上的黑箭头。现在按官方文档在浅色/深色**预设样式表之间整体互换**，`setTheme()` 仅作为叠加的调色层，Ribbon 等处的图标资产一并回到正确变体。
- **面板去掉标题栏与状态栏**：文件名由 DSH 的标签页显示，编辑器区域因此多出空间；保存/冲突反馈改为编辑器右下角的浮层提示（进行中与失败常驻，成功类 4 秒后淡出，不再永久占一行）。
- **新增「关于」弹窗**：Designer「设置」标签里增加「关于」按钮，显示插件版本、内置的 SpreadJS 与 Designer 版本、授权是否已配置，以及版权信息（版本信息原来挤在状态栏里）。
- **为什么保存由本插件提供**：DSH 的文件系统接口能读二进制、却只能写文本（`ctx.fs` 仅提供 `writeText` / `editText`），因此平台和 Agent 都无法写回工作簿。写入逻辑已收敛为可替换的内部实现，官方将来提供二进制写入后可直接切换。
- **要求 DSH `>=0.1.5-rc.3`**。客户端契约同步升级：不再使用已停止发布的 `@deepseek-ai/dsh-client-runtime`，改用 `@deepseek-ai/cordis` + `@deepseek-ai/dsh-client-ui-slots`。
- 新增 `spreadjsHostBridge` 桥：把当前正在编辑的工作簿（活对象，不是文件副本）交给配套的 `@grapecity-software/dsh-spreadjs-driver`，装上它即可让 Agent 通过对话直接修改你眼前这张表；未安装 driver 时插件行为与之前完全一致。
- 桥接契约变化：`getActivePath()` 返回 DSH 资源地址（`dsh-resource://file/session/…`）而非绝对路径，该地址同时携带会话与路径，保存接口亦以它定位文件。
- 新增配置项 `maxSaveBytes`（默认 64 MB）与 `trustedHosts`。
- 新增 `npm run probe:live` 运行时探针：对着**正在运行的** DSH 真实验证整条保存链路（真实 `ctx.fs` 的解析与落盘、冲突守卫、工作区越界拒绝），无需浏览器。
- **内置 SpreadJS 升级到 19.2.0**（Designer、IO、中文资源等共 20 个 `@grapecity-software/*` 依赖同步升级）。升级前逐条复核了本插件所依赖的产品内部结构，19.2.0 均未变化：文件菜单模板（`SaveSJS` 导航值、`data-activeCategory_main`、内置保存按钮的 `width:70`/`height:30`/`margin:10px 50px`）、两套设计器预设的 `--sjs-color-background-2`（`#f5f5f5` / `#141414`）与返回箭头依赖的 `invert(1)`、运行时主题样式表，以及 `registerTemplate` / `setTheme` / `showDialog` 三个静态 API。

### English

- **Switched to the harness's own right Sidebar**: no dependency on the third-party `dsh-better-sidebar` (`@linxin666/dsh-web-all`) any more. The plugin registers with the product's document extension points (`ctx.documentPreviews` plus the `sidebar.right.tab.document` slot), so no third-party sidebar plugin is required.
- **The harness reads the file**: the document owner hands over complete bytes (`bytes-complete`); the plugin no longer uses the `/sidebar/file` route.
- **Saving**: the editor writes the workbook back to its file (`POST /spreadjs/api/save`).
  - Save has one entry point: `保存到工作区` (save to workspace) in the Designer's File tab, where the built-in "save as .sjs" button used to be. The button is rebuilt at the built-in button's own size (`margin:10px 50px`, `height:30`, an explicit width), so its label is no longer squeezed against the border and wrapped.
  - The File tab dispatches through its own handler (`FileMenuHandler.processPropertyChanged`), not the command table, so replacing the command has no effect on it. The plugin instead rewrites the menu template before the Designer is built: the nav keeps only `SaveSJS`, the content column keeps only that panel (`data-activeCategory_main=SaveSJS`), the built-in operations inside it (filename box, `.sjs` download button) become our button, and every other category and separator is removed. A copy is what the harness's own file download is for.
  - A workbook that is still loading refuses to save: it holds no content yet, so saving would overwrite the file with an empty book.
  - The target is confined to the session workspace, a content-hash conflict guard refuses to clobber a file changed since it was opened, and a same-directory temporary file is renamed over the target so no reader sees half a workbook. No second confirmation — pressing Save is the user's intent.
- **The runtime theme follows the system too**: the Designer's own light/dark handling (`setTheme()`) reaches the Designer's ribbon and panels only; the workbook beneath it is styled by the SpreadJS runtime stylesheet, which used to stay white. That stylesheet is now swapped in place between `excel2013white` and `excel2016black` — never a second sheet — and the workbook is repainted with `workbook.refresh()`.
- **Fixed the wrong icon colour in dark mode**: the root cause was recolouring through `setTheme()` alone, while the icons are SVG assets baked into the stylesheet — the File-menu back arrow, for one, is a white arrow in the light preset that an `filter:invert(1)` rule turns black over a light background. Recolouring darkened the background but could not replace the asset, leaving a black arrow on a dark one. Both presets are now swapped wholesale (`designer.light` ↔ `designer.dark`), as the product documents, and `setTheme()` is layered on top as a palette; the ribbon's other icon assets come along to the right variant.
- **The panel lost its title bar and status bar**: the harness tab already names the file, so the editor gains that space back; save and conflict feedback moved into a floating message over the editor (in-flight and failed messages persist, success messages fade after four seconds) instead of holding a row forever.
- **New About dialog**: a button in the Designer's settings tab opens a dialog with the plugin version, the bundled SpreadJS and Designer versions, the licence state and the copyright — the versions that used to sit in the status bar.
- **Why this plugin carries the write**: the harness filesystem seam reads bytes but writes text only, so neither the harness nor an agent can write a workbook. The write sits behind an internal seam so it can switch to a platform byte write later.
- **Requires DSH `>=0.1.5-rc.3`**. The client contract moves off the discontinued `@deepseek-ai/dsh-client-runtime` to `@deepseek-ai/cordis` + `@deepseek-ai/dsh-client-ui-slots`.
- Add the `spreadjsHostBridge` bridge: it hands the workbook you are editing (a live object, not a file copy) to the companion `@grapecity-software/dsh-spreadjs-driver`, so an agent can edit the sheet on screen; with the driver absent the plugin behaves exactly as before.
- Bridge contract change: `getActivePath()` now returns the DSH resource address (`dsh-resource://file/session/…`) rather than an absolute path; the address carries both session and path, and the save endpoint resolves it that way.
- New configuration: `maxSaveBytes` (default 64 MB) and `trustedHosts`.
- Add `npm run probe:live`, a runtime probe that verifies the whole save path against a **running** DSH (real `ctx.fs` resolution and write, the conflict guard, the workspace-escape refusal) with no browser involved.
- **Bundled SpreadJS moved to 19.2.0** (the Designer, IO, the Chinese resources and seventeen more `@grapecity-software/*` dependencies with it). Every product internal this plugin leans on was re-checked against 19.2.0 and is unchanged: the File-menu template (`SaveSJS` nav value, `data-activeCategory_main`, the built-in save button's `width:70`/`height:30`/`margin:10px 50px`), both Designer presets' `--sjs-color-background-2` (`#f5f5f5` / `#141414`) and the `invert(1)` the back arrow relies on, the runtime theme stylesheets, and the `registerTemplate` / `setTheme` / `showDialog` statics.

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
