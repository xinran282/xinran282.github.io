---
title: Open Code Review 把不该交给模型的审查步骤收回来
date: 2026-10-09 15:34:13
categories:
  - 人工智能
tags:
  - 代码审查
  - Open Code Review
  - Agent
  - CLI
  - 开源
description: 阿里开源的 Open Code Review 用确定流程卡住选文件、配规则和评论落点，只把查上下文和判断问题留给模型。
---

# Open Code Review 把不该交给模型的审查步骤收回来

阿里开源的 [Open Code Review](https://github.com/alibaba/open-code-review) 不是又一个“把 diff 丢给编程 Agent”的审查 Skill。命令行叫 `ocr`。它把选哪些文件、套哪条规则、评论落在哪一行做成工程流程，模型主要负责查上下文和判断有没有问题。兼容多少家模型只是配置；和普通 Skill 的差别在选文件和落点。

仓库 2026 年 5 月 18 日创建，Apache-2.0，主语言是 Go，官网在 [open-codereview.ai](https://open-codereview.ai)。2026 年 10 月 9 日我查 GitHub API，star 是 44710，fork 3233，开放 issue 282，最新 release 是 10 月 8 日的 v1.12.13。star 会变。7 月 29 日团队复盘里写的还是 15.5k。

## 它想收住的不是“模型不够聪明”

README 把前身说成阿里集团内部的官方 AI 代码审查助手：过去两年服务了数万开发者，识别了数百万个缺陷。更具体的数在 [2026-07-29 的复盘](https://github.com/alibaba/open-code-review/blob/main/pages/src/content/blog/zh/oss-two-month-retrospective.md) 里，作者 lizhengfeng101 写，内部有 2 万月活，采纳率 30% 以上，误报率不到 5%，合并进基线的有效建议里近八成来自 AI。这些都是项目自述，我没有独立审计。它们说明团队想证明的是“大规模用过”，不是开源仓库本身已经把效果证完。

项目点名了通用 Agent 加 Skill 做审查时的三个毛病：变更一大就漏文件，评论行号对不上，提示词稍改质量就飘。我更在意前两个。漏文件和行号漂移会让审查结果没法用；提示词不稳是原因，用户先看见的是错位的评论。

它没有再堆一份更长的审查提示词，而是把文件范围、规则选择和评论坐标从模型手里拿回来。模型仍然会错，只是错的位置变了。

## 一次 `ocr review` 实际怎么走

仓库里的[中文架构文档](https://github.com/alibaba/open-code-review/blob/main/pages/src/content/docs/zh/architecture.md) 把流水线写得很具体。`ocr review` 先解析 LLM 端点，端点必须凑齐 URL、token 和 model，缺一个就退出，不猜。然后用 Git 取 diff。需要 Git 2.41 或更高。

diff 有三种。不带参数看工作区，包括 staged、unstaged 和 untracked。`--commit` 看单个提交。`--from` 加 `--to` 看的是 merge-base 到目标分支，不是两个 ref 的朴素两点 diff。上下文行固定 3 行，和 Git 默认一样。

文件接着过过滤。二进制先丢。用户的 `exclude` 优先。配了 `include` 且命中的文件，可以绕过后面的扩展名白名单和默认路径排除。扩展名不在 [supported_file_types.json](https://github.com/alibaba/open-code-review/blob/main/internal/config/allowlist/supported_file_types.json) 里就丢。测试文件默认不审，例如 `*_test.go`、`*.test.ts`、`src/test/java` 下的 Java 测试。`vendor/`、`node_modules/`、`target/` 这些依赖目录在更早的 diff 层就被丢掉，`include` 救不回来。被删的文件不审。单个 diff 超过 token 上限的 80% 会标成 `too_large` 跳过。`ocr review --preview` 可以不花 token 看每个文件为什么留下或被丢。

留下的文件先做一次分组。这次调用只发路径、状态和增删行数，不发 diff 正文，让模型把相关文件捆在一起。一组最多 10 个文件。分组失败就退回一个文件一组。

每个组是一个子 agent，默认并发 8，上下文互不共享。变更够大才先做 plan：组内单文件变更达到 50 行，或者至少两个文件且合计达到 100 行。plan 不能调工具，只产出一份清单。小 diff 跳过这一步，省一次调用。

真正写评论的是 main 循环。`--effort` 决定轮数：`low` 1 轮，`medium` 2 轮，默认就是 medium，`high` 3 轮。工具调用上限默认 100。文档列出的工具是六个：`code_search`、`file_read_diff`、`file_find`、`file_read`、`code_comment`、`task_done`。提示词预算默认 20 万 token，到 60% 开始后台压缩，到 80% 必须先压缩再请求。输出另有 16384 token 的上限，把 `--max-tokens` 调高不会把输出预算一起放大。`ocr scan` 扫整文件时用更小的 58888。

评论落点不靠模型报一个行号就算数。`code_comment` 要给出 `existing_code`，工程再用滑动窗口去 diff 里对。对不上就跑重新定位。循环结束后还有一次 `REVIEW_FILTER_TASK`，去掉能证明是错的评论。仍然对不上的评论不会被扔掉，`start_line` 和 `end_line` 记为 0，表示没锚上。

跨文件推理停在组边界。同组文件共享一轮对话，可以直接一起看。其他组只能通过工具去读，不能当成评论目标。架构文档写明，模型应把上下文工具用于理解，并忽略给定 diff 之外冒出来的问题。大 PR 因此不会变成一次无限上下文的闲聊。代价也直接：跨模块的问题更容易漏。README 把低召回说成有意取舍，和这条边界是同一件事。

会话以 JSONL 写在 `~/.opencodereview/sessions/`。`ocr viewer` 读这些文件回放，没有单独的数据库。

## 规则是提示词，不是扫描器

规则按四层匹配，先命中先生效：命令行 `--rule`，仓库里的 `.opencodereview/rule.json`，用户目录的 `~/.opencodereview/rule.json`，最后是打进二进制的 `system_rules.json`。系统层按路径挂不同的规则文档。Java 走 `java.md`，Go 走 `go.md`，TypeScript 和 JavaScript 走同一份，MyBatis 风格的 mapper XML 另有一份。不认识的扩展名落到 `default.md`，除非 `include` 把它放进来。`ocr rules check <path>` 会告诉你命中的是哪一层、哪条 glob。

仓库简介里的 NPE、线程安全、XSS 和 SQL 注入，能在规则正文里对上，但它们不是静态分析规则。我看的是 main 分支上的 `rule_docs`：

Java 规则要求检查可能的 NPE，并让模型用 `file_read` 和 `code_search` 看调用链。线程安全只在有证据时报，局部变量、只读操作、看不到多线程调用的代码，明确要求别报。Go 规则写了 goroutine 捕获请求内可变数据、资源没关闭、SQL 或命令由不可信输入拼接。JS/TS 规则写了 XSS、`innerHTML` 插入用户输入，以及 `eval` 和 `Function`。mapper XML 规则把 `${}` 拼接用户参数标成注入风险，同时说上下文不清时宁可忽略，不要误报。Python 和 PHP 也有参数化查询、字符串拼 SQL 的条款。

这套规则的作用是收窄注意力，不是保证找出漏洞。它反复要求模型在证据不足时不要报。这和内部“误报率不到 5%”的说法方向一致，也解释了召回为什么上不去：少报错的，就会放过一些真问题。

语言覆盖很宽，从 Java、Go、Python、PHP、Rust、C/C++、Kotlin 到 Solidity、Terraform、Rego。宽不等于每份规则一样深。main 分支上的 `go.md` 有一万多个字符，`java.md` 只有三千多，而且两份都是英文规则。支持某种扩展名，不等于对这种语言有同等的审查深度。

## 基准先看取舍

README 的基准叫 AACR-Bench，数据集在 [Hugging Face](https://huggingface.co/datasets/Alibaba-Aone/aacr-bench)。项目说它来自 50 个热门开源仓库、200 个真实 PR、10 种语言，由 80 多位资深工程师交叉标注，共 1505 个缺陷。对照物是同一个底层模型上的通用 Agent，文中点名 Claude Code。结论是 Precision 和 F1 更高，token 大约是对方的 1/9，审查更快，召回更低。

具体百分比在官网图片里。我没有从图片抄数字，所以这里不报分数。实验设计比“我们觉得更好”认真，但它仍是项目自己的基准。仓库怎么选、缺陷怎么定义、Claude Code 挂了什么 Skill，都会改结论。低召回如果正好漏掉你在意的那类问题，省下的 token 就不算赚到。

## 用的时候要接受什么

安装最直接的方式是 `npm install -g @alibaba-group/open-code-review`。NPM 包装出来的命令是 `ocr`，release 里的静态二进制叫 `opencodereview`。默认模式要自己配模型，兼容 OpenAI 风格和 Anthropic 风格的端点。委托模式不需要给 OCR 单独配 key：它负责选文件、解析规则、收集 diff，宿主 Agent 用自己的模型和订阅额度跑审查。插件覆盖 Claude Code、Codex、Cursor、Kimi Code 和 OpenCode。仓库里还有 VS Code 扩展和 IntelliJ 插件，后者是 CLI 的图形前端，不是另一套审查引擎。CI 示例包括 GitHub Actions、GitLab CI、Gerrit。

有几条限制比安装步骤重要。

diff 会发到你配置的模型端点。会话和规则留在本地。遥测文档写明，prompt 和响应内容不会导出；`content_logging` 接进了配置，但目前不控制任何代码路径。没有内置脱敏。含密钥的文件得自己放进 `exclude`，或者别让它进入 diff。

模型必须支持原生 tool call。FAQ 把 `deepseek-r1` 当成反例：它如果只在文本里叙述“我要调用某工具”，OCR 会一直重试，最后零评论。换一个会返回结构化 `tool_calls` 的模型，比改提示词有用。

子任务失败被隔离，不重试。只要还有成功的组，进程仍以 0 退出。CI 如果只看退出码，会把部分失败当成通过。要看 JSON 里的 `warnings`，或者文本模式的 stderr。

默认不审测试，大文件会跳过，跨组问题不作为评论目标，召回又被主动往下压。四件事叠在一起，“没报问题”不能读成“这段改动没问题”。OCR 也不做无人值守的自动修复。IDE 插件可以让人逐条应用、忽略或标误报，那是人点的。

它不支持 Git 以外的版本库。diff provider 就是调 `git`。

如果你已经有编程 Agent，烦的是审查漏文件、评论对不上行，或者希望规则待在仓库里而不是散落在某段 Skill 提示词里，这个工具对得上。如果你要的是一次审查代替安全审计，它的设计目标就不是这个。
