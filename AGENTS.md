## Agent skills

### Issue tracker

事项使用本地 Markdown；创建、读取或更新事项前，读取 `docs/agents/issue-tracker.md`。

### Triage labels

使用五个默认分流标签；分流事项前，读取 `docs/agents/triage-labels.md`。

### Domain docs

采用单上下文布局：根目录 `GLOSSARY.md` 和 `docs/adr/`。探索项目或修改领域文档前，读取 `docs/agents/domain.md`。

## Git 提交

- 按原子化功能提交：每个提交只包含一个可独立理解、验证和回退的功能、修复或规则变更。
- 同一功能所需的实现、测试和文档放在同一个提交中；不同功能、无关重构或格式调整拆成独立提交。
- 提交标题和正文使用中文，说明具体改动及必要原因；代码标识、命令、依赖名称等保留原文。
- 提交前检查暂存区差异，确认内容属于当前提交的范围，并完成与改动相关的必要验证。
