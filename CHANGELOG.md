# Release Notes / 版本记录

## 0.2.0

> 破坏性变更：本版要求 DSH `>=0.1.5-rc.3`，并改用 DSH 自带的右侧栏，不再需要任何第三方侧边栏插件；升级前请先升级 DSH。仓库里准备过的 `0.1.5` 从未发布，其内容已并入本版。

### 中文

- **编辑后可以直接保存回原文件**：Designer「文件」菜单里点「保存到工作区」即可。写回限定在会话工作区内，带冲突检测（文件被外部改过会拒绝并说明原因），按下即写入、不再二次确认。「文件」菜单里只保留这一个动作，其余分类（新建、打开、导入、导出、打印、信息）已移除，需要副本时用 DSH 自己的文件下载。
- **浅色/深色完整跟随系统**：此前只有工具栏和面板变深、工作表区域仍是白底，现在一起切换。
- **界面更干净**：去掉面板顶部的文件名标题栏（DSH 标签页已有）和底部状态栏，保存与冲突提示改为右下角浮层。
- **新增「关于」**：Designer「设置」标签里可查看插件版本、内置 SpreadJS 与 Designer 版本、授权状态和版权信息。
- **可以让 AI 直接改你正在编辑的表**：另装配套的 `@grapecity-software/dsh-spreadjs-driver` 后，可通过对话让 Agent 修改当前工作簿；未安装时插件行为不变。
- 内置 SpreadJS 升级到 19.2.0；新增配置项 `maxSaveBytes`（默认 64 MB）与 `trustedHosts`。

### English

- **Save your edits straight back to the file you opened**: press `保存到工作区` (save to workspace) in the Designer's File tab. The write stays inside the session workspace and is guarded against conflicts (a file changed on disk is refused, with a reason), and it writes immediately with no second prompt. That is now the File tab's only action — new, open, import, export, print and info are gone, so use the harness's own file download for a copy.
- **Light and dark follow the system all the way**: previously only the toolbars and panels darkened while the sheet stayed white.
- **A cleaner panel**: the file-name title bar (the harness tab already shows it) and the status bar are gone, and save or conflict messages appear as a floating notice in the corner.
- **A new About dialog**: the Designer's settings tab shows the plugin and bundled versions, the licence state and the copyright.
- **Let an agent edit the sheet you are looking at**: with the companion `@grapecity-software/dsh-spreadjs-driver` installed, you can ask an agent to change the open workbook in conversation; without it the plugin behaves as before.
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
