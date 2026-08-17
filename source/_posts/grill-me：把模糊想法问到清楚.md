---
title: grill-me：把模糊想法问到清楚
date: 2026-08-11 16:24:00
categories:
  - AI 工具
tags:
  - grill-me
  - 需求分析
  - 提示词
  - 智能体
description: 介绍 mattpocock/skills 中的 grill-me 技能，以及它和 grilling、grill-with-docs 的关系。
---

# grill-me：把模糊想法问到清楚

`grill-me` 做的事很单纯：让智能体持续追问你的计划或设计，直到关键决策不再含糊。它适合用在动手之前，尤其是你已经有一个方向，但还说不清边界、取舍和下一步的时候。

这个技能来自 [mattpocock/skills](https://github.com/mattpocock/skills)。从公开说明看，`grill-me` 本身很薄，它的 `SKILL.md` 基本只是让智能体运行一场 `/grilling` 会话。真正的工作方式写在 [grilling 文档](https://github.com/mattpocock/skills/blob/main/docs/productivity/grilling.md)里。

## 它解决什么问题

很多计划在刚开始时看起来已经够清楚了，但一问到具体选择，就会露出空白。

比如：

- 这个功能先服务哪一类用户？
- 哪些行为必须现在支持，哪些可以以后再说？
- 成功标准是什么？
- 如果两个目标冲突，优先保哪一个？

普通的助手很容易直接给方案。`grill-me` 的价值正好相反：它先不急着替你执行，而是把计划里的未定项逐个挑出来。它按照决策之间的依赖关系追问，一次只问一个问题，并且会给出它推荐的答案，让你可以确认、反驳或改写。

这比一次性扔出十几个问题更有用。前一个答案会改变后一个问题，访谈才会收敛。

## 它怎么工作

`grill-me` 背后的核心模型是“决策树”。一个计划不是一段线性的待办清单，而是一组互相影响的选择。先选目标用户，才知道交互要偏简单还是偏可配置；先选数据来源，才知道验证逻辑要放在哪里；先选发布范围，才知道测试应该覆盖到什么程度。

所以它会沿着这棵树往下走：

1. 找出当前最影响后续判断的问题。
2. 只问这一个问题。
3. 同时给出推荐答案，逼近一个可执行的判断。
4. 根据你的回答继续追问下一层。
5. 等双方对计划的理解一致后，再停下来。

如果问题可以通过代码库或已有资料回答，`grilling` 的设计倾向是让智能体自己去查，而不是把所有不确定性都丢回给你。也就是说，它追问的是需要人类判断的取舍，不是让你替它做检索。

## 什么时候用 grill-me

用 `grill-me` 的好时机，是你还不想写正式 spec，但已经有一个值得打磨的想法。

它尤其适合这些场景：

- 产品功能：你知道要做什么，但还没想清 MVP 范围。
- 架构调整：你有一个方向，但担心隐藏的迁移成本。
- 写作或课程设计：你有主题，但结构和受众还没定。
- 个人决策：你有几个选项，需要把判断标准说清楚。

如果你的目标只是“帮我想几个点子”，它可能显得太用力。它更像一次严肃的预演：真正开始之前，先把会绊倒你的问题拿到桌面上。

## 和 grill-with-docs 的区别

`grill-me` 是轻量入口。它负责访谈，不强调留下长期文档。

[`grill-with-docs`](https://github.com/mattpocock/skills/blob/main/docs/engineering/grill-with-docs.md) 则适合已有代码库的工程场景。它同样运行 `/grilling`，但会把已经澄清的术语写进 `CONTEXT.md`，把难以逆转、需要记录背景的决策写成 ADR。

简单说：

- 只想被追问，把想法磨清楚：用 `grill-me`。
- 想在追问过程中顺手沉淀项目词汇和架构决策：用 `grill-with-docs`。
- 想直接使用底层访谈机制：用 `grilling`。

这三个名字看起来接近，但定位并不一样。`grilling` 是访谈技术本身；`grill-me` 是最直接的用户入口；`grill-with-docs` 是带文档副作用的工程版。

## 怎么安装和调用

公开的 [skills.sh 页面](https://www.skills.sh/mattpocock/skills/grill-me)给出的安装方式是：

```bash
npx skills add https://github.com/mattpocock/skills --skill grill-me
```

安装后，在支持技能调用的智能体里使用 `/grill-me`，再贴上你的计划或设计草案即可。草案不需要完美，但要有足够的起点。比如：

```text
/grill-me

我想做一个面向独立开发者的轻量项目管理工具。核心是把需求、任务和发布节奏串起来，但我还没想清楚第一版应该多小。
```

好的输入通常包含三类信息：你想达成什么、已经确定了什么、最不确定的地方在哪里。剩下的部分，可以交给它追问。

## 它真正有用的地方

`grill-me` 的重点不是“问得狠”，而是问得有顺序。它不靠压力制造清晰，而是把互相依赖的选择拆开，让你一次只处理一个判断。

这对人很友好。很多模糊不是因为懒，而是因为脑子里同时挂着太多分支。`grill-me` 把这些分支排队，让决策有一个可以走下去的路径。

我会把它看成一种计划前的校准工具。它不会替你拥有判断，但会逼你发现自己到底在判断什么。对复杂一点的功能、架构和产品方向来说，这通常比立刻写代码更省时间。

## 资料来源

- [mattpocock/skills GitHub 仓库](https://github.com/mattpocock/skills)
- [grill-me 页面](https://www.skills.sh/mattpocock/skills/grill-me)
- [grilling 文档](https://github.com/mattpocock/skills/blob/main/docs/productivity/grilling.md)
- [grill-with-docs 文档](https://github.com/mattpocock/skills/blob/main/docs/engineering/grill-with-docs.md)
