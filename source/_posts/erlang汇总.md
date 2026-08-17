---
title: Erlang 常用知识汇总
date: 2022-04-14 09:26:33
categories:
  - Erlang
tags:
  - Erlang
  - BEAM
  - OTP
  - 并发
  - 虚拟机
description: 汇总 Erlang 的启动参数、进程、消息和常用运行时知识。
---
#### 常用启动参数

启动方式： erl   argument有三种标签：



虚拟机机标签，以+开头
系统标签，以-开头，这里有部分是启动标签，即启动时被调用如-s，其他为用户标签，存储在虚拟机内，通过init:get_argument(sname).可以得到，用户标签相当于在启动时设置了key-value值
计划标签，放在最前面，或在–，-extra之后，通过init:get_plain_arguments().获得

常用参数如下：



-detached

  用于运行守护或后台进程
-remsh Node

  连接到某个节点
-connect_all false
  禁止节点自动连通，且不能使用全局注册（global）
+sub true|false

  开启或关闭进程调度的负载平衡，默认false
+S Num

  开启smp时设置调度进程数量
+P Number

  设置进程数量上限
-setcookie

  指定cookie
-hidden

  设置为隐藏节点，在多节点中不会被其他节点自动连接，需要显示调用net_kernel:connect/1
+sub true

  开启调度程序负载平衡
-extra

  设置启动参数，通过init:get_plain_arguments/0获得
-config

  指定应用的配置，通过application:get_env/2获得
+pc unicode | latin1

  启动时指定字符格式
latin1：只有ISO-latin-1范围内的字符才能被认为是可打印的，这意味着代码点大于255的字符将永远不会被打印，并且包含此类字符的列表将被工具显示为整数列表，而不是文本字符串
unicode：在决定是否以字符串语法显示整数列表时，将考虑所有可打印的Unicode字符。这可能会带来意想不到的结果，例如，如果您的字体没有涵盖所有Unicode字符
io:printable_range().  查看shell的字符格式


args_file FileName

  从一个文件里读取命令参数，注释以 # 开头，\ 作为引用符，禁止再嵌套-args_file FileName，在文件里，-extra被视为命令结束符
compile Mod1 Mod2 …

  编译模块
+sbwt none|very_short|short|medium|long|very_long

  设置调度程序繁忙等待阈值。默认为中。该阈值确定了在没有工作之前要进入睡眠状态的调度程序要等待多长时间
+Q Num

  erlang open_port的数量默认是65536，win为8192，若要超过这个数，则需要启动时用此参数指定，当然系统的限制也要打开，否则也是用不了的，可以通过erlang:system_info(port_limit) 来确认限制

#### 编译选项


