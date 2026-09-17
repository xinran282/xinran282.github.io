---
title: CodexHost：在 Codex Desktop 里切换多种 Agent Harness
date: 2026-09-03 19:47:44
categories:
  - AI 开发工具
  - 开源项目
tags:
  - CodexHost
  - Codex Desktop
  - Agent Harness
  - Claude Code
  - Pi
---

[BytePioneer-AI/codex-host](https://github.com/BytePioneer-AI/codex-host) 做的事情很直接：把 Pi、Claude Code、OpenCode、Oh My Pi、Grok Build、DeepSeek Harness 等 Agent Harness 接进 Codex Desktop，让它们在同一个桌面窗口里运行。

它不是另一个聊天壳，也不是把所有模型包装成 OpenAI 兼容接口。项目的取舍是保留 Codex Desktop 的工作区、Thread、流式输出、工具状态、Diff、审批和提问界面，再把真正执行任务的 Harness 交给用户选择的原生程序。

## 先理解两个词

**Agent** 是执行任务的程序，例如 Claude Code 或 Pi。**Harness** 可以理解为 Agent 的运行框架：它负责读取项目、调用工具、修改文件、运行命令，并维护自己的会话状态。

CodexHost 把“显示界面”和“执行任务”拆开。Codex Desktop 负责统一呈现；被选中的 Harness 仍在自己的协议和权限模式下工作。这也是项目强调原生体验的原因：已有的工具审批、Diff 和登录状态，不必重新在一个第三方聊天框里模拟。

## 它是怎样接进去的

从仓库文档和代码结构看，CodexHost 大致分为四个部分：

- **Desktop 集成**：通过 CDP / Electron Inspector 在官方 Codex Desktop 界面中增加 Agent 选择和会话入口，不重做整个聊天界面。
- **协议适配**：用 CLI Shim 与官方 app-server 对接，让 Codex 的请求可以透明转发到目标 Harness。
- **Harness 适配器**：不同 Agent 按各自原生接口接入，例如 Pi 的 RPC、Claude Code 的 SDK/CLI；输出再映射回 Desktop 的流式文本、工具、Diff 和审批组件。
- **会话编排**：被委派的任务会创建独立 Native Session，并保存委派关系。发起方可以在 Codex Desktop 的会话列表里查看进度或继续对话。

仓库还使用了 [Agent Client Protocol（ACP）](https://agentclientprotocol.com/) 作为部分客户端接入思路，但项目并没有只依赖 ACP；README 明确提到，过度依赖通用协议可能会削弱某些 Harness 的原生能力，因此适配器会保留各自的接口。

## 快速安装

项目 README 给出的 npm 安装方式是：

```bash
npm install -g @codexhost/cli
codexhost
```

仓库声明支持 macOS、Windows 和 x64/ARM64 Linux。Linux 文档对系统和 ChatGPT App 安装包有额外限制，使用前应按仓库的 [Linux 说明](https://github.com/BytePioneer-AI/codex-host/blob/main/docs/linux.zh-CN.md)核对架构、glibc 和安装来源。

如果要从源码开发，可以按仓库要求准备官方 Codex Desktop、Node.js 22.19+ 或 24.x，以及 Rust：

```bash
git clone https://github.com/BytePioneer-AI/codex-host
cd codex-host
npm ci
npm start
```

这里的 `npm start` 是开发启动方式；日常使用更适合安装 CLI 或下载仓库 Releases 中的安装包。macOS 首次打开若遇到系统隔离提示，README 也提供了对应的排查命令。

## 适合怎样的工作流

最有意思的用法是让一个 Agent 委派另一个 Agent：例如让当前 Agent 请 Claude Code 做一次独立代码审查，再让 Pi 调查某个偶发测试失败。CodexHost 会为目标 Harness 创建独立会话，结果回到 Codex Desktop 的会话列表中，便于并行观察。

这类协作适合有清晰输入和输出的任务，比如审查、定位测试失败、实现一个局部功能或整理文档。它并不会自动替你解决责任问题：合并补丁、发布版本和生产变更仍应经过团队自己的评审和流水线。

## 远程 Harness：SSH 与 Remote Control

CodexHost 不只支持本机 Agent。仓库提供两种远程路径，但状态并不相同。

### SSH 远程工作区

macOS、Linux 客户端可以通过 Codex Desktop 的原生 SSH 工作区，使用另一台 macOS 或 Linux 开发机上已安装、已登录的 Harness。远程机需要安装相同版本的 codexhost，并执行：

```bash
npm install -g @codexhost/cli
codexhost remote install
codexhost remote start
codexhost remote status
```

凭据留在远程开发机，提示词、流式输出、工具状态、审批和 Diff 通过已有 SSH 通道投影回来。仓库文档特别强调，远程 Host 不会把 Claude 的登录材料复制到客户端，也不会把普通 Shell 中的远程所有权配置扩散出去。

### Windows Remote Control

Remote Control 集成目前仍标为实验能力。被控端是 Windows，控制端需要按官方 Remote Control 完成配对；Harness 账号和项目文件留在 Windows 上。CodexHost 通过官方允许的 `process/spawn` 等 app-server 方法启动固定桥接命令，不新增 TCP 监听端口，也不替代官方 relay。

遇到配对失败、账号授权错误或原生 Codex 任务本身无法运行时，应先按 OpenAI Remote Control 的文档排查，再检查 CodexHost 的桥接状态。

## 使用前要留意的边界

第一，项目依赖官方 Codex Desktop 的界面和协议。Desktop、Harness 或 codexhost 版本不匹配时，集成可能表现为 Agent 不出现、桥接超时或会话无法恢复；远程两端应尽量保持同版本。

第二，权限仍由所选 Harness 的原生模式约束。CodexHost 统一了入口，不会替你取消 Claude Code、Pi 等工具自身的确认机制。把高权限账号交给自动化任务前，应该先确认工作区、网络和凭据范围。

第三，部分能力仍在演进。README 对 Antigravity 和 Windows Remote Control 都标注了实验或完善中的状态，不能把功能矩阵当作所有版本都不变的承诺。

## 值不值得试

如果你已经在 Codex Desktop、Claude Code 和 Pi 之间来回切换，CodexHost 的价值很明确：少开几个窗口，同时保留不同 Harness 的原生能力。它尤其适合需要并行委派、比较不同 Agent 输出，或者希望在远程开发机上复用登录环境的人。

如果你只使用官方 Codex，或者更看重极简安装，额外引入一个集成层未必划算。建议先从低风险仓库和只读审查任务开始，确认版本兼容、权限边界和会话恢复都符合预期，再扩大到代码修改和远程执行。

项目采用 MIT License，源码、安装包和各平台说明都在 [GitHub 仓库](https://github.com/BytePioneer-AI/codex-host)。具体命令和支持矩阵会随项目更新，安装前最好以仓库 README 和对应平台文档为准。

