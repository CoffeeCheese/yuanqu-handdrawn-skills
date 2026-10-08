# 可选的固定几何绘图

只有用户明确要求固定几何复现时读取。此模式属于旧版绘图模块；下述约束不适用于默认模型生成。

## 输入与执行

1. 查看用户原图与 [../assets/geometry-reference.png](../assets/geometry-reference.png)。原图决定身份、人数、姿态和遮挡；参考图只解释几何语言。
2. 阅读 [style.md](style.md)、[scene-format.md](scene-format.md)，再读取 [compositions.md](compositions.md) 的对应分支。
3. 记录主体、头向、倾斜、每只眼的 open/closed/hidden 状态、可见耳朵、整体发型与必要识别特征。根据实际原图输出 V1 scene JSON。读取 [examples/](examples/) 对应分支样例学习语法，不将样例人物用作身份模板。
4. 将 JSON 和识别记录 `.analysis.md` 放入任务临时目录，使用实际 `<skill-root>`：

   ```bash
   node "<skill-root>/scripts/render.mjs" "<scene.json>" --check
   node "<skill-root>/scripts/render.mjs" "<scene.json>" --out-dir "<output-dir>" --name "<原图名>-yuanqu"
   ```

   需 Node.js 20 或更高。PNG 依赖缺失时在 skill 根目录执行 `npm ci --ignore-scripts --no-audit --no-fund`。V1 的校验与 SVG 生成只需 Node；默认 PNG 导出使用锁定的 Resvg。用户接受 SVG 交付时才使用 `--svg-only`。

5. 查看 PNG，按 [quality.md](quality.md) 与原图比较；最多修正一次 JSON 后重绘。程序检查通过不表示身份、姿势或风格已通过。
6. 使用 CLI 返回的报告路径更新 `semanticReview`、`attempts` 和顶层 `status`。复制同名 `.analysis.md` 到 `records/`，说明实际偏差。

## 输出与局限

默认 1024×1024，也接受 512 或 2048。按 [output-layout.md](output-layout.md) 确定输出根，作为 `--out-dir` 传入。PNG 放 `images/`，scene／SVG 放 `source/`，report／analysis 放 `records/`，整组重名编号。用户接受 SVG-only 时没有 PNG 成品，仍按分类目录保存。

固定 scene、seed、引擎与渲染环境后可以复现；重新识别原图会改变数据。五个分支有离线语法样例，旅游和无人风景尚无用户原图实测基线。此模式的几何保证不能用于证明默认模型生成的质量。
