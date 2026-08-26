---
title: Orca 介绍：面向多 Agent 并行开发的开源 IDE
date: 2026-08-26 11:48:02
categories:
  - 人工智能
  - 开发工具
tags:
  - Orca
  - AI Agent
  - Codex
  - Claude Code
  - Git Worktree
description: 介绍 Stably AI 开源的 Orca IDE：它如何编排 Codex、Claude Code、Pi 等终端 Agent，如何利用并行 Git worktree、远程 SSH、Design Mode 和移动伴侣支持多 Agent 开发。
---

# Orca 介绍：面向多 Agent 并行开发的开源 IDE

Orca 是 Stably AI 开源的一款桌面 IDE，核心用途不是替代某个 AI 编程 Agent，而是把多个 Agent 放进同一个开发工作区。它可以让 Codex、Claude Code、OpenCode、Pi 等命令行 Agent 并排运行，每个 Agent 使用独立的 Git worktree，开发者在 Orca 中查看、比较和合并结果。

这个定位很重要。单个 Agent 解决的是“帮我完成一项编码任务”，Orca 解决的是“如何同时安排几项任务、隔离改动、持续观察进度并决定哪些结果值得合并”。如果你只偶尔让 AI 修改一个文件，Orca 可能显得复杂；如果你经常拆分任务、比较不同实现或需要远程盯住运行中的 Agent，它的价值会更明显。

## Orca 不是什么

Orca 不是一个新的大语言模型，也不是只能使用某一家模型的聊天窗口。它本身更像 Agent 的编排层和开发工作区：Agent 仍然由各自的 CLI 启动，模型账号和提供商也通常由对应工具负责。

它也不是把多个 Agent 的代码直接写进同一目录。Orca 的并行开发依赖 Git worktree，把不同尝试隔离到不同工作树，最后由开发者比较 diff、选择结果并合并。隔离减少了互相覆盖，但不会自动解决冲突、测试失败或设计方向错误。

## 核心工作方式：一个任务，多棵 worktree

假设你要给项目增加一个导出功能，可以把同一提示分发给五个 Agent。Orca 为每个 Agent 创建独立 worktree，它们共享同一个仓库历史，却在不同目录里修改代码。几个 Agent 可以分别尝试 API 设计、界面实现或测试方案，互不覆盖工作文件。

完成后，Orca 提供 diff 和审查入口。你可以逐行添加评论，把修改意见发回 Agent，让它继续编辑、提交，或者直接放弃某个分支。最终合并仍然需要人工判断：代码是否满足需求、测试是否覆盖关键路径、依赖和许可证是否可接受，都不能由“生成完成”这几个字代替。

这种模式把 Agent 从单线程助手变成了可调度的开发资源。它适合探索阶段和方案比较，但会消耗更多模型调用、磁盘空间和审查时间。五个答案不一定比一个答案更好，只有任务确实存在多种实现路径时，并行才有意义。

## 主要功能

### 并行 Worktree

这是 Orca 的招牌能力。一个提示可以分发给多个 Agent，各自运行在隔离 worktree 中。你可以比较不同模型、不同提示词或不同实现方案，再挑选一个合并。

使用前要确认仓库适合这样做。生成文件、数据库迁移、端口监听和外部服务状态可能会跨 worktree 共享，隔离的只是 Git 工作目录，不是整个操作系统环境。需要共享资源时，应为每个分支准备独立配置或测试环境。

### 多终端分屏

Orca 集成了支持 WebGL 渲染的终端，可以创建多个分屏，滚动历史在重启后仍可保留。终端是 Agent 的实际入口，因此这一层体验会直接影响你能否看懂命令输出、确认权限请求和处理异常。

对习惯 tmux 或多个终端窗口的人来说，Orca 把这些会话收进了一个界面；对不常用命令行的人来说，分屏数量增加后也可能带来新的管理负担。建议从少量长期任务开始，而不是一上来就铺满窗口。

### Design Mode

Design Mode 允许你在真实 Chromium 窗口中点击某个界面元素，把对应的 HTML、CSS 和裁剪截图直接送进 Agent 提示词。它适合处理“这个按钮间距不对”“弹窗在窄屏上溢出”这类需要视觉上下文的任务。

