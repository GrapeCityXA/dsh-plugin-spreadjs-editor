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
- 基于 GrapeCity 官方 SpreadJS 和 SpreadJS Designer，提供完整的表格编辑能力。
- 与 ui-all 文件树集成，打开文件后立即进入编辑界面，不需要单独的编辑器页面。
- Designer 界面自动跟随系统 light/dark 偏好。

### 快速开始

要求 DSH `>=0.1.2-rc.1`，并已安装提供 `dsh-better-sidebar` 的 `@linxin666/dsh-web-all`（ui-all）。不再需要 `dsh-plugin-web-editors`。

npm 包自带预构建的 SpreadJS 和 Designer 客户端，无需放行安装脚本或本地编译。安装插件并启动：

```sh
dsh plugin --profile web add @grapecity-software/dsh-spreadjs-editor
dsh --profile web
```

启动后，在 Web UI 右侧文件树中打开 `.xlsx`、`.xlsm`、`.csv`、`.sjs` 或 `.ssjson` 文件即可。

安装直接使用包内的客户端文件，不会运行构建脚本。

如果使用 npx 运行 DSH，使用同样的命令：

```sh
npx --yes @deepseek-ai/dsh@latest plugin --profile web add @grapecity-software/dsh-spreadjs-editor
npx --yes @deepseek-ai/dsh@latest --profile web
```

DeepSeek Harness CLI 是 `@deepseek-ai/dsh`，不要使用同名 npm 包 `dsh`。

从旧版本升级后，不再需要本插件的 `onlyBuiltDependencies` 放行项。

### 常见问题

**我已经有 ui-all，还需要额外安装什么吗？**

不需要。ui-all 自带 `dsh-better-sidebar`，本插件会直接注册到它。

**安装完还需要手动构建吗？**

不需要。发布包已包含构建产物，只有从源码开发时才需要构建。

**SpreadJS 会跟随每次安装自动升级吗？**

不会自动跨版本升级。所有 GrapeCity 官方包在 `package.json` 中锁定为同一版本；维护者会在发布新版时统一同步。

### 配置

正式部署时，在 profile 的 `cordis.patch.yml` 中配置 license key：

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS 部署许可证。留空以带水印的试用模式运行。 |
| `designerLicenseKey` | `''` | 独立的 SpreadJS Designer 部署许可证。留空保持 Designer 试用状态。 |

```yaml
- id: spreadjs-editor
  config:
    licenseKey: 'YOUR_SPREADJS_KEY'
    designerLicenseKey: 'YOUR_DESIGNER_KEY'
```

现有 `licenseKey` 配置仍用于 SpreadJS，不会再赋给 Designer。配置从服务端下发到浏览器，用于客户端激活；修改后请重启 DSH 并刷新网页。

### 支持的文件

| 文件 | 说明 |
| --- | --- |
| `.xlsx` / `.xlsm` | Excel 工作簿 |
| `.csv` | CSV 文本 |
| `.sjs` | SpreadJS 原生工作簿格式 |
| `.ssjson` | SpreadJS JSON 工作簿 |

### 从源码安装

如果你需要从源码运行或参与开发：

```sh
git clone https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor.git

cd dsh-plugin-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-plugin-spreadjs-editor
```

### 许可

插件代码免费提供，采用 MIT 许可证。预构建包包含的 SpreadJS 和 Designer 属于葡萄城商业产品，不适用插件的 MIT 许可证；未配置授权时可在相应试用条款下体验带水印的界面，不代表免费商业授权。

可将 DSH 与插件部署为 SaaS 服务，表格仍在浏览器端运行。部署者应根据服务场景获取适用的 SpreadJS 和 Designer 授权，分别配置许可证。身份认证、租户与文件隔离由宿主服务负责，本插件不提供这些能力。

### 维护者

每次发布前更新 `CHANGELOG.md` 中对应版本的变更、兼容性和升级说明。当前版本尚未发布时，继续归并到同一版本条目；实际发布后再填写发布日期。

发布前执行 `npm run prepublishOnly`。该检查包含类型检查、单元测试、构建、smoke 测试，以及在临时目录离线安装 tarball，验证预构建客户端注册和许可证配置接口。它不代替浏览器中实际打开、编辑和保存工作簿的验证。

发布新版前，统一把所有 GrapeCity 依赖同步到最新版本：

