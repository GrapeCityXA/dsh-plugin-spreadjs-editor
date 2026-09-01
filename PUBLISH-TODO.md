# dsh-spreadjs-editor 发布与收录 TODO

> 状态约定：`[ ]` 待办，`[x]` 已完成，`[~]` 进行中。
> 原则：未确认 GrapeCity SpreadJS EULA 前，不把内联 SpreadJS 的 `lib/` 打进公开 npm 包。

## 仓库准备

- [ ] 给 GitHub 仓库添加 Topics：`dsh-plugin`、`deepseek-harness`
- [ ] 可选 Topics：`spreadjs`、`excel`、`web-ui`
- [ ] README 补充可识别的一键安装 specifier（git 或 npm）
- [ ] README 明确安装流程：`npm install && npm run build` 后交给 `dsh plugin`
- [ ] 确认 `package.json` 保留 `dsh.bundle` manifest 和 `cordis.patch.yml`

## dshmk / dsh-plugins-store 自动收录

- [ ] 确认 GitHub Topics 已生效
- [ ] 检查 https://dshmk.com/ 是否出现 `GrapeCityXA/dsh-plugin-spreadjs-editor`
- [ ] 观察验证状态；失败时根据验证结果修复仓库/README
- [ ] 参考：https://github.com/ZASENJC/dsh-plugins-store

## awesome-dsh-plugin 人工收录

- [ ] PR 新增 `data/plugins/GrapeCityXA__dsh-plugin-spreadjs-editor.yml`
- [ ] 填写 `url`、`name`、`category: ui`、`description.en`
- [ ] 补充 `description.zh`
- [ ] 确认满足：`dsh.bundle`、仓库满 1 天、至少 10 commits、已加 `dsh-plugin` Topic
- [ ] 参考：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md

## ui-all community.json 收录

- [ ] PR 到 https://github.com/zhu1090093659/dsh-web
- [ ] 修改 `packages/dsh-client-ui-community-plugins/community.json`
- [ ] 新增 `dsh-spreadjs-editor` 条目，含 repo、name、category、subcategory
- [ ] 确认 `subcategory` 使用现有枚举；如无 file/editor，则先归入 `panel` 或新增
- [ ] 若后续发布 npm，再补 `npm` 字段
- [ ] 参考：已安装包 `@linxin666/dsh-client-ui-community-plugins/community.json`

## dsh-market 收录

- [ ] awesome-dsh-plugin 合并后检查 dsh-market 是否自动出现
- [ ] 如未出现，研究 dsh-market 的直接提交入口
- [ ] 参考：https://github.com/dsh-market/dsh-market

## npm 发布决策（不阻塞目录收录）

- [x] 已定：公开 npm 采用“源码构建模式”，tarball 不携带 `lib/`
- [x] 与用户确认：不把内联 SpreadJS 的 `lib/` 打进公开 npm 包
- [x] 把 GrapeCity 包、tsdown、typescript、unrun 移入 `dependencies`，保证安装阶段可构建
- [x] package.json 增加 `postinstall` / `rebuild` 脚本
- [x] README 写清 pnpm 10 需要 `onlyBuiltDependencies` + `pnpm rebuild`
- [x] 使用 `pnpm pack` 验证 tarball 内容不包含 `lib/client.js`
- [x] 在临时 profile 中安装 tarball，验证 postinstall 构建成功
- [~] 确认 npm 登录状态和包名可用性（包名可用；本机未登录）
- [ ] 在发布机器执行 `npm adduser` 或配置 npm token
- [ ] 执行 `npm publish`（或 `pnpm publish`）
- [ ] 发布后从 npm 安装到临时 profile 并打开 `.xlsx` 验收
- [ ] 发布成功后补 ui-all community.json 的 `npm` 字段

## 最终验收

- [ ] `dsh plugin --profile web add <specifier>` 可从干净环境安装
- [ ] 安装后 SpreadJS 能通过 better-sidebar 打开 `.xlsx`
- [ ] README 中 license/config 说明与最终发布方式一致
