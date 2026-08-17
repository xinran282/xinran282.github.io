---
title: Erlang 工具介绍
date: 2022-03-13 15:06:47
categories:
  - Erlang
tags:
  - Erlang
  - OTP
  - 调试
  - 监控
  - 崩溃分析
description: 汇总 Erlang 开发和运行维护中常用的监控、调试与崩溃分析工具。
---
#### 1. observer:start()

官方系统监视工具，最强最全，但只能在window下运行，可惜正式部署环境大多为Linux，且不与外界节点联通，导致只能在开发周期使用


#### 2. crashdump_viewer:start()

官方对崩溃日志（erl_crash.dump）的解析工具


#### 3. observer_cli:start()

文字窗口版本的observer


#### 4.  erlangpl

escript ./erlangpl -n Node -c Cookie


网页版系统信息监控，需要能联通监视节点


[项目地址](https://github.com/erlanglab/erlangpl)


#### 5. debugger

debugger:start().



win下界面版断点调试、信息匹配跟踪                
断点单进程比较合适，多进程并发服务器就不怎么适用了                
信息匹配追踪，较难上手，比较适合通过命令方式在正式场景动态追踪问题        

#### 6. dialyzer

静态分析工具，代码错误检查鸡肋工具，会有较多的非错误性输出


#### 7. reltool

todo 发布工具


#### 8. 运行时工具


dbg
 todo 信息追踪                
dyntrace
  todo 信息追踪
erts_alloc_config 内存分配配置


msacc 调度\IO进程利用率查看


scheduler 调度进程


system_infomation 系统信息



#### 9. Syntax_Tool  标签工具


prettypr
 输出美化

#### 10. cover 覆盖分析

```text
% 启动引用
cover:start().
% 编译所要分析的模块
cover:compile_beam(Module).
% 执行测试代码
% 覆盖分析
cover:analyse(Module, coverrage, module | funcation | clause | line) -> {ok,  list()}
% 调用次数分析
cover:analyse(Module, calls, module | funcation | clause | line) -> {ok,  list()}
% 输出到文件
cover:analyse_to_file(Module).
```



#### 11. redbug

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



#### recon

##### recon_trace

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



[文档](http://ferd.github.io/recon/recon_trace.html#type-args)


#### 12. Tool

##### tags

标签，用于生成EMACS的跳转函数，几乎不用，ctags就能支持了，且有更多适合erlang编辑的工具，如eclipse，Idea


##### cprof

一个基于断点的调用次数分析工具，使用时性能相对会下降10%



```text
% 使用流程
cprof:start().          % 开始统计
cprof:pause().         % 暂停统计
cprof:analyse().       % 分析并打印结果
cprof:restart().        % 重新开启统计
cprof:stop().           % 结束统计
```
以上函数都支持0-3参数（analyse除外）
- 0参数 表示监听所有已加载的模块，除了eprof自身
- Mod 监听某个模块
- Mod, Fun 监听某个函数，无论是否有导出
- Mod, Fun, Arty

分析输出数据：
{调用总次数, [{Mod, 模块凑数, [{{Mod, Fun}, 函数次数}]}]}

##### eprof
时间分析工具，基于trace监控指定进程（及其创建的进程）的函数时间消耗，会影响系统性能
```


% 使用流程
eprof:start().                                      % 启动分析进程
eprof:start_profiling(PidL).                     % 开始分析
eprof:stop_profiling().                         % 结束分析
eprof:log(FileName).                           % 分析结果输出到指定文件
eprof:analyze(procs | total [, Opt]).      % 分析输出结果
eprof:stop().                                    % 停止进程



- analyze
    - procs 分析结果按进程分类
    - total 分析结果汇总
    - Opt = [{filter, Filter} | {sort, Sort}]
        - Sort = time | calls | mfa 指定排序的列
        
分析输出数据：
Mod:Fun/Arty  | 调用次数 | 占用百分比 | 总消耗时间 | 每次消耗时间
    



[erlang应用文档](https://www.erlang.org/doc/applications.html)
