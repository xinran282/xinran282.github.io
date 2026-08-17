---
title: Linux 常用指令
date: 2022-04-13 16:21:05
categories:
  - 运维
tags:
  - Linux
  - Shell
  - SSH
  - rsync
  - Git
description: Linux 日常运维中常用的终端命令、服务管理、网络排查和文件同步速查。
---
### screen

```text
screen -X -S 20153 quit  ## 退出
screen -ls
screen -r Id|name        ## 跳到指定界面
screen -D                ## 踢掉正在查看的用户
```



### rsync

[win版本](https://www.itefix.net/cwrsync)

[centos7安装配置rsync以及遇到问题](https://developer.aliyun.com/article/692451)

[RSYNC常见问题及解决办法](https://www.cnblogs.com/reve-wang/p/7216582.html)



```text
## linux服务端 /etc/rsyncd.conf配置
uid=root
gid=root
use chroot = no
max connections = 4
strict modes =no
port = 873
address = 192.168.1.111
log file=/var/log/rsync.log

[admin_web]
path = /data/admin/web/dist
comment = admin web
ignore errors
read only = no
list = no
auth user=test
secrets file = /etc/rsync.pas
transfer logging = yes
pid file = /var/run/rsyncd.pid
lock file = /var/run/rsync.lock
hosts allow = 192.168.1.0/255.255.255.0
hosts deny = *

UID = 0
GID = 0
```





```text
/etc/rsync.pas 文件内容
test:rsync      ## 用户:密码
```




```text
rsync --daemon  ## 启动后台服务

# 不用后台的同步方式
rsync -avz --progress -e "ssh -i ~/.shh/id_rsa.pub"
```





```text
rem window同步示例
rsync -avz --port=873 --chmod=777 --delete --password-file=d:/passwd dist/ 192.168.1.111::admin_web/
```








命令参数
说明



–progress
显示传输过程


-avz
z:压缩 v:显示传输文件名 a:归档模式(= -rlptgoD)


-exclude=”文件/目录”
排除指定文件或目录



### find

```text
find / -ctime -1  ## 查找1天内被修改过的文件
find / -cmin -60  ## 查找60分钟内被修改过的文件
```



### grep

```text
grep -参数 "内容" 待搜索的内容或文件
-n 显示行号
```


### sed

```text
sed -i s/Search/Replace/g File  ## 替换该文件所有匹配到的为所要替换的
## 实例
sed -i s/"case 'Mac'"/"case 'Mac','Linux'"/g ../../../Build/SubPackages/Modules/*/hxscript/Compile.hx
```



### ssh

client 没有密钥时可用下面指令生成

密钥要放在 ~/.ssh 下面，且名字未id_rsa.pub、id_rsa

因为ssh登陆其他机器是，会默认按这个名字去取私钥



```text
ssh-keygen -t [rsa|dsa] -C "comments"
# -t 可选择RSA 和 DSA 两种密钥
# -C 可选注释

# 登陆指定机器示例
ssh -p 22 192.168.1.111
```



### netstat

```text
## 查看监听的端口
netstat -nltp
## 查看所有的tcp连接
netstat -t
```




### iptables

[https://www.cnblogs.com/liang2580/articles/8400140.html](https://www.cnblogs.com/liang2580/articles/8400140.html)



表（tables）
filter 负责过滤功能，防火墙；内核模块：iptables_filter
raw 关闭nat表上启用的连接追踪机制；iptable_raw
nat network address translation，网络地址转换功能；内核模块：iptable_nat
mangle 拆解报文，做出修改，并重新封装 的功能；iptable_mangle


链（chains）
PREROUTING  路由前
INPUT     进入     
FORWARD       转发  
OUTPUT    出去
POSTROUTING 路由后


规则（policy）


```text
## 启动、重启、停止服务
/etc/init.d/iptables start | restart | stop
service iptable save | start | restart
## 查看规则
Iptables –L –n
## 开放端口
iptables -A INPUT -m state --state NEW -m tcp -p tcp --dport 23 -j ACCEPT
## 禁止端口
iptables -A INPUT -p tcp --dport 22 -j DROP
```





### xarges

[xargs](https://www.runoob.com/linux/linux-comm-xargs.html) 可以将管道或标准输入（stdin）数据转换成命令行参数，也能够从文件的输出中读取数据。


xargs 也可以将单行或多行文本输入转换为其他格式，例如多行变单行，单行变多行。


xargs 默认的命令是 echo，这意味着通过管道传递给 xargs 的输入将会包含换行和空白，不过通过 xargs 的处理，换行和空白将被空格取代。


xargs 是一个强有力的命令，它能够捕获一个命令的输出，然后传递给另外一个命令。



```text
## 多行变当行输出
cat
a b c d e f g h i j k l m n o p q r s t u v w x y z

## -n 选项多行输出：
cat
a b c
d e f
g h i
```




### crontab

```text
## 显示正在运行的任务
crontab -l

## 重启
service crond restart

## 查看状态
service crond status

crontab任务配置基本格式：
*   *　 *　 *　 *　　command
分钟(0-59)　小时(0-23)　日期(1-31)　月份(1-12)　星期(0-6,0代表星期天)　 命令
第1列表示分钟1～59 每分钟用*或者 */1表示
第2列表示小时1～23（0表示0点）
第3列表示日期1～31
第4列表示月份1～12
第5列标识号星期0～6（0表示星期天）
第6列要运行的命令
```




在以上任何值中，星号（*）可以用来代表所有有效的值。譬如，月份值中的星号意味着在满足其它制约条件后每月都执行该命令。
整数间的短线（-）指定一个整数范围。譬如，1-4 意味着整数 1、2、3、4。
用逗号（,）隔开的一系列值指定一个列表。譬如，3, 4, 6, 8 标明这四个指定的整数。
正斜线（/）可以用来指定间隔频率。在范围后加上 / 意味着在范围内可以跳过 integer。譬如，0-59/2 可以用来在分钟字段定义每两分钟。间隔频率值还可以和星号一起使用。例如，*/3 的值可以用在月份字段中表示每三个月运行一次任务。
开头为井号（#）的行是注释，不会被处理。 

### 安装

```text
## 检索已安装的程序
rpm -qa |grep erlang
## 查看软件包的安装路径
rpm -ql 软件包名
## 安装
rpm -ivh esl-erlang_21.1-1_centos_6_amd64.rpm --force --nodeps
```





### mysql

```text
## 查询数据库存在否
SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'c_local_1'
## 查看表结构
desc 表名
## 查看创建表的语句
show create table 表名
```



### more

```text
Enter 向下n行，需要定义。默认为1行
Ctrl+F 向下滚动一屏
空格键 向下滚动一屏
Ctrl+B 返回上一屏
= 输出当前行的行号
：f 输出文件名和当前行的行号
V 调用vi编辑器
!命令 调用Shell，并执行命令
q 退出more
```



### ansible

[命令详解](https://www.cnblogs.com/keerya/p/7987886.html#_label4_2)



```text
## 测试是否连通
ansible 服务器组名 -m ping
## 在指定服务器上执行shell命令
ansible SrvName -m shell -a "command string"
```



### svn git

```text
## 递归恢复
svn  revert -R 目录
## 查看最新5条日志
svn log

# 初始化一个git仓库
git init --bare runoob.git
# 在已有文件夹中关联一个git仓库
git init
git remote add origin 地址
# 下载指定版本(分支)
git clone
```



### gcc


-fPIC与-fpic都是在编译时加入的选项，用于生成位置无关的代码(Position-Independent-Code)。这两个选项都是可以使代码在加载到内存时使用相对地址，所有对固定地址的访问都通过全局偏移表(GOT)来实现。-fPIC和-fpic最大的区别在于是否对GOT的大小有限制。-fPIC对GOT表大小无限制，所以如果在不确定的情况下，使用-fPIC是更好的选择。
-fPIE与-fpie是等价的。这个选项与-fPIC/-fpic大致相同，不同点在于：-fPIC用于生成动态库，-fPIE用与生成可执行文件。再说得直白一点：-fPIE用来生成位置无关的可执行代码。
-w 关闭编译时的警告
-Wall 显示所有警告

### 常用指令

#### 查询

```text
# 查看系统版本
cat /etc/redhat-release
# 统计当前目录各个项所占磁盘大小
du -sh *
# 统计错误日志模块函数出现的频率
grep '[E]' error_log.*|awk -F\( '{a[$1]+=1} END {for (i in a) print a[i],i}'|sort -rn
```





#### 性能调优

```text
##### 查看内存前10的进程
ps aux|head
##### 清缓存
echo
```
