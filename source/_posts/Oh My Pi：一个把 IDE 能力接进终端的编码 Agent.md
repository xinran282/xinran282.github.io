---
title: Oh My Pi：一个把 IDE 能力接进终端的编码 Agent
date: 2026-09-16 09:42:41
categories:
  - AI 开发工具
  - 开源项目
tags:
  - Oh My Pi
  - Coding Agent
  - Pi
  - 终端工具
  - ACP
---

[Oh My Pi（OMP）](https://github.com/can1357/oh-my-pi) 可以先用一句话概括：它是在 Pi 的基础上继续扩展的开源编码 Agent，仍把终端交互放在中心，却试图把编辑器里的语言服务、调试器和协作入口一起带到 Agent 工作流里。

它不是一个新的大模型，也不靠替换模型取胜。OMP 解决的是另一层问题：模型怎样读项目、改文件、运行命令、理解代码符号，并在需要时把任务交给别的 Agent 或编辑器。项目 README 把这一层称为 coding-first surface；更直白一点，就是给代码 Agent 准备一套比“聊天 + shell”更完整的运行环境。

## 它和 Pi 是什么关系

OMP 是 [Pi](https://github.com/badlogic/pi-mono) 的 fork。Pi 本身强调可编程、可扩展的终端 Agent；OMP 保留了这些基础，同时加入了一批面向编码任务的内建能力，例如会话管理、子 Agent、斜杠命令、插件、模型路由和编辑器协议。

这层关系很重要。它意味着 OMP 并非从零定义一套 Agent 交互，而是在已有的终端 Agent 体验上做工程化加法。对于已经习惯 Pi 的人，迁移成本会低一些；对于从 Claude Code、Codex 或 Cursor 过来的人，则更容易把它理解成一个偏“可组合”的终端编码环境。

README 当前列出的技术构成也说明了这个取向：交互与 SDK 主要使用 TypeScript，性能敏感的底层能力则由 Rust 实现。项目声明其 Rust 核心约 8 万行，并提供多提供商模型接入、内建工具，以及 LSP 和 DAP 相关操作。这里的数量来自项目 README，适合作为能力范围的参考，不等同于第三方性能测评。

## OMP 想补上的，正是终端 Agent 容易缺的那一段

纯终端 Agent 通常已经能读写文件、跑命令和调用模型，但它未必能稳定拿到编辑器掌握的语义信息。OMP 的设计重点，是把这些信息和操作放进同一个 Agent 回路。

### 让 Agent 使用语言服务和调试器

项目把 LSP 接到写入流程中。LSP 即 Language Server Protocol，编辑器依靠它提供跳转定义、查找引用、诊断和重命名等能力。对编码 Agent 来说，这意味着它可以少依赖字符串搜索，多利用符号和诊断来判断一次修改是否影响了别处。

OMP 也声明支持驱动真实调试器，并提供 DAP 相关操作。DAP 是 Debug Adapter Protocol。调试器接入不保证 Agent 自动找到所有运行时问题，但它给了 Agent 一条更接近开发者日常排障方式的路径：设置断点、观察变量、沿调用过程定位问题，而不只是在日志里猜。

### 子 Agent、审查和会话不再只是外围脚本

README 将子 Agent、第二模型审视每轮输出、代码审查、会话分支与恢复列为内建工作流的一部分。实际价值不在于“多 Agent”这个标签，而在于任务隔离：主 Agent 可以继续实现功能，同时让另一条会话检查风险、阅读文档或复现问题。

这类工作流适合问题边界清楚的任务，例如让一个子 Agent 审查补丁、让另一个调查测试失败。它仍然需要人来决定结论是否可信，尤其是在涉及权限、生产环境和合并发布时。

### 既能在终端跑，也能被别的宿主驱动

OMP 给出四种入口：交互式终端、一次性命令、Node/TypeScript SDK，以及基于标准输入输出的 RPC。后一种方式让非 Node 的宿主也可以通过 NDJSON 驱动 Agent。

另一个值得关注的是 `omp acp`。它实现 [Agent Client Protocol（ACP）](https://github.com/zed-industries/agent-client-protocol)，让编辑器可以作为客户端与 Agent 通信。编辑器若声明了对应能力，文件读写与终端操作能通过协议路由，写入操作还可由 `session/request_permission` 控制。对 IDE 作者或团队内部工具而言，这比模拟终端界面更适合作为集成点。

## 对已有配置的态度：尽量继承，而非强迫迁移

第一次启动时，OMP 会尝试发现本机已存在的规则、技能和 MCP 服务器配置，范围包括 `.claude`、`.cursor`、`.windsurf`、`.gemini`、`.codex`、`.cline`、`.github/copilot` 与 `.vscode`。项目的目标是减少“换一个 Agent 就重建一遍工作环境”的摩擦。

这项能力很方便，但也建议先检查继承到了什么。不同工具对规则优先级、命令权限和 MCP 配置的含义并不完全一致。把现成配置导入新工具之前，尤其要确认其中没有过宽的 shell 权限或不再需要的服务凭据。

扩展方式也相当直接：插件是 TypeScript 模块，可使用与内建功能相同的工具 API、斜杠命令注册表和终端 UI 原语。插件既可以只放在本地，也能打包发布到 marketplace 或 npm。这个设计适合有固定开发流程的团队，把约定做成可检查的工具，而不是反复贴进提示词。

## 安装与最小上手

OMP 支持 macOS、Linux 和 Windows。README 提供了多种安装方式；如果机器上已经使用 Bun，推荐的全局安装命令是：

```bash
bun install -g @oh-my-pi/pi-coding-agent
```

Windows PowerShell 也可使用项目安装脚本：

```powershell
irm https://omp.sh/install.ps1 | iex
```

macOS 和 Linux 用户可使用：

```bash
curl -fsSL https://omp.sh/install | sh
```

此外还有 Homebrew、Nix 和 `mise` 等安装入口。安装前应以 README 的最新要求为准；其中 Bun 路径要求 Bun 版本不低于 1.3.14。终端补全可以由 `omp completions` 为 bash、zsh 和 fish 生成。

如果准备从源码参与开发，仓库给出的起步流程是：

```bash
bun setup
bun dev
```

`bun setup` 会安装工作区依赖并构建本地 Rust/N-API 扩展。修改 Rust crate 或 `packages/natives` 后，README 建议重新运行 `bun run build:native`。

## 哪些人值得试，哪些人可以先等等

如果你主要在终端中完成开发，又希望 Agent 能用 LSP、调试器、结构化编辑和可拆分的子任务，OMP 值得放进候选工具清单。它也适合需要把 Agent 嵌入自有编辑器、脚本或服务的开发者：SDK、RPC 和 ACP 覆盖了不同宿主的接入方式。

但如果你的需求只是偶尔让模型生成一段代码，OMP 的配置面和功能深度可能反而显得重。它提供的模型选择、插件、会话和工具策略需要花时间建立习惯。对个人项目而言，先用一个简单的终端 Agent 跑通“读代码—修改—测试”的闭环，再判断是否需要更复杂的 harness，通常更稳妥。

还有一点需要保留：README 中关于工具效果和基准的陈述主要来自项目自身。它们可以帮助理解作者优化的方向，例如减少失败编辑的重试和改善模型的工具调用格式，却不能替代在你的仓库、模型和权限配置上的实际验证。

## 结语

Oh My Pi 最有意思的地方，不是又做了一个聊天入口，而是认真对待了代码 Agent 的运行环境：模型需要语义信息，需要调试路径，需要可控的权限和可复用的配置，也需要与编辑器、脚本和团队流程相连。

它选择的答案是保留终端的直接感，再把 IDE 与工程工具接进来。是否适合你，最终取决于你愿意把多少日常开发流程交给 Agent，以及你是否愿意为更强的可组合性承担相应的配置与验证成本。

## 参考

- [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi)
- [OMP 文档站](https://omp.sh)
- [Agent Client Protocol](https://github.com/zed-industries/agent-client-protocol)
