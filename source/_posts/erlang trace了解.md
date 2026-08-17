---
title: Erlang Trace 机制介绍
date: 2022-04-13 16:15:25
categories:
  - Erlang
tags:
  - Erlang
  - Trace
  - 调试
  - OTP
  - redbug
description: 介绍 Erlang 的 trace 机制，以及 sys、dbg、redbug 等常见追踪工具的适用场景。
---
erlang trace机制提供了一套消息发送接收、函数调用、垃圾收集、端口开闭的追踪方法


现在Erlang用于Trace的库有：



sys 是一个标准的OTP， 可以允许自 定义trace函数， 记录所有类型的事件等等。 它非常完善且可以很好地用于开发。 但它会稍微影响处于生产 环境的系统， 因为它没有把IO重定向到远程的shell中， 而且他没有限制trace消息的速度。 不过还是推荐阅读其文档模块。
dbg 也是一个标准的OTP。 它的接口在可用性方面显得有点笨拙。 但它完全足以满足你所需。 问 题在于： 你必须要知道你要做什么,因为 dbg可以记录一切， 并在2秒内把系统搞崩溃。
tracing BIFs作为一个Erang的模块可用。 它们大多作为原始块(the raw blocks)由这个列表中提到的application所调用,但由于他们处于较底层， 比较抽象， 用起来也非常困难。
redbug 是可以在正式的生产 运行系统中使用的trace库， 是eper 的一部分， 它内部有一个速度限制开关， 和一个不错的可用接口。 为了使用它， 你必须把eper的所有依赖项都加上。 这个工具箱非常全面， 你会体验到一次非常有趣的安装。
recon_trace 是recon中负 责trace的模块。 目的是和redbug有相同的安全水平,但却不要这么多的依赖项。 接口也不一样， 速度限制选项并不完全相同。 它可以只trace指定的函数调用， 没有trace send/recv message （实际在使用OTP的application里面根本没有必要支持trace message这种机制）

#### 1. redbug的使用

[项目地址](https://github.com/massemanet/redbug)


基于erlang trace机制实现的，跟踪函数调用并输出的方法库



```text
% 监听模块函数
redbug:start("Module:Func").
% 监听模块函数并打印结果
redbug:start("Module:Func->return").
% 监听模块函数并打印调用堆栈
redbug:start("Module:Func->stack").

监听格式  when  ->
MFA = Mod | Mod:Fun | Mod:Fun/Arity | Mod:Fun(_, atom, X)
guard = is_atom(X) | X == 1
action = return | stack | return;stack
```



第二参数选项






参数
默认
释义



msgs
10
条数


time
15000
持续时间


procs
all
all 或 指定的pid列表


records
[]
模块名列表，从其取出record


print_file
“”
打印输出文件，默认为standard_io(屏幕)


print_mesc
false
显示时间精确到毫秒否


print_return
true
显示返回值否


print_fun
‘’
自定义显示函数


arity
false
true:显示参数个数 false:显示参数详细



#### 2. recon_trace的使用

以安全的方式监听单个erlang节点的函数调用，会创建一个进程去收集信息并处理



```text
recon_trace:calls(TSpecs::tspec() | [tspec(), ...], Max::max(), Opts::options()) -> num_matches()

recon_trace:call({dev, online, '_'}, 100, []).
% 带返回结果
recon_trace:call({dev, online,  return_trace}, 100, []).
% 自定义输出打印 A = {trace, Pid, call, {M, F, A}}
recon_trace:call({dev, online, '_'}, 100, [{formatter, fun(A)-> io_lib:format("", [A]) end}]).
```







参数
默认
释义



scope
global
local:跟踪包括本地调用 global:只限mfa的调用


formatter
recon_trace:format/1
自定义消息打印格式


pid
all
指定监听的进程，all=所有 new=开始监听后创建的


io_server
“”
指定输出的文件，为空时则为当前的shell


args
args
args=显示详细参数 arity=显示参数个数



[文档](http://ferd.github.io/recon/recon_trace.html#type-args)


#### 3. 用途

线上环境加输出打印不易，可以用recon_trace做动态输出打印
