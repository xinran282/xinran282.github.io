---
title: 从源码看 Erlang/OTP 27 的 GC：进程、消息和二进制引用
date: 2026-08-13 10:20:00
categories:
  - Erlang
tags:
  - Erlang/OTP
  - BEAM
  - 垃圾回收
  - 内存管理
  - 二进制
description: 面向初学者的 Erlang/OTP 27 GC 介绍，从进程堆讲到消息队列、off-heap binary 和排查方法。
---

# 从源码看 Erlang/OTP 27 的 GC：进程、消息和二进制引用

理解 Erlang 的 GC，最好先忘掉“整个虚拟机一起停下来大扫除”的画面。BEAM 的思路更局部：每个 Erlang 进程有自己的堆，GC 也主要围绕单个进程展开。一个进程产生了临时列表、元组、闭包、消息里的数据，空间紧了，就整理自己的那一小块内存。

这也是 Erlang 能支撑大量并发进程的原因之一。GC 不需要动不动扫描全局对象图，大多数时候只处理某个进程自己的堆和它挂着的 off-heap 引用。

## 先看进程这张“内存账本”

GC 的第一现场在 `erts/emulator/beam/erl_process.h`。这里的 `Process` 结构里有几组很关键的字段：

```c
Uint16 gen_gcs;
Uint16 max_gen_gcs;
Eterm *high_water;
Eterm *old_hend;
Eterm *old_htop;
Eterm *old_heap;
ErlOffHeap off_heap;
ErlHeapFragment* mbuf;
Uint64 bin_vheap_sz;
Uint64 bin_old_vheap_sz;
Uint64 bin_old_vheap;
```

粗略说，`heap` 是年轻对象待的地方，`old_heap` 是活得久的对象待的地方，`off_heap` 记录那些不直接放进普通进程堆的对象，比如较大的引用计数 binary。`gen_gcs` 和 `max_gen_gcs` 则决定一个进程做了多少次小回收后，该不该来一次更彻底的 fullsweep。

把这几个字段看懂，再读 `erl_gc.c` 会轻松很多。否则你会觉得源码一直在搬指针，其实它是在围着这些边界整理房间。

## GC 什么时候发生

触发判断在 `erts/emulator/beam/erl_gc.h` 里能看到。核心条件并不神秘：

- 进程堆剩余空间不够；
- off-heap binary 的虚拟堆压力超过阈值；
- 进程被设置了强制 GC 标记。

JIT 和解释执行路径都会在合适的分配点插入检查。比如 `erts/emulator/beam/jit/beam_jit_common.cpp` 里会调用 `erts_garbage_collect_nobump()`，BIF 返回后也可能通过 `erts_gc_after_bif_call_lhf()` 补一次检查。

这不是“定时打扫”，更像“每次要继续放东西之前，先看桌面还够不够”。

## minor GC：先清年轻代

主入口在 `erts/emulator/beam/erl_gc.c` 的 `garbage_collect()`。它先判断进程状态：如果进程正在退出，或者 GC 被 BIF 临时禁止，就会走延迟路径。状态允许时，再根据 `GEN_GCS(p) < MAX_GEN_GCS(p)` 这样的条件选择 minor GC 或 major GC。

minor GC 对应 `minor_collection()`。它的目标很明确：尽量只处理年轻代。

Erlang 程序里大量对象都很短命。一次函数调用里临时构造的列表、匹配时产生的中间值、很快就不用的元组，多数撑不过几次调度。minor GC 利用这个事实，只复制还活着的对象，把不再被栈、寄存器、消息或其他根引用到的对象留在原地，整块旧空间随后就可以丢掉。

这就是复制式 GC 的好处：它不需要逐个释放死对象，而是搬走活对象。

## major GC：连老年代一起整理

minor GC 做多了，或者进程带着 `F_NEED_FULLSWEEP` 之类的标记，就会进入 `major_collection()`。

major GC 会把年轻代和老年代一起纳入整理。它成本更高，但能处理老年代里累积下来的长期对象，也能重新计算堆大小、释放不再需要的旧堆。

可以这样记：

- minor GC 是收拾桌面；
- major GC 是重新整理整个房间。

BEAM 不会轻易做 major GC，因为大多数场景用 minor GC 就够了。但长期运行的 server 进程、缓存进程、消息堆积的进程，迟早会把老年代也卷进来。

## 消息队列为什么会影响 GC

Erlang 的并发靠消息传递。消息不是凭空存在的，它要进入接收进程的信号队列。源码注释在 `erts/emulator/beam/erl_proc_sig_queue.h` 里把队列分成三层：外部队列、中间队列、内部队列。

外部队列表示消息还在路上；中间队列表示消息已经到达接收进程；内部队列才是 `receive` 真正可以匹配的消息。

这和 GC 有直接关系。消息如果存在进程堆上，GC 要扫描它；消息如果带着 off-heap binary，GC 还要维护外部引用。消息越多，进程越容易触发 GC，单次 GC 要看的东西也越多。

