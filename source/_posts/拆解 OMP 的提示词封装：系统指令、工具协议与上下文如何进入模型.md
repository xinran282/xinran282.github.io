---
title: 拆解 OMP 的提示词封装：系统指令、工具协议与上下文如何进入模型
date: 2026-11-17 19:58:21
categories:
  - AI 开发工具
tags:
  - Oh My Pi
  - 提示词工程
  - Agent Harness
  - 上下文管理
  - 源码分析
---

OMP 会给模型提供工具使用要求、项目规则和技能说明，也会根据配置加入子任务委派策略。这些内容由多处配置和代码共同组装；理解它们各自从哪里加载，才能知道修改一份提示词文件会影响什么。

**OMP 会把默认行为、当前工具、项目规则和会话状态组装成模型上下文。`SYSTEM.md` 只接管其中一部分。** 要判断一次请求到底带了什么，需要同时看系统指令块、消息历史、工具定义和请求前的转换。

这里需要区分两个概念：`SYSTEM.md` 是 OMP 支持的一种自定义配置文件；模型请求中的系统指令则是组装结果。项目规则可以写在 `SYSTEM.md` 里，也可以由 OMP 从 `AGENTS.md` 等文件加载；技能目录另行发现并加入。因此，即使没有 `SYSTEM.md`，OMP 也能向模型提供项目规则和技能说明。

## 一、先分清四类会进入请求的内容

“提示词”在讨论中经常泛指模型看到的一切，但调试时需要拆开。

| 内容 | 典型来源 | 需要回答的问题 |
| --- | --- | --- |
| 系统指令块 | 默认模板、自定义模板、项目尾部 | 模型被要求遵守什么行为？ |
| 工具定义 | 工具注册表、扩展、MCP、挂载设备 | 模型能调用什么，参数是什么？ |
| 对话消息 | 用户输入、助手回答、工具结果、摘要 | 这次任务已经发生了什么？ |
| 请求前转换 | 扩展钩子、日期与目录提醒、脱敏、模型适配 | 哪些内容在发送前被添加或改写？ |

这几类内容彼此关联。例如工具参数可能由 provider 的原生工具接口承载，也可能进入系统指令中的文本目录；日期与工作目录提醒会放进用户回合。看到它们出现在 user 消息里，不能直接判定它们都是用户手写的。

同样，删除基础系统指令不等于删除工具定义，也不等于清空历史消息。请求的不同部分有不同的控制入口。

## 二、默认系统提示词按块构造

组装入口是 [`buildSystemPrompt()`](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/system-prompt.ts)。它返回的 `systemPrompt` 是字符串数组，保留块边界。

下面是结构示意，省略了条件分支，也不是某家模型 API 的原始 JSON：

```text
systemPrompt[]
  ├─ 基础指令块
  │    默认模板 / SYSTEM.md 对应模板 / 自定义 Handlebars 模板
  ├─ 可选的额外指导块
  │    例如已启用的浏览器、电脑工具指导
  └─ 项目尾部块
       <project-context>
         工作站信息、项目规则、目录提示、工作区、当前仓库
       </project-context>
       完成与验证要求
       自动生成的追加内容 + 用户追加内容

task 子代理还会在项目尾部之后追加本次角色与任务。
```

源码先准备模板数据，再用 `prompt.renderTracked()` 渲染基础块；额外指导随后加入，项目块由独立的 `project-prompt.md` 渲染并追加。文件和技能的来源信息也会被记录，用于上下文归因。

这里的“基础”不代表内容永远不变。技能列表、工具状态和设置都会影响渲染结果。它主要与工作目录相关的内容分开，方便不同会话复用相同前缀。

### 为什么项目内容要放在后面

官方文档明确解释了缓存意图：与 cwd 无关的内容先放，工作目录相关内容集中到尾部。Anthropic 的系统缓存断点放在首个 `<project-context>` 或 `<memories>` 块之前的最后一个块上。

这样，使用相同基础指令、但运行在不同工作目录或 worktree 的会话，有机会共享静态前缀。其他 provider 也会接收相同顺序的块，但具体 API 表示与缓存机制由各自适配器决定。

