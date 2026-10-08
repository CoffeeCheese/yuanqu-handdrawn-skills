# 本地代码手绘实验

当前模型查看原图、拟合数值曲线；本地 Node.js 与 Resvg 绘制形状，固定种子生成颜料颗粒。全程不调用图像生成工具、外部视觉模型或 API。保留人物和姿势，以手绘风格相近为目标，脸型、胶囊、间距和发块数量允许变化。

## 输入与识别

查看用户原图，以及用户指定的风格成品；未指定风格图时查看包内 `assets/handdrawn-reference.jpg`。原图决定身份、人物数量、发型、头向、闭眼/睁眼、隐藏眼耳、服装、手势、物品结构和场景。风格图只决定调色、笔触密度、造型语言与完成度；不移植参考人物的姿势、耳饰或背景。

保留有辨识度的坐姿、交叠双手、领饰和必要座椅；无关房间背景可去除。仅当用户要头像或裁减不损失主体动作时采用短肩构图。旅游和风景继续保留原图中的主要人群与一个场景线索。

人形采用柔和圆脸、实心胶囊眼、少量腮红与连续发块，脸部留空，不画鼻嘴或写实眼细节。隐蔽内容继续隐蔽；看不清时记录不确定，不按人物知识补全。以灰蓝和蜜桃为主，必要识别配件可用少量包内柔和辅助颜料。更多形状用于结构、梳理方向与衣纹，不能用随机小形状冒充身份轮廓。

## 绘图数据

读取 [examples/paint-portrait.json](examples/paint-portrait.json) 学习语法。它是本次真实照片拟合后保存的曲线样例，原图不随包提供；不把这些轮廓用作其它人物的身份模板。

顶层 `version: 2`、`renderer: "paint"`、`mode`、整数 `seed`、`texture`（0–1）、`source: {image, summary, people}`、`layers`。模式为 portrait/anime/object/travel/landscape，几何语法可表达这些分支，但此次真实效果只验证了单人坐姿肖像。

`layers` 是后到前排列的 1–500 个形状，无自动重排、脸型生成或几何比例修正。每项：

- 唯一 `id`；`type` 为 path/ellipse/rect。坐标均为 0–1000，不能超出画布。
- path 用数值 `segments`：M/L/Q/C/Z，以 M 开头，填色路径以 Z 结束；最多 120 段。ellipse 为 cx/cy/rx/ry；rect 为 x/y/width/height/radius。
- `fill` 默认为 blue；可用 paper/blue/blueLight/hair/hairLight/peach/skin/rose/sage/gold/wood/none。`opacity` 为颜料浓度（0.01–1）。透明镜片用 fill:none 和镜框描边。
- 可选 `stroke` 为颜料名，`strokeWidth` 为 0.1–40；端点转角圆润。
- `material` 为 paper/skin/hair/cloth/background/detail/eye；控制颗粒强弱，胶囊用 eye 保持干净。可用 `grain: 0–1` 覆盖；镜框建议 0.05。
- `underpaint` 默认 true：填色先铺纸白，保护遮挡。衣服或头发上的半透明笔触设 false，在原有颜料上叠加；遮眼的头发/手/帽子保持 true。

画幅、比例和留白由当前模型拟合，程序只校验合法数据。使用少量手工起伏的曲线，给重要主体留出舒适的白纸边缘。

## 执行与保存

在实际 skill 目录准备 `npm ci --ignore-scripts --no-audit --no-fund`。已有依赖后绘制完全离线，无浏览器或图像 API 密钥。

```bash
node "<skill-root>/scripts/render.mjs" "<scene.json>" --check
node "<skill-root>/scripts/render.mjs" "<scene.json>" --out-dir "<output-dir>" --name "<原图名>-paint"
```

沿用 512/1024/2048、重名编号与五个侧文件。V2 的 SVG 包含可编辑轮廓和嵌入 PNG 的颗粒层，因此即使 `--svg-only` 也需要 Resvg。它不是完全由矢量组成的扫描画。

查看 PNG 并比较实际原图和风格参考：身份轮廓、姿势、眼耳遮挡、胶囊、调色、笔触。最多一次曲线/参数修正；没有通过时说明具体偏差，保留记录，不改走图像模型。

报告补充 `semanticReview` 和 `styleReview`（状态、具体问题、attempts）；两项均通过才将顶层 status 设 passed。仅达到程序要求、需要用户确认风格时设 `needs-style-review`。将实际识别记录保存为同名 `.analysis.md`。不要把数据校验通过当成风格通过。

## 稳定性边界

固定 scene、seed、尺寸、引擎/Resvg/Node 环境后，PNG 可重复生成。优先修改已保存的数据；重新识别与拟合会因当前模型而变化。种子固定的是材质，不是人物识别。程序化颗粒能靠近手绘质感，但不会自动达到图像模型的笔触、织物和人物塑形能力；需要更多真实样本才能判断系列效果。
