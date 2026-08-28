#!/bin/bash
# MCP 自动加载脚本

MCP_CONFIG_DIR="$HOME/.claude/plugins/marketplaces/claude-plugins-official/external_plugins"

# MCP 名称到配置文件的映射
declare -A MCP_MAP=(
    ["github"]="github"
    ["gitlab"]="gitlab"
    ["playwright"]="playwright"
    ["firebase"]="firebase"
    ["telegram"]="telegram"
    ["discord"]="discord"
    ["context7"]="context7"
    ["asana"]="asana"
    ["linear"]="linear"
    ["imessage"]="imessage"
    ["laravel-boost"]="laravel-boost"
    ["serena"]="serena"
    ["greptile"]="greptile"
    ["terraform"]="terraform"
    ["fakechat"]="fakechat"
)

# 检查 MCP 是否已启用
is_mcp_enabled() {
    local name=$1
    claude mcp get "$name" &>/dev/null
    return $?
}

# 启用 MCP
enable_mcp() {
    local name=$1
    local config_file="$MCP_CONFIG_DIR/$name/.mcp.json"

    if [ ! -f "$config_file" ]; then
        echo "错误: 找不到 $name 的配置文件"
        return 1
    fi

    echo "正在启用 $name MCP 服务器..."

    # 读取配置文件并提取服务器配置（去掉外层的服务器名称）
    local config=$(cat "$config_file" | python -c "import json, sys; data = json.load(sys.stdin); print(json.dumps(data['$name']))")

    if [ -z "$config" ]; then
        echo "错误: 无法解析 $name 的配置文件"
        return 1
    fi

    claude mcp add-json "$name" "$config"

    if [ $? -eq 0 ]; then
        echo "✓ $name MCP 已启用"
        return 0
    else
        echo "✗ $name MCP 启用失败"
        return 1
    fi
}

# 自动加载指定的 MCP
auto_load() {
    local name=$1

    # 检查是否在支持的列表中
    if [ -z "${MCP_MAP[$name]}" ]; then
        echo "错误: 不支持的 MCP 服务器 '$name'"
        echo "支持的 MCP: ${!MCP_MAP[*]}"
        return 1
    fi

    # 检查是否已启用
    if is_mcp_enabled "$name"; then
        echo "✓ $name MCP 已经启用"
        return 0
    fi

    # 启用 MCP
    enable_mcp "$name"
}

# 显示帮助
show_help() {
    echo "MCP 自动加载脚本"
    echo ""
    echo "用法: $0 <mcp-name>"
    echo ""
    echo "支持的 MCP 服务器:"
    for name in "${!MCP_MAP[@]}"; do
        echo "  - $name"
    done
}

# 主逻辑
if [ -z "$1" ]; then
    show_help
    exit 1
fi

auto_load "$1"
