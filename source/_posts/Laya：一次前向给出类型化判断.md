---
title: Laya：一次前向给出类型化判断
date: 2026-09-23 17:04:36
categories:
  - 工具
tags:
  - Laya
  - System 1
  - 决策模型
  - Jev
  - ModernBERT
---

Laya 是一个非自回归的 System 1 决策引擎。你给它一段状态（邮件、工单、JSON、纯文本）和一组类型化问题，它做一次前向，返回 `choice`、`score` 或 `noul`（是否），不生成句子。仓库是 [NandhaKishorM/laya](https://github.com/NandhaKishorM/laya)，Apache 2.0，Convai Innovations 做的。权重在 [Hugging Face](https://huggingface.co/convaiinnovations/laya)。

到 2026 年 9 月 23 日，这个 9 月 18 日才公开的 Python 仓库大约 1.8 万 Star。宣传数字是 T4 上一问 33 ms，批量大约 7.2 ms/问。数字来自作者自己的测量，可以当数量级，不必当成你机器上的保证。

它想替代的，是「让大模型写一段 JSON，再自己解析」这条路。解析会失败，模型会编。Laya 的输出本来就是标签、分数和概率。

## 它回答哪三类问题

| 原语 | 返回什么 | 典型用途 |
|---|---|---|
| `choice` | 选中的标签、每项概率、置信度 | 工单分部门、意图分类 |
| `score` | 有序量表上的期望档位、分布、置信度 | 紧急程度、受挫程度 |
| `noul` | 校准过的 P(true)，0 到 1 | 是否退款、是否要流失、是否越狱 |

一次调用可以塞多道题，共用同一次前向。README 的客服例子里，同一封「三月收了两次费，今天退款否则取消」的邮件，同时问部门、紧急度、流失风险、是否明确要求退款。

作者说训练用了 RLCD：按严格真评分规则做强化学习。因此他们主张置信度可以拿来做门槛，高置信度自动处理，低的转人工。这是训练目标上的说法。后面会写到，出厂权重本身过自信，要用温度校准；`action.act_probability` 目前几乎不能用。

## 三个 checkpoint，加一个 Router

| 名称 | 编码器 | 参数量 | 上下文 | 用途 |
|---|---|---|---|---|
| `laya` | ModernBERT-large | 421M | 512 | 英文 |
| `laya-multilingual` | mmBERT-base | 322M | 1024 | 100 多种语言，更快 |
| `laya-typed-decisions` | ModernBERT-large | 421M | 1024 | 类型化决策工作流微调版 |

推荐入口是 `Router`。它先用纯 Python 做脚本和语言探测（作者写小于 0.5 ms），再决定走英文还是多语言模型。探测发生在前向之前。原因写在基准里：英文 checkpoint 在高棉语上准确率 0.000，置信度却是 0.952。错了还很笃定，靠模型自己的置信度挡不住。

路由证据（同一套问题，一块 T4，17416 题）：

- MASSIVE 意图，英文：`laya` 0.783，多语言 0.657，Router 跟英文走 0.783
- MASSIVE 意图，另外 13 种语言：英文 0.306，多语言 0.451，Router 跟多语言
- XNLI 非英文 14 种语言：英文 0.521，多语言 0.731
- 51 种语言里，高于 3 倍随机的：英文 23/51，多语言和 Router 都是 45/51

短拉丁文本经常看不出语种，比如 `Quero cancelar`。默认会进英文。流量主要不是英文时，设 `Router(default="multilingual")`。0.3.7 还修了被邮件客户端扒掉口音的西语、意语、葡语、法语，以及巴西葡语，让它们能进多语言模型。内置探测是无依赖的启发式，不准可以自己塞 `lang_guess`，接 fastText 或别的 LID。

生产环境别每次冷加载。作者测过：`max_loaded=1` 时语言一切换，CPU 中位重载 7.4 秒，T4 上 10.3 秒。默认 `Router()` 常驻英文和多语言两个；`Router(preload=True)` 三个都放内存，之后语言切换只付探测成本。预加载后他们报的延迟是 GPU 32.8 ms，CPU 193–464 ms。

## 和 Jev 比，数字怎么读

TypeSafe 的 Jev 是同类产品：类型化判断，走 System One API。Laya 的 HTTP 服务 `laya-serve` 故意兼容 `POST /v1/systemone`，现有 Jev 客户端改 `baseUrl` 就能打过来。impossibl 上也有免费托管，同样这套协议。

README 里有一张「Laya（经 Router）对 Jev」表。Laya 数字是作者自己测的；Jev 数字来自第三方已发表结果，作者写明没有 TypeSafe API 权限，样本和提示并不相同。当作方向，不要当成同一次对照实验。

作者列出的差异大致是：

- typed-decisions 2000 条：Jev 0.727，Laya 0.766
- AG News：0.910 对 0.950
- DAIR Emotion：0.480 对 0.595；Jev 有 16% 样本给真标签的概率是 0
- Banking77：Jev 0.870（72 类），Laya 默认 0.425（77 类）
- ECE（越低越好，Laya 是温度校准后）：0.246 对 0.081
- 单问 p50 延迟：Jev 第三方测到 236–276 ms，Laya 自测 32.8 ms
- 权重：Jev 闭源 API，Laya Apache 2.0，自托管按他们的算法是 $0

Jev 仍强的地方，作者自己写了。选项超过大约 20 个时，Laya 把选项挤进固定的 `head_max_len`（英文默认 192，多语言 256）。77 个标签大约每个只分到 3 到 4 个 token，字面值会糊在一起。Jev 开箱能到 255 个选项。软分布匹配上 Jev 也更好（soft accuracy 0.580 对 0.471）。出厂未校准的 ECE，Laya 原始值并不更好，0.081 是拟合温度之后的数。

typed-decisions 那 0.766 来自专门微调的 `laya-typed-decisions`。两个基座在同一套基准上是 0.362 和 0.342，低于多数类基线 0.461，只略高于随机 0.318。作者原话：Laya 是一个很快的、用来特化的基座，不是开箱即用的零样本决策引擎。能力主要来自微调。

## 用之前先看限制

这些是仓库自己写的，不是外人挑刺。

选项很多时，加大 `head_max_len` / `max_len`，或者用 `predict_shortlist` 先按向量召回 top k 再打一次前向。Issue #102 有人报告 Banking77 短名单从 54.3% 到 60.8%，仓库没有复测。

`score` 是最弱的原语。SST-5 上英文 checkpoint 0.372。多语言模型在 `score` 上有位置偏差，很少选列表里第一档（#131）。英文分数题应指定 `model="english"`。

英文 checkpoint 的 `noul` 可能跟着 `false:` / `true:` 这两个选项词走，而不是跟着正文走（#156）。正例也会给出很自信的「否」。未换权重之前，用自己的数据检查；不行就改成两个中性 key 的 `choice`。

`action.act_probability` 几乎恒为 1.0，在 396 条标注上 AUROC 0.30，和正确性反着来（#185）。门控用 `confidence`，同一批 AUROC 0.77。

两个基座出厂都过自信。按题型和选项数在留出数据上重拟合温度后，平均 ECE 从 0.466 降到 0.081（英文），多语言从 0.314 到 0.106。多语言权重不带拟合温度，要用概率就自己拟合。加载时温度会被夹到 `[0.5, 5.0]`，非法值回退到 1.0，这只是避免加载失败，不代表已经校准。

0.3.7 把 `laya.load()` 在 CPU 上从大约 22 秒降到大约 2 秒，并绕开了 Windows + Python 3.14 的崩溃（#123）。微调笔记本的校准改到留出切片上拟合（#186）。

## 微调才是正路

Kaggle 免费 2xT4 上有完整笔记本：造数据、RLCD 训练、拟合温度、评估、推 Hub。大约 4 到 5 小时，4 个 epoch，约 3 万题。

一份完整特化记录在 `docs/finetune_browser_agent.md`：在 16 GB 单卡、不调用付费 API 的情况下，把 Laya 做成 [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast) 的操作/目标决策头。约 45 个候选元素的 top-1 从零样本 0.10 到 0.66，真实任务成功率从 0% 到 62%，每步 17–23 ms。权重在 [cklxx/laya-browser](https://huggingface.co/cklxx/laya-browser)。

仓库还带几套现成问题模板：小模型/前沿模型路由、提示词护栏、内容审核、工单分诊。那是起点，不是替你完成领域适配。

## 怎么跑

Python 3.10+（`huggingface_hub` 1.x、`transformers` 5.x、`torch` 2.14 都卡在这）。

```bash
python -m pip install laya
```

```python
from laya import Router
router = Router(preload=True)
res = router.predict(state, questions)
```

只跑一个权重时用 `laya.load("convaiinnovations/laya")`，多语言和 typed-decisions 走对应 `subfolder`。空问题字典会直接返回空答案，不做分词和前向。

自托管：

```bash
pip install "laya[serve]"
LAYA_DEVICE=cuda LAYA_PRELOAD=1 laya-serve
```

默认 `0.0.0.0:8000`。环境变量可配设备、预加载列表、CPU 线程上限、可选 Bearer。仓库是 Nix flake，也有 NixOS 模块。Docker 说明在 `docs/docker.md`。

不想管 GPU 可以用 [impossibl](https://impossibl.com) 的免费托管。`convaiinnovations/laya` 走 Router；`convaiinnovations/laya-multilingual` 钉死多语言权重。托管侧 `max_len` 写的是 8192。注意：按脚本路由时，拉丁字母文本会进英文 checkpoint，西语葡语不会自己跑到多语言权重，所以才单独给了第二个 model id。

在线试：[HF Space](https://huggingface.co/spaces/convaiinnovations/laya-demo)。作者在 [Dev.to](https://dev.to/nandakishor_m_6cc0adfde9f/i-built-non-autoregressive-decision-models-a-year-ago-then-a-frontier-lab-called-it-a-18me) 写过来龙去脉。社区有 [omp-laya-judge](https://github.com/F0Rextasy/omp-laya-judge)（oh-my-pi 插件）和 [laya-adk-toolkit](https://github.com/Ashfaqbs/laya-adk-toolkit)（Google ADK 工具）。

## 结论

Laya 把「分类 / 打分 / 是否」从文本生成里拆出来，用编码器一次前向给出带概率的结构化答案。Router 解决了英文权重在非拉丁文字上又错又自信的问题。协议上能接 Jev 那一类 System One 客户端。

它不是通用零样本裁判。基座在 typed-decisions 上接近随机；选项一多、`score`、英文 `noul` 都有已知坑。置信度要校准，`act_probability` 先别用。你有稳定的判断模式、愿意微调、还在意毫秒级延迟和可自托管，它值得试。你只是偶尔让 LLM 抽几个字段，上 Laya 多半是在给自己加一套训练和校准负担。