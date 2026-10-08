# Scene JSON

唯一可执行格式，机器事实以 `scripts/engine.mjs` 校验为准。未列字段不支持，不提供脚本、原始 SVG、图片、文字绘制、外部资源或任意颜色。

## 顶层

| 字段 | 内容 |
|---|---|
| `version` | 固定 1 |
| `mode` | portrait / anime / object / travel / landscape |
| `seed` | 0–4294967295 整数，默认 1，保留以复现纹理 |
| `source` | `{image, summary, people, landmark?}`：原图路径/来源、观察摘要、主要人物数，旅行必填真实地标 |
| `background` | 仅旅行/风景使用的形状数组 |
| `objects` | 全局物品形状数组 |
| `bodies` | 简短身体形状数组 |
| `heads` | 由后到前，数量等于 source.people，背影/隐藏头也计数 |

四个数组可省略，默认空。`source` 是模型观察，不是代码验证过的事实。每真人/人形角色对应一个头，最多 16 个；无法兼顾最低头大小时报告限制。

## 坐标

全局使用 0–1000 坐标，引擎按几何与控制点包围盒统一居中。头中心 `(x,y)` 为全局坐标，`size` 为面罩基准高度。头内局部高度为 100，面罩为 `[-50,-50]` 到 `[50,50]`，负 Y 朝上；局部坐标值限 -110 到 110。引擎按视向收窄、按 tilt 旋转。

## 头

| 字段 | 内容 |
|---|---|
| id | 唯一字母数字、下划线或短横线 |
| x, y | 全局中心 0–1000 |
| size | 80–700，面罩基准高度 |
| tilt | -180–180 度，来自原图，正方向顺时针 |
| view | front / three-quarter-left / three-quarter-right / profile-left / profile-right / back / hidden；left/right 是朝画面左/右 |
| eyes | `{left:"open|closed|hidden",right:"open|closed|hidden"}`，左右是头局部画面左右，不是人物解剖左右；无眼睛位置/尺寸参数 |
| ears | 实际可见耳列表，如 `["left"]`，默认空 |
| features | 最多三项识别特征的文字，不绘制文字 |
| hairBack, hairFront | 局部形状，合计 3–6，秃头/完全盖住为 0 |
| accessories | 最多三项 `{kind,shapes}`，每项最多 8 个局部形状 |
| blush | 布尔，默认 true；脸颊不可见时 false |

配件 kind 仅 `glasses / earring / hat / prop / beard / occluder`，依数组顺序覆盖。profile 最多一眼，back/hidden 两眼 hidden，hidden 无耳。发型不占配件额度。

眼罩/不透明镜片下 eyes 设 hidden；透明镜片下的可见眼可以 open，仅用无填色描边绘镜框，不填充镜片，不绘反光。部分被发遮眼使用 open 和前发覆盖；全藏眼不生成。不能根据人物知识补全。

## 形状

共有 type、fill（默认 blue）、opacity（默认 1），可选 stroke/strokeWidth。fill 只能 `blue / peach / paper / none`，stroke 只能前三种，opacity 为 0.04–1。彩色填块先铺纸白底，opacity 控制颜料浓度，不会透出后方图形。none 必须有描边，可用于透明镜片的镜框。描边全局宽 0.1–24、局部 0.1–6，端点转角自动圆润。

- 圆块：`{"type":"ellipse","cx":0,"cy":0,"rx":20,"ry":30,"fill":"blue"}`。
- 圆角块：`{"type":"rect","x":-20,"y":-20,"width":40,"height":40,"radius":12}`，radius 必填且不超过短边一半。
- 曲线：`{"type":"path","segments":[["M",-30,-20],["Q",0,-40,30,-20],["Q",0,0,-30,-20],["Z"]]}`。

路径仅支持 M(2 数值)、L(2)、Q(4)、C(6)、Z(0)，以 M 开始，填色路径以 Z 结束，最多 40 段。Q 为控制点/终点，C 为两个控制点/终点。头发只用圆润 Q/C，不允许 L；其它轮廓也优先圆润曲线，开放结构描边可用 L。不逐根描发或用小形状堆纹理。

## 指令记录与运行

`.analysis.md` 保存本次实际识别指令与观察，交付时按 [output-layout.md](output-layout.md) 放入输出根的 `records/`。例如：

> 将原图识别为圆趣手绘 scene JSON。原图是身份/内容唯一来源，参考只提供几何语法。识别人数、视向、倾斜、每眼状态、可见耳朵、发型与最多三项配件；选当前分支，用少量数值曲线表达，不补隐藏内容。

这是识别指令，不是图像模型直出提示词。

```bash
node "<skill-root>/scripts/render.mjs" "scene.json" --check
node "<skill-root>/scripts/render.mjs" "scene.json" --out-dir "yuanqu-handdrawn" --name "主体-yuanqu"
```

`--out-dir` 接收输出根目录，默认 `yuanqu-handdrawn`，CLI 分类保存到 `images/`、`source/` 和 `records/`。`--check` 只输出报告，不创建文件。`--size` 为 512/1024/2048。默认 PNG 依赖 skill 根目录的 `npm ci`；`--svg-only` 明确省略 PNG，不能报告完整交付。

报告初始 pending-source-review，含数据哈希、种子、版本、参数和路径。重名不覆盖，规范化 `.scene.json` 可再渲染。最终报告补语义审核与尝试次数。
