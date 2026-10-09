---
title: Orca：给并行 Agent 用的 ADE
date: 2026-09-22 19:53:51
categories:
  - 工具
tags:
  - Orca
  - Agent
  - worktree
  - ADE
---

Orca 不是又一个聊天窗口，也不是又一个绑定单一模型的 IDE。它把自己叫成 ADE：Agent Development Environment。仓库 [stablyai/orca](https://github.com/stablyai/orca) 的定位很直白：用你自己的订阅，同时跑一队编码智能体。桌面、手机、远程机器都能接进来。

到 2026 年 9 月 22 日，这个 TypeScript 仓库大约 7.5 万 Star，MIT 许可证，Stably 出品，Y Combinator 背景。官网是 [onOrca.dev](https://onorca.dev)。宣传语写的是「面向 100x 构建者的 AI 编排器」，听起来夸张，产品本身倒不绕：把 Codex、Claude Code、OpenCode、Pi 这类 CLI 智能体并排跑起来，每个占一个 git worktree，状态集中看。

## 它到底解决什么

现在常见的用法是：开一个 Claude Code 终端，改一个仓库；卡住了再开 Cursor 或 Codex 重来一遍。文件在同一份 checkout 上互相覆盖，stash 和切分支很快变成体力活。

Orca 把单位从「一个仓库窗口」改成「一个任务一份磁盘副本」。文档写得很清楚：每个功能或 bug 对应一个 `git worktree`。智能体改的是自己那份文件，不会踩到旁边那个 agent 正在改的同一行。

这不是新发明。`git worktree` 一直能做到隔离。Orca 做的是把创建、分发提示、对比 diff、提交、开 PR、远程跑、手机盯进度，收进同一个桌面应用。

## 核心模型：一个任务一份 worktree

按官方文档，仓库有一个 base ref，通常是 `origin/main`。每个 worktree 再选自己的 start-from：base、本地分支、某个 SHA，或已有远程分支。每个 worktree 有自己的分支、磁盘目录和 agent 终端。

生命周期也按任务走：

1. 创建：填任务名，选起点，可选挂上 GitHub / Linear / Jira / GitLab 链接。
2. 干活：agent 终端、编辑器、浏览器、普通终端都绑在这个 worktree 上。
3. 评审：对着 start-from 看 diff，可以在行上批注再丢回给智能体。
4. 发出去：提交、push、开 PR、等检查，都在应用里完成。
5. 归档或删除：确认后删掉目录和分支。

创建是后台进行的。对话框提交后立刻关掉，`git fetch` 和 `git worktree add` 继续跑。侧边栏会出现进度条，你可以先去别的 worktree。失败了能重试。

新 worktree 默认是干净 checkout。`node_modules`、缓存、`.env` 这类 gitignore 文件不会自动出现。Orca 用三套机制补：

- 仓库设置里的 Worktree Shared Paths，从主 checkout 物化过来。macOS 上能走 APFS clone-copy，否则用符号链接。
- `orca.yaml` 里的 `worktree.sharedDirectories`，适合 `node_modules`、`.cache` 这种可重建的大目录，共享而不是复制。
- 仓库根目录的 `.worktreeinclude`，把 `.env` 这类文件复制进每个 worktree，各自一份。

这些 worktree 就是普通 git worktree。你在终端里 `git rebase` 或 `git cherry-pick`，Orca 下一次刷新会跟上。自己用 `git worktree add` 建出来的，默认先藏着，可以在 Non-Orca worktrees 里选「显示」。

## 并行跑，然后挑一个留下

README 里最显眼的能力是：把同一条提示发给五个智能体，各自隔离 worktree，比完再合赢的那份。文档里也有对应食谱，比如三个 agent 赛同一件事。

它宣称支持任何能在终端里跑的 CLI 智能体。名单很长，Claude Code、Codex、Grok、Cursor CLI、GitHub Copilot、OpenCode、Pi、Kimi、Qwen Code 都在上面，末尾还写了「+ any CLI agent」。这更像兼容层，不是官方认证清单。能不能用，取决于那个 CLI 自己能不能在你的机器上跑起来。

桌面端还带账号切换和用量追踪，至少覆盖 Claude 和 Codex：看用量、看限额重置时间，切账号不必重新登录。

## 桌面里还塞了什么

如果只是 worktree 管理器，它不会涨到这个体量。仓库 README 还列了这些：

**手机 Companion。** 桌面配对后，agent 跑完会推通知，你可以在外面补一句后续指令。iOS 上架 App Store，也有 TestFlight；Android 目前是 APK，英文 README 写到 0.0.50，中文 README 还停在 0.0.48，以 GitHub Release 为准更稳。

**终端分屏。** 自称 Ghostty 级，WebGL 渲染，无限分屏，滚动历史能熬过重启。

**设计模式。** 内嵌真实 Chromium。点页面上的某个元素，HTML、CSS 和裁好的截图直接进 agent 提示。修 UI 时比口头描述「那个按钮偏右一点」靠谱。

**GitHub 和 Linear 原生界面。** 应用里看 PR、issue、看板，从任务直接开 worktree。文档里还有 Jira 抽屉，创建 worktree 时也能贴 Jira 链接。

**SSH worktree。** agent 可以跑在远程大机器上，文件编辑、git、终端都走过去，带自动重连和端口转发。无头 Linux 服务器另有 `orca serve` 指南。

**给 AI diff 写批注。** 某一行不行，评论丢回给智能体，评审、改、提交不用切出去。

**编辑器。** 用的是 VS Code 那套编辑器，自动保存。文件和图片可以拖进提示。Markdown、图片、PDF 能在工作区预览。

**Orca CLI。** `orca worktree create`、`snapshot`、`click`、`fill` 这类命令让智能体反过来驱动 Orca。还有 Computer Use：需要真的点桌面应用时，走无障碍树、截图和受限制的 UI 操作。

快速打开可以搜 worktree、文件、智能体、命令和仓库上下文。通知系统会标出谁跑完了、谁卡住了，也可以标未读稍后再看。README 自己承认功能列表永远落后，真正的清单在 [Releases](https://github.com/stablyai/orca/releases)，他们说每天都发。

## 安装

桌面支持 macOS、Windows、Linux。

- 官网：[onorca.dev/download](https://onorca.dev/download)
- GitHub Release 直链：Apple Silicon dmg、Intel dmg、Windows exe、Linux AppImage
- Homebrew：`brew install --cask stablyai/orca/orca`
- Arch：AUR 上的 `stably-orca-bin`，源码包是 `stably-orca-git`

Windows 代码签名由 SignPath.io 赞助，证书来自 SignPath Foundation。

手机端需要先有桌面。iOS：[App Store](https://apps.apple.com/us/app/orca-ide/id6766130217)。Android APK 在 Releases 里，安装步骤见 [Android 文档](https://www.onorca.dev/docs/android-apk)。

配对手机用的 relay 也在同一个仓库的 `cloud/` 目录，单独一套 pnpm workspace。

## 和普通 AI IDE 差在哪

Cursor、Windsurf 这类产品把模型和编辑器绑在一起卖。Orca 反向：模型你自己订，应用负责编排。GitHub 简介写的就是「Run any coding agent with your own subscription」。

Claude Code 或 Codex 单独用，已经能改代码。缺的是同时跑多个、文件不打架、结果能并排看、远程机器和手机能接着管。Orca 押的是这个调度层。

它仍然是本地优先的桌面应用，不是云端把代码交出去代跑的服务。远程能力走 SSH 或自建 Orca Server。遥测文档说收集匿名使用数据，可以关掉。

## 使用时要注意

并行有成本。五个 worktree 就是五份磁盘，再加依赖目录。共享 `node_modules` 能省空间，也可能让两个 agent 同时改构建缓存时互相干扰。`.env` 这类文件官方建议复制，不要共享。

删除 worktree 会连分支一起删。如果 git 认为还有未合并提交，Orca 会留下分支并提示你复查，文件夹不会自动恢复。

Issue 数量不少。仓库公开 issue 有六千多，fork 大约五千。日更产品常见：功能来得快，边角会毛。合不合适，看你是不是真的在并行用多个 CLI agent。如果你一次只开一个 Claude Code，Orca 多半显得重。

中文社区有微信群。README 写的是第 9 群，二维码在仓库文档资源里。英文社区在 [Discord](https://discord.gg/fzjDKHxv8Q)，更新在 [@orca_build](https://x.com/orca_build)。

## 结论

Orca 是一个开源桌面 ADE。它把「多个 CLI 编码智能体 + 每个任务一份 git worktree」当成默认工作方式，再补上终端、内嵌浏览器、评审、SSH 和手机监控。

值不值得装，取决于你有没有这种痛：同一个改动想让几个 agent 各写一版，或者一边修 bug 一边开新功能，还不想在同一份工作树上互相覆盖。有的话，从 [GitHub 仓库](https://github.com/stablyai/orca) 或 [下载页](https://onorca.dev/download) 装一份就够判断。没有的话，它就是个功能很多的终端管理器，不必为了名单上的几十个 agent logo 专门换工具。