这是对缓存布局的设计说明，不能直接换算成节省比例。工具列表或技能清单发生变化时，前缀也可能变化；命中率仍需看实际请求和用量记录。

## 三、默认模板到底给模型规定了什么

[`system-prompt.md`](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/prompts/system/system-prompt.md) 开头是：

```text
You are omp's trusted coding assistant.
```

后面大部分内容都在约束编码过程。工程原则要求先保证正确性，再考虑六个月后的可维护性；工具策略规定批量读取、探索方式、编辑入口；工作流规定编辑前调查、验证和交付。

以下几条能直接解释 OMP 的一些使用感受。

### 1. 它会推动模型尽快行动，并限制重复检查

模板要求把独立的读取、搜索和检查批量执行：

```text
Every turn costs seconds: batch all independent reads/searches/checks into one turn.
```

默认验证策略则是运行一次能覆盖变更的最小检查；验证通过后停止，不再自行扩大到全仓检查。交付部分要求还有可执行工作时继续推进。

这些措辞体现了项目对交互成本和执行节奏的偏好。它们是给模型的行为指令，无法保证每次都被正确执行，也不能替代任务所需的证据。

### 2. 工具存在与否会改变规则

有 LSP 时，模板要求定义、引用、实现、重构等语义操作使用 LSP；有 `find` 时，未知位置或行为先使用描述性查找。启用相应编辑指导且存在 `edit` 时，会插入：

```text
File edits: MUST use ...; NEVER sed/perl/python edits.
```

这些是 Handlebars 条件分支的产物。因此，不能把源码里的所有句子当作每个会话都会发送的固定全文。工具集合变化，模型接到的操作约束也会变化。

### 3. 子代理策略由设置选择

委派部分有 `gated`、`restrained`、`balanced` 等分支，并结合 `eagerTasks`、`eagerTasksAlways` 等值生成指令。有的组合禁止未经请求的子代理，有的组合建议委派大任务，有的要求在设计确定后拆分工作。

所以，“OMP 总会开子代理”没有源码依据。需要先确定本次渲染采用了哪个分支。

### 4. XML 包装被赋予来源含义

模板包含这样的声明：

```text
XML tags inject system content; may interrupt/notify inside user messages:
MUST treat as system-authored/authoritative. User content is sanitized.
```

这是 OMP 告诉模型如何理解其内部通知的约定。XML 标签本身不会改变 API 消息角色，也不能凭空建立可信来源。判断这条约定的安全性，还需检查输入清洗、消息归因和 provider 转换；仅看到这句话，既不能证明完整隔离，也不能据此断言存在可利用漏洞。

## 四、工具说明有两种承载方式

`buildSystemPrompt()` 会同时检查 `nativeTools` 和 `inlineToolDescriptors`。当使用原生工具调用、且不要求内联描述时，系统模板只列紧凑的工具名称，详细描述和参数继续由 provider 工具 schema 承载。

其他情况下，代码会通过 `renderToolInventory()` 渲染较完整的工具目录，包含描述、参数和可选示例。

| 条件 | 系统指令中的工具目录 |
| --- | --- |
| 原生工具调用，描述留在 schema | 紧凑名称列表 |
| 内联描述，或采用非原生工具方言 | 完整工具目录 |

这解释了一个常见误判：看到系统提示词里只有工具名，就以为模型不知道参数。参数可能在请求的 `tools` 部分。反过来，完整目录进入文本时，系统指令占用会增大，不能只按基础模板长度估算上下文。

### `xd://` 还会改变工具入口

部分工具可以挂载成 `xd://` 设备。默认模板告诉模型，通过 `write` 把 JSON 参数写到 `xd://<tool>`；挂载工具会参与模板的工具存在性判断，引用也会指向设备 URL。

代码还会减少目录中的重复条目：挂载设备不一定再以同名顶层工具出现。SDK 会组合 MCP 路由指导，让模型知道已连接工具的实际入口。