它传递的是当前页面的观察结果，不是完整的设计规范。颜色、字体、交互状态和响应式行为仍要在不同窗口尺寸下复核；截图能帮助 Agent 定位问题，却不能代替验收。

### GitHub 与 Linear 集成

Orca 可以在应用内查看 GitHub 的 PR、Issue 和 Linear 项目任务，并从任务直接打开对应 worktree。这样做减少了在浏览器、终端和编辑器之间切换，适合把“任务描述—编码—审查”连成一条流程。

集成是否顺手取决于团队的权限和工作方式。它不会改变 GitHub 或 Linear 原有的审批规则，也不会让一个没有验收标准的 Issue 自动变成可执行任务。

### 远程 SSH Worktree

需要更大内存或更强 CPU 时，可以把 Agent 放到远程机器，Orca 通过 SSH 提供文件编辑、Git、终端、自动重连和端口转发。桌面端更像控制台，真正的构建和测试在远端运行。

远程模式要重点检查密钥、网络中断、端口暴露和敏感文件同步。自动重连能恢复界面，不代表远程进程一定仍在运行；长任务最好同时保留日志和可恢复的运行方式。

### 移动伴侣

Orca 提供 iOS 和 Android 移动伴侣，可以接收 Agent 完成通知，并从手机发送后续指令。它适合等待构建、评测或长时间代码任务时查看状态。

移动端更适合“观察和轻量干预”，不适合在小屏幕上完成复杂 diff 审查。涉及权限批准、代码合并或删除文件时，仍建议回到桌面端确认上下文。

### Orca CLI 与自动化

除了桌面界面，Orca 还提供 CLI，可以用 `orca worktree create`、`snapshot`、`click` 和 `fill` 等命令脚本化工作流。这样，Agent 也可以驱动 Orca，把重复的打开工作树、采集快照和填写输入等操作纳入自动化。

CLI 的价值在于可组合，而不是命令越多越好。自动化脚本需要处理超时、失败重试、权限和清理策略，否则只是把手工操作换成了更难排查的黑盒。

## 支持哪些 Agent

Orca 的官方 README 写的是“任何能在终端运行的 CLI Agent”。当前列出的例子包括 Claude Code、Codex、Grok、Cursor CLI、GitHub Copilot CLI、OpenCode、Pi、Kimi Code、Qwen Code、Goose、Cline CLI 等。

这里的“支持”主要表示 Orca 能为它提供终端、worktree 和工作区管理，并不代表 Orca 统一了这些 Agent 的模型能力、权限语义或配置格式。不同 Agent 对上下文文件、命令确认、会话恢复和费用统计的处理方式可能不同，团队仍需分别熟悉。

## Orca 与 Pi、Maka 的关系

Orca、Pi 和 Maka 都可以出现在终端 Agent 的工作流里，但层次不同：

| 工具 | 主要定位 | 解决的问题 |
| --- | --- | --- |
| Pi | 可编程的终端 coding harness | 如何在终端运行并扩展一个 Agent |
| Maka | local-first Agent workspace 与 Runtime Host | 如何记录、审批、恢复和评测 Agent 运行 |
| Orca | 多 Agent 开发 IDE 与编排层 | 如何并行安排多个 CLI Agent，并隔离和合并代码 |

Orca 可以运行 Pi，也可以运行 Maka CLI，只要它们能在终端工作。Orca 不需要接管每个 Agent 的内部 Runtime；它更关注进程、终端、worktree 和开发者审查界面。因此，把 Orca 说成“Pi 的升级版”或“Maka 的桌面皮肤”都不准确。

## 技术形态与开源信息

从官方仓库的 `package.json` 看，Orca 是 Electron 应用，前端使用 React 和 Vite，项目同时包含 CLI、Electron 主进程、原生模块和移动端目录。Electron 让它可以覆盖 macOS、Windows 和 Linux，代价是桌面应用需要携带 Chromium 运行时，并处理各平台打包与更新。

