---
title: Pstack 插件技能详解：从任务路由到运行验证与自动交付
date: 2026-11-24 09:21:13
categories:
  - AI 工程
tags:
  - Pstack
  - Agent Skills
  - Cursor
  - 多智能体
  - 软件验证
description: 基于 Cursor 官方仓库，逐项分析 Pstack 的 35 个工作流技能、24 个工程原则和 22 个任务剧本，解释加载机制、多模型协作、TLA+ 状态检查、验证技能生成与自动交付边界。
---

Pstack 把 AI 编程中的工作方法组织成可调用的技能：理解代码、比较设计、实现修改、复现问题、验证行为，最后交付结果。它尤其重视一件事：智能体说“完成了”以后，要有什么证据支持这个判断。

这套插件由 Lauren Tan 编写，保存在 [Cursor 官方插件仓库](https://github.com/cursor/plugins/tree/main/pstack)。插件清单署名 Lauren Tan，README 以 poteto 自称，并链接到 [X 账号 @poteto](https://x.com/poteto)。它与她在《All Code Is Slop (Except Mine)》中主张的方法一致：先建设可靠的工程环境，再扩大并行和自动化。

Pstack 把“用哪个方法”“由谁执行”“如何判断正确”分别写清楚。采用它也有成本：多模型比较、运行应用和反复验证都需要工具、环境与时间。下面按源码说明每类技能做什么、怎样组合，以及哪些规则需要结合项目调整。

<!-- more -->

## 一、先看全貌：59 个技能分工不同

在本文分析的上游源码中，插件版本为 `0.15.48`。注册目录 `pstack/skills/` 下有 59 份 `SKILL.md`，其中 35 个是工作流或辅助技能，24 个是工程原则。`poteto-mode` 另有 22 个任务剧本。

| 组成 | 负责什么 | 代表文件或技能 |
| --- | --- | --- |
| 插件清单 | 声明名称、版本、作者和技能、子智能体目录 | `.cursor-plugin/plugin.json` |
| 主入口 | 根据目标选剧本，安排步骤，按需读取技能 | `poteto-mode` |
| 工作流技能 | 执行一种具体方法，给出约定的产物 | `arena`、`interrogate`、`create-verification-skill` |
| 原则技能 | 在某类决策发生时提供工程约束 | `principle-model-the-domain` 等 |
| 任务剧本 | 将技能串成修 bug、开发功能、发布等流程 | `playbooks/bug-fix.md` 等 |
| 子智能体 | 给委派者统一角色、规则和输出范围 | `poteto-agent`、`comment-sicko` |
| 辅助程序 | 完成确定性操作 | PR 观察器、TSV 日志脚本、状态检查工具 |
| 独立自动化素材 | 配置后处理 Slack 问题报告 | `automations/benny/` |

这里的数量不包含 Benny 目录内的三个技能文件。它们是自动化直接读取的操作说明，没有注册到插件的斜杠命令目录。22 个剧本保存在主入口内部，不能单独作为斜杠技能调用。

Pstack 没有提供新的基础模型。它规定宿主如何调用模型和工具；能否访问多家模型、启动云端代理或操作浏览器，仍取决于宿主。

## 二、怎么生效：显式入口、常驻模式和按需读取

### 安装以后，不会自动执行全部技能

源码中，除 `setup-pstack` 外，其余 58 个技能都设置了 `disable-model-invocation: true`。这意味着不能仅凭 description 里写了“适用于某任务”，就假定宿主会自动把它加入上下文。

通常的入口是用户显式调用 `/poteto-mode`，或者直接调用某个技能。主入口读到任务后选择剧本，再读取剧本需要的技能原文。原则也按需加载：`poteto-mode` 要求应用某条原则之前，先完整阅读对应的原则文件。

README 还区分两种使用方式。在 Cursor 的斜杠菜单里选择技能后，普通回车将其附加到一条消息；使用 macOS 的 Option+Enter 或 Windows 的 Alt+Enter，可以把它设为 custom mode，持续保留到退出模式。

因此，需要分别看清：插件是否安装、技能是否进入本轮上下文，以及是否已设为常驻模式。

### 当前上游没有注册 hook

当前 Pstack 清单注册了 `skills` 和 `agents`，没有 hook 字段，Pstack 目录也没有对应 hook 配置。把它概括为“hook 自动注入全部工程纪律”，与这里的上游实现不符。

`setup-pstack` 会写入一份 always-applied 模型配置规则，但那份文件主要保存各角色的模型选择，不等于把整个 `poteto-mode` 自动加载到每一轮。

### 主会话和子智能体各有责任

收到 `/poteto-mode` 的主会话持有剧本、待办列表和委派责任。`poteto-agent` 是执行具体子任务的包装角色，不替代主会话运行整个流程。

主入口要求给工作者传入 `worker.md` 的绝对路径；`poteto-agent` 还要读取完整的主入口规则。这样，委派出去的任务也能得到工作约束。只把一句“修复这个文件”传给通用子智能体，可能丢失验证与交付要求。

这属于指令传递机制。它能减少遗漏，但约束能否被遵守，仍要看执行记录和实际产物。

## 三、入口与表达：先把任务说清楚

这一组共有六个技能。它们帮助用户进入流程、明确目标，通常不直接实现功能。

| 技能 | 实际做法与产物 | 适合的场景 |
| --- | --- | --- |
| [`setup-pstack`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/setup-pstack/SKILL.md) | 检测可用模型，选择推理预算，确认角色表，写入模型配置规则 | 初次设置，或调整成本、模型与评审规模 |
| [`poteto-mode`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/SKILL.md) | 将目标匹配到剧本，把步骤加入待办，再调用所需技能 | 有一定复杂度、需要完整证据的工程任务 |
| [`poteto-help`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-help/SKILL.md) | 了解用户卡在哪里，解释相关入口，交回可以直接输入的提示词 | 不知道该选哪个技能或剧本 |
| [`in-your-own-words`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/in-your-own-words/SKILL.md) | 用自己的话复述用户目标与问题 | 担心智能体误解需求，希望先校准理解 |
| [`sharpen`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/sharpen/SKILL.md) | 补出专业方法、一手材料、具体工具和外部判据，重写提示词 | 请求太浅，但不希望无节制扩大范围 |
| [`reframe`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/reframe/SKILL.md) | 从原始描述和文件中辨认问题，提供专业术语及相邻领域的做法，再改写描述 | 知道自己想做什么，却找不到准确名称 |

`sharpen` 和 `reframe` 的差别值得注意。前者问的是“怎样把这件事做得更扎实”；后者问的是“这件事在专业领域叫什么，是否已经有成熟方法”。

例如，“帮我优化消息系统”可以经 `sharpen` 变成带测量方法和成功条件的请求；“我想让多个设备不重复显示提醒，但不知道怎么描述”，更适合先用 `reframe` 找到相关术语。

这些是说明用途的例子，不是插件已经完成的实测任务。

## 四、理解系统：how、why、teach 与 blast-radius

| 技能 | 查什么 | 输出重点 |
| --- | --- | --- |
| [`how`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/how/SKILL.md) | 当前代码、模块关系和运行流程 | 系统现在怎样工作，代码应该放在哪一层 |
| [`why`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/why/SKILL.md) | 引入该设计的提交、PR 讨论及后续修改记录 | 当时为什么这样选，哪些理由有记录，哪些只是推断 |
| [`teach`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/teach/SKILL.md) | 组合 `how` 与 `why` 的调查结果 | 把运行方式和设计动机讲成连贯解释 |
| [`blast-radius`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/blast-radius/SKILL.md) | 修改涉及的隐含契约、下游路径、库实现、数据格式和时序 | 修改可能破坏什么，以及安全判断依赖的事实是否成立 |

当前上游的 `how` 很短：它委派一个只读子智能体，一次完成探索与解释，再由主会话做少量编辑后呈现。不能把另一个独立仓库里更复杂的同名 `how` 实现，直接套在这份代码上。

`why` 尤其要求避免从代码反推动机。代码能说明“现在是这样”，提交和讨论才可能说明“作者为什么这样做”。缺少记录时，就应保留空白。

`blast-radius` 则进一步追问：这个小补丁为什么看起来安全？假设删除缓存项之所以安全，是因为被删项绝不会再被使用，那就应该运行真实代码验证这个事实，不能只交一份很有说服力的风险说明。

它把证据分成不同强度：口头断言、代码位置、逐步排除坏路径、运行实际代码、在运行应用中复现。读者据此能判断哪些结论已经落地，哪些还停在推测。

## 五、设计与并行：architect、arena、swarm 各管什么

### architect 先确定结构

`architect` 要求在写代码前追踪受影响的系统，画出两种不同的类型、函数签名和模块边界，再选择状态所有者明确、调用者需要知道最少的方案。

当前正文只有在设计较大或有争议时才要求使用 `arena`。因此，不能把它写成“每次设计都强制启动一整套多模型竞赛”。

它的产物是结构选择，为后续实现提供依据。对于一个局部而明显的改动，设计草图可以很小；对于重复出现的变通方案，则应重新考虑边界。

### arena 比较同一任务的不同候选

`arena` 的六个阶段是确定任务、并行生成、交叉评判、选择基底、吸收其他候选的优点、验证合成结果。

候选拿到同一份任务，但不拿评判量表；主会话先定义三到六条可评分标准，用来比较候选。这样做试图避免候选只迎合评分条目。

每个候选有独立输出目录或 worktree。候选完成后，额外选择一个尽可能来自不同供应商的评判者，主会话也要完整读完所有结果。最后保留一个基底，手工吸收少量有用部分，保证设计仍然一致。

如果候选分歧过大，源码建议重新明确任务，而不是把互不兼容的方案平均混合。最终合成物还要重新验证，因为合成后的代码已经不是任何一个原候选。

### swarm 汇总并行工作的覆盖结果

`swarm` 可以拆分不同范围，也可以让多个工作者竞争同一任务。区别在于，它主要管理分工、验收和汇总，不包含 `arena` 那套固定的选基底与吸收流程。

| 比较项 | `arena` | `swarm` |
| --- | --- | --- |
| 主要目标 | 从候选中形成一个更好的产物 | 完成覆盖任务或按预定规则选择结果 |
| 常见分工 | 同一任务，多种方案 | 不同切片，也支持竞速或混合 |
| 开始前要确定 | 任务、评分标准、候选和输出位置 | 完成条件、分工形状、竞速选择规则 |
| 结束产物 | 一个合成结果及取舍说明 | 一份合并报告、问题和覆盖缺口 |
| 重要限制 | 所有候选都要读，合成后重验 | 缺少结果不能算通过，证据须对应指定版本 |

“`swarm` 只处理不同任务”这个说法过窄。它也支持相同任务竞速，但必须事先声明采用 first pass、rank all 还是 best-of，不能等结果出现后临时挑有利规则。

### 隔离写入比增加工作者更重要

两者都强调给写入者独立输出位置。多个智能体各改 `state.json` 的不同字段，仍然是在修改同一个共享对象，不能靠“大家小心一点”避免冲突。

Pstack 的原则是先看能否拆成独立事实，在读取时合并；确实需要共享写入时，再使用单写入者、锁或比较交换等结构。这决定并行是否可靠。

## 六、审查与实现纪律：四个技能的不同边界

### interrogate 只报告运行证实的问题

`interrogate` 借用 `arena` 的候选分派机制，让多个审查者尝试打破同一个修改。每个发现必须包括实际命令、输出，以及根据任务意图本应出现的结果。

主会话要重跑命令，确认既能复现错误，又确实违反需求；相同根因的发现合并。风格、命名和只有未来改动才会触发的假想风险，不进入最终问题列表。

它不选择“最好的审查者”，也不直接修复，而是保留所有已验证发现。“没有经过验证的问题”是允许的结论。

这让审查结果更容易复核，也带来覆盖边界：难以执行的安全问题、环境依赖强的问题或长期退化，可能无法在一次运行里证明。没有发现不能解释为没有缺陷，应与架构、安全及其他评审配合。

### tdd 用于有实际收益的回归路径

`tdd` 首选小而明确的失败测试：先确认测试因原始错误失败，再修改代码，最后让同一测试通过。

它没有要求所有任务先搭建测试基础设施。用户明确要求 TDD，或 bug 已有便宜的本地测试入口时适用；路径昂贵、模糊或过度依赖集成环境时，可以改用针对性脚本、浏览器操作或日志断言。

重点在于保留修复前后可比较的证据。为了满足形式而写一个主要测试 mock 的用例，可能没有帮助。

### no-comments 是带强烈偏好的清理流程

`no-comments` 调用 `comment-sicko` 子智能体，清除叙述性注释、废弃代码和为临时补丁辩护的文字，并标记需要重塑的代码。主会话检查报告后，再处理接受的改动。

子智能体允许保留法律和许可头、无法改变的外部依赖行为、公共 API 契约，以及代码无法表达的约束链接等例外。它本身只处理注释和标记问题，产品代码由后续流程修改。

这套规则明显偏激进。尤其是对无法确认例外的约束注释，正文倾向删除并报告未执行的约束。对于合规、安全、协议或跨团队契约项目，应该先调整例外和审查方式，不能把“删掉注释”当作已经消除约束。

一条“不要这样做”的注释，如果能变成类型、接口或检查，就可以减少日后依赖人工提醒的次数。注释承载的背景仍要有人判断是否值得保留。

### typescript-best-practices 把原则落到语法

它要求先读取类型纪律原则，再应用可辨识联合、语义品牌类型、边界解析、穷尽检查和 schema 推导等做法。

例如，用 `kind` 区分状态，优于让多个可选字段拼出大量无效组合。外部 JSON 在解析前应是 `unknown`，不能靠 `as` 把未经验证的数据变成可信领域对象。

它也强调不要为了更强的类型强行增加复杂性：普通数组上的操作都能完整定义时，就保留普通数组；只有松散类型迫使代码使用断言或“不应发生”的异常，才进一步加强类型。

## 七、运行时验证：生成与维护项目自己的验收能力

### create-verification-skill 生成可执行的项目技能

这个技能先调查仓库，再写出适合该应用的 `verify-<app>`。它要从代码中找到启动命令、用户入口、已有操作工具、证据来源和实例隔离方式。

生成物必须包含以下内容：

| 部分 | 必须回答的问题 |
| --- | --- |
| Launch | 怎样启动到真正可用的状态，如何停止自己启动的实例？ |
| Doctor | 当前是否是正确版本，进程、端口和认证是否正常？ |
| Drive | 怎样走真实用户路径，选择器或命令是什么？ |
| Evidence | 怎样证明操作发生、状态改变及副作用正确？证据保存在哪里？ |
| Cleanup | 怎样清理实例和临时状态，同时保留证据？ |
| Feature map | 有哪些用户功能、入口、操作步骤和常见陷阱？ |

它先为三到五个主要功能建立功能地图，而非一次写完所有功能。生成后必须按说明完整运行一次，验证至少一个已映射功能，并在清理后检查证据仍然存在。

因此，产物是一份经过试跑的项目操作能力，而非通用测试建议。对 CLI、API、桌面和 Web 应用，实际生成的驱动方式应不同。

### maintain-verification-skill 检查文档有没有过期

维护技能分两条线：多个只读调查者并行核对各功能的源码，主协调者负责串行操作运行实例。这样既扩大源码覆盖，又避免多个工作者同时干扰同一个界面。

它要求每个功能都有源码和运行覆盖。修改范围只限验证技能自身、功能地图和所属驱动脚本。若应用实际坏了，应报告产品问题，不能改文档假装新行为正确。

最终结果分为 clean、changed、blocked。只有确有经过证明的改动才产生一个修正 PR，没有改动就不制造提交。

验证方法本身也是代码和文档，会随着产品变化而失效；生成以后仍需要维护。

## 八、形式化验证与 statechart：从性质到反例路径

这一组有三个技能，分别负责建立检查、维护检查，以及把结果变成人能判断的状态图。

### create-formal-verification-skill 先选值得验证的性质

它要求选择出错代价高、普通测试不容易到达的部分，例如重试、并发顺序、状态机、解析器或不安全代码。目标不应只是“挑一个最容易证明的函数”。

问题决定工具：事件顺序适合模型检查；代码对输入的性质可能适合直接检查代码的验证器；需要对所有规模成立的结论，可能需要证明助手。工具无法直接覆盖实现语言时，源码要求诚实说明，并考虑对真实代码进行生成式测试。

生成的项目技能要留下性质、边界、对应实现位置、工具版本和可重跑命令。每条性质还必须在一个故意破坏的变体上失败，证明检查真的能抓住目标问题。

如果发现当前实现违反性质，默认报告，不擅自修改产品，也不把性质改弱来换取通过。

### maintain-formal-verification-skill 防止模型悄悄落后

它沿着上次同步位置之后的提交，检查覆盖代码是否变化，更新模型、性质或验证驱动，再重新运行。

结果可以是 in sync、updated、bug、blocked，也可以是“模型更新后发现真实 bug”。验证范围仍限于验证材料，不能把产品代码改成符合旧模型。

模型可能持续通过，却已经不再描述现有代码。维护技能检查这种过期状态，避免把旧模型的通过结果用于新实现。

### statechart 包含实际检查程序

`statechart` 需要 TLA+ 模型和配置，可选一个视图模块，将内部变量映射为读者理解的状态和事件。随附的 TypeScript 程序运行 TLC，处理状态图和检查结果，输出 `report.md`、`chart.mmd`、`tlc.out` 等文件。

它的工作可以概括为：

```text
实现或产品行为
    → 建立 TLA+ 模型、性质与配置
    → TLC 检查
    → 视图将内部状态映射成用户语言
    → Mermaid 状态图、规则标记和反例路径
    → 将反例回放到真实实现
```

其中有几处比“画一张流程图”更具体：

- 支持平面状态、父子层级和并行区域。
- 标记违反规则的状态，也区分聚合后“部分底层状态可能违反”的情况。
- 给出违反规则的最短路径，方便解释故障怎样发生。
- 一条规则失败后，程序会移除该规则并继续检查，尝试发现其他规则的反例。
- 明确列出未完成检查的规则，不能把未检查当作成立。

源码还给出了两种不同预算。按原配置计数超过 500 个状态时，图只画违规路径；若没有违规，则可能没有 `chart.mmd`。这不等于停止所有性质检查。另一方面，首次发现违规后的后续检查每轮有十万个不同状态的上限，未完成的规则会进入报告。

首次运行通常需要通过 mise 获取 TLC 和 Java；原生 Windows 可按技能给出的 Node 版本范围直接运行 TypeScript 入口，不能照搬 POSIX shell 包装命令。

如果模型描述的是代码，技能最后要求把每条反例路径在真实代码上回放。实际无法复现时，应先怀疑模型不准确，再继续调查。模型检查通过也只覆盖模型的范围、边界和假设。

## 九、性能结果：benchmark-checklist 防止优化了错误指标

`benchmark-checklist` 是唯一专门审核测量结果的工作流技能。它要求先写出想报告的结论，再审查测量脚本。

完整比较需要回答七个问题：瓶颈是什么；两边是否按实际生产条件调优；结果是否超过资源上限；错误率是否变化；能否重复；端到端是否有意义；计时范围内目标工作究竟有没有发生。

例如，一个导出命令快了很多，可能是没有等待写盘，也可能是错误提前返回。只报告耗时，无法证明性能改善。

一般比较要求两边各至少运行五次，交替执行，报告中位数和范围。明确要求粗略估计时，可以只运行一次，但仍要检查错误以及工作确实发生，并说明只有一次观测。

它也要求把微基准放回整体路径中判断。一个只占总耗时 1% 的辅助函数，再快也无法消除其余 99% 的等待。

## 十、长任务与经验积累：六个技能分别保留什么

| 技能 | 读取与处理方式 | 交付物或边界 |
| --- | --- | --- |
| [`recall`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/recall/SKILL.md) | 从限定工作区的近期会话、共享记录和实时状态重建上下文 | 当前状态简报、未解决问题和下一步；默认近期窗口为七天 |
| [`ketchup`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/ketchup/SKILL.md) | 汇总当前会话中，自用户上次消息之后的变化 | 易读进展和所有待用户决定事项；不借汇报之机继续改代码 |
| [`ketchup-video`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/ketchup-video/SKILL.md) | 将同类进展制成短视频，优先使用已有截图、录像和数据 | 带字幕的视频，以及文字形式的待决定事项 |
| [`figure-it-out`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/figure-it-out/SKILL.md) | 没有合适剧本时，先设计可审计的阶段与验收方式 | 自定义流程、假设实验、验证结果和决策记录 |
| [`show-me-your-work`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/show-me-your-work/SKILL.md) | 以追加方式写入每个重要决策及证据 | TSV 日志，包含时间、阶段、决定、原因、证据、结果 |
| [`make-bot-ui`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/make-bot-ui/SKILL.md) | 通过本机服务将页面按钮转发到自动化 webhook | 可操作页面和服务端转发，依赖对应 bot、凭据及网络能力 |

### recall 恢复工作状态，ketchup 帮人跟上进度

`recall` 面向即将开始或恢复工作的智能体，既看个人会话，也看相关代码的历史修复、撤回和问题报告。它限定范围，避免为恢复一个主题而读取其他项目的私人会话。

`ketchup` 面向监督工作的用户，关心发生了什么以及用户现在需要做什么决定。智能体自己还能完成的工作，不应该转写成用户行动项。

`ketchup-video` 更重：最多十张幻灯片，需要渲染并检查每页可读性、字幕和停留时间。它适合视觉变化确有价值的汇报，不宜为一次小改动例行生成视频。

### show-me-your-work 记录可以追查的决定

它的日志是追加式的。判断错了就追加一行纠正，不能删掉旧行来改写历史。证据字段应指向文件、提交、截图或其他产物，不能只写一段自我解释。

交付前还要用真实会话记录核对日志，并安排不同供应商模型审查记录。成本在于需要会话可访问、证据仍存在，以及确有不同供应商可用；缺少这些条件时，不能假装完成了交叉验证。

### make-bot-ui 的通用部分与专属部分

通用结构是“浏览器 → 本地服务 → 认证 webhook”。密钥留在服务端，不放浏览器或聊天记录；webhook 的请求体作为外部数据处理。

具体创建 routine、申请 secret 和通过 Tailscale 暴露服务的步骤，则依赖对应环境。把这份技能复制到另一种编码工具，不会自动获得相同接口。

## 十一、改进自己的方法：reflect、correct、automate-me

这三个技能很容易混淆，但改动对象不同。

| 技能 | 要回答的问题 | 主要改动对象 |
| --- | --- | --- |
| [`reflect`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/reflect/SKILL.md) | 本次会话有什么长期有效的经验，应该进入已用技能？ | 现有技能的描述和执行规则 |
| [`correct`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/correct/SKILL.md) | 哪类错误在仓库里重复出现，怎样阻止再次发生？ | 架构、类型、lint、CI、测试，最后才是文档 |
| [`automate-me`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/automate-me/SKILL.md) | 用户长期怎样工作，哪些偏好值得成为个人模式？ | 新的或已有的个人 `-mode` 技能 |

`reflect` 要把发现分为接受、拒绝和待办。能用代码强制执行的内容进入待办，不继续堆进提示词；修改技能前等待批准，也不直接改插件缓存，而是复制到项目或用户技能目录再修改。它明确不负责开 PR 或推送。

`correct` 以至少重复两次为错误类别的信号，要求优先从结构上消除错误。新增检查还要在真实历史错误上证明会失败，并保留“规则—执行机制”对照表。

`automate-me` 读取当前工作区的历史，交叉确认多次出现的偏好，再询问用户意图，生成个人模式。它强调不能直接复制 Lauren 的习惯，更不能从一条偶然纠正推导出永久政策。

这套区分很实用：临时问题不必固化，长期判断可进入技能，稳定且能自动识别的错误则应尽量变成检查。

## 十二、写作与说明：三个技能的尺度

| 技能 | 做什么 | 与另外两个的区别 |
| --- | --- | --- |
| [`unslop`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/unslop/SKILL.md) | 删除空话、模糊归因、机械排比和装饰性措辞，保留事实 | 负责编辑语言，不负责验证技术事实 |
| [`technical-writing`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/technical-writing/SKILL.md) | 区分教程、操作指南、参考和解释，再约束术语、句子与步骤 | 负责文档结构和技术表达，并调用 `unslop` |
| [`bro`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/bro/SKILL.md) | 用日常语言重述上一条消息，减少术语 | 解决“没听懂”，不增加调查或新结论 |

`technical-writing` 将 PR 描述和提交信息也视为写作产物，要求简短说明问题、变更与证据，把长日志链接出去。

它引用的部分规范为英文设计，例如句子词数、冠词和某些语法限制。中文使用时，可以保留明确指代、统一术语、具体动作和可操作步骤，没必要机械套用英文句法。

至此，35 个工作流与辅助技能都已覆盖。下面再看它们怎样被主入口组合起来。

## 十三、22 个剧本怎样组织这些技能

剧本解决端到端任务；技能解决其中一种方法。`poteto-mode` 先选剧本，再根据步骤调用技能。

| 剧本文件名 | 任务与关键要求 |
| --- | --- |
| [`investigation`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/investigation.md) | 只读调查，交付带依据的解释或建议，不开 PR |
| [`bug-fix`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/bug-fix.md) | 自己复现，排除假设，确认机制，修复后回到相同操作界面验证 |
| [`perf-issue`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/perf-issue.md) | 先采基线和 trace，再改代码，比较前后真实数据 |
| [`hillclimb`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/hillclimb.md) | 冻结测量方法，一次一个假设，测量后保留或撤回，持续逼近目标 |
| [`runtime-forensics`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/runtime-forensics.md) | 对运行进程采样、插桩，先交付诊断，未要求时不修复 |
| [`trace-forensics`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/trace-forensics.md) | 分析已有 profiling 材料，不把重新运行当作替代数据 |
| [`feature`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/feature.md) | 理解系统、确定数据结构、分解工作、委派实现、运行验证 |
| [`refactoring`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/refactoring.md) | 先固定现有行为，再分步调整结构，保持行为等价 |
| [`prototype`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/prototype.md) | 在隔离目录里快速试验，产物用于决策，不作为生产实现 |
| [`visual-parity`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/visual-parity.md) | 固定截图基线，逐项比较像素，不能修改基线来换取通过 |
| [`authoring-a-skill`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/authoring-a-skill.md) | 借助宿主的技能编写能力，验证元数据和引用，按需要测试 |
| [`eval`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/eval.md) | 对技能或提示词做盲测，从真实读取记录和产物判断执行情况 |
| [`babysit`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/babysit.md) | 检查或推动 PR 到可合并状态；不自行 rebase，不授权合并 |
| [`shipping`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/shipping.md) | 独立验证每个 PR，自底向上交付连续通过的一段 |
| [`autonomous-run`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/autonomous-run.md) | 设定可检查的结束条件，按唤醒机制持续推进 |
| [`autopilot-full`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/autopilot-full.md) | 每个 PR 有独立 owner，另有验证者核对代码，再按授权合并 |
| [`autopilot-stack`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/autopilot-stack.md) | 基于同类流程构建、验证 PR，交还用户，不合并 |
| [`session-pickup`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/session-pickup.md) | 从既有记录恢复状态，把未完成部分交给对应剧本 |
| [`pause-safely`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/pause-safely.md) | 在安全边界停止，保存持久状态和恢复说明 |
| [`multi-phase-plan`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/multi-phase-plan.md) | 产出依赖图和各 PR 的验收计划，等待明确执行指令 |
| [`worktree-cleanup`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/worktree-cleanup.md) | 先审计是否使用中、有无未提交内容，再回收空间 |
| [`opening-a-pr`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks/opening-a-pr.md) | 整理小提交和简短 PR 描述，按适用流程创建可评审 PR |

### 用一次重试重复写入说明组合方式

假设用户要求修复“导出任务在中途重试时写入重复行”。合理流程是：

1. `poteto-mode` 选择 `bug-fix`，先在真实导出入口复现重复。
2. 调查调用链，需要历史原因时读取 `why`；通过运行证据排除错误假设。
3. 如果修改跨越函数边界，先用 `architect` 确定批次、重试和写入状态的归属。
4. 有便宜的回归路径时用 `tdd`；实现修改后在相同重试条件下验证。
5. 将幂等性和边界解析原则用于设计，检查可能受影响的其他调用者。
6. 争议大时用 `interrogate` 尝试打破修改，最后整理证据与提交。

这里不必每次都启动 `arena`、`swarm` 和形式化验证。每个额外步骤都应解决具体的不确定性。

### 自动交付最重视证据是否对应当前代码

`shipping` 要求验证者不是代码作者；绿色 CI 和机器人同意都不能替代运行用户路径。

一条旧验证意见能否继续使用，要比较它覆盖的补丁与当前补丁。源码使用 `git patch-id` 等依据判断重排后的补丁是否变化，并区分哪些验证能沿用、哪些必须重跑。

`babysit`、`shipping`、`autopilot-full` 和 `autopilot-stack` 的权限也不同。检查 PR 状态不代表可以 rebase；修到可合并不代表可以合并；要求计划不代表批准执行。把这些边界写进流程，能减少自动化中的误操作。

## 十四、24 条原则分别约束哪些决定

这些原则是按情境读取的短文件，不能替代类型系统、锁或 CI。其价值在于让智能体遇到对应选择时，采用更明确的判断方法。

下面表中的名称省略共同的 `principle-` 前缀。

| 原则名称 | 实际要求 |
| --- | --- |
| [`laziness-protocol`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-laziness-protocol/SKILL.md) | 集中重复决策，偏向删除和解决目标所需的最小改动 |
| [`foundational-thinking`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-foundational-thinking/SKILL.md) | 先选数据结构和类型，检查并发共享，先做支撑后续工作的基础 |
| [`redesign-from-first-principles`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-redesign-from-first-principles/SKILL.md) | 把新要求视为最初就存在，再考虑设计应是什么样，分步交付 |
| [`attack-the-premise`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-attack-the-premise/SKILL.md) | 同一前提下两次修复仍失败时，先写出并直接测试这个前提 |
| [`subtract-before-you-add`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-subtract-before-you-add/SKILL.md) | 新增或重写前先删死代码、冗余检查和无效引用 |
| [`minimize-reader-load`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-minimize-reader-load/SKILL.md) | 减少追踪层级和需要记住的可变状态 |
| [`outcome-oriented-execution`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-outcome-oriented-execution/SKILL.md) | 在明确的迁移阶段内允许可逆的中间破坏，在验收点证明终态 |
| [`experience-first`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-experience-first/SKILL.md) | 从使用者和维护者体验选目标，缩减粗糙功能，改进核心操作 |
| [`exhaust-the-design-space`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-exhaust-the-design-space/SKILL.md) | 没有先例的新交互或架构，先做两三种原型比较 |
| [`build-the-lever`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-build-the-lever/SKILL.md) | 非琐碎任务尽量留下能重跑的脚本、codemod、生成器或检查 |
| [`model-the-domain`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-model-the-domain/SKILL.md) | 用状态机、类型、表、集合等表达领域，减少散落条件分支 |
| [`boundary-discipline`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-boundary-discipline/SKILL.md) | 在外部数据进入时解析和处理错误，内部使用领域类型 |
| [`type-system-discipline`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-type-system-discipline/SKILL.md) | 让编译器拒绝无效状态、混用语义值和遗漏变体 |
| [`make-operations-idempotent`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-make-operations-idempotent/SKILL.md) | 根据实际状态协调，使重试或崩溃恢复后仍收敛到同一结果 |
| [`migrate-callers-then-delete-legacy-apis`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md) | 对可协调的内部 API 同批迁移调用者并删除旧入口 |
| [`separate-before-serializing-shared-state`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-separate-before-serializing-shared-state/SKILL.md) | 先消除不必要的共享写入，确有共享要求再做串行化 |
| [`prove-it-works`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-prove-it-works/SKILL.md) | 检查实际产物和行为，不把自我报告或编译通过当作完成 |
| [`fix-root-causes`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-fix-root-causes/SKILL.md) | 找到最早的错误决策；只有合法状态才应在出错处处理 |
| [`sequence-verifiable-units`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-sequence-verifiable-units/SKILL.md) | 小步修改，每步结束于检查；提交顺序也要体现证明过程 |
| [`test-behavior-not-implementation`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-test-behavior-not-implementation/SKILL.md) | 测试应抓住行为破坏，同时允许不改变行为的内部重构 |
| [`explain-the-number`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-explain-the-number/SKILL.md) | 测量前定义决策、噪声和限制因素，排除测错对象 |
| [`guard-the-context-window`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-guard-the-context-window/SKILL.md) | 限定范围，把大量读取放到工作者，主会话保留结论 |
| [`never-block-on-the-human`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-never-block-on-the-human/SKILL.md) | 可逆执行选择继续做，产品方向和不可逆操作保留人的决定 |
| [`encode-lessons-in-structure`](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/principle-encode-lessons-in-structure/SKILL.md) | 重复提醒优先变成结构、检查或元数据，只把判断留给文字 |

### 原则之间需要结合范围解释

“最小改动”与“重新设计”并非随时都指向同一个方案。应先明确目标边界，再找达到目标所需的最小结构变化，不能拿重新设计作为扩张整个项目的理由。

“阶段内允许中间破坏”和“每步都可验证”也需要写清检查边界。规划允许的临时失败，不等于让无关检查持续失效；更不能到最后才发现无法恢复。

内部 API 一次迁移并删除旧入口的原则，正文明确限定没有外部兼容用户、允许协调破坏性变更的情况。公共 SDK、持久化格式或外部协议，通常需要另外设计兼容期。

## 十五、模型配置与跨宿主适配

### setup-pstack 配的是角色，不是一个全局模型

配置规则分别保存功能与重构、bug 修复、性能、持续优化、文字与判断、候选生成、交叉评判和并行工作者等角色。评审面板一行可以有多个模型，一个条目对应一个工作者；交叉评判池则是候选列表，实际选一个合适的评判者。

推理预算有 large、medium、small 三档。源码先检测工具当前接受的模型标识，再按预算调整推理等级；也允许 `auto` 或 `inherit-parent`，让角色继承父会话模型。

这解决了硬编码配置在不同账户间失效的问题，但“多模型”不必然是“不同供应商”。同一供应商的不同模型仍共享部分背景；只有确实调用到了不同供应商，才能据此说明交叉来源。

### Cursor 与 Claude Code 的入口不同

README 给出的 Cursor 安装入口是：

```text
/add-plugin pstack
```

Claude Code 则是：

```text
/plugin marketplace add cursor/plugins
/plugin install pstack@cursor-plugins
```

在 Claude Code 中，命令带插件前缀，例如 `/pstack:setup-pstack` 和 `/pstack:poteto-mode`。仓库为该宿主生成单独分发树，并提供工具、路径、子智能体和模型映射。

适配文档尤其指出，部分带 `disable-model-invocation` 的技能不能直接靠技能调用工具启动，而应读取安装目录里的对应文件。Cursor 的云端工作者可以映射成本地 worktree，但这不意味着 Claude Code 获得了 Cursor 云代理。

模型映射还会降低某些多供应商评判的多样性。不支持的非 Claude 模型会回落到会话模型，并应明确说明，不能继续声称由原来的跨供应商面板评审。

### 完整流程还有外部依赖

Pstack README 明确列出，代码清理用的 `deslop`，以及操作 CLI、浏览器或 Electron 的 `control-cli`、`control-ui`，来自另一个 `cursor-team-kit` 插件。`deslop` 不是 `unslop`：前者清理代码，后者编辑文字。

技能编写会引用 Cursor 内置 `create-skill`；长时间执行依赖宿主 `/loop` 或适配后的唤醒机制；PR 流程需要可用的代码托管工具和权限。

因此，只复制 `SKILL.md` 可以复用部分方法，但不能保证整套任务链可运行。跨工具迁移应逐项检查读取、委派、运行、证据和交付能力。

## 十六、Benny 自动化是独立扩展

`automations/benny/` 提供两段 Slack 问题处理流程。

第一段读取原始问题线程，区分 bug、性能问题、需求或其他反馈，查找重复工单，给出路由和可信标记。第二段等待该标记，通过真实 UI 两次复现，检查是否已有负责人或修复，再决定是否尝试一次受限修复。

它强调原线程坐标不变、回复留在原线程、子智能体不持有 Slack 凭据。已有修复时优先验证，不另开竞争性修改。修复成功可以开草稿 PR，但不合并、不部署。

这些文件默认处于休眠状态，安装 Pstack 不会自动开启 Slack 机器人。用户需要把自动化素材合并到目标仓库、填写配置、接好操作适配器和功能地图，并明确创建自动化。

Benny 使用草稿 PR，与主模式通常创建可评审 PR 的政策不同。它有独立的操作契约，不应拿主模式的默认规则覆盖这个边界。

## 十七、哪些部分最值得先采用

如果希望减少重复错误，优先看 `correct`。它最接近 Lauren 演讲中“把纠正变成工程约束”的实践，结果也容易核对：新增检查能否抓住过去的真实错误？

如果智能体经常“写完了但没运行”，优先建立 `create-verification-skill`，从一条真实用户路径开始，再用维护技能保持它有效。这能为其他流程提供可靠的验收入口。

如果争论主要发生在设计选择，先用 `architect`。只有两个方案都合理、值得付出比较成本时，再进入 `arena`。批量独立检查适合 `swarm`，怀疑补丁有隐藏缺陷时用 `interrogate`。

如果系统包含重试、锁、队列、多设备状态或复杂协议，可以选择一个明确性质尝试形式化验证，并用 `statechart` 检查反例。要保留模型与真实代码之间的对应关系。

对小型脚本、一次性文案或非常局部的改动，完整 `poteto-mode` 可能过重。可以只借用目标澄清、行为验证和一次可靠检查，不必把多模型面板、视频汇报和发布循环全部串上。

Pstack 提供的方法最终都落到具体问题：目标是否明确，当前证据对应哪份代码，下一步能减少什么不确定性。先为自己的项目建立一条能重跑的验证路径，再决定需要增加多少协作步骤。

## 源码与延伸阅读

以下链接固定到本文使用的同一份源码，便于回看具体规则。分析对象是 Cursor 官方仓库的 Pstack；第三方镜像或移植版的入口和触发机制可能不同。

- [README：作者、安装、技能清单与依赖](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/README.md)
- [插件清单：目录注册与版本](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/.cursor-plugin/plugin.json)
- [全部 59 个技能目录](https://github.com/cursor/plugins/tree/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills)
- [poteto-mode：入口、原则与模型角色](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/SKILL.md)
- [22 个任务剧本](https://github.com/cursor/plugins/tree/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/poteto-mode/playbooks)
- [architect：结构先行](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/architect/SKILL.md)
- [arena：候选比较与合成](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/arena/SKILL.md)
- [swarm：覆盖、竞速与结果汇总](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/swarm/SKILL.md)
- [interrogate：运行证据筛选](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/interrogate/SKILL.md)
- [运行时验证技能生成器](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/create-verification-skill/SKILL.md)
- [形式化验证技能生成器](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/create-formal-verification-skill/SKILL.md)
- [statechart 技能](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/statechart/SKILL.md)与[随附脚本](https://github.com/cursor/plugins/tree/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/statechart/scripts)
- [benchmark-checklist：测量可信度](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/benchmark-checklist/SKILL.md)
- [correct：将重复纠错变成约束](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/skills/correct/SKILL.md)
- [Claude Code 适配说明](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/docs/harness/claude-code.md)
- [Benny 自动化的独立操作契约](https://github.com/cursor/plugins/blob/9e278fe4d4ecd8bfe98b1b79bf4be662efb338cc/pstack/automations/benny/FOR_AGENTS.md)
