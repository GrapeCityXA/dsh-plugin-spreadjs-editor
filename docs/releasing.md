# 发布流程 / Release workflow

## 准备 / Prepare

版本号以 `package.json` 为准；在 `CHANGELOG.md` 中写对应版本小节，并同步 README 安装示例。依赖使用 `pnpm-lock.yaml`，无需维护 npm 锁文件。

Use the version in `package.json`, add a matching section to `CHANGELOG.md`, and update README installation examples. Use `pnpm-lock.yaml` for dependencies; no npm lockfile is maintained.

```sh
pnpm install --frozen-lockfile
npm run prepublishOnly
npm pack --ignore-scripts
```

`prepublishOnly` 包含类型检查、测试、构建、客户端与宿主 smoke，以及独立离线包安装验证。安装包使用预构建产物，不在用户安装时编译。运行中的 DSH 另用 `npm run probe:live` 验证保存；该命令需要已加载当前构建的 DSH 实例。

`prepublishOnly` runs typechecking, tests, builds, client/host smokes, and an independent offline package installation check. Packages contain prebuilt artifacts; users do not build during installation. Use `npm run probe:live` separately against a running DSH loaded with the current build to verify real saves.

## GitHub 版本记录 / GitHub release

确认改动已提交到 `main`，工作区干净后运行：

After committing changes on `main` with a clean working tree:

```sh
npm run release -- --dry-run
npm run release
```

发布脚本先完成检查，再创建版本提交（如需要）、annotated tag、推送和 GitHub Release；说明文字取自 changelog。`--dry-run` 执行检查并显示计划，不推送。**此脚本不发布 npm 包。**

The release script validates first, then creates a version commit if needed, an annotated tag, a push, and a GitHub Release using the changelog section. `--dry-run` validates and prints the plan without pushing. **It does not publish to npm.**

## npm 发布 / npm publication

发布已验证的 tarball，再核对 registry 中的版本：

Publish the verified tarball, then check its registry version:

```sh
npm publish ./grapecity-software-dsh-spreadjs-editor-<version>.tgz --access public
npm view @grapecity-software/dsh-spreadjs-editor@latest version
```

最后在 `web` profile 安装完整版本号，重启 DSH，验证打开、编辑、保存及可选的 Driver 操作。授权要求以 [README](../README.md) 和[桌面授权策略](desktop-licensing.md) 为准。

Finally, install the exact version in a `web` profile, restart DSH, and verify opening, editing, saving, and optional Driver operations. Licensing requirements are documented in the [README](../README.md) and [desktop licensing policy](desktop-licensing.md).
