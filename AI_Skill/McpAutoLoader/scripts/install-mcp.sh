#!/bin/bash
# MCP 安装脚本

MCP_CONFIG_DIR="$HOME/.claude/plugins/marketplaces/claude-plugins-official/external_plugins"

# 显示帮助
show_help() {
    echo "MCP 安装脚本"
    echo ""
    echo "用法: $0 <mcp-name>"
    echo ""
    echo "示例:"
    echo "  $0 github"
    echo "  $0 playwright"
    echo "  $0 context7"
    echo ""
    echo "注意: 安装前会检查是否已安装，并显示配置信息"
}

# 检查 MCP 是否已安装
is_mcp_installed() {
    local name=$1
    claude mcp get "$name" &>/dev/null
    return $?
}

# 安装 MCP
install_mcp() {
    local name=$1
    local config_file="$MCP_CONFIG_DIR/$name/.mcp.json"

    # 检查配置文件是否存在
    if [ ! -f "$config_file" ]; then
        echo "错误: 找不到 $name 的配置文件"
        echo "配置文件路径: $config_file"
        echo ""
        echo "请先搜索可用的 MCP: ~/.claude/skills/mcp-auto-loader/scripts/search-mcp.sh $name"
        return 1
    fi

    # 检查是否已安装
    if is_mcp_installed "$name"; then
        echo "✓ $name MCP 已经安装"
        echo ""
        echo "是否要重新安装？(y/N)"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo "已取消"
            return 0
        fi
        echo "正在重新安装..."
        claude mcp remove "$name" 2>/dev/null
    fi

    echo "正在安装 $name MCP 服务器..."
    echo ""

    # 显示配置信息
    echo "配置信息:"
    echo "========================================"
    cat "$config_file" | python -c "import json, sys; data = json.load(sys.stdin); print(json.dumps(data, indent=2))" 2>/dev/null
    echo ""
    echo "========================================"
    echo ""

    # 确认安装
    echo "是否安装此 MCP？(Y/n)"
    read -r response
    if [[ "$response" =~ ^[Nn]$ ]]; then
        echo "已取消安装"
        return 0
    fi

    # 读取配置文件并提取服务器配置（去掉外层的服务器名称）
    local config=$(cat "$config_file" | python -c "import json, sys; data = json.load(sys.stdin); print(json.dumps(data['$name']))")

    if [ -z "$config" ]; then
        echo "错误: 无法解析 $name 的配置文件"
        return 1
    fi

    # 安装 MCP
    claude mcp add-json "$name" "$config"

    if [ $? -eq 0 ]; then
        echo ""
        echo "✓ $name MCP 安装成功"
        echo ""
        echo "验证安装:"
        claude mcp get "$name"
        return 0
    else
        echo "✗ $name MCP 安装失败"
        return 1
    fi
}

# 主逻辑
if [ -z "$1" ]; then
    show_help
    exit 1
fi

install_mcp "$1"
