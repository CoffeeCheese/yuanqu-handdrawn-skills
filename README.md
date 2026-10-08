# 圆趣手绘

把照片或动漫原图转换为灰蓝／蜜桃橘、胶囊眼和白纸留白的正方形手绘插画。当前模型理解原图与风格参考，优先使用会话内置图像生成完成绘制。

默认流程关注风格、身份和姿态：模型自由决定脸型、眼距、发块和笔触，无需 SVG、坐标数据或固定几何比例。不配置外部 API 或密钥，也不承诺指定图像模型。需要离线代码绘图时可明确选择保留的旧绘图模块。

## 安装

通过 `npx skills add` 管理，在 Codex 中使用 `$yuanqu-handdrawn` 调用。准备 Node.js 22.20 或更高、npm 和 Git；运行环境需要能查看图片、保存文件，并提供内置图像生成能力。

本仓库为 **private**，安装者需有访问权限及可用的 GitHub 认证。已有 Git 凭据或 SSH 配置可直接使用；GitHub CLI 用户可先执行 `gh auth status` 检查登录。

推荐全局安装：

```bash
npx skills add CoffeeCheese/yuanqu-handdrawn-skills --skill yuanqu-handdrawn --agent codex --global --yes
```

只安装到当前项目时去掉 `--global`。技能位于全局 `~/.agents/skills/yuanqu-handdrawn/` 或项目内 `.agents/skills/yuanqu-handdrawn/`。

HTTPS 认证不可用、已配置 GitHub SSH 时可使用：

```bash
npx skills add git@github.com:CoffeeCheese/yuanqu-handdrawn-skills.git --skill yuanqu-handdrawn --agent codex --global --yes
```

默认模型生成无需安装本仓库的 npm 渲染依赖。安装 skill 本身不会为会话增加图像生成能力；环境缺少该能力时会说明未完成成图并提供生成指令，代码绘图需明确选择。

## 使用

提供原图后发送：

```text
使用 $yuanqu-handdrawn 将这张原图转换为圆趣手绘插画。
保留人物数量、发型、头朝向、姿态和真实遮挡，保存到 ./output/yuanqu-handdrawn/。
```

有自己认可的风格成品时，同时提供并明确角色：

```text
使用 $yuanqu-handdrawn：图1是原图，图2只作为风格参考。
尽量接近图2的配色、圆润造型和蜡笔笔触，人物身份与姿势以图1为准。
优先使用会话内置图像生成，保存到指定目录。
```

也接受多张原图或一个目录；目录默认只处理直属图片，每张独立生成和核对。只需分析时说明“只分析，不生成”。

未指定风格图时采用包内参考。以下图片是用户提供的历史风格成品，用于表达目标，不是本次规则重构后的生成样张：

![圆趣手绘风格参考](skills/yuanqu-handdrawn/assets/handdrawn-reference.jpg)

## 风格与构图

柔和圆脸、醒目的实心竖胶囊眼、干净的脸部留白，配合连续发块、蜡笔／彩铅颗粒和自然边缘。灰蓝和蜜桃为主，必要识别配件允许少量低饱和辅助色。完整要求见 [技能入口](skills/yuanqu-handdrawn/SKILL.md)。

风格参考还控制造型夸张尺度、色块组织、颗粒尺度和笔触密度。包内参考以饱满头脸、紧凑身体、大块近似平涂底色、细密纸粒及少量低对比衣纹为主；生成后按 [风格校准](skills/yuanqu-handdrawn/references/style-calibration.md) 分项比较。参考人物的朝向、配件和动作仍不移植。

| 输入 | 构图依据 |
| --- | --- |
| 人物或人形动漫 | 保留发型、配件、头向、闭眼与遮挡；头像用头肩构图，必要坐姿、双手与服装可保留 |
| 有人的旅游照 | 保留主要旅行者、互动及一个浅色场景线索 |
| 无人风景或物品 | 保留可辨的空间或物品结构，保持原图内容与无拟人化 |