因此，排查“模型为什么不用某个工具”时，至少要检查工具是否注册、是否被限制，以及它是顶层调用还是设备路由。只搜索系统文本中的工具名不够。

## 五、项目规则、技能与记忆分别怎样进入

### 项目规则全文与深层目录索引是两回事

[`project-prompt.md`](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/prompts/system/project-prompt.md) 会把已经发现的上下文文件放进 `<repo-rules>`，每个文件带路径和内容。另一个 `<dir-context>` 区段列出需要在进入相应目录前读取的规则文件路径。

前者是已经注入的正文，后者是待按需读取的指针。目录树也是单独控制的可选项，不应假定所有会话都有完整文件树。

自动发现还受配置来源和优先级约束，不能理解成扫描并合并机器上所有 Agent 配置。官方文档说明：同一目录层级选择上下文文件时有 provider 优先级；外部工具的用户级配置通常需要相应启用设置。

### 技能通常先给目录，再按需读全文

默认模板列出技能名称和描述，并要求匹配任务时先读 `skill://<name>`。技能清单不是全部 `SKILL.md` 的全文拼接。

清单还有工具能力门槛：需要存在声明支持读取 `skill://` 的有效工具；`hide: true` 的技能不会列入公开目录，但仍可通过支持的入口读取或调用。

规则也有类似区分：`alwaysApplyRules` 注入正文，其他规则以名称、匹配范围和描述构成索引。修改模板时，若漏掉这些字段，模型就可能失去相应提示。

### 记忆和 MCP 说明在 SDK 层组合

[`sdk.ts`](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/sdk.ts) 会按启用状态组合记忆指导、自动学习说明、MCP 路由与服务端说明，随后与用户的追加文本合并。

MCP 服务端说明前有明确标记，声明内容由服务端控制、可能未经验证。若前面已有自动生成的追加内容，用户追加文本会放到单独的 `## User Instructions` 标题下，避免看起来仍属于某个服务器的说明。

这解决了段落归属的歧义。至于这些文字对模型最终行为有多大影响，还取决于指令冲突和执行过程。

## 六、自定义入口的覆盖边界

这是配置时最容易出错的地方。下面的“保留”描述的是常规组装路线，仍受具体功能是否启用影响。

| 入口 | 替换或追加的位置 | 仍可能保留什么 |
| --- | --- | --- |
| `APPEND_SYSTEM.md`、`--append-system-prompt` | 项目尾部追加 | 默认基础指令、技能、规则、项目内容、工具 schema |
| `SYSTEM.md`、`--system-prompt` | 改用纯文本自定义基础模板 | 技能、规则、脱敏说明、项目尾部、额外指导和工具 schema |
| `SYSTEM_TEMPLATE.md`、`--system-prompt-template` | 接管基础块的 Handlebars 源码 | 独立生成的项目尾部、额外指导和工具 schema |
| `systemPromptTemplates` | 按模型选择基础模板 | 同模板路线；更高优先级的自定义配置会覆盖它 |
| SDK 的 `systemPrompt` | 替换生成的系统指令块数组 | 工具定义、对话消息和请求钩子需要分别检查 |

### `SYSTEM.md` 不会变成唯一一条系统消息

纯文本自定义走的是 [`custom-system-prompt.md`](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/prompts/system/custom-system-prompt.md)。它显式保留技能、规则等生成区段，独立项目尾部仍会加入。

被移除的是默认基础模板专有的角色与性格、通用工具策略、工作流、内部 URL 目录和 `xd://` 指导等。只写一句“你是代码审查员”，会同时放弃这些默认指导；不能假定它们仍被继承。

### Handlebars 模板要自己引用动态数据

`SYSTEM_TEMPLATE.md` 能访问 `skills`、`rules`、`alwaysApplyRules`、`toolInventory`、`internalUrls`、`xdevDocs` 等字段，但省略字段就不会自动补进基础块。项目上下文和追加内容则已经由独立尾部输出，通常不应再在基础模板重复插入。

