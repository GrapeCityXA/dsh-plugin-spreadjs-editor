# Release Notes / 版本记录

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
