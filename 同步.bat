@echo off
chcp 65001
:: ===============================
:: Git 自动提交并推送脚本
:: ===============================

:: 设置提交信息（如果用户没有输入，就用默认）
set PATH=C:\Users\gz0571\AppData\Local\Programs\Git\bin;%PATH%
set commit_msg=%1
if "%commit_msg%"=="" (
    set commit_msg=auto commit - %date% %time%
)

echo.
echo ==============================
echo 正在提交更改...
echo 提交信息: %commit_msg%
echo ==============================
echo.

:: 添加所有更改
git add -A

:: 提交
git commit -m "%commit_msg%"

:: 推送到远程仓库（默认 origin main/master）
git push origin HEAD

echo.
echo ✅ 提交并推送完成！
pause
