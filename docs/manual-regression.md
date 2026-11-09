# 手工回归 / Manual regression

在浏览器 Web UI 中测试，使用独立测试文件。先安装本次 Editor 构建及配套 Driver（如需 AI 测试），重启 DSH 并刷新页面。核对 `/spreadjs/api/health` 的 `plugin.version` 与待测版本一致；授权须适用于实际页面来源。

准备 `regression.xlsx` 和 `scratch.xlsx` 两个文件。记录 DSH、Editor、Driver 版本及浏览器，避免在业务文件上制造冲突或坏文件。

## 编辑、保存与恢复

1. 打开 `regression.xlsx`，在 A1 输入 `BASE`、B1 输入 `100`、C1 输入 `=B1*2`，提交单元格编辑后保存。
2. 刷新页面并重新打开，确认 C1 为 `200`，内容已写入磁盘，没有未保存标记。
3. A2 输入 `RECOVERY`，不保存，切到 `scratch.xlsx` 后再切回；关闭文档标签后再打开。两种情况下均应恢复 A2，并保留未保存标记。
4. 最后保存。恢复快照只在当前页面内存中，第 3 步不能用整页刷新代替切换文档。

## 保存期间继续编辑或切换

在浏览器 Console 中延迟交付保存响应，留出稳定的编辑时间；此代码不延迟服务端写入，刷新页面后失效：

```js
(() => {
  if (window.__restoreSpreadjsTestFetch) return;
  const original = window.fetch;
  window.fetch = async function (input, init) {
    const response = await original.call(this, input, init);
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    if (url.includes('/spreadjs/api/save')) {
      console.info('[SJS-TEST] SAVE_RESPONSE_DELAY');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    return response;
  };
  window.__restoreSpreadjsTestFetch = () => {
    window.fetch = original;
    delete window.__restoreSpreadjsTestFetch;
  };
})();
```

1. 修改 A3 并保存。看到 `SAVE_RESPONSE_DELAY` 后立即修改 B3，等待保存结束。B3 仍应标为未保存，第二次保存后才清除标记。
2. 再做一轮：修改 A4、保存，看到延迟提示后修改 B4，并立即切到另一文件。等待保存结束再打开原文件，B4 应仍可恢复。旧保存不能清掉较新的快照。
3. 最后保存所有测试改动。若未在保存期间产生新改动，记录为「未触发」，重新测试。

## 另存为

1. 修改工作簿，另存为新的 `copy.xlsx`；内容完整写入后应打开副本，原文件的磁盘内容不变。
2. 保持上述延迟，另存为另一个新文件；看到提示后切到 `scratch.xlsx`。等待完成后应仍停在 scratch，不能被旧任务导航到副本。
3. 再次另存为已存在的 `copy.xlsx`，应拒绝覆盖；工作区外路径、其他后缀也应拒绝。
4. 在 Console 执行 `window.__restoreSpreadjsTestFetch?.()` 恢复正常保存响应。

## 冲突、加载失败与界面

1. 两个浏览器标签页打开同一聊天的同一文件。第一边修改并保存，再在第二边修改并保存，第二边应提示磁盘变化或保存冲突。独立读盘确认第一边的内容未被覆盖；恢复缓存中的内容不能作为磁盘结果。
2. 多次在大工作簿与小工作簿间切换，确认文件名和内容一致，不被旧加载覆盖。
3. 准备内容为普通文本、后缀为 `.xlsx` 的测试坏文件。加载失败后应拒绝保存和另存为，不生成空白副本；关闭后文本、图片和聊天切换仍正常。
4. 切换 DSH 明暗主题，检查表格及工具栏。若出现授权或初始化失败，记录错误详情，并确认关闭该文件后侧栏仍可使用。

## 可选的 Driver 回归

1. 在「设置 → 电子表格编辑器」选择 Driver，刷新后选择应保留；选择「不使用」后应停止提供其工具。
2. 让 AI 修改单元格，使用 `save:false` 时只改变当前工作簿；使用 `save:true` 时经 Editor 保存，刷新后内容仍在。
3. 运行包含可取消等待的任务，在写入之前停止，确认不继续保存。取消不回滚已经完成的改动；已发送的写入仍可能完成。
4. 执行期间关闭或切换文件，任务应中断。重新打开后检查可恢复的部分，再继续测试；快照不能恢复 JavaScript 执行位置。

Driver 的详细接入与执行约束见[桥接契约](bridge-contract.md)。

## 记录结果

记录测试项、版本、实际步骤、预期结果、实际结果和 Console / 工具错误。未触发的竞态测试单独标注；数据丢失、错误文件操作或保存结果不符需要先修复再发布。
