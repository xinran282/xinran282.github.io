@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion
title 生成并发布博客

pushd "%~dp0"
if errorlevel 1 exit /b 1

where node >nul 2>&1
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_node
where git >nul 2>&1
if errorlevel 1 goto missing_git

echo 正在生成网站并更新根目录发布文件...
call npm.cmd run publish:root
if errorlevel 1 goto build_failed

echo.
echo 网站生成完成。当前 Git 改动如下：
git -c core.quotepath=false status --short
if errorlevel 1 goto git_failed
echo.
echo 提交将包含上面列出的全部改动，包括新增文件和删除记录。
choice /C YN /N /M "是否提交到 Git？[Y/N] "
if errorlevel 2 goto skipped_commit
if errorlevel 1 goto commit
goto failed

:commit
git add -A
if errorlevel 1 goto git_failed
git diff --cached --quiet
if errorlevel 2 goto git_failed
if errorlevel 1 goto do_commit
echo 没有需要提交的改动。
goto done

:do_commit
git commit -m "publish site - %date% %time%"
if errorlevel 1 goto git_failed
echo.
choice /C YN /N /M "提交成功，是否推送到远程仓库？[Y/N] "
if errorlevel 2 goto skipped_push
if errorlevel 1 goto push
goto failed

:push
git push
if errorlevel 1 goto push_failed
echo 推送完成。
goto done

:skipped_commit
echo 已跳过提交，生成的文件保留在工作区。
goto done

:skipped_push
echo 已跳过推送，提交已保存在本地。
goto done

:missing_node
echo 未找到 Node.js 或 npm，请安装 Node.js 后重新运行。
goto failed

:missing_git
echo 未找到 Git，请安装 Git 并将其加入 PATH 后重新运行。
goto failed

:build_failed
echo 网站生成失败，请查看上方错误信息。
goto failed

:git_failed
echo Git 操作失败，请查看上方错误信息。
goto failed

:push_failed
echo 推送失败，本地提交已保留。请查看上方错误信息。
goto failed

:failed
echo.
pause
popd
endlocal
exit /b 1

:done
echo.
pause
popd
endlocal
exit /b 0
