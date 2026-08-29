#!/bin/bash
# DeepSeek Harness 插件安装脚本模板

set -e

PLUGIN_NAME="<plugin-name>"
GITHUB_URL="https://github.com/<username>/<plugin-name>"

echo "正在安装  ..."

# 检查 dsh 命令是否可用
if ! command -v dsh &> /dev/null; then
    echo "错误: 未找到 dsh 命令，请先安装 DeepSeek Harness"
    exit 1
fi

# 安装插件
dsh add ""

echo "安装完成！"
echo "使用 'dsh <command>' 查看可用命令"
