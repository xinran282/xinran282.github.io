---
title: Lua 笔记
date: 2022-04-14 09:36:44
categories:
  - 编程语言
tags:
  - Lua
  - Skynet
  - 协程
  - C 扩展
description: Lua 与 Skynet 开发中的并发模型、安装配置和常用实践笔记。
---
## skynet


同一服务内的不同用户线程永远是轮流获得执行权的，每个线程都会需要一个阻塞操作而挂起让出控制权，也会在其它线程让出控制权后再延续运行
skynet 并不是一个抢占式调度器，没有时间片的设计，不会因为一个工作线工作时间过长而强制挂起它
消息由 6 部分构成：消息类型、session 、发起服务地址 、接收服务地址 、消息 C 指针、消息长度。
[skynet.register_protocol() 和 skynet.dispatch()](https://www.zybuluo.com/wsd1/note/564718)
dispatch处理lua类消息，register_protocol支持自定义类消息（如socket传来的消息）

### 安装

[gcc4.9安装](https://blog.csdn.net/llh_1178/article/details/79329250)


[gcc4.9.4 安装包](http://ftp.gnu.org/gnu/gcc/gcc-4.9.4/gcc-4.9.4.tar.gz)



```text
# 需要 gcc4.9
yum install gcc-c++
yum install -y readline-devel autoconf

git clone https://github.com/cloudwu/skynet.git
cd skynet
make linux
```



### API

映射关系






函数
函数说明
回调
回调说明



newservice(Name)
启动一个服务
Name文件中的skenet.start
在其中指定了该服务的回调函数组


call(Name, “lua”, Func, Arg)
Name:服务名 “lua”为消息类型 Func:调用函数 Arg:其他参数
Name文件中的函数




### misc


userdata、lightuserdata
可以让C返回一个句柄给Lua，而Lua可以将句柄再通过在C中注册的方法传回C
[区别](https://blog.csdn.net/fwb330198372/article/details/82217022)



### question


怎么创建一个进程（或者说服务）？
进程内的数据怎么保存？
相当于一个全局变量


怎么与socket进程通信？
垃圾回收机制是怎样的？
有没有性能分析工具？
skynet.stat(“mqlen” | “cpu” | “message”)
[profile](https://github.com/cloudwu/skynet/wiki/Profile)


各种瓶颈数值（进程数、端口数）
skynet
call(addr, type, …) 用 type 类型发送一个消息到 addr ，并等待对方的回应。
dispatch(type, func) 为 type 类型的消息设定一个处理函数。
redirect(addr, source, type, …) 伪装成 source 地址，向 addr 发送一个消息。
send(addr, type, …) 用 type 类型向 addr 发送一个消息。


有交互调试shell吗？
[DebugConsole](https://github.com/cloudwu/skynet/wiki/DebugConsole)


支持热更吗？
连接到debug_console，使用clearcache清掉代码缓存，会使内存增大，但可以再调用gc回收
本质是替换变量的值（函数也是变量）
[尽量正确的热更新](https://blog.codingnow.com/2016/11/lua_update.html)
[skynet：热更新 lua 代码](https://www.cnblogs.com/losophy/p/9204036.html)


怎么启动
./skynet ConfigFile
配置文件的start为启动入口
[Skynet配置](https://github.com/cloudwu/skynet/wiki/Config)    

### 源码解析

#### 网关 gateserver

```text
graph LR
Main[Main] -->|1.new|Watchdog(Watchdog)
Watchdog -->|2.new|Gate(Gate)
Gate -->|3.start|Gateserver(Gateserver)
Main -->|4.start|Watchdog
Watchdog -->|5.open|Gateserver
Gateserver -->|6.端口监听|Socket(Socket)
Gateserver -->|7.open|Gate

Socket -->|11.链接来了|Gateserver
Gateserver -->|12.opne|Gate
Gate -->|13.open|Watchdog
Watchdog -->|14.new|Agent(Agent)
Watchdog -->|15.start|Agent
Agent -->|16.forward|Gate
Gate -->|17.openclient|Gateserver
Gateserver -->|18.socketdriver.start|Socket

Socket -->|21.消息来了|Gateserver
Gateserver -->|22.message|Gate
Gate -->|23.socket data|Agent

Socket -->|31.连接关闭|Gateserver
Gateserver -->|32.disconnect|Gate
Gate -->|33.close|Watchdog
Watchdog -->|34.kick|Gate
Gate -->|35.closeclient|Gateserver
Watchdog -->|36.disconnect|Agent
```



[网关服务](https://blog.csdn.net/weixin_44770127/article/details/107721768)
[skynet socketserver](https://wudaijun.com/2015/02/skynet-socketserver/)

#### 登陆服务器 loginserver

```text
graph LR
User[用户] -->|1.发起认证请求 获取Token|A(认证平台)
User[用户] -->|2.选择服务器+Token 交换密钥|L(登陆服)
L -->|3.检查 Token合法性|A
L -->|4.转发登陆请求 密钥|G[游戏节点]
G -->|5.同步subid 作为登陆凭证 |L
L -->|6.同步subid|User
User -->|7.断开连接|L
User -->|8.链接后通讯|G
```



[官网LoginServer介绍](https://github.com/cloudwu/skynet/wiki/LoginServer)

## 资料


[Skynet 设计综述](https://blog.codingnow.com/2012/09/the_design_of_skynet.html)
[skynet 入门](https://github.com/cloudwu/skynet/wiki/GettingStarted)
[skynet LuaAPI](https://github.com/cloudwu/skynet/wiki/LuaAPI)
[skynet源码赏析](https://manistein.github.io/blog/post/server/skynet/skynet%E6%BA%90%E7%A0%81%E8%B5%8F%E6%9E%90/)
[游戏例子](https://github.com/Naivebug/skynet_gameserver_study)
[Lua 5.3 参考手册](https://cloudwu.github.io/lua53doc/manual.html)
[白鹭](http://developer.egret.com/cn/github/egret-docs/Engine2D/projectConfig/installation/index.html)
