@echo off
REM DeepSeek Harness 插件安装脚本模板 (Windows)

set PLUGIN_NAME=<plugin-name>
set GITHUB_URL=https://github.com/<username>/<plugin-name>

echo 正在安装 %PLUGIN_NAME% ...

REM 检查 dsh 命令是否可用
where dsh >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未找到 dsh 命令，请先安装 DeepSeek Harness
    pause
    exit /b 1
)

REM 安装插件
dsh add "%GITHUB_URL%"

echo 安装完成！
echo 使用 'dsh ^<command^>' 查看可用命令
pause