纯文本文件没有这个模板能力。在 `SYSTEM.md` 或 `APPEND_SYSTEM.md` 中写 Handlebars 占位符，会按字面传给模型。插入模板的数据也不会递归执行第二轮模板解析。

一个稳妥做法是从安装版本对应的默认模板复制，再针对模型修改措辞，并保留需要的动态字段与子代理分支。不要把 `/dump` 的渲染结果复制成模板：那会把当时的工具目录、设置和设备信息固定下来。

### 配置优先级还区分项目与用户

显式 CLI 参数优先；两个基础覆盖参数互斥。没有显式覆盖时，发现顺序是：

```text
项目 SYSTEM.md
  > 项目 SYSTEM_TEMPLATE.md
  > 用户 SYSTEM.md
  > 用户 SYSTEM_TEMPLATE.md
  > 按模型匹配的模板
  > 内置默认模板
```

同一作用域中，已有的纯文本 `SYSTEM.md` 会压过模板。追加入口单独决策，显式追加参数优先于发现的追加文件。profile 还会改变用户级配置位置，默认的 `~/.omp/agent` 不能代表所有启动方式。

显式空字符串 `--system-prompt` 仍然表示“已指定”，会阻止自动发现自定义基础文件，却不会关闭 OMP 其余自动生成指令。

### 真正替换全部生成块的是 SDK 选项

`CreateAgentSessionOptions.systemPrompt` 可以是固定字符串、数组或回调。固定字符串或数组直接替换生成块，并跳过无用模板的发现与渲染；回调先收到正常生成的块数组，再返回替换结果，因此仍会经过模板发现和相关错误处理。

即便使用固定替换，也不跳过参数互斥校验。这一入口控制的是系统指令数组；要构造一个完全受控的实验请求，还需要另外控制工具、历史和扩展。

## 七、基础组装完成后，请求还会变化

[`agent-session.ts`](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/session/agent-session.ts) 在开始用户回合时调用扩展的 `before_agent_start`。扩展可以返回本回合的系统提示词覆盖，也可以加入自定义消息。代码把覆盖看作完整替换，而非简单字符串补丁；覆盖只在本回合生效。

SDK 随后还提供多处转换入口：

```text
基础系统块与会话消息准备
  → before_agent_start 可覆盖本回合系统块、加入消息
  → context 钩子处理消息，随后包装 steering
  → 转换为模型消息，处理图片支持与脱敏等
  → provider 上下文转换
  → provider payload 钩子 before_provider_request
```

这是阅读相关代码后整理的处理层次，未列出每个内部步骤。实际请求还受目标模型和已启用功能影响。

### 日期与 cwd 提醒刻意避开系统前缀

SDK 的 `DateCwdReminderInjector` 在请求前处理日期和当前工作目录，把提醒放到首个用户回合，减少高频变化对前缀缓存的影响。这里的 cwd 提醒与项目尾部的工作站、仓库信息属于不同处理位置。

所以，模板里找不到日历日期，并不说明模型完全不知道当天日期；只检查系统块也无法覆盖所有自动注入内容。

### 脱敏和可选图片转换改变发送表示

启用相应功能时，SDK 会对出站内容脱敏；源码还包含把系统提示词或工具结果栅格化成图片的可选 Snapcompact 转换，以及图片预算、格式兼容和 URL 装饰处理。

这些分支不是所有请求都会启用。它们说明：保存在会话里的内容、界面展示的内容和 provider 最终接到的表示，不一定逐字相同。

## 八、主会话、task 和顾问使用不同契约

官方文档给出的差别很具体：

| 输入 | 主会话 | task 子代理 | advisor / watchdog |
| --- | --- | --- | --- |
| `AGENTS.md` | 自动发现 | 按文件名过滤，不继承 | 继承 |
| `CLAUDE.md` / `GEMINI.md` | 按发现规则加载 | 继承 | 继承 |
| 用户追加系统文本 | 使用 | 不继承该追加入口 | 不继承该追加入口 |
| MCP 工具与服务端说明 | 可使用 | 通常继承；受限制会话例外 | 不使用 |
| 默认性格块 | 按配置 | `none` | 无 |
| `WATCHDOG.md` | 不使用 | 不使用 | 使用 |

