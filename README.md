# 欣然的备忘录

这是一个使用 Hexo 8.1.2 生成的 GitHub Pages 博客。平时只需要编辑 `source` 中的文章，再按下面的流程发布。

## 第一次使用

在项目根目录执行：

```powershell
npm.cmd install
```

之后不需要重复安装，除非更换电脑或删除了 `node_modules` 目录。

## 写一篇新文章

执行：

```powershell
npm.cmd run new -- "文章标题"
```

这会在 `source/_posts/` 创建一个 Markdown 文件。用编辑器打开它，填写标题、日期、分类、标签和正文，例如：

```markdown
---
title: 我的第一篇新文章
date: 2026-08-17 10:00:00
categories:
  - 技术
tags:
  - Hexo
---

这里开始写正文。

## 二级标题

可以使用 Markdown 语法写链接、代码和图片。
```

已有文章也在 `source/_posts/`，直接修改对应的 `.md` 文件即可。

图片请放入 `source/images/`，然后在文章中这样引用：

```markdown
![图片说明](/images/example.png)
```

## 本地预览

执行：

```powershell
npm.cmd run server
```

在浏览器打开 [http://localhost:4000/](http://localhost:4000/)。修改文章后，刷新浏览器即可看到更新。

不要直接双击根目录的 `index.html`。那样浏览器无法正确解析 `/css/main.css` 等站点资源路径，因此页面会没有样式。

按 `Ctrl+C` 可以停止本地预览服务。

## 发布到 GitHub Pages

确认预览没有问题后，依次执行：

```powershell
npm.cmd run publish:root
git status
git add -A
git commit -m "publish new post"
git push
```

`publish:root` 会重新生成整个网站，并把可发布的静态文件更新到仓库根目录。推送完成后，GitHub Pages 通常会在几分钟内更新。

执行 `git add -A` 前先查看 `git status`。确认列表中只有这次要发布的文章和生成文件后再继续；不想发布的改动可以先保留在工作区。

## 常用命令

```powershell
# 新建文章
npm.cmd run new -- "文章标题"

# 本地预览
npm.cmd run server

# 仅生成到 public/ 目录，用于检查构建是否成功
npm.cmd run build

# 生成并更新 GitHub Pages 要发布的根目录文件
npm.cmd run publish:root
```
