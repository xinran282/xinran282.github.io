# Impeccable：使用与生效机制

核对日期：2026-11-18。所读 main 分支技能与 npm 包版本为 4.9.2；main 内容会继续变化。[package.json](https://github.com/pbakaus/impeccable/blob/main/package.json)

## 它如何生效

1. **技能入口约束代理的工作流程。** 安装后由宿主编码工具发现 `impeccable/SKILL.md`；入口的 description 覆盖前端设计、审查、打磨等请求。显式 `$impeccable polish 页面` 可以明确选择它。当前版本是一个入口技能加 24 个子命令，不是 24 个独立技能。[Codex 入口](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md)
2. **按任务读取手册。** 入口要求先运行 `impeccable context`（每 session 一次，项目 cwd），读取 PRODUCT.md、DESIGN.md、对应 surface brief 和适用的平台指导；随后按子命令加载 reference。真正修改 UI 前还须读取 `craft-floor.md`。因此作用来自给当前模型提供目标、上下文、设计规则和检查步骤，不涉及更换或微调模型。[入口 Setup / Commands / Routing](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md)
3. **本地引擎做确定性检查和辅助工作。** launcher 调用随附或首次下载的独立二进制；技能运行本身不依赖 Node，`npx` 安装才需要。Windows 没有 sh 时使用 `impeccable.cmd`。当前 README 列出 62 条确定性检测规则，无需 LLM/API key。[README](https://github.com/pbakaus/impeccable#three-ways-to-run-the-detector)
4. **hook 让检查自动触发。** 安装器可配置 UI 修改后的 detector 检查，把问题交回代理。技能成功加载和 hook 成功授权是两个条件；手动只复制技能不会安装 hook。Codex 需要到 `/hooks` 批准项目 hook，更新变动后可能再批准。[安装说明](https://github.com/pbakaus/impeccable#installation)
5. **多宿主是生成适配产物。** 构建脚本读取源技能并交给 provider transformers，生成 `.agents/skills/`、`.claude/skills/` 等宿主目录以及分发 ZIP/插件。不是通过网站 CSS 直接改变用户项目。[scripts/build.js](https://github.com/pbakaus/impeccable/blob/main/scripts/build.js)

## Codex 最短使用流程

在目标项目根目录运行：

```powershell
npx impeccable install --providers=codex --scope=project
```

重新加载编码工具，在 `/skills` 中确认能找到 impeccable；如果安装了 hook，在 `/hooks` 中批准。然后在聊天中依次按需运行：

```text
$impeccable init
$impeccable document
$impeccable critique 首页的导航和首屏
$impeccable polish 首页的导航和首屏
$impeccable audit 首页
```

`init` 写 PRODUCT.md，记录产品用户、用途和约束；`document` 从既有代码提取 DESIGN.md，以后修改有视觉依据。`critique` 是 UX 评估，`audit` 是可访问性、性能、响应式等技术质量报告，`polish` 是实际打磨。聚焦组件/区块通常比一次指定全站更有效。[README How it works](https://github.com/pbakaus/impeccable#how-it-works)

也可以说 `$impeccable 重做这个首屏，保留现有文案和品牌色`。只输入 `$impeccable` 会呈现菜单，不自动执行命令。常用命令可以 `$impeccable pin audit` 固定为 `$audit` 快捷入口。[入口 Routing](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md)

## 判断是否有效与边界

- `/skills` 里出现 impeccable 说明宿主发现了技能；请求后出现读取 SKILL/reference、运行 context 或读取 PRODUCT/DESIGN 等行为，是实际采用该流程的证据。仅收藏 GitHub 仓库或在普通聊天贴 URL，不等于安装。[入口](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md)、[安装说明](https://github.com/pbakaus/impeccable#installation)
- 独立检查可用 `npx impeccable detect src/`；源码扫描只有模式规则，低对比度/过小文字等需要渲染页，使用 `npx impeccable detect http://localhost:5173`。退出码 2 为发现问题、1 为无法扫描。[detector 文档](https://github.com/pbakaus/impeccable#three-ways-to-run-the-detector)
- 不保证任何模型、任何页面都获得示例图效果；它提供流程和规则，最终设计仍由编码代理实现、通过渲染验证。已有界面上的小范围迭代是 README 推荐起点。[Why](https://github.com/pbakaus/impeccable#why)、[入口原则](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md)
- `live` 还有独立的浏览器迭代运行机制；README 明示，无活跃聊天轮询时 Apply 可能降级启动取消 approvals/sandbox 的 codex/claude CLI。若使用该功能，可在启动 live 的环境设置 `IMPECCABLE_LIVE_COPY_AGENT=chat` 保持聊天代理路径；普通 init/critique/polish 无须 live。[Live mode](https://github.com/pbakaus/impeccable#live-mode)
