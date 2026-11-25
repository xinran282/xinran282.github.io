---
title: claude-mem：让 Claude Code 找回跨会话的项目记忆
date: 2026-11-05 11:28:50
categories:
  - AI 工程
tags:
  - Claude Code
  - claude-mem
  - 上下文工程
  - 持久记忆
  - MCP
description: 从记录、摘要到按需检索，理解 claude-mem 如何延续项目上下文，以及使用时的成本、隐私和准确性边界。
---

# claude-mem：让 Claude Code 找回跨会话的项目记忆

换一个 Claude Code 会话，往往又得解释一遍项目背景：昨天为什么放弃某个方案，哪个测试暴露了边界问题，下一步准备改哪里。代码保留下来了，做决定的过程却散落在旧对话里。

[claude-mem](https://github.com/thedotmack/claude-mem) 为这类问题提供了一套持久记忆机制。它通过工具使用记录提取观察、生成会话摘要，再把相关历史提供给后续会话。对于需要反复进入同一个代码库的开发工作，这能减少重新交代背景和重复调查的次数。

它的效果取决于记录是否准确、检索是否命中，以及旧结论是否仍然适用。下面按这几个环节理解这个项目。

## 为什么代码还在，背景却需要重讲

假设你昨天排查登录失败，发现问题来自旧版客户端的 token 刷新逻辑。你试过两种修改，最后为了兼容旧客户端，保留了现有接口，只调整服务端判断。

今天打开新会话，模型可以重新读代码，但仅靠当前文件，很难知道昨天为什么这样取舍。它可能再次提出那个已经被否决的接口改造方案。

这里有两类信息值得分别保存：长期稳定的项目约定，以及开发中逐渐积累的调查结果。前者适合写进 `CLAUDE.md`、项目文档或架构决策记录；后者包括修复经过、失败尝试和临时发现，逐条手工整理的成本更高。claude-mem 主要帮助收集和找回后一类信息。

因此，是否值得使用它，可以从一个很具体的问题判断：你是不是经常需要向新的会话复述同一段调查经过？

## 一段开发经历怎样变成可检索的记忆

根据项目的[架构文档](https://github.com/thedotmack/claude-mem/blob/d8bf121ae98063e5e3158befff33a9d635c0246b/docs/public/architecture/overview.mdx)，Claude Code 集成依赖生命周期 hooks、本地 worker 和数据库。主要流程可以概括为：

```text
工具执行记录 → worker 调用模型提取观察 → 保存观察和会话摘要
                                             ↓
新会话加载历史上下文 ← 按需检索相关记录 ← 记忆数据库
```

在工具调用后，hook 将执行信息交给 worker 处理。模型从中提取结构化的观察；会话停止时，还会生成摘要。后续会话启动时，插件再提供历史上下文，模型也可以搜索更具体的记录。

这里的“观察”是对一次发现、修改或决策的提炼。例如，“为兼容旧客户端，保留刷新接口的返回格式”，就比整段调试输出更适合日后检索。不过，提炼本身会丢失细节，也可能出现理解偏差。

各组件的分工并不复杂：

| 组件 | 作用 |
| --- | --- |
| 生命周期 hooks | 在会话开始、工具调用后和停止等时机触发记录或召回 |
| 本地 worker | 处理观察、调用摘要模型，并提供检索 API 和查看界面 |
| SQLite 与 FTS5 | 保存会话、观察和摘要，提供全文检索 |
| 可选的 Chroma | 为语义检索提供向量索引 |
| mem-search 技能或 MCP 工具 | 让智能体按需查询已有记忆 |

默认数据目录为 `~/.claude-mem/`，数据库通常位于其中的 `claude-mem.db`。官方架构文档将 Chroma 标为可选，因此不能把向量数据库当作所有安装方式的必备条件。

## 先看索引，再取详情

历史记录积累得越多，越需要控制每次读入的内容。把所有旧会话塞回上下文，会占用当前任务的空间，也会带入无关信息。

claude-mem 的[渐进披露设计](https://github.com/thedotmack/claude-mem/blob/d8bf121ae98063e5e3158befff33a9d635c0246b/docs/public/progressive-disclosure.mdx)强调先展示有哪些记忆、读取它们大约需要多少 token，再按需要加载详情。README 给出的搜索流程是：

1. 用 `search` 获取紧凑的结果索引，先看标题、ID 等线索。
2. 用 `timeline` 查看某条记录前后发生了什么，补上时间背景。
3. 用 `get_observations` 批量获取筛选后记录的完整内容。

继续用登录问题举例。新会话可以先搜索“token 刷新、旧客户端兼容”，确认相关记录后，再读取当时的决策和修复经过。如果需要验证行为，仍要打开当前代码或运行测试。

这个流程的价值在于控制读取范围。项目 README 宣称，先筛选再取详情可以节省约十倍 token；这是项目方给出的量级描述，不能直接当作所有代码库的实测结果。实际收益会受到记录规模、命中率和读取习惯影响。

## 记忆怎样与项目文档配合

开发记录和正式约定的更新节奏不同，适合放在不同位置。

| 信息 | 更适合的载体 |
| --- | --- |
| 项目命令、代码规范、长期约束 | `CLAUDE.md` 或项目文档 |
| 正式架构决策及其适用条件 | ADR、设计文档 |
| 调试经过、已尝试方案、会话进展 | claude-mem 等工作记忆系统 |
| 当前实现和实际行为 | 代码、配置、测试结果 |

例如，记忆里可能保存着“为了兼容旧客户端，保留旧接口”。几周后旧客户端下线，这条历史仍然真实，但它对新修改的约束已经变了。

比较稳妥的用法是让记忆带路：先找出当时的理由，再检查当前条件。反复出现、已经确认需要长期遵守的结论，应当补进正式文档。这样后续会话既能查到过程，也有明确的项目约定可依。

## 本地保存、模型调用和云同步要分别看

claude-mem 会在本地保存数据，也可以调用模型生成观察和摘要。**数据库在本机，并不意味着参与处理的内容全程留在本机。**

判断数据会去哪里，需要分别看几条路径：

- 本地数据库保存了哪些提示、观察和摘要。
- 负责提取观察的模型由谁提供，调用时发送了什么内容。
- 是否开启 Cloud Sync，以及是否使用托管记忆或团队服务。
- 是否启用了截图保存、图片推理等额外功能。

当前 README 提供 `<private>...</private>` 标签，用于排除敏感内容的存储。这是 claude-mem 的过滤机制，不能据此推断其他工具、模型服务或日志系统也会排除同一段内容。

截图功能默认关闭。README 还区分了截图的本地保存、开启云同步后的上传，以及单独开启的图片推理，三者需要分别检查。官方配置文档说明，Cloud Sync 会上传观察正文和完整提示文本；不能因为某个云端页面只显示标题，就认为只有标题离开了机器。

开源许可也有相应边界：当前仓库标注 Apache-2.0，[IP 边界文档](https://github.com/thedotmack/claude-mem/blob/d8bf121ae98063e5e3158befff33a9d635c0246b/docs/ip-boundary.md)另列出托管云、团队与企业功能等商业或私有区域。评估时应分别确认核心代码许可和所选服务的条款。

## 安装前，先选观察模型的提供方

当前 README 的通用安装入口是：

```bash
npx claude-mem install
```

交互式安装包含账号和记忆提供方的选择，并介绍了托管 observer 的试用。安装时应留意所选 provider、试用结束后的处理方式，以及费用由哪个账号承担。

如果希望使用自己的 Anthropic 方案，官方安装文档给出了明确参数：

```bash
npx claude-mem install --provider claude
```

该参数可以跳过登录步骤，记忆处理会使用你的 Anthropic 方案额度。它仍涉及模型调用，不能据此称为完全离线运行。

也可以在 Claude Code 内通过插件市场安装：

```text
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem
```

安装后重启 Claude Code。官方文档提醒，只运行 `npm install -g claude-mem` 得到的是 SDK／库，不会完成插件 hooks 和 worker 的配置。

环境要求应以所装版本为准。本次核对的 `package.json` 将 Node.js 要求写为 `^20.19.0 || >=22.12.0`，比 README 的“20+”更具体；安装文档还要求 Claude Code 2.1.139 或更高版本，以支持当前 hooks 的命令参数形式。

Windows 的日常生命周期 hooks 直接调用 launcher，无需 Git Bash。安装后应重启终端或 IDE，让新的用户 Path 生效；若捕获没有工作，可以运行 `npx claude-mem doctor` 检查。

需要中文观察和摘要时，可在 `~/.claude-mem/settings.json` 中合并以下设置，再按文档重启 Claude Code：

```json
{
  "CLAUDE_MEM_MODE": "code--zh"
}
```

查看记录时，使用 worker 启动时打印的地址，记忆与设置界面位于 `/viewer`。端口可以配置，不宜照搬旧教程中的固定地址。

## 用一次真实的跨会话任务评估

claude-mem 更适合长期维护、反复调试的项目。短暂的一次性任务未必需要额外的记录和摘要流程；如果项目约定已经整理得很清楚，也可以先观察现有文档是否够用。

试用时可以做一个小验证：完成一次真实修复，确认查看界面记录了发现和决策；再开新会话，询问“上次为什么采用这个方案”，检查它是否找到了正确历史，以及是否保留了当时的适用条件。这个测试能观察召回质量，不能代表长期效果。

同时看看摘要生成消耗了多少额度，以及被召回的内容是否帮助了当前任务。节省检索时的 token 与生成记忆的成本，需要放在一起算。

如果新会话能准确找回上次排查的理由，你便少了一轮重复调查。若它把过时结论当成现行约定，就需要调整记录或检索方式。最值得保留的使用习惯是：让记忆帮你定位过去的证据，再用当前代码和测试判断下一步。

## 资料来源

本文核对日期为 2026 年 11 月 5 日，依据仓库提交 `d8bf121ae98063e5e3158befff33a9d635c0246b`；该提交的包版本为 `15.9.0`。本文是基于官方资料的机制解读，未对插件进行安装实测。

- [项目 README](https://github.com/thedotmack/claude-mem/blob/d8bf121ae98063e5e3158befff33a9d635c0246b/README.md)
- [架构概览](https://github.com/thedotmack/claude-mem/blob/d8bf121ae98063e5e3158befff33a9d635c0246b/docs/public/architecture/overview.mdx)
- [渐进披露设计](https://github.com/thedotmack/claude-mem/blob/d8bf121ae98063e5e3158befff33a9d635c0246b/docs/public/progressive-disclosure.mdx)
- [安装说明](https://github.com/thedotmack/claude-mem/blob/d8bf121ae98063e5e3158befff33a9d635c0246b/docs/public/installation.mdx)
- [配置说明](https://github.com/thedotmack/claude-mem/blob/d8bf121ae98063e5e3158befff33a9d635c0246b/docs/public/configuration.mdx)
- [运行时要求与包版本](https://github.com/thedotmack/claude-mem/blob/d8bf121ae98063e5e3158befff33a9d635c0246b/package.json)
