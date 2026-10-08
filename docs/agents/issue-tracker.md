# 事项跟踪：本地 Markdown

事项和规格存放在 `.scratch/`。

## 文件约定

- 每个功能一个目录：`.scratch/<feature-slug>/`。
- 规格：`.scratch/<feature-slug>/spec.md`。
- 每个事项独立成文件：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 编号。
- 分流状态记录在事项顶部的 `Status:` 行，取值见 `triage-labels.md`。
- 评论和对话追加到文件底部的 `## Comments` 下。

技能要求“发布到事项跟踪器”时，按上述约定创建文件及目录。
技能要求“获取相关事项”时，读取用户提供的路径或编号对应的文件。

## Wayfinder 操作

- 地图：`.scratch/<effort>/map.md`，包含 Notes、Decisions-so-far 和 Fog。
- 子事项：`.scratch/<effort>/issues/NN-<slug>.md`，正文记录问题。
- `Type:` 取值为 research、prototype、grilling 或 task。
- 认领与解决分别使用 `Status: claimed` 和 `Status: resolved`。
- 依赖记录为 `Blocked by: NN, NN`；全部依赖 resolved 后解除阻塞。
- 按编号选择尚未解决、无阻塞且未认领的事项。
- 开始工作前，将状态改为 claimed 并保存。
- 解决后，在 `## Answer` 下追加答案，状态改为 resolved，
  并将答案摘要及文件链接追加到地图的 Decisions-so-far。