task 对 `AGENTS.md` 的过滤按文件 basename、大小写不敏感执行，包含用户级文件。但经由其他文件的 `@` 导入带入的文字，不受这项文件名过滤约束。

默认模板还把验证职责分开：主代理负责最后检查，子代理默认完成改动后交接，除非任务明确要求它自行测试。这会影响并行工作中的测试次数。

给主会话加一条规则，并不能据此推断所有内部模型调用都会继承。自动标题也有单独的 `TITLE_SYSTEM.md`，不受主会话 `SYSTEM.md` 与 `APPEND_SYSTEM.md` 控制。

## 九、怎样核对你实际发送了什么

建议按三个层次检查，越靠后越接近发送结果。

1. **先看 `/context`。** 用它定位占用来自系统指令、项目文件、技能还是历史。来源统计与模板如何渲染条目有关；统计分类不是模型 API 的角色划分。
2. **再看 `/dump` 的渲染内容。** 核对实际命中的模板、工具目录、项目规则与追加段落。它适合观察某个时点，不适合直接作为长期模板。
3. **需要确认出站请求时，检查请求转储和最终 payload。** 对照模型、工具 schema、消息角色，以及扩展和 provider 转换。`dumpLlmRequestToTmpDir()` 导出的是 `convertToLlm` 边界快照，包含系统块、工具 wire schema 和转换后的消息，不会发起网络请求。因此，即使看到这份 JSON，也要继续区分它与后续 provider 转换、payload 钩子处理后的发送结果。

分析配置影响时，每次只改一个变量。例如保持项目、模型和工具集合相同，分别测试默认配置、增加 `APPEND_SYSTEM.md`、加入 `SYSTEM.md`。比较基础块和项目尾部，比直接比较最终回答更容易确定覆盖边界。

若要比较任务效果，还要重复运行、固定验证标准，并记录调用次数和工具错误。一个回答写得更长或更积极，无法证明提示词更好。

源码也做了一些防止上下文膨胀和格式污染的处理：上下文文件去重、始终应用规则去重、补齐文件里未关闭的代码围栏。准备阶段设置了共享的五秒截止时间，部分读取超时或失败时使用后备值并记录日志。因此，“配置文件存在”仍不足以证明它成功进入了本次请求。

## 十、按目标选择最小改动入口

只想补充团队约定，可以先用 `APPEND_SYSTEM.md`，保留默认工具和工作流指导。只想改交流风格，可以检查 `personality` 或用户级 `PERSONALITY.md`，避免连带删掉执行策略。

要重写默认工作方式，可以用 `SYSTEM.md`，但应明确承担丢失默认工具指导的后果。要给不同模型调整措辞，同时保留动态能力，使用从对应版本默认模板派生的 `SYSTEM_TEMPLATE.md` 或按模型模板更合适。

需要做严格控制变量的 harness 实验时，SDK 的完整系统块替换才提供足够低层的入口。然后分别固定工具集合、消息转换和扩展钩子，并保存实际出站请求。这样才知道行为差异来自哪一处封装。

## 源码与延伸阅读

相关实现：

- [系统提示词自定义文档](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/docs/system-prompt-customization.md)：块顺序、覆盖优先级、会话继承和模板契约。
- [system-prompt.ts](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/system-prompt.ts)：动态数据、工具目录、去重和渲染。
- [默认系统模板](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/prompts/system/system-prompt.md)、[纯文本自定义模板](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/prompts/system/custom-system-prompt.md)、[项目尾部模板](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/prompts/system/project-prompt.md)：直接核对模型会看到的指令。
- [sdk.ts](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/sdk.ts)：追加内容、MCP、完整替换和请求前转换。
- [agent-session.ts](https://github.com/can1357/oh-my-pi/blob/1bdbf6d242d99ca62bdf2feeff4519ff992f647d/packages/coding-agent/src/session/agent-session.ts)：回合级扩展覆盖和请求诊断。
