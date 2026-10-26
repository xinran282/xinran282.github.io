---
title: Claude Code、Codex 与 OMP 的 Memory 机制对比
date: 2026-10-15 15:04:20
categories:
  - AI 工程
tags:
  - Claude Code
  - Codex
  - Oh My Pi
  - Agent Memory
---

用编码助手做长期项目，最容易产生的疑问是：昨天已经纠正过的事，为什么今天还要说一遍？

Claude Code、Codex 和 OMP 都有跨会话记忆，但写入和读回的方式不同。Claude Code 主要让模型在工作过程中维护 Markdown 笔记；Codex 从符合条件的历史会话中后台提炼记忆；OMP 则允许选择不同后端，既能做会话摘要，也能使用带检索工具的记忆库。

这会直接影响使用感受：Claude 的笔记容易查看和修改，Codex 的记忆可能延迟生成，OMP 的能力和维护成本则取决于启用的后端。**比较之前，要先区分项目规则、长期记忆和上下文压缩。**

本文的 Claude 指 Claude Code，OMP 指 [Oh My Pi](https://github.com/can1357/oh-my-pi)。资料核对日期为 2026 年 10 月 15 日；Claude 与 Codex 依据官方文档，OMP 的实现细节依据文末固定提交的项目文档。OMP 主分支文档描述的功能，不保证已包含在每个已安装版本中。

## 一、哪些东西算 Memory

编码助手使用的上下文至少有四类，解决的问题各不相同。

| 类型 | 回答的问题 | 典型载体 |
| --- | --- | --- |
| 项目指令 | 每次进入项目都应遵守什么？ | CLAUDE.md、AGENTS.md、路径规则 |
| 当前会话状态 | 这次任务做到哪一步？ | 对话、工具结果、任务计划 |
| 上下文压缩 | 对话太长后，怎样继续当前任务？ | 压缩摘要、保留的近期消息 |
| 跨会话记忆 | 下次开新任务，哪些经验值得带过去？ | 笔记、提炼后的摘要、可检索记忆库 |

比如，“提交前运行哪个测试命令”适合放进项目指令；“客户刚确认下周才能切换接口”适合成为有时效的项目记忆；“这次已经改了哪些文件”主要属于会话状态。

压缩后的摘要可以帮助当前任务继续，却不等于新会话一定会读到它。保存完整聊天记录，也不等于系统已经把有用信息提炼出来。Prompt cache 缓存的是可复用的输入计算，同样不能代替跨会话记忆。

下面主要比较最后一类，同时说明它与项目指令如何配合。

## 二、先看差异最大的几个维度

| 维度 | Claude Code Auto memory | Codex 本地 Memories | OMP |
| --- | --- | --- | --- |
| 默认状态 | 本地会话默认开启，部分运行环境例外 | 官方文档说明默认关闭 | 默认 `memory.backend: off` |
| 主要写入方式 | 模型在会话中读写笔记 | 从符合条件的历史会话后台生成 | local 做后台提炼；其他后端可自动保留或显式写入 |
| 主要存储 | MEMORY.md 索引与专题 Markdown | Codex home 下的生成文件与支撑材料 | 取决于后端：文件、本地 SQLite 或服务端 bank |
| 新会话如何使用 | 启动载入索引，详情按需读取 | 将既有记忆注入后续会话 | local 注入摘要；Mnemopi、Hindsight 首轮召回 |
| 常见边界 | 默认按 Git 仓库，本机 worktree 共享 | 独立的本地 host 记忆库 | 作用域随后端和配置变化 |
| 修改方式 | 可直接编辑、删除 Markdown | 以 `/memories` 和设置为主，文件视作生成状态 | `/memory` 加后端工具，删除语义也随后端变化 |

不能据此简单排出“谁记性最好”。表格描述的是机制；召回是否准确、有没有记住错误经验，还需要在具体项目里验证。

## 三、Claude Code：模型维护索引和笔记

Claude Code 的持久上下文分成两部分。[官方 memory 文档](https://code.claude.com/docs/en/memory)把它们称为指令文件和 Auto memory。

`CLAUDE.md` 是你或团队维护的规则，可以写构建命令、工作流程和项目约定。Auto memory 则由 Claude 根据工作中的纠正、偏好和项目情况维护。两者都以文本进入上下文，实际的权限限制仍由权限设置或 hooks 等机制负责。

### 写入发生在工作过程中

当前文档把自动记忆分成 `user`、`feedback`、`project` 和 `reference` 四类，分别记录用户情况、纠正反馈、无法从代码推导的项目背景，以及外部信息入口。

例如，你明确纠正：“接口迁移还没获批，这周先保持兼容。”这类信息可能对下一次任务有用，又无法从源码直接读出，适合成为项目记忆。Claude 自行判断是否值得保存，并非每次对话都会写笔记。

文档也要求避免重复保存代码库已经能说明的事实，或 CLAUDE.md 已经写明的内容。这能减少笔记与代码长期分叉的机会。

### 启动先加载索引，再按需读详情

默认目录类似这样：

```text
~/.claude/projects/<project>/memory/
├── MEMORY.md
├── user_role.md
└── feedback_testing.md
```

`MEMORY.md` 是索引。每次会话启动时，系统加载其前 200 行或前 25KB，以先达到的上限为准；专题文件不会全部自动塞进上下文，Claude 需要时再用文件工具读取。

因此，“磁盘上已经保存”与“本轮已经读到”之间仍有距离。索引太长，超出部分在下次启动时会被截掉；索引写得不清楚，模型也可能没去打开真正有用的专题文件。

默认情况下，同一个 Git 仓库的 worktree 和子目录共享自动记忆目录。笔记保存在本机，不会因为仓库同步就自动出现在另一台电脑上。可用 `/memory` 管理，也可以直接编辑和删除 Markdown。

这一设计适合希望随时查看“它到底记了什么”的人。维护时要留意索引是否简洁，以及项目事实是否已经过期。

## 四、Codex：从历史会话中后台提炼

把 Codex 的 memory 等同于 `AGENTS.md`，会漏掉它的本地 Memories 功能。[官方文档](https://learn.chatgpt.com/docs/customization/memories)明确区分了本地 Codex 记忆与 ChatGPT 网页端的记忆，两者使用不同的存储和控制方式。

### AGENTS.md 负责稳定规则

Codex 启动时会发现全局和项目级指令。项目范围内，从项目根目录到当前工作目录逐层寻找 `AGENTS.override.md`、`AGENTS.md` 及配置的备用文件名，再组合成指令上下文。具体优先顺序见 [AGENTS.md 官方指南](https://developers.openai.com/codex/guides/agents-md/)。

必须长期遵守的团队要求应放在这里，或写进仓库文档。自动记忆适合补充工作经验。

### Memories 不一定在聊天结束后立刻生成

开启本地 Memories 后，Codex 会从符合条件的历史会话中提炼有用信息，在后台更新。活跃会话、短暂会话等可能被跳过；系统会等待会话闲置，也可能因剩余额度低于阈值而跳过一次生成。

这解释了一个容易误判的现象：刚结束任务就开新任务，发现它没有记住，不一定是检索出错，也可能是记忆还没有生成。

配置参考分别提供 `memories.extract_model` 和 `memories.consolidation_model`，对应单会话提取与全局整合。`generate_memories` 控制新会话能否成为生成输入，`use_memories` 控制后续会话是否使用已有记忆。两者可以分别关闭。

这里的“全局整合”不能直接理解成“所有项目的每段记忆都会注入每次会话”。官方说明没有承诺这种行为，也不应据此推断每次召回都使用向量数据库。

### 文件可检查，控制以设置为主

主要记忆文件位于 `~/.codex/memories/`，或自定义 `CODEX_HOME` 对应的位置，包括摘要、持久条目和历史证据。官方将其视作生成状态：可以检查，但不建议依靠手工改文件作为主要控制方式。

本地 Memories 默认关闭，可通过设置或配置启用：

```toml
[features]
memories = true
```

交互会话中的 `/memories` 可以分别控制当前任务是否使用既有记忆、是否贡献未来记忆。IDE 扩展使用所连接 Codex host 的本地记忆库；不能把它理解成所有设备自动共享同一份记忆。

对使用者而言，Codex 的特点是把提炼工作放到后台。排查“为什么没记住”时，应先检查功能是否开启、任务是否允许贡献记忆，以及后台生成是否已满足条件。

## 五、OMP：先选后端，再谈机制

OMP 的 [Autonomous Memory 文档](https://github.com/can1357/oh-my-pi/blob/c2cb79e4c227aa4b22c4ccb933ff72fd88bceba4/docs/memory.md)列出 `off`、`local`、`hindsight`、`mnemopi`、`sharpshooter` 五种模式。因此，“OMP 使用 SQLite 记忆”只描述了其中一种选择。

| 后端 | 主要机制 | 需要关注的边界 |
| --- | --- | --- |
| local | 从持久会话提取，再整合成文件与摘要 | 没有结构化 `recall`、`retain` 等工具 |
| Hindsight | 通过服务端 bank 保存、召回和综合记忆 | 要配置服务、作用域与服务端数据管理 |
| Mnemopi | 本地 SQLite，支持检索和按 ID 管理记忆 | 本地存储不代表模型调用也一定在本机 |
| sharpshooter | 按摩擦信号触发的项目决策文件，后台整合 | 文档将其概括为架构、产品和风格决策；本文不展开其未核实细节 |

### local：两阶段生成摘要，也能积累经验条目

启用方式是：

```yaml
memory:
  backend: local
```

local 的后台流程在启动时处理符合条件的历史会话。第一阶段逐会话提取决策、约束、已解决的问题和重复流程，第二阶段整合为 `MEMORY.md`、`memory_summary.md` 和 `skills/` 下的操作指南。

下一次会话会把简短摘要注入系统提示。启用 `autolearn.enabled` 后，还可用 `learn` 把明确经验保存到独立的 `learned.md`，从后续会话开始使用。整合过程不会覆盖这份文件。

这和 Codex 都有“历史会话提取，再整合”的结构，但不能据此认定内部实现、筛选条件和效果相同。OMP local 还明确把生成操作指南作为输出之一。

### Mnemopi：带自动召回的本地记忆库

[Mnemopi 后端](https://github.com/can1357/oh-my-pi/blob/c2cb79e4c227aa4b22c4ccb933ff72fd88bceba4/docs/mnemosyne-memory-backend.md)在首个模型回合召回相关记忆，自动保留已完成的对话轮次，也提供 `retain`、`recall`、`reflect` 和 `memory_edit`。

`recall` 返回的是带 ID 的预览；修改前需要读取完整条目，避免用截断预览覆盖全文。检索可以使用全文路径，也能配置 embedding；多路融合检索、主动关联等是额外开关，不能一概算作默认行为。

它的作用域尤其值得单独核对：默认 `per-project` 的 bank 根据当前工作目录的名称和绝对路径哈希生成。换到另一个 worktree，路径不同，就不能照搬 Claude Code 的“同仓库共享”预期。`global` 和 `per-project-tagged` 则提供不同的共享方式。

“本地 SQLite”只说明数据存储位置。配置远程 embedding 或在线记忆模型后，相关处理仍可能访问服务端。

### Hindsight：召回与保留交给服务端 bank

Hindsight 后端连接一个可访问的服务，服务也可以部署在本机。它支持首轮自动召回、按轮次保留，以及 `retain`、`recall`、`reflect`。默认使用带项目标签的共享 bank 方案；配置为 `per-project` 时，项目识别会归一到仓库的主 checkout，使关联 worktree 共享项目身份。

这与 Mnemopi 默认按当前目录路径划分的方式不同。即使都叫“按项目”，也要看项目身份是怎样算出来的。

删除操作也有差别。Hindsight 的 `/memory clear` 清理本地会话状态和召回缓存，不删除服务端 bank；Mnemopi 的同名命令会删除当前配置作用域内的数据库。不能只凭命令名称判断数据是否已清空。

## 六、同一句纠正，三种记忆路径

假设你说：“这个项目暂时只能用 Node 22，升级要等客户确认。”

在 Claude Code 中，Claude 可以在当前会话写下一条项目笔记，加入 MEMORY.md 索引。新会话先看到索引，有需要再打开详情。

在 Codex 中，这句话可能在该会话满足后台处理条件后被提炼。立即打开新任务，不保证已经可用；如果它是每次构建都必须遵守的约束，应该同时写入 AGENTS.md 或仓库文档。

在 OMP local 中，它可能经过会话提取与整合后进入摘要，也可以在启用相应功能后用 `learn` 明确记录。使用 Mnemopi 或 Hindsight 时，则可以显式 `retain`，以后通过相关性召回读回。

等客户同意升级，这条记忆就过期了。合适的记录应带上原因和失效条件，例如“升级等待客户确认；获批后重新检查”。只写“永远使用 Node 22”，会把临时限制变成长期错误。

这也是本文的使用建议：对会影响行动的记忆，重新核对当前仓库和最新用户要求。记忆保留了过去的经验，过去未必仍然适用。

## 七、怎样选，怎样维护

希望查看和修改笔记，尤其常在同一仓库多个 worktree 间工作的，可以重点看 Claude Code 的文件式自动记忆。索引规模和过期条目是维护重点。

已经使用 Codex，希望从长期任务中自动积累经验，可以开启本地 Memories，同时保留简洁的 AGENTS.md。遇到遗忘时，先检查生成条件和任务级开关。

需要选择记忆后端、控制 bank 作用域，或希望通过工具更新、失效和召回具体条目，可以考虑 OMP。先决定使用摘要文件还是可检索记忆库，再核对所选后端的共享和清理语义。没有共享需求时，可以从 local 或隔离作用域开始。

无论使用哪一款，团队必须遵守的要求应留在版本管理中的指令或文档里；自动记忆负责补充经验。判断它是否可靠，最好拿真实任务试一次：记录一条纠正，开启新会话检查能否读回，再修改事实，观察旧记忆能否被及时更新。

## 资料来源

- [Claude Code：How Claude remembers your project](https://code.claude.com/docs/en/memory)，用于核对指令文件、自动记忆、加载上限、作用域与管理方式。
- [OpenAI：Memories](https://learn.chatgpt.com/docs/customization/memories)，用于核对本地 Codex 记忆的生成、存储、开关及与 ChatGPT 网页端的区别。
- [OpenAI：Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md/)，用于核对 Codex 项目指令发现机制。
- [OpenAI：Configuration reference](https://developers.openai.com/codex/config-reference/)，用于核对 `features.memories`、提取、整合和生成控制参数。
- [OMP：Autonomous Memory](https://github.com/can1357/oh-my-pi/blob/c2cb79e4c227aa4b22c4ccb933ff72fd88bceba4/docs/memory.md)，用于核对后端、local 流程和 Hindsight 行为。
- [OMP：Mnemopi memory backend](https://github.com/can1357/oh-my-pi/blob/c2cb79e4c227aa4b22c4ccb933ff72fd88bceba4/docs/mnemosyne-memory-backend.md)，用于核对 SQLite 后端、召回、作用域和清理语义。

本文比较公开文档描述的机制，没有对三款工具进行同任务召回率或长期准确率测试。
