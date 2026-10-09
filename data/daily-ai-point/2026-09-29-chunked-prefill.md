# 今日知识点：分块预填充与流式批处理：把长请求切成可插入的小任务

> 一句话：切分长 prompt 的预填充计算，让解码请求及时加入批处理。

**分类**：工程与产品　**难度**：4　**资料截至**：2024-03-04

## 它解决什么问题

大模型推理常分两个阶段：prefill 一次性处理输入 prompt 并生成 KV cache，计算量大但可高度并行；decode 逐 token 输出，每步计算少且更依赖访存。连续批处理虽提升了整体吞吐，但当一条超长 prompt 进入 prefill 时，可能长时间占住 batch 槽位，导致已在线生成的请求无法及时 decode，用户看到的流式输出突然停顿。分块预填充（chunked prefill）把长 prompt 切成多个小块，让系统在块与块之间插入其他请求的 decode，从而缓解“长输入阻塞短请求”的延迟问题。

## 工作机制

1. 为每个推理 step 设置 token budget，例如该步最多计算多少输入 token 与输出 token。
2. 将长 prompt 的 prefill 拆成多个 chunk；每个 step 只处理一个或部分 chunk。
3. 同一 step 的剩余预算留给已在生成阶段的请求，执行它们的 decode。
4. 请求完成 prefill 后进入 decode；新请求的后续 chunk 可继续排队。
5. 调度器根据延迟目标（TTFT、TBT/ITL）和吞吐目标调整 chunk 大小、batch 组成与请求顺序。

这样，长请求仍需累计完成全部 prefill 才能开始输出，但它的计算被摊到多个 step，不再形成一次超长独占计算；短请求的 decode 也能持续流动。

## 一个具体例子

假设 token budget 为 2048，decode 侧有 32 个请求各需 1 token，共 32。请求 A 的 prompt 为 8192 token，可拆成 4 个 2048 的 chunk；若 chunk 取 2016，则本 step 还能放入 32 个 decode token。示意图：
- step 1：A chunk 1（2016）+ 32 decode；
- step 2：A chunk 2（2016）+ 32 decode；
- step 3：A chunk 3（2016）+ 32 decode；
- step 4：A chunk 4（2144 减去预算差异）+ 32 decode。

数字仅为机制示意，实际系统会按算力、显存、KV cache 与调度目标动态调整。收益是 decode 请求不会等待 8192 token 的整段 prefill 完成，Token 间延迟更平稳；代价是 A 的首 token 延迟可能略增，因为其 prefill 被拉长到多个 step。

## 它和什么容易混淆

- **连续批处理**：连续批处理解决“整批等待、槽位空转”的调度粒度问题；chunked prefill 进一步解决单个长 prefill 阻塞 decode 的问题。
- **prompt cache / KV cache 复用**：缓存复用避免重复计算相同前缀；chunked prefill 改变的是首次计算长 prompt 的调度方式。
- **请求分片/并行 prefill**：把一个请求的 prefill 分布到多设备并行是另一类优化；chunked prefill 通常是在单设备/实例内按时间切片。

## 局限与实践建议

- 首 token 延迟可能上升：prefill 被摊开后，长请求更晚进入输出阶段。
- 调参复杂：chunk 太小降低 prefill 效率，太大仍会阻塞 decode。
- GPU 利用率有权衡：混合计算密集 prefill 与访存密集 decode 可填补空闲算力，但需要精细 kernel 与批组织。
- 尾延迟不等于平均延迟：评估时应同时看 TTFT、TBT/ITL、P95/P99 和吞吐。
- 与缓存、量化、抢占和准入控制交互；部署前应按真实流量分布测试。

## 为什么现在值得关注

Sarathi-Serve 明确提出了 chunked prefill 与响应感知的 token budget 调度，用来平衡 LLM 推理吞吐与交互延迟。随着长上下文、文档问答和多轮 Agent 任务普及，长 prompt 与在线生成混跑会越来越常见，这类调度机制成为推理服务的重要基础。

## 来源

1. [Sarathi-Serve: Taming Throughput-Latency Tradeoff in LLM Inference](https://arxiv.org/abs/2403.02310)（2024-03-04）

## 自测

连续批处理已经允许请求动态加入和退出，为什么一条长 prompt 的 prefill 仍可能让其他请求的流式输出停顿？
