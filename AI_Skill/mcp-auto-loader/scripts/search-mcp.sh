#!/bin/bash
# MCP 搜索脚本

MCP_CONFIG_DIR="$HOME/.claude/plugins/marketplaces/claude-plugins-official/external_plugins"

# 显示帮助
show_help() {
    echo "MCP 搜索脚本"
    echo ""
    echo "用法: $0 <关键词>"
    echo ""
    echo "示例:"
    echo "  $0 github"
    echo "  $0 浏览器"
    echo "  $0 数据库"
    echo "  $0 项目管理"
}

# 搜索 MCP
search_mcp() {
    local keyword=$1
    local found=0

    echo "正在搜索与 '$keyword' 相关的 MCP 服务器..."
    echo ""
    echo "搜索结果:"
    echo "========================================"

    # 遍历所有 MCP 配置目录
    for dir in "$MCP_CONFIG_DIR"/*/; do
        if [ -d "$dir" ]; then
            local name=$(basename "$dir")
            local config_file="$dir/.mcp.json"

            if [ -f "$config_file" ]; then
                # 读取配置文件内容
                local content=$(cat "$config_file" 2>/dev/null)
                if [ -n "$content" ]; then
                    # 检查是否包含关键词（不区分大小写）
                    if echo "$content" | grep -qi "$keyword" || echo "$name" | grep -qi "$keyword"; then
                        found=1
                        echo "✓ $name"
                        echo "  配置文件: $config_file"

                        # 提取配置信息
                        local config=$(cat "$config_file" | python -c "import json, sys; data = json.load(sys.stdin); print(json.dumps(data, indent=2))" 2>/dev/null)
                        if [ -n "$config" ]; then
                            echo "  配置信息:"
                            echo "$config" | head -10 | sed 's/^/    /'
                        fi
                        echo ""
                    fi
                fi
            fi
        fi
    done

    if [ $found -eq 0 ]; then
        echo "未找到与 '$keyword' 相关的 MCP 服务器"
        echo ""
        echo "建议:"
        echo "  1. 尝试使用英文关键词"
        echo "  2. 使用更广泛的关键词"
        echo "  3. 查看所有可用的 MCP: $0"
    fi
}

# 列出所有 MCP
list_all_mcp() {
    echo "所有可用的 MCP 服务器:"
    echo "========================================"

    for dir in "$MCP_CONFIG_DIR"/*/; do
        if [ -d "$dir" ]; then
            local name=$(basename "$dir")
            local config_file="$dir/.mcp.json"

            if [ -f "$config_file" ]; then
                echo "✓ $name"
            fi
        fi
    done
}

# 主逻辑
if [ -z "$1" ]; then
    show_help
    echo ""
    list_all_mcp
    exit 0
fi

search_mcp "$1"
