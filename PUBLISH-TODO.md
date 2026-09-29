# dsh-spreadjs-editor 发布与收录 TODO

> 状态约定：`[ ]` 待办，`[x]` 已完成，`[~]` 进行中。
> 最近核对：2026-09-29。npm 上最新为 **`0.2.1`**，仓库里当前未发布的版本是 **`0.2.2`**。
>
> **事实更正**（原文写于 0.1.x 时期，与后来实际发货的方式相反）：
> - 公开 npm 包**不是**「源码构建模式」：0.1.2 起就以**预构建**分发，`lib/client.js` 内联了
>   SpreadJS（`0.2.1` 的 tarball 10 个文件、解包约 53 MB），`lib/licenses` 随包携带。
> - 安装期不执行任何脚本：0.1.4 起移除 `prepare`，`prepack` 只在发布机上构建。
>   因此下文的 `postinstall` / `rebuild` 类条目已随旧方案作废（已从本文件删除）。

## 仓库准备

- [x] 给 GitHub 仓库添加 Topics：`deepseek-harness`、`dsh-plugin`
- [x] 可选 Topics：`spreadjs`、`excel`、`web-ui`
- [ ] **移除过期 Topic `dsh-better-sidebar`**：0.2.0 起本插件不再依赖它，但仓库 Topics 里仍留着这一项（已用 GitHub API 核对）。按该主题检索的人会误以为它属于 better-sidebar 生态。
- [x] README 有可识别的一键安装 specifier（npm 包名）
- [x] README 写清安装流程：`dsh plugin --profile web add @grapecity-software/dsh-spreadjs-editor`
- [x] `package.json` 保留 `dsh.bundle` manifest 与 `cordis.patch.yml`

## 目录收录（本次未逐一核对）

- [ ] 检查 https://dshmk.com/ 是否出现 `GrapeCityXA/dsh-plugin-spreadjs-editor`，并观察验证状态
- [ ] awesome-dsh-plugin：确认 `data/plugins/GrapeCityXA__dsh-plugin-spreadjs-editor.yml` 是否已收录（本次只看到列表开头的字母段，未能确认；若未收录，按仓库 contributing 提 PR）
- [ ] ui-all `community.json`（`zhu1090093659/dsh-web`）：确认是否已有本插件条目，并补 `npm` 字段
- [ ] dsh-market：确认是否已自动同步收录

## npm 发布

- [x] 已发布：`0.1.0` → `0.1.4`、`0.2.0`、`0.2.1`（`latest = 0.2.1`，2026-09-29）
- [x] 预构建分发：`files` 含 `lib/*.js` 与 `lib/licenses`，`prepack` 在发布机构建，安装期无脚本
- [x] 打包校验：`npm run verify:package`（离线 tarball 全新安装 + 客户端注册 + 独立 license 配置）
- [ ] 发布 **`0.2.2`**（未发布，内容见 `CHANGELOG.md`）：发布前跑一遍全量验收
      ```sh
      npm run typecheck && npx vitest run && npm run build
      node scripts/smoke-client.mjs && node scripts/smoke-node.mjs
      npm run verify:package && npm run probe:live
      ```
- [ ] 发布后从 npm 安装到临时 profile，打开 `.xlsx` 验收
- [ ] 内联 SpreadJS 的再分发许可：随包携带 `lib/licenses` 是不够的结论性依据，正式对外发布前仍需 GrapeCity 侧确认一次条款（本文件开头那条「未确认 EULA 前不把 lib/ 打进公开包」的原则，与现在的发货方式不一致，需要以书面结论替代）

## 发布流程（从 `0.2.2` 起约定）

> 背景：`0.1.0`–`0.2.1` 实际是「改完就发」——29 天 7 个版本，其中 `0.1.2`→`0.1.3` 隔 27 分钟、
> `0.2.0`→`0.2.1` 隔 21 小时；而且**一个 tag 都没有**，npm 上的版本只能用 `package.json`
> 反推对应哪次提交。以下约定从 `0.2.2` 开始执行，历史版本**不回溯补 tag**（推定的 tag 会
> 给出假的确定性）。

1. **版本号**：不到 1.0 之前，没有破坏性变更就继续在原位上递增（`0.2.2` → `0.2.3` …），
   不为了「有功能」跳到 `0.3.0`。
2. **提交与发布分离**：`main` 随时可提交；`latest` 只在功能攒够一批、或出现严重缺陷时移动。
3. **想立刻验证**用本地 tarball 或 `npm publish --tag next`，不污染 `latest`。
4. **发布动作**（手动执行；`npm publish` 本身**不会**打 tag，所以 `npm version` 那步不能省）：

   ```sh
   npm run typecheck && npx vitest run && npm run build
   node scripts/smoke-client.mjs && node scripts/smoke-node.mjs
   npm run verify:package
   npm version 0.2.2 -m "chore(release): 0.2.2"   # 改 package.json + 提交 + 打 tag
   npm publish
   git push --follow-tags                          # 提交与 tag 一起推
   gh release create v0.2.2 --title "0.2.2" --notes-file <从 CHANGELOG.md 抽出的那一节>
   ```

5. **发布后核对**：`npm run probe:live` 报出的插件版本 == 刚发布的版本（需先重启 DSH）。
6. **权限**：`gh` 已登录的账号对 `GrapeCityXA/dsh-plugin-spreadjs-editor` 具备 push（无 admin）；
   推提交、打 tag、建 Release 都不需要 admin。

## 最终验收

- [ ] `dsh plugin --profile web add <specifier>` 可从干净环境安装
- [ ] 安装后在文件树里打开 `.xlsx`，由 **DSH 自带的右侧栏**承接（不需要任何第三方侧边栏插件）
- [ ] `npm run probe:live` 能报出「正在运行的进程就是这一版」（0.2.2 起 `/spreadjs/api/health` 回报插件版本与内置 SpreadJS 版本）
- [ ] README 中的 license/config 说明与最终发布方式一致
- [ ] 发布后 `git tag`（`v<version>`）与 `gh release` 均已创建，且 tag 指向发布提交