Erlang 进程还可以选择消息队列数据放在 on-heap 还是 off-heap。相关标志在 `erl_process.h` 里：

```c
#define FS_OFF_HEAP_MSGQ       (1 << 0)
#define FS_ON_HEAP_MSGQ        (1 << 1)
```

on-heap 消息队列让消息更贴近进程堆，访问可能更直接，但 GC 压力也更明显。off-heap 消息队列能减少某些大消息对进程堆的冲击，不过它不是万能开关，还是要看进程的消息形态。

## 二进制为什么常常放在 off-heap

普通小对象复制起来便宜，大 binary 不一样。如果每次 GC 都复制一个几 MB 的 binary，成本会很难看。BEAM 的做法是：较大的 binary 通常作为引用计数对象放在进程堆外，进程堆里只保留一个引用。

`erts/emulator/beam/erl_binary.h` 里的 `Binary` 结构有 `refc` 字段；`erl_gc.c` 里的 `sweep_off_heap()` 会处理 `BIN_REF_SUBTAG`，根据对象是否仍然活着维护引用计数和虚拟 binary heap 统计。

这带来一个非常实用的结论：进程堆看起来不大，不代表这个进程没有拖住大块 binary 内存。

## 小切片拖住大 binary

最容易让人误判为“内存泄漏”的情况，是 sub-binary。

假设你读入一个 10 MB 的包，只取里面 20 字节作为 ID，然后把这个 ID 长期放进进程状态。如果这个 20 字节值仍然引用原始 binary，而不是复制出来的新 binary，那么那块 10 MB 的原始数据就不能释放。

可以用一张图理解：

```text
10 MB 原始 binary
        |
        v
切出 20 字节 sub-binary
        |
        v
保存到进程状态 / ETS / 消息队列
        |
        v
20 字节还活着，10 MB 也被拖住
```

这通常不是 VM 泄漏。它只是引用还活着。问题在于，业务代码以为自己只保存了 20 字节，运行时却必须保留背后的整块 binary。

## 怎么检测这种情况

先看系统级趋势：

```erlang
erlang:memory(binary).
```

如果这个值持续上涨，再去找进程。OTP 自带：

```erlang
process_info(Pid, binary).
```

它会返回该进程相关 binary 的信息。当前实现里包含 binary 标识、大小和引用计数。这个接口适合定位“哪个进程挂着大 binary”。

如果线上已经装了 recon，更方便：

```erlang
recon:bin_leak(10).
recon:info(Pid, binary_memory).
recon_alloc:memory(allocated_types).
```

`recon:bin_leak/1` 会做一轮前后对比，帮你找最可疑的进程。`recon_alloc` 则能看分配器层面是不是 `binary_alloc` 在涨。

定位到具体 binary 后，再比较它自身大小和引用的底层大小：

```erlang
byte_size(Bin).
binary:referenced_byte_size(Bin).
```

`lib/stdlib/src/binary.erl` 的文档也给了类似建议：如果 `referenced_byte_size(Bin)` 明显大于 `byte_size(Bin)`，而这个小 binary 又要长期保存，可以考虑 `binary:copy(Bin)`。

一个保守写法是：

```erlang
maybe_copy(Bin) when is_binary(Bin) ->
    case binary:referenced_byte_size(Bin) > 2 * byte_size(Bin) of
        true -> binary:copy(Bin);
        false -> Bin
    end.
```

不要到处无脑复制。binary 共享本来是性能优化，只有在“小切片长期拖住大 binary”已经成为实际问题时，复制才是合理选择。

## 读源码的顺序

如果你想继续读 Erlang/OTP 27 的 GC 源码，可以按这个顺序来：

1. `erts/emulator/beam/erl_process.h`：先看进程的堆、老年代和 off-heap 字段。
2. `erts/emulator/beam/erl_gc.h`：看 GC 触发宏。
3. `erts/emulator/beam/erl_gc.c`：读 `garbage_collect()`、`minor_collection()`、`major_collection()`。
4. `erts/emulator/beam/erl_proc_sig_queue.h`：理解消息怎样进入进程。
5. `erts/emulator/beam/erl_binary.h` 和 `erl_gc.c` 的 `sweep_off_heap()`：看 refc binary 的生命周期。

这样读，比从 `erl_gc.c` 第一行硬啃到最后有效得多。

## 最后总结

Erlang/OTP 27 的 GC 可以概括成一句话：每个进程管理自己的堆，用 minor GC 快速清理短命对象，用 major GC 偶尔整理老年代，再通过 off-heap 和引用计数处理大 binary。

这套设计很符合 Erlang 的并发模型。进程轻，消息多，短命数据多，大 binary 又常常需要跨进程共享。GC 的很多细节，都是围绕这些现实权衡展开的。

真正排查内存问题时，也别只问“GC 有没有工作”。更有用的问题是：哪个进程持有了什么？消息队列是不是堆积？有没有一个很小的 sub-binary，悄悄拖住了一整块大 binary？