## 输出与稳定性

默认请求一张 1:1、1024×1024 的纯插画，记录工具实际生成尺寸。用户指定目录优先，否则保存到当前目录的 `output/yuanqu-handdrawn/`，重名编号：

- `<原图名>-yuanqu.png`：选中的成品；需要 JPG 时可指定。
- `<原图名>-yuanqu.generation.md`：输入与参考路径、实际指令、使用的能力、可见参数、尝试次数、主体与风格核对结果。

每张先生成一次，有具体偏差时最多修正一次；仍有偏差会说明。未核对成品时不记为通过。用户可继续提出下一轮修改。

系列稳定性依靠同一风格参考、核心要求和生成后核对；不保证重生成逐像素一致，也不假设工具能固定模型或种子。当前模型的视觉判断和会话提供的图像生成能力都可能影响效果。模型生成已用一张真实坐姿肖像试验，并根据用户对比反馈校准造型与笔触；校准后的风格仍待用户确认，其它主体和系列稳定性尚未验证。

## 更新与移除

```bash
# 查看全局 Codex 技能
npx skills list --global --agent codex

# 更新这一项技能
npx skills update yuanqu-handdrawn --global --yes

# 更新失败时，重新执行安装命令替换技能文件
npx skills add CoffeeCheese/yuanqu-handdrawn-skills --skill yuanqu-handdrawn --agent codex --global --yes

# 移除
npx skills remove yuanqu-handdrawn --global --agent codex --yes
```

项目安装的查看和移除去掉 `--global`；更新使用 `--project`。更新前将个人改动和输出保存在技能目录之外。安装命令参考 [skills CLI 官方说明](https://github.com/vercel-labs/skills)，本仓库此前使用 CLI 1.7.1 验证。

## 可选的本地代码绘图

仅在明确要求代码／离线绘图时读取 [代码手绘实验](skills/yuanqu-handdrawn/references/code-handdrawn.md)；明确要求固定几何复现时读取 [固定几何流程](skills/yuanqu-handdrawn/references/legacy-geometry.md)。这些模式可复用已有 scene 数据，需准备锁定的本地渲染依赖。其数据、SVG 和种子要求不适用于默认模型生成。

[历史代码肖像样张](assets/previews/paint-portrait.png) 与 [几何样例](assets/previews/portrait.png) 仅展示旧绘图模块能力。代码颗粒与模型生成的手绘笔触可能不同。

## 设计与开发

按 `codebase-design` 将规则收拢为一个 Module：

| 设计概念 | 本项目的选择 |
| --- | --- |
| Interface | 原图＋可选风格参考＋可选输出目录，返回成品与生成记录 |
| Implementation | 参考角色、风格要求、生成指令、核对、一次修正及保存集中在技能内部 |
| Seam | 生成执行处：使用会话实际可用的图像能力；明确选择代码时切换到旧绘图模块 |
| Adapter | 会话内置图像生成与已有本地渲染流程，两者实际存在，按用户选择使用 |

Depth 来自小 Interface 隐藏识别、风格约束和交付细节；Leverage 是不同图片复用同一流程，Locality 是默认规则集中在 [SKILL.md](skills/yuanqu-handdrawn/SKILL.md)。工具参数集中在 [内置生成约定](skills/yuanqu-handdrawn/references/model-generation.md)，旧代码规范仅按需读取。

修改规则时检查默认路径不加载固定几何规范，参考图只影响风格，能力缺失时不偷偷切换执行方式。旧渲染脚本保留回归检查：

```bash
cd skills/yuanqu-handdrawn
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

离线脚本测试验证旧代码模块，不验证模型生成质量。新生成效果应以真实原图及参考成品逐例比较。

## 许可证

采用 [MIT 许可证](LICENSE)。本项目是原创融合风格实验，不是官方 Grok 素材。
