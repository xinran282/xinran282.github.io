# 今日知识点：推测解码——用小模型加速大模型生成

> 一句话：让便宜的草稿模型先猜一串 token，再让目标模型一次性验收；验收规则经过校正后，最终分布与直接用目标模型逐 token 采样一致。

**分类**：推理与效率　**难度**：4/5　**资料截至**：2026-09-02

## 它解决什么问题？

自回归生成通常每次只产生一个 token。目标模型必须反复读取参数和 KV cache，哪怕 GPU 还有算力，也会被串行依赖和访存延迟限制。推测解码适用于“每个 token 都要调用大模型、但附近 token 有较强可预测性”的场景，例如聊天、代码补全和结构化输出。

## 工作机制

设草稿模型分布为 q，目标模型分布为 p。草稿模型先连续生成 γ 个候选 token；目标模型随后并行计算这 γ 个位置的 logits。对第 i 个候选 token，按接受概率

`a_i = min(1, p(token_i) / q(token_i))`

进行验收：随机数小于 a_i 就接受，否则在目标模型的“剩余分布”中重新采样，并停止本轮验收。若 γ 个 token 全部通过，还可额外得到一个目标模型 token。关键在于拒绝时使用校正后的 residual distribution，而不是简单丢弃候选，因此整体输出仍服从 p，而不是草稿模型的近似分布。

## 一个具体例子

草稿模型一次提出 5 个 token，目标模型并行检查。若平均能接受 3.5 个 token，那么一次目标模型前向就能推进约 3.5 个位置；理想加速上限接近“每轮推进 token 数”相对 1 的比例，但实际还要扣除草稿模型耗时、额外 kernel、同步和低 batch 利用率。草稿模型越快、越贴近目标模型，接受率越高，收益越明显。

伪代码可以概括为：

```text
while not finished:
  y = draft_model.generate(prompt, gamma)
  logits = target_model.forward(prompt + y)  # 一次并行验证
  for token, (p, q) in zip(y, logits):
    accept with probability min(1, p[token] / q[token])
    on reject: sample from normalized max(p - q, 0), then break
```

## 它和什么容易混淆？

它不是量化：量化改变数值表示，推测解码改变调用流程；两者可以叠加。它也不是 beam search：beam search 维护多条候选路径，推测解码的目标是保持采样分布并减少目标模型串行调用。与 speculative sampling 的关系是，后者是这类“草稿—验证—校正”方法的具体采样实现。

## 局限与实践建议

推测解码不会减少目标模型参数量；草稿模型不匹配时，低接受率会让额外开销抵消收益。温度较高、强约束解码、超大 batch 或网络服务中频繁排队时，收益可能下降。评估时应同时记录端到端 tokens/s、首 token 延迟、目标模型调用次数、平均接受长度和显存，而不是只测目标模型 kernel。生产环境还要确认随机数、停止词、采样器和 logprobs 的实现与校正公式一致。

## 为什么现在值得关注

这是一种不改变目标模型权重、也不牺牲其理论输出分布的推理优化思路。随着长上下文和 agent 工作流让生成成本上升，“用小模型承担大部分简单预测、让大模型负责验收”已成为可组合的系统设计；但是否加速，仍必须由真实模型对、硬件和流量基准决定。

## 来源

1. [Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192)（论文，2022-11-30）

## 自测

为什么拒绝候选 token 时不能直接从目标模型 p 重新采样？请写出 residual distribution 的直觉，并说明这样做如何保持最终分布不变。
