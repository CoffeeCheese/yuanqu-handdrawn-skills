# 圆趣手绘 Skills

用于开发和维护与「圆趣手绘」相关的 AI 技能。

## 目录

- `skills/`：存放各个技能，每个技能使用独立目录。
- 每个技能的使用说明和执行规则放在对应目录的 `SKILL.md` 中。

当前技能：[圆趣手绘](skills/yuanqu-handdrawn/SKILL.md)。识别原图为结构化数据，再用固定 SVG 引擎绘制，优先控制两色、胶囊眼比例和白纸留白，覆盖五类构图。

首次使用需要 Node.js 20 或更高，在 `skills/yuanqu-handdrawn/` 运行 `npm ci --ignore-scripts` 安装锁定的 PNG 渲染器。当前为仓库内交付，可让 agent 读取 `skills/yuanqu-handdrawn/SKILL.md` 并按它转换原图；安装到技能目录后，调用示例为 `使用 $yuanqu-handdrawn 将这张原图转换为圆趣手绘插画`。

开发验证：在技能目录运行 `npm test`。五类合成样例验证流程与几何规则；真实原图的身份、姿态与遮挡仍须逐例验收，旅游与风景尚无用户原图实测。

本项目采用 [MIT 许可证](LICENSE)。