```sh
npm run grapecity:update -- --latest
```

---

## English

### Features

- Opens `.xlsx`, `.xlsm`, `.csv`, `.sjs`, and `.ssjson` files.
- Built on GrapeCity's official SpreadJS and SpreadJS Designer for full spreadsheet editing.
- Integrated with the ui-all file tree: open a file and start editing immediately, with no separate editor page.
- The Designer follows the OS light/dark preference.

### Quick Start

Requires DSH `>=0.1.2-rc.1` and `@linxin666/dsh-web-all` (ui-all), which provides `dsh-better-sidebar`. The former `dsh-plugin-web-editors` prerequisite is no longer needed.

The npm package includes prebuilt SpreadJS and Designer client code. No install-script allow-list or local compilation is required. Install the plugin and start DSH:

```sh
dsh plugin --profile web add @grapecity-software/dsh-spreadjs-editor
dsh --profile web
```

After startup, open `.xlsx`, `.xlsm`, `.csv`, `.sjs`, or `.ssjson` from the right-side file tree.

Installation uses the packaged client files without running a build script.

If you run DSH through npx, use the same commands:

```sh
npx --yes @deepseek-ai/dsh@latest plugin --profile web add @grapecity-software/dsh-spreadjs-editor
npx --yes @deepseek-ai/dsh@latest --profile web
```

Use `@deepseek-ai/dsh`; the unrelated npm package `dsh` is not the DeepSeek Harness CLI.

After upgrading, this plugin no longer needs an `onlyBuiltDependencies` allow-list entry.

### FAQ

**I already have ui-all. Do I need to install anything else?**

No. ui-all bundles `dsh-better-sidebar`, and this plugin registers directly with it.

**Do I need to build manually after installation?**

No. The package includes built artifacts. Building is only required when developing from source.

**Will SpreadJS upgrade automatically with every install?**

No. All GrapeCity packages are pinned to the same version in `package.json`; maintainers sync them together before a new release.

### Configuration

For production use, set the license key in the profile's `cordis.patch.yml`:

| Key | Default | Description |
| --- | --- | --- |
| `licenseKey` | `''` | SpreadJS deployment key. Empty runs in evaluation mode with a watermark. |
| `designerLicenseKey` | `''` | Separate SpreadJS Designer deployment key. Empty keeps Designer in evaluation mode. |

```yaml
- id: spreadjs-editor
  config:
    licenseKey: 'YOUR_SPREADJS_KEY'
    designerLicenseKey: 'YOUR_DESIGNER_KEY'
```

Existing `licenseKey` settings continue to configure SpreadJS and are no longer assigned to Designer. The server delivers these keys to the browser for client activation. Restart DSH and refresh the page after changing them.

### Supported files

| File | Description |
| --- | --- |
| `.xlsx` / `.xlsm` | Excel workbook |
| `.csv` | CSV text |
| `.sjs` | SpreadJS native workbook format |
| `.ssjson` | SpreadJS JSON workbook |

### Install from source

To run from source or contribute:

```sh
git clone https://github.com/GrapeCityXA/dsh-plugin-spreadjs-editor.git

cd dsh-plugin-spreadjs-editor
npm install
npm run build

dsh plugin --profile web add ../dsh-plugin-spreadjs-editor
```

### License

The plugin code is free and MIT-licensed. Bundled SpreadJS and Designer are GrapeCity commercial products and are not covered by the plugin's MIT license. Without keys, users can try the watermarked interface under the applicable evaluation terms; this does not grant free commercial usage.

DSH and the plugin can be hosted as a SaaS service, with spreadsheets still running in the browser. Operators should obtain licenses appropriate to their deployment and configure SpreadJS and Designer keys separately. Authentication, tenant isolation, and file isolation are responsibilities of the host service.

### Maintainers

Before each release, update its `CHANGELOG.md` entry with changes, compatibility requirements, and upgrade notes. Keep changes under the same version while it is unpublished; add the release date only after publishing.

Run `npm run prepublishOnly` before releasing. It checks types, unit tests, builds, smoke tests, and a fresh offline tarball installation with client registration and license-config checks. It does not replace opening, editing, and saving workbooks in a real browser.

Before a new release, sync all GrapeCity dependencies to the latest version:

```sh
npm run grapecity:update -- --latest
```
