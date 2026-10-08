---
name: yuanqu-handdrawn
description: 将用户原图转换为圆趣手绘插画：识别内容并用固定 SVG 引擎控制灰蓝/蜜桃橘配色、胶囊眼和白纸留白，导出 PNG 与可复现绘图数据。适用于明确要求圆趣手绘、两色胶囊眼头像或这套风格的物品、旅游照与风景转换。
---

# 圆趣手绘

用原图识别内容，用固定引擎绘制。目标是几何一致的原创融合插画：宽圆面罩、醒目胶囊眼、灰蓝/蜜桃橘和白纸留白。几何优先于材质丰富程度。

## 输入与参考角色

- 用户原图是身份、人数、姿势、朝向、遮挡、物品结构与地标的唯一来源。接受附件、本地图片路径、明确指定的多图或目录；目录默认只处理直属图片文件，排除本轮输出。
- 查看本地原图后再识别。缺少原图，或无法确定用户要保留哪个主体时，简短追问；其余情况自动判断分支。
- 查看随包的 [assets/geometry-reference.png](assets/geometry-reference.png)：它只解释几何语言，不能成为待转换主体，也不承担配色或构图。参考人物的外貌、发型、倾斜、裁切和深色背景均不进入绘图数据。
- 用户明确改变核心风格时说明它将成为变体，遵从当前要求；需修改引擎的任务不伪装成现有引擎已支持。

## 执行

1. 阅读 [references/style.md](references/style.md) 与 [references/scene-format.md](references/scene-format.md)，再按原图类别读取 [references/compositions.md](references/compositions.md) 的对应分支。
2. 根据原图写出识别记录：主要主体数量、头朝向和倾斜、每只眼的 open/closed/hidden 状态、实际可见耳朵、整体发型与最多三项识别特征；物品记录关键结构，场景记录一个主要地标。无法确认隐藏内容时保持隐藏。
3. 输出受约束的 scene JSON。轮廓用少量数值曲线表达，对照真实原图，不从参考图复制发型。数据只进入 `scripts/engine.mjs`，不另写绘图代码，不输出任意 HTML/SVG。五类 [references/examples/](references/examples/) 是语法与流程样例，按当前分支读取一份；它们不是用户身份模板或质量证据。
4. 将 JSON 放入任务临时目录，如 `tmp/yuanqu-handdrawn/<原图名>.scene.json`，同目录保存本次识别指令与观察 `<原图名>.analysis.md`。命令使用实际 skill 根目录，不能写死作者机器路径：

   ```bash
   node "<skill-root>/scripts/render.mjs" "<scene.json>" --check
   node "<skill-root>/scripts/render.mjs" "<scene.json>" --out-dir "<output-dir>" --name "<原图名>-yuanqu"
   ```

   PNG 依赖缺失时在 skill 根目录运行 `npm ci --ignore-scripts --no-audit --no-fund`。需 Node.js 20 或更高。验证与 SVG 生成只需 Node；默认 PNG 导出使用锁定的 `@resvg/resvg-js`，无需浏览器、API 密钥或图像生成工具。依赖不可用时明确说明未完成 PNG；用户接受 SVG 交付时才使用 `--svg-only`。

5. 用图像查看工具检查 PNG，按 [references/quality.md](references/quality.md) 与原图比较。代码通过只表示输入与几何规则通过，**不是身份与姿态已通过**。最多修正一次 JSON，再用同一引擎重绘；不自动改走图像模型补画。
6. 在最终 `.report.json` 中更新 `semanticReview.status` 为 `passed` 或 `failed`，填写具体问题及 `attempts`（1 或 2），顶层 `status` 更新为相同状态。将本次 `.analysis.md` 复制为与选中输出同名的侧文件。失败记录保留，交付时说明原因；批量继续下一张，每张有独立数据与记录。

## 保存与交付

用户指定目录优先，否则使用当前工作目录的 `output/yuanqu-handdrawn/`。默认 1024×1024；还接受 512 和 2048，同一 SVG viewBox 保持比例。文件以原图名加 `-yuanqu` 命名，重名自动编号。

保留 `.scene.json`、`.svg`、`.png`、`.report.json` 和 `.analysis.md`。展示选中成品并给出路径，聊天只报告结果和必要偏差。JPG 按用户要求转换，保留 PNG 与 SVG；图片不添加文字、标签或水印。

用户要求“只写提示词/只分析”时交付识别指令与绘图计划，不执行渲染。绘图 JSON、种子、引擎和 PNG 渲染器版本一起决定复现条件；重新识别可能得到不同数据，应优先修改已保存的数据。

## 支持边界

五个分支都有绘制语法与离线样例，真实原图的识别和表达质量须逐例验收；旅游与无人风景尚无用户提供的实测基线。复杂发型、互动、衣服与遮挡由模型拟合曲线，可能丢失特征；不要把规则校验等同于原图保真。

本技能是原创融合风格实验，不是官方 Grok 素材。