inline 开启自动内联函数，即把一些短小的函数内嵌到调用者函数体里面，减少函数调用的开销，默认大小为24，并不是指行数，可以通过{inline_size, Num}来改变大小，存在破坏尾递归的可能，也可以在源文件中用 **-compile({inline, [Fun/Arty]}).** 的方式显示指定哪个函数需要内联，但这种会被提示成old inline
debug_info 添加调试信息，加了这个可以由beam导出erl
warning_as_errors 警告当做错误输出
report 输出警告、错误信息
verbose 输出详细编译信息
[其他](https://www.erlang.org/doc/man/compile.html)

#### 编程规范

##### 官网推荐 = 基本要求


不要写深度嵌套代码
不要写非常大的模块，模块行数控制在1000行内
不要写很大的函数 尽量控制一个屏幕能显示完整
不要写太长的代码，太长时就换行
变量命名，驼峰式命名  后面跟数字的前面可以加’_’,以突出显示 如Player_2
函数名、模块名，单词以_分隔
代码间隔格式 ,后面加空格 看起来比较直观 如{12, 23, 45}##### 附加


不要在其他功能模块插入自己功能的一长段代码，应封装好后供其调用
功能目录下的模块命名前缀尽量跟目录名一致
涉及到玩家个人零点清次数的，要么用daily模块，要么state里存个更新时间T，根据T去判断要不要清次数或重置数据
任务监听的，生成配置时要列出改功能用到的任务标签，代码做判断时优先根据这标签列表做过滤
后面涉及到玩家个人零点清次数的，要么用daily模块，要么state里存个更新时间T，根据T去判断要不要清次数或重置数据，可以参考task_daily模块
会存机器人key的玩法，登陆初始化时要判断下key还在不在，因为每次重启时不能保证相同key的机器人还在

#### 运维常用

```text
recon:scheduler_usage(1000

%% Type = used | allocated | unused | usage | allocated_types | allocated_instances
%% usage 使用率 = used/allocated
%% allocated 系统分配的
%% allocated_types 各种数据类型的占用
%% allocated_instances 调度程序占用，0代表所有
recon_alloc:memory(Type).       %% 内存查看 单位b

reconcile:info(Pid). %% 获取进程信息 类似process_info/1 但相对安全，不安全的如binary、dictionary、messages
%% 按Type值排序取前Num个进程的信息
%% Type = memory | message_queue_len | heap_size | binary_memory | reductions
%% 上述为常用选项，其实就是类似process_info里的key
recon:proc_count(Type, Num).
recon:proc_window(Type, Num, Milliseconds)  %% 同上，但会在给定时间内采样两次取均值

recon:port_types(). %% 查看端口类型数量
recon:port_info("#Port"
%% 查看按属性排序的前N个端口信息
%% Attribute = 'recv_cnt' | 'recv_oct' | 'send_cnt' | 'send_oct' | 'cnt' | 'oct'
%% oct：流量字节数，cnt包数
recon:inet_count(Attribute, Num).
recon:inet_window(Attribute, Count, Milliseconds). %% 同上

recon:bin_leak(N). %% 对比gc前后binary内存变化，得出变化最大的N个进程
recon_trace:calls({queue, in, 2

rb:start() %% 查看系统自带日志输出
crashdump_viewer:start() %% win端查看节点挂掉的dump文件
observer:start()    %% 具象化看节点信息

%% ets表占用内存排序
lists:reverse(lists:keysort(2
%% 显示10秒内内核进程的使用率
msacc:start(10000
```



#### dialyzer 静态分析

使用示例



```text
dialyzer --build_plt -r "C:\Program Files\erl7.3\lib\erts-7.3\ebin" "C:\Program Files\erl7.3\lib\kernel-4.2\ebin" "C:\Program Files\erl7.3\lib\stdlib-2.8\ebin" "C:\Program Files\erl7.3\lib\mnesia-4.13.3\ebin" "C:\Program Files\erl7.3\lib\crypto-3.6.3\ebin" "C:\Program Files\erl7.3\lib\sasl-2.7\ebin"
dialyzer -Werror_handling -r E:\work\cshx\server\script\../ebin >
```


#### gen_server exit




type
trap_exit
exit原因
进程终止否
teminate执行否



gen_server
false
test、shutdown、kill、other
是
否


gen_server
false
normal
否
否


gen_server
true
normal、shutdown、test、other、killed
否
否


gen_server
true
kill
是
否


spawn
false
test、shutdown、kill、other
是



spawn
false
normal
否



spawn
true
kill、shutdown、test、other、killed
否



spawn
true
normal
是



ps：游戏节点终止会用init:stop/0,通知到gen_server退出的原因是shutdown







#### xrl yrl  erlydtl

[.xrl](http://www.erlang.org/doc/man/leex.html)
[.yrl](http://www.erlang.org/doc/man/yecc.html)
具体看官方文档，大意是按一定规制写文件，然后可以用erlc编译生成.erl文件

[erlc可支持编译的文件格式](http://www.erlang.org/doc/man/erlc.html)


erlang模板引擎

[https://github.com/erlydtl/erlydtl](https://github.com/erlydtl/erlydtl)

[https://github.com/erlydtl/erlydtl/wiki](https://github.com/erlydtl/erlydtl/wiki)  例子


#### 运算符号




运算符
说明
参数类型



‘+’
一元  +
number


‘-‘
一元  -
number


‘*’
乘法
number


‘/‘
浮点除法
number


div
整数除法
integer


bnot
一元 not 位运算
integer


rem
整数求余
integer


band
与运算
integer


bor
或运算
integer


bxor
异或运算
integer


bsl
左移运算
integer


bsr
右移运算
integer



#### 全局宏




宏名
类型
说明



?MODULE
atom
当前模块


?LINE
integer
当前行数


?FILE
string
当前文件名


?FUNCTION_NAME
atom
当前函数名


?FUNCTION_ARITY
integer
当前函数参数数量


?MACHINE
string
当前执行程序名 ‘BEAM’


?MODULE_STRING
string
当前模块


?OTP_RELEASE
integer
OTP版本 = erlang:system_info(otp_release) = 21



#### 字符编码

##### 源文件的编码

编译器会用正则\s*[:=]\s*([-a-zA-Z0-9]检索erl文件头两行，若命中，则以声明的编码格式编译文件，R16B之前默认是Latin-1,之后是UTF-8。如可以用以下任意一种声明方式



```text
%% coding: utf-8
%% For this file we have chosen encoding = Latin-1
%% -*- coding: latin-1 -*-
```



##### 位语法

Flag = utf8、utf16、utf32、little、big、binary



```text
> = Bin1,
> = Bin2,
Bin3 = >
```




#### erlang:system_monitor(MonitorPid, Options) -> MonSettings

监控某个进程，Options如下：



{long_gc, Time}

若GC时间>=Time,监控进程会收到{monitor, GcPid, long_gc, Info}

Info = [ {timeout, GcTime} | {Key, Val} ]

GcTime = 实际GC的毫秒数 Key =

heap_size         堆容量
heap_block_size   堆栈容量
old_heap_size
old_heap_block_size
stack_size
recent_size       上次GC后的数据容量
mbuf_size         消息缓冲区容量
bin_vheap_size    从进程堆引用的唯一堆外二进制文件的总容量
bin_old_vheap_size 
bin_vheap_block_size  GC前，虚拟堆中允许的二进制文件的容量上限
bin_old_vheap_block_size


{long_schedule, Time}

若端口或进程在内核调用的时间>=Time,则收到{monitor, PidOrPort, long_schedule, Info}

被监控的是pid()时，Info内容有：
{timeout, Millis}
{in, Location}
{out, Location}

Location = {Module, Function, Arity} | undefined


被监控的是port()时

可用于检测NIFs(内建函数)或驱动的运行时间，最好不要超过1ms，但在分时系统，只要<100ms，都可以被认为正常
{timeout, Millis}
{port_op,Op}

Op = proc_sig | timeout | input | output | event | dist_cmd




{large_heap, Size}

若GC后堆大小>=Size，则收到{monitor, GcPid, large_heap, Info}，Info跟long_gc的一致，除了没有timeout

若被监控进程自身超过max_heap_size而被kill，则监控进程不会收到信息，因为其还没进行GC或GC完
busy_port

若被监控进程因为向繁忙端口发送消息而被挂机，则监控者收到{monitor, SusPid, busy_dist_port, Port}
busy_dist_port

同上，不同的是节点间的调用，{monitor, SusPid, busy_dist_port, Port}

#### 内存

内存块 18位对齐 所以最小256KB

载体 = 1~n个内存块

堆分配器，二进制分配器，驱动程序分配器和ets分配器

erl_alloc.types 具体的内存分配映射处理表,在源码中可见(erl_alloc.types)


内存增长的原因：



消息队列过长
ets不规范操作
进程字典
binary数据引用

#### 反编译

#### ps


erlang c源码查看关联 如lists:reverse/1  = lists_reverse_1

内建函数BIF表 = bif.tab
dict:fetch/2 用于查找已存在key的数据，不存在时会报错

dict:find/2 也是查找数据，不存在时返回error   
Erlang的binary分为两大类：ProcBin和Refc binary 。64 字节及以下的binary都直接在进程自己的堆上分配，其整个生命期都在堆中。大于 64 字节的binary会分配在一个binary专用的全局堆上，每个使用它的进程都会在自己的局部堆中持有一个对其的本地引用
erl_alloc.types 内存类型总览的源码文件


```text
%%% -*- coding: utf8 -*-
% 指定编译编码格式

erlc -S 文件   %% 生成中间代码 .S文件

% SHA256加密
hmax_sha256(Key, Data)->
lists:flatten([[integer_to_list(N, 16) || > 
erlang的缺陷
使用耗时的nif时，会影响其调度公平
存在进程字典、ets，妨碍了函数式的幂等性



#### 其他文档


[cowboy websocket分析](https://www.processon.com/view/link/5c3d4a55e4b0641c83dc0772#map)
[php使用erlang](https://code.google.com/p/mypeb/downloads/list)
[erlang数据结构的二进制表示](http://erlang.org/doc/apps/erts/erl_ext_dist.html)
[SHA256算法原理详解](https://blog.csdn.net/u011583927/article/details/80905740)
[Base64 的原理、实现及应用](https://blog.csdn.net/weixin_40811410/article/details/81950142)
[Erlang并发机制 –进程调度](https://www.iteye.com/blog/jzhihui-1482175)
[Erlang ERTS的Trap机制的设计及其用途](https://www.iteye.com/blog/mryufeng-334744)
[软实时和硬实时操作系统的区别](https://blog.csdn.net/softn/article/details/51872232)
如果系统响应不能满足时限的要求，即使它能得到正确的输出，我们也只能说他是一个失败的响应。“软”意味着如果没有满足指定的时间约束并不会导致灾难性后果，而对硬实时系统来说却是灾难性的
[深入理解 MySQL 索引底层原理](https://mp.weixin.qq.com/s/qHJiTjpvDikFcdl9SRL97Q)
[Erlang并发机制 – 消息传递](https://www.iteye.com/blog/jzhihui-1506756)
[Erlang类型数据的内存存储格式](http://beam-wisdoms.clau.se/en/latest/indepth-memory-layout.html)
[Erlang Inline编译 内联函数](https://www.cnblogs.com/me-sa/archive/2012/01/09/erlang0029.html)
[分析和解决mnesia过载问题](https://blog.csdn.net/mycwq/article/details/28660813)
[Erlang 常用数据结构实现](https://wudaijun.com/2015/12/erlang-datastructures/)
[Erlang进程堆垃圾回收机制](https://blog.csdn.net/mycwq/article/details/26613275)
[Erlang垃圾回收细节](https://hamidreza-s.github.io/erlang%20garbage%20collection%20memory%20layout%20soft%20realtime/2015/08/24/erlang-garbage-collection-details-and-why-it-matters.html)

#### 资料


[Erlang OTP 设计原理文档](http://erlang.shiningray.cn/otp-design-principles/index.html)
[坚强2002的博客](https://www.cnblogs.com/me-sa/)
[系统技术非业余研究](http://blog.yufeng.info/)
[yufeng原博客](https://www.iteye.com/blog/user/mryufeng)
[成立涛的博客](https://erlangdisplay.iteye.com/category/127758)
[惊帆之静默](http://gashero.yeax.com/?cat=6)
[cryolite](https://cryolite.iteye.com/category/30938?page=2)
[wudaijun](https://wudaijun.com/)
[Erlang/Elixir精选](https://www.yuque.com/mouwen/weekly/qa)
[Erlang开发组博客](https://blog.erlang.org/)
[Erlang-and-OTP-in-Action](https://github.com/erlware/Erlang-and-OTP-in-Action-Source)
[http://trapexit.org](http://trapexit.org/) （国内封锁）
[erlang书签](https://github.com/0xAX/erlang-bookmarks/blob/master/ErlangBookmarks.md)
[erlang 教程wiki](https://iowiki.com/erlang/erlang_index.html)
[Erlang资源大全中文版](https://github.com/hstcscolor/awesome-erlang-cn)
[Erlang程序设计](https://sites.google.com/a/chaoskey.com/erlang/)
[Erlang中文手册](https://erldoc.com/)
[彭政生的博客](https://szpzs.oschina.io/categories/)
[learn you some erlang作者博客](https://ferd.ca/)
