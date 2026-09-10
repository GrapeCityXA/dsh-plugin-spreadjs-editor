# Release Notes / 版本记录

## 0.1.2 (Unreleased / 尚未发布)

### 中文

- 在 README 和编辑器顶部显示内置 SpreadJS/Designer 19.1.4，并提示旧版文件兼容性及备份、另存副本要求。
- 修复客户端模块注册 ID，使其与 npm 包名 `@grapecity-software/dsh-spreadjs-editor` 一致。
- 修复插件 YAML 配置中带 scope 包名缺少引号导致的解析错误。
- 改为发布预构建的 SpreadJS 和 Designer 客户端，安装时不再编译，也无需为本插件配置安装脚本白名单。
- 将已打包组件及构建工具移到开发依赖，排除源码和 source map，保留第三方授权文件。
- 新增独立的 `designerLicenseKey` 配置；`licenseKey` 继续用于 SpreadJS，不再同时赋给 Designer。
- 声明最低 DSH 版本为 `0.1.2-rc.1`；文件树集成使用 ui-all 提供的 `dsh-better-sidebar`，无需旧的 `dsh-plugin-web-editors`。
- 更新插件展示名称、安装步骤、免费插件与商业组件的授权说明，以及 SaaS 部署说明。
- 增加全新临时目录离线安装 tgz 的验证，检查客户端模块注册和独立许可证配置接口。

升级提示：移除旧的 `dsh-plugin-web-editors` 前置插件及其 profile patch；本插件不再需要 `onlyBuiltDependencies` 放行项。已有 SpreadJS 许可证继续使用 `licenseKey`；Designer 授权需单独配置 `designerLicenseKey`。修改许可证配置后重启 DSH 并刷新网页。

### English

- Show bundled SpreadJS/Designer 19.1.4 in the README and editor, with older-version compatibility and backup/save-a-copy guidance.
- Fix the client module registration ID to match the scoped npm package name.
- Quote the scoped package name in the YAML plugin patch to fix parsing.
- Ship prebuilt SpreadJS and Designer client code; installation no longer compiles the plugin or requires an install-script allow-list entry.
- Move bundled components and build tools to development dependencies; exclude sources and source maps while preserving vendor license files.
- Add `designerLicenseKey`; retain `licenseKey` for SpreadJS without assigning it to Designer.
- Require DSH `>=0.1.2-rc.1`. File-tree integration uses ui-all's `dsh-better-sidebar`, not the former `dsh-plugin-web-editors` prerequisite.
- Update the display name, installation steps, licensing explanation, and SaaS deployment guidance.
- Add fresh offline tarball-install checks for client registration and independent license configuration.

Upgrade notes: remove the old `dsh-plugin-web-editors` dependency and its profile patch. This plugin no longer needs an `onlyBuiltDependencies` entry. Keep the SpreadJS key in `licenseKey` and configure the Designer key separately in `designerLicenseKey`. Restart DSH and refresh the browser after changing keys.

## 0.1.1

- 更新 README 中的编辑器截图。
- Update the editor screenshot in the README.

## 0.1.0

- 首次以 `@grapecity-software/dsh-spreadjs-editor` 包名发布。
- 提供基于 SpreadJS 和 Designer 的工作簿编辑，通过 `betterSidebar` 集成文件树，支持 `.xlsx`、`.xlsm`、`.csv`、`.sjs` 和 `.ssjson`。
- Initial release under the scoped npm package name.
- Provide SpreadJS and Designer workbook editing through `betterSidebar`, supporting `.xlsx`, `.xlsm`, `.csv`, `.sjs`, and `.ssjson`.
