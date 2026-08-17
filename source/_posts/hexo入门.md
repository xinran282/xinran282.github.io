---
title: Hexo 入门
date: 2022-04-13 14:25:54
categories:
  - 博客
tags:
  - Hexo
  - GitHub Pages
  - NexT
  - 静态网站
description: Hexo 的基础配置、主题设置和部署命令速查。
---
### 快速使用




指令
释义



hexo g
生成


hexo s
本地部署预览


hexo d
发布


hexo clean
清除缓存


hexo n 文章名
创建一个新的文章模板


hexo new page tags
生成标签索引界面


hexo new page categories
生成分类索引界面



### next主题配置

```text
menu:
home: / || fa fa-home
#about: /about/ || fa fa-user
tags: /tags/ || fa fa-tags
categories: /categories/ || fa fa-th
archives: /archives/ || fa fa-archive
codeblock:
# Code Highlight theme 设置代码块主题
# Available values: normal | night | night eighties | night blue | night bright | solarized | solarized dark | galactic
# See: https://github.com/chriskempson/tomorrow-theme
highlight_theme: night
```



### 站点配置

```text
# Deployment
## Docs: https://hexo.io/zh-cn/docs/one-command-deployment
deploy:
type: 'git'
repo:  #https://bitbucket.org/JohnSmith/johnsmith.bitbucket.io
branch: master
```



### 链接

[hexo官方指南](https://hexo.io/zh-cn/docs/configuration)
[next主题使用文档](http://theme-next.iissnan.com/getting-started.html)