仓库以 MIT License 发布。官方 README 提供 macOS Apple Silicon、macOS Intel、Windows 安装程序和 Linux AppImage 下载，也提供 Homebrew 与 Arch Linux AUR 安装方式。版本迭代很快，功能墙和 README 会落后于实际更新，使用前应查看最新 release 和变更记录。

## 适合谁，不适合谁

Orca 比较适合以下情况：

- 你经常同时运行多个编码 Agent，需要集中查看状态；
- 你想比较多个实现，而不是接受第一次生成的结果；
- 项目使用 Git，并且能够接受为每个尝试维护 worktree；
- 你需要远程机器运行构建或测试，再从本地查看结果；
- 团队愿意建立 diff 审查、分支清理和 Agent 权限规则。

下面这些情况要谨慎：

- 仓库很小，任务通常几分钟内就能手工完成；
- 团队成员不熟悉 Git 分支和 worktree；
- 构建依赖共享数据库、固定端口或硬件设备，难以并行隔离；
- 对账号、代码或终端输出有严格的本地化和合规要求，却没有审查 Orca 的遥测与集成配置；
- 希望一个工具自动替你完成方案选择、代码验收和上线决策。

## 使用 Orca 时最容易忽略的成本

第一是模型调用成本。并行五个 Agent 等于同时支付五份探索费用，失败尝试也会产生调用量。可以先让一个 Agent 做方案分析，再把真正有价值的分支并行展开。

第二是审查成本。隔离 worktree 减少了覆盖风险，却增加了比较 diff、运行测试和清理分支的工作。没有明确验收标准时，多个结果只会让选择更慢。

第三是环境成本。每个 worktree 可能需要依赖安装、构建缓存、端口和测试数据。磁盘、CPU、内存和 CI 队列都要按并发数估算。

第四是安全成本。Orca 只是编排层，真正执行命令的 Agent 仍可能读取文件、访问网络或修改仓库。应分别检查 Agent 的权限，再检查 Orca 的终端、SSH、移动通知和第三方集成设置。

## 一个稳妥的上手流程

先选一个可以快速验收、又存在两种实现路径的任务，例如补一个 API、重构一个模块或修复一个有测试覆盖的界面问题。只启动两个 Agent，分别放到独立 worktree。

接着记录四件事：任务完成时间、模型调用量、人工审查时间、最终合并后测试结果。若并行带来的收益没有覆盖额外审查成本，就不要为了“多 Agent”而强行并行。

等流程稳定后，再加入远程 SSH、移动通知和 CLI 自动化。每增加一种入口，都要明确谁负责批准命令、处理失败和清理资源。这样扩展出来的工作区才不会变成一排无人维护的 Agent 窗口。

## 总结

Orca 的核心价值是把多个终端 Agent 放进同一个 Git 驱动的开发循环：任务可以并行，代码彼此隔离，结果集中审查，必要时还能远程运行和移动端跟进。它不替你选择模型，也不替你完成代码验收；它提供的是一套让“多次尝试”更容易管理的界面和编排机制。

如果你的工作方式已经接近“一个任务、一个 Agent、一个终端”，先把 Pi、Codex 或 Claude Code 用顺，通常更划算。等你开始同时维护多个长任务、比较不同实现，或者需要把 Agent 工作纳入团队流程，再考虑 Orca。

## 资料与项目入口

- [Orca 官方 GitHub 仓库](https://github.com/stablyai/orca)
- [Orca 官方 README](https://raw.githubusercontent.com/stablyai/orca/main/README.md)
- [Orca 下载页面](https://onorca.dev/download)
- [Orca Homebrew Tap](https://github.com/stablyai/homebrew-orca)
- [Orca Worktrees 文档](https://www.onorca.dev/docs/model/worktrees)
- [Orca SSH 文档](https://www.onorca.dev/docs/ssh)
- [Orca Design Mode 文档](https://www.onorca.dev/docs/browser/design-mode)

本文依据 2026 年 8 月 26 日公开仓库和文档整理。Orca 更新频繁，支持的 Agent、安装包和功能细节应以最新 release 为准。
