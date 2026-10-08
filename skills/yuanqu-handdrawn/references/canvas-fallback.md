# JS + Canvas 备用绘制

会话缺少内置图像生成、工具实际不可执行，或用户选择本地绘图时读取。当前模型看图并编排自由曲线，Canvas 2D 绘制颜色、分区干笔与实际遮挡；不调用外部视觉或图像 API，不通过 SVG 中转。模型生成可用且用户未指定代码时继续使用原流程。

## 从观察到绘图

先查看原图和按 style-calibration.md 选定的参考，沿用 SKILL.md 的身份与风格要求。将人数、头向、可见眼耳、发型轮廓、姿势、手物关系与必要背景写入 `source.summary`；难以判断的部分记录不确定。模型负责识别，脚本不会自动检测人物或将照片转换为曲线。

按本张主体编排 `layers`，从后向前绘制：浅色场景、身体／后发、脸颈与可见耳、眼、前发与遮挡、配件、手物关系。实际顺序取决于原图。隐藏眼耳不建立对应形状；遮眼布／手／前发也通过真实图层覆盖。侧脸或背影按可见轮廓绘制，无统一正脸模板。

先把大形画到参考的头身观感，再补必要结构与宽笔触；不能把“更多颗粒”当作塑形，也不能将旧样例的身份曲线平移到新人物。卷发的深浅块相互连接，避免整齐堆叠的圆圈；白衣通过纸白、浅灰蓝面与局部较深结构线读出装备；手套、衣袖与头盔的覆盖次序清楚。

## V3 scene

顶层 `version: 3`、`renderer: "canvas"`、`mode`、整数 `seed`、`texture`（0–1，默认 .8）、`source: {image, summary, people, styleReference?}`、`layers`。mode 可为 portrait/anime/object/travel/landscape；本轮实图只验证了卷发工作服和白色航天服两类人物。

形状坐标用 0–1000 的设计画布，输出尺寸独立。这是曲线数据的单位，不是脸型或眼距规则。1–500 个图层按输入顺序绘制，每层：

- 唯一 `id`；`type` 为 path/ellipse/rect。
- path：数值 `segments` 使用 M/L/Q/C/Z，以 M 开头；填色轮廓以 Z 结束，支持最多 240 段。
- ellipse：cx/cy/rx/ry；rect：x/y/width/height/radius，形状留在画布内。
- `fill` 是颜料名，默认 blue；`stroke` 与 `strokeWidth` 可选。透明镜片用 fill:none＋镜框描边，五官省略规则照常适用。
- 默认颜料有 paper/blue/blueLight/hair/hairLight/peach/skin/rose/sage/gold/wood。顶层可用 `palette: {颜料名: "#六位HEX"}` 调整或补充参考的实际色调，合计最多 36 种；这只是容量限制，画面仍以灰蓝蜜桃为主。
- `material` 为 paper/skin/hair/cloth/background/detail/eye，默认 detail。skin 接近干净平涂，hair/cloth 使用方向性干颜料，background 边缘较松，eye 保持实心。眼和镜框用 eye，浅腮红用 skin。
- `flow` 为笔触角度（−180–180，默认 25），按本层发型或衣纹走势调整；可用 `grain` 与 `edge`（0–1）覆盖材质的颗粒与边缘默认值。宽明暗笔触用真实曲线色块表达，程序只提供底层材质。
- `opacity` 为颜料浓度（.01–1），`underpaint` 默认 true：在同一轮廓内铺纸白，保护真实遮挡，颗粒空隙也不会漏出被遮住的眼。衣发上的半透明高光与明暗叠色设 false，让颜色混在已有颜料上；真实遮挡保持 true。

可查看 [canvas-curly-hair.json](examples/canvas-curly-hair.json) 或 [canvas-eva-suit.json](examples/canvas-eva-suit.json) 学习图层与材质。这两份数据来自对应试验原图的人工拟合，未随包附原照片；`source:` 是样例占位标识，不能当作新任务已经查看的来源。它们不是其它人物的身份模板，也不是图像模型成品。V1/V2 比例规则不进入 V3。

## 执行与保存

在实际 `<skill-root>` 运行 `npm ci --ignore-scripts --no-audit --no-fund`。锁文件固定 Canvas 依赖；依赖安装需要 npm 网络或缓存，安装后渲染离线。依赖不可用时明确报告原因，不宣称已经成图。

```bash
node "<skill-root>/scripts/render.mjs" "<scene.json>" --check
node "<skill-root>/scripts/render.mjs" "<scene.json>" --out-dir "<output-root>" --name "<原图名>-yuanqu" --size 1024
```

尺寸可为 256–2048 的整数，也可指定 1254 对照最近的模型生成成品。`--out-dir` 是已按 output-layout.md 确定的输出根。CLI 采用整组编号与不覆盖写入，返回真实文件路径：PNG 到 images，规范化 scene 与 `.canvas.html` 到 source，report 到 records。Canvas 不输出 SVG，`--svg-only` 仅适用于 V1/V2。

HTML 内嵌 scene 和同一套 Canvas JS，直接离线打开可复绘、下载 PNG，不依赖 CDN、原照片、图像参考文件或 Node 模块。源数据中的路径只用于记录，渲染不读取它们的像素。浏览器的 Canvas 实现可能有不同抗锯齿；需要同环境复现时以固定 Node/Canvas 版本的 CLI 导出为准。

查看成品与原图、参考：分别核对身份／姿势／遮挡与造型／分区材质／结构／场景。有具体问题时最多一次曲线或材质修正；仍有偏差如实交付。优化材质时复用 scene，而不是重新识别原图。

用 CLI 返回的 `files` 写同名 `.analysis.md`：记录来源、风格图、观察与不确定项、后端选择原因、执行命令、尝试次数、改进和残留差异。在 `.report.json` 补充 semanticReview 和 styleReview；程序初始状态只是 pending-source-review。检查过且两项均通过才设 passed；风格仍有差异用 needs-style-review，并区分模型核对与用户确认。程序测试不能证明视觉风格通过。

## 稳定性与目标差异

固定 scene、seed、尺寸、引擎、依赖及运行环境后可以复绘相同 PNG；种子只固定材质，不固定模型的看图判断。跨模型或重新拟合无法保证同一构图。系列任务保留认可 scene 和参考，局部修改已有数据。

这条备用路径能表达圆脸、胶囊、灰蓝蜜桃、衣发颗粒、白衣结构与浅色场景。与最近两张模型生成图相比，本轮 Canvas 样张的边缘更规整，卷发和衣纹层次更概括，笔触覆盖也更均匀；没有达到相同完成度。优先保持识别和遮挡，并持续按实际参考调整曲线与材质，不承诺复制模型的全部笔触。
