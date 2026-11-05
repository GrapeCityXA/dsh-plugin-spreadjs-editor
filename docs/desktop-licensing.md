# 桌面版授权与故障排查

## 为什么 localhost 能打开，桌面版却提示没有授权

DSH Desktop `0.2.1-rc.5` 将界面加载到 `dsh-app://app/`。SpreadJS 在这个页面中运行，看到的协议是 `dsh-app:`、主机名是 `app`。DSH 的文件和保存请求虽然被转发到本地 HTTP 后端，页面来源并不会因此变为 localhost。

[SpreadJS 官方试用与许可说明](https://demo.grapecity.com.cn/spreadjs/help/docs/started-guide/trial-and-license) 明确指出：没有试用或生产许可证时，只支持本地计算机环境，并以 `http(s)://localhost` 或 `http(s)://127.0.0.1` 为例。Designer 还列举了 `file:` 等本地地址，但文档并未承诺支持 `dsh-app:`。SpreadJS 和 Designer 需要各自的许可证，并须在创建工作簿和 Designer 之前赋值。

因此，不能将「在本机运行」等同于「符合无 key 的本地试用条件」。本插件免费，不包含 SpreadJS 或 Designer 的商业授权。

## 可行的部署方式

向葡萄城提供以下信息，确认适用于桌面环境的试用或部署许可证：

- SpreadJS 与 Designer 版本：均为 `19.2.1`。
- 运行环境：Electron 中的 DSH Desktop。
- 页面地址：`dsh-app://app/`，自定义协议 `dsh-app:`，主机名 `app`。
- 使用方式：公开分发的插件，在用户自己的 DSH 桌面客户端创建和编辑工作簿。

[官方 Licensing FAQ](https://developer.mescius.com/spreadjs/licensing/) 提供 Named Mobile/Desktop Application License，并明确将 Electron 列为适用的分发场景。需要进一步确认许可证是否支持 `dsh-app:`、如何签发，以及插件分发所需的授权条款。仅凭主机名 `app` 不能断定普通域名许可证可用。配置了非空 key 也不代表授权校验已经通过。

插件已经支持 `licenseKey` 和 `designerLicenseKey`，拿到适用许可证后无需更改 SDK 的授权校验。当前无 key 的本地开发可继续使用 HTTP(S) localhost 的浏览器 dev 环境。

2026-11-05，用户用主机名 `app` 申请试用授权后反馈：运行时能够启动，但 Designer 没有正常显示。这说明主机名授权值得继续验证，还不足以确认桌面端完整可用。Editor `0.2.7` 先修复初始化失败的错误隔离，Designer 的授权和显示问题继续单独调查。

## 配置桌面 profile

默认配置文件为 `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml`。自定义 `DSH_HOME` 时，以实际目录为准。在已有配置中更新 `spreadjs-editor`，不要覆盖其他插件的配置：

```yaml
- id: spreadjs-editor
  config:
    licenseKey: 'YOUR_SPREADJS_KEY'
    designerLicenseKey: 'YOUR_DESIGNER_KEY'
```

浏览器 profile 使用 `profiles\web\cordis.patch.yml`；两个 profile 的配置互不替代。修改后重启相应 DSH 实例，再打开工作簿。不要将真实 key 提交到公共仓库。

## 初始化失败时的行为

插件会将创建、授权赋值或 React 文档生命周期中的异常隔离在当前编辑器，显示错误页和页面来源。可以关闭当前文件或切换到其他文档。SDK 清理失败也不会阻止后续清理和 Driver 租约撤销。

文件导入失败仍显示该文件的加载错误，不会写回一个尚未加载成功的工作簿。初始化失败页没有自动重试；确认配置后重新打开文件。错误页不代表所有错误均由授权引起，应结合错误详情判断。

这些保护不承诺能够拦截 SDK 在全局计时器、独立 DOM 事件或模块加载 / 求值时抛出的任意异常，也无法终止第三方 SDK 的同步死循环。

## 回归步骤

1. 在没有许可证的桌面 profile 打开一个 `.xlsx` 或 `.ssjson`。若 SDK 拒绝初始化，应显示局部错误页，页面来源为 `dsh-app://app`。
2. 关闭该文件，打开文本或图片，再切换聊天。Sidebar 应继续响应；失败的工作簿不得被 Driver 获取或保存。
3. 切换 DSH 明暗主题，确认失败页仍可显示，其他界面正常。
4. 在 HTTP(S) localhost dev 环境打开同一工作簿，检查加载、编辑、保存和切换标签后的恢复没有退化。
5. 获得供应商确认的两份许可证后，在 desktop profile 配置并重启，检查编辑器启动、导入、编辑、保存、Driver 操作及主题切换。

自动测试使用可控 SDK 故障覆盖授权赋值、构造器、实例初始化及清理异常；它们不能替代第 5 步的真实许可证验证。

## 调查依据

2026-11-05 只读检查本机安装的 DSH Desktop `0.2.1-rc.5`：`resources/app.asar` 中的 `lib/main.js` 定义 `SCHEME = 'dsh-app'`，构造并导航到 `applicationUrl = 'dsh-app://app/'`，并注册该协议的静态资源及后端转发处理。后续 DSH 版本应以错误页展示的实际页面来源为准。

- [SpreadJS 官方试用与许可说明](https://demo.grapecity.com.cn/spreadjs/help/docs/started-guide/trial-and-license)
- [SpreadJS 官方技术支持 FAQ](https://demo.grapecity.com.cn/spreadjs/help/docs/started-guide/techsupport)
- [SpreadJS v19 licensing](https://developer.mescius.com/spreadjs/docs/getstarted/trialSpreadJS)
- [Designer Component licensing](https://developer.mescius.com/spreadjs/docs/spreadjs-designer-component/getting-started-designer)
- [Desktop application licensing FAQ](https://developer.mescius.com/spreadjs/licensing/)

## English

DSH Desktop `0.2.1-rc.5` loads its UI at `dsh-app://app/`. Forwarding API requests to a local HTTP backend does not change the page origin. GrapeCity documents keyless local evaluation for HTTP(S) localhost / loopback addresses, so it must not be assumed to cover this custom protocol.

Ask GrapeCity to confirm licensing for SpreadJS and Designer `19.2.1` in Electron, including the `dsh-app:` protocol, hostname `app`, and distribution through a public plugin. Configure the separate `licenseKey` and `designerLicenseKey` values in the active desktop profile as shown above, then restart DSH. Nonempty keys only mean configured, not validated.

On 2026-11-05, the user reported that a trial key issued for hostname `app` let the runtime start, but Designer did not display correctly. Editor `0.2.7` contains initialization failures; it does not resolve or establish full desktop licensing and Designer compatibility.

Initialization and React lifecycle errors are contained within this document. The failure page shows the page origin; users can close or switch documents. Cleanup attempts recovery, cancels Driver leases and disposes SDK resources independently. Automated fault tests do not establish successful desktop licensing: that still requires a real key and desktop regression checks. Browser development over HTTP(S) localhost remains an alternative for keyless local evaluation under the vendor's terms.
