# Release Notes / 版本记录

## 0.2.0

> 从 `0.1.4` 升级属于破坏性变更。仓库里准备过的 `0.1.5` 从未发布，其内容已并入本版。

### 中文

- **保存**：编辑器可把改动直接写回你打开的那个文件，入口只有一处——Designer「文件」菜单里的「保存到工作区」。
  - 「文件」菜单里只保留这一个动作，新建、打开、导入、导出、打印、信息等分类与分隔线一并移除；需要副本时用 DSH 自己的文件下载。
  - 写回是原子的（同目录替换），限定在会话工作区内，并带冲突检测：文件在打开后被外部改过会拒绝覆盖并说明原因。
  - 按下保存即写入，不再二次确认；工作簿尚未载入完成时会拒绝保存，避免用空表覆盖原文件。
  - DSH 的文件系统接口目前只能写文本，写回工作簿因此由本插件自己完成。
- **改用 DSH 自带的右侧栏**：不再依赖第三方侧边栏插件，文件内容也交由 DSH 读取。
- **深浅色主题完整跟随系统**：此前只有 Designer 的工具栏与面板变深、表格区域仍是白底，现在工作表一起切换；并修复了深色下文件菜单返回箭头等图标颜色不对的问题。
- **界面更简洁**：去掉面板顶部只显示文件名的标题栏（DSH 标签页已有）和底部状态栏；保存、冲突等提示改为编辑器右下角浮层（进行中与失败常驻，成功类数秒后淡出）。
- **新增「关于」**：Designer「设置」标签中的「关于」按钮可查看插件版本、内置 SpreadJS 与 Designer 版本、授权是否已配置以及版权信息。
- **内置 SpreadJS 升级到 19.2.0**（Designer、IO、中文资源等 20 个相关包同步升级）。
- **要求 DSH `>=0.1.5-rc.3`**，客户端契约改用 `@deepseek-ai/cordis` + `@deepseek-ai/dsh-client-ui-slots`（原 `@deepseek-ai/dsh-client-runtime` 已停止发布）。
- 新增 `spreadjsHostBridge` 桥接：把当前编辑中的工作簿（活对象，不是文件副本）交给配套的 `@grapecity-software/dsh-spreadjs-driver`，装上它即可让 Agent 通过对话直接修改这张表；未安装 driver 时插件行为不变。桥接契约变化：`getActivePath()` 返回 DSH 资源地址（同时携带会话与路径），保存接口以它定位文件。
- 新增配置项 `maxSaveBytes`（默认 64 MB）与 `trustedHosts`；另加维护者自检脚本 `npm run probe:live`（对正在运行的 DSH 验证保存链路，无需浏览器）。

### English

- **Saving**: the editor writes your changes straight back to the file you opened, with a single entry point — `保存到工作区` (save to workspace) in the Designer's File tab.
  - The File tab keeps only that action; new, open, import, export, print and info are removed outright. A copy is what the harness's own file download is for.
  - The write is atomic (a same-directory replacement), confined to the session workspace, and guarded against conflicts: a file changed on disk since it was opened is refused, with an explanation.
  - Pressing Save writes immediately, with no second prompt; a workbook that is still loading refuses to save rather than overwrite the file with an empty book.
  - The harness filesystem interface writes text only, so writing a workbook back is done by this plugin itself.
- **Uses the harness's own right Sidebar**: no third-party sidebar plugin required, and the harness reads the file contents.
- **Light/dark now follows the system all the way**: previously only the Designer's toolbars and panels darkened while the sheet stayed white — the worksheet switches too now, and the wrong icon colours in dark mode (the File-menu back arrow among them) are fixed.
- **A simpler panel**: the title bar (the harness tab already names the file) and the status bar are gone; save and conflict messages appear as a floating notice in the corner — in-flight and failed messages persist, success messages fade after a few seconds.
- **New About dialog**: a button in the Designer's settings tab reports the plugin version, the bundled SpreadJS and Designer versions, the licence state and the copyright.
- **Bundled SpreadJS moved to 19.2.0** (the Designer, IO, the Chinese resources — 20 packages in all).
- **Requires DSH `>=0.1.5-rc.3`**; the client contract moves to `@deepseek-ai/cordis` + `@deepseek-ai/dsh-client-ui-slots` (`@deepseek-ai/dsh-client-runtime` is discontinued).
- Add the `spreadjsHostBridge` bridge: it hands the workbook you are editing (a live object, not a file copy) to the companion `@grapecity-software/dsh-spreadjs-driver`, so an agent can edit the sheet on screen; without the driver the plugin behaves exactly as before. Contract change: `getActivePath()` returns the DSH resource address (session and path together) and the save endpoint resolves the file from it.
- New configuration: `maxSaveBytes` (default 64 MB) and `trustedHosts`; plus `npm run probe:live` for maintainers, which verifies the save path against a running DSH with no browser involved.

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
