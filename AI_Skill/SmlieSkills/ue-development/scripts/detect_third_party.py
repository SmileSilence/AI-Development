#!/usr/bin/env python3
"""
UE项目第三方插件检测脚本
检测项目中使用的第三方插件，并提供文档获取建议
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Set, Optional

# 已知第三方插件配置
KNOWN_THIRD_PARTY_PLUGINS = {
    # 游戏框架
    "AdvancedSessions": {
        "name": "Advanced Sessions Plugin",
        "description": "高级会话管理插件",
        "keywords": ["session", "lobby", "multiplayer"],
        "doc_url": "https://forums.unrealengine.com/advanced-sessions-plugin"
    },
    "VaRest": {
        "name": "VaRest Plugin",
        "description": "REST API请求插件",
        "keywords": ["rest", "api", "http", "json"],
        "doc_url": "https://github.com/ufna/VaRest"
    },
    "HTTPRequests": {
        "name": "HTTP Requests",
        "description": "HTTP请求插件",
        "keywords": ["http", "request", "web"],
        "doc_url": ""
    },
    
    # UI框架
    "UIWS": {
        "name": "UIWS - UI Widget System",
        "description": "UI组件系统",
        "keywords": ["ui", "widget", "interface"],
        "doc_url": ""
    },
    
    # AI系统
    "DialoguePlugin": {
        "name": "Dialogue Plugin",
        "description": "对话系统插件",
        "keywords": ["dialogue", "conversation", "npc"],
        "doc_url": ""
    },
    "BehaviorTreeEditor": {
        "name": "Behavior Tree Editor",
        "description": "行为树编辑器扩展",
        "keywords": ["behaviortree", "ai", "editor"],
        "doc_url": ""
    },
    
    # 动画系统
    "AnimationPro": {
        "name": "Animation Pro",
        "description": "高级动画插件",
        "keywords": ["animation", "procedural", "ik"],
        "doc_url": ""
    },
    
    # 物理系统
    "DestructionPlugin": {
        "name": "Destruction Plugin",
        "description": "破坏系统插件",
        "keywords": ["destruction", "physics", "fracture"],
        "doc_url": ""
    },
    
    # 网络系统
    "NetworkingPlugin": {
        "name": "Networking Plugin",
        "description": "网络扩展插件",
        "keywords": ["networking", "replication", "multiplayer"],
        "doc_url": ""
    },
    
    # 音频系统
    "AudioPlugin": {
        "name": "Audio Plugin",
        "description": "音频扩展插件",
        "keywords": ["audio", "sound", "music"],
        "doc_url": ""
    },
    
    # 工具插件
    "EditorScripting": {
        "name": "Editor Scripting Utilities",
        "description": "编辑器脚本工具",
        "keywords": ["editor", "scripting", "automation"],
        "doc_url": ""
    },
    "BlenderTools": {
        "name": "Blender Tools",
        "description": "Blender集成工具",
        "keywords": ["blender", "import", "export"],
        "doc_url": ""
    },
    
    # 平台集成
    "OnlineSubsystemSteam": {
        "name": "Online Subsystem Steam",
        "description": "Steam在线子系统",
        "keywords": ["steam", "online", "platform"],
        "doc_url": "https://partner.steamgames.com/doc/sdk/api"
    },
    "OnlineSubsystemEOS": {
        "name": "Online Subsystem EOS",
        "description": "Epic在线服务",
        "keywords": ["eos", "epic", "online"],
        "doc_url": "https://dev.epicgames.com/docs"
    },
    
    # 渲染扩展
    "PostProcessVolume": {
        "name": "Post Process Volume",
        "description": "后处理效果扩展",
        "keywords": ["postprocess", "rendering", "effects"],
        "doc_url": ""
    },
    
    # 数据管理
    "DataTableEditor": {
        "name": "DataTable Editor",
        "description": "数据表编辑器扩展",
        "keywords": ["datatable", "data", "editor"],
        "doc_url": ""
    },
    
    # 调试工具
    "DebuggingTools": {
        "name": "Debugging Tools",
        "description": "调试工具插件",
        "keywords": ["debug", "logging", "profiling"],
        "doc_url": ""
    },
    
    # 游戏特定
    "InventorySystem": {
        "name": "Inventory System",
        "description": "背包系统插件",
        "keywords": ["inventory", "item", "gameplay"],
        "doc_url": ""
    },
    "QuestSystem": {
        "name": "Quest System",
        "description": "任务系统插件",
        "keywords": ["quest", "mission", "objective"],
        "doc_url": ""
    },
    "SaveSystem": {
        "name": "Save System",
        "description": "存档系统插件",
        "keywords": ["save", "load", "persistence"],
        "doc_url": ""
    },
    "DialogueSystem": {
        "name": "Dialogue System",
        "description": "对话系统插件",
        "keywords": ["dialogue", "conversation", "npc"],
        "doc_url": ""
    }
}

class ThirdPartyPluginDetector:
    """第三方插件检测器"""
    
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.detected_plugins: Dict[str, Dict] = {}
        self.unknown_plugins: List[str] = []
        
    def detect(self) -> Dict[str, Dict]:
        """检测第三方插件"""
        self.detected_plugins = {}
        self.unknown_plugins = []
        
        # 扫描Plugins目录
        plugins_dir = self.project_path / "Plugins"
        if plugins_dir.exists():
            self._scan_plugins_directory(plugins_dir)
        
        # 扫描.uplugin文件
        self._scan_uplugin_files()
        
        # 扫描Build.cs依赖
        self._scan_build_dependencies()
        
        return self.detected_plugins
    
    def _scan_plugins_directory(self, plugins_dir: Path):
        """扫描Plugins目录"""
        for plugin_dir in plugins_dir.iterdir():
            if plugin_dir.is_dir():
                # 查找.uplugin文件
                uplugin_files = list(plugin_dir.glob("*.uplugin"))
                for uplugin_file in uplugin_files:
                    self._analyze_uplugin(uplugin_file)
    
    def _scan_uplugin_files(self):
        """扫描所有.uplugin文件"""
        for uplugin_file in self.project_path.rglob("*.uplugin"):
            try:
                with open(uplugin_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # 清理JSON注释
                content = re.sub(r'//.*?\n', '\n', content)
                content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
                
                try:
                    plugin_data = json.loads(content)
                    plugin_name = plugin_data.get("Name", uplugin_file.stem)
                    
                    # 检查是否是已知插件
                    if plugin_name in KNOWN_THIRD_PARTY_PLUGINS:
                        self.detected_plugins[plugin_name] = {
                            **KNOWN_THIRD_PARTY_PLUGINS[plugin_name],
                            "path": str(uplugin_file.parent),
                            "version": plugin_data.get("VersionName", "Unknown")
                        }
                    else:
                        # 尝试从内容推断
                        self._infer_plugin_from_content(plugin_name, content, str(uplugin_file.parent))
                        
                except json.JSONDecodeError:
                    pass
                    
            except Exception as e:
                pass
    
    def _analyze_uplugin(self, uplugin_file: Path):
        """分析单个.uplugin文件"""
        try:
            with open(uplugin_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # 清理JSON注释
            content = re.sub(r'//.*?\n', '\n', content)
            content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
            
            try:
                plugin_data = json.loads(content)
                plugin_name = plugin_data.get("Name", uplugin_file.stem)
                
                # 检查是否是已知插件
                if plugin_name in KNOWN_THIRD_PARTY_PLUGINS:
                    self.detected_plugins[plugin_name] = {
                        **KNOWN_THIRD_PARTY_PLUGINS[plugin_name],
                        "path": str(uplugin_file.parent),
                        "version": plugin_data.get("VersionName", "Unknown")
                    }
                else:
                    self._infer_plugin_from_content(plugin_name, content, str(uplugin_file.parent))
                    
            except json.JSONDecodeError:
                pass
                
        except Exception as e:
            pass
    
    def _infer_plugin_from_content(self, plugin_name: str, content: str, path: str):
        """从内容推断插件类型"""
        content_lower = content.lower()
        
        # 检查常见关键词
        keyword_mapping = {
            "session": ("session", "会话管理"),
            "lobby": ("lobby", "大厅系统"),
            "multiplayer": ("multiplayer", "多人游戏"),
            "rest": ("rest", "REST API"),
            "api": ("api", "API接口"),
            "http": ("http", "HTTP请求"),
            "ui": ("ui", "界面系统"),
            "widget": ("widget", "UI组件"),
            "dialogue": ("dialogue", "对话系统"),
            "inventory": ("inventory", "背包系统"),
            "save": ("save", "存档系统"),
            "quest": ("quest", "任务系统"),
            "ai": ("ai", "人工智能"),
            "animation": ("animation", "动画系统"),
            "audio": ("audio", "音频系统"),
            "physics": ("physics", "物理系统"),
            "network": ("network", "网络系统"),
            "editor": ("editor", "编辑器扩展"),
            "debug": ("debug", "调试工具"),
            "platform": ("platform", "平台集成")
        }
        
        detected_keywords = []
        for keyword, (category, description) in keyword_mapping.items():
            if keyword in content_lower:
                detected_keywords.append(category)
        
        if detected_keywords:
            self.detected_plugins[plugin_name] = {
                "name": plugin_name,
                "description": f"第三方插件 ({', '.join(detected_keywords)})",
                "keywords": detected_keywords,
                "doc_url": "",
                "path": path,
                "inferred": True
            }
        else:
            self.unknown_plugins.append(plugin_name)
    
    def _scan_build_dependencies(self):
        """扫描Build.cs依赖"""
        for build_cs in self.project_path.rglob("*.Build.cs"):
            try:
                with open(build_cs, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # 提取依赖模块
                dependency_pattern = r'PublicDependencyModuleNames\.AddRange\(new string\[\]\s*\{([^}]+)\}'
                private_pattern = r'PrivateDependencyModuleNames\.AddRange\(new string\[\]\s*\{([^}]+)\}'
                
                for pattern in [dependency_pattern, private_pattern]:
                    matches = re.findall(pattern, content, re.DOTALL)
                    for match in matches:
                        # 提取模块名
                        modules = re.findall(r'"([^"]+)"', match)
                        for module in modules:
                            # 检查是否是已知第三方模块
                            if module in KNOWN_THIRD_PARTY_PLUGINS:
                                if module not in self.detected_plugins:
                                    self.detected_plugins[module] = {
                                        **KNOWN_THIRD_PARTY_PLUGINS[module],
                                        "path": str(build_cs.parent),
                                        "source": "build_dependency"
                                    }
                                    
            except Exception as e:
                pass
    
    def get_doc_queries(self) -> List[Dict]:
        """获取文档查询建议"""
        queries = []
        
        for plugin_id, plugin_info in self.detected_plugins.items():
            for keyword in plugin_info.get("keywords", []):
                queries.append({
                    "plugin": plugin_info["name"],
                    "keyword": keyword,
                    "query": f"{plugin_info['name']} {keyword}",
                    "doc_url": plugin_info.get("doc_url", "")
                })
        
        return queries
    
    def format_report(self) -> str:
        """格式化检测报告"""
        lines = []
        
        if self.detected_plugins:
            lines.append("🔍 检测到的第三方插件:")
            lines.append("=" * 60)
            
            for plugin_id, plugin_info in self.detected_plugins.items():
                lines.append(f"\n📦 {plugin_info['name']}")
                lines.append(f"   描述: {plugin_info['description']}")
                lines.append(f"   关键词: {', '.join(plugin_info.get('keywords', []))}")
                if plugin_info.get('version'):
                    lines.append(f"   版本: {plugin_info['version']}")
                if plugin_info.get('doc_url'):
                    lines.append(f"   文档: {plugin_info['doc_url']}")
        
        if self.unknown_plugins:
            lines.append("\n\n❓ 未识别的插件:")
            lines.append("=" * 60)
            for plugin_name in self.unknown_plugins:
                lines.append(f"  - {plugin_name}")
        
        if not self.detected_plugins and not self.unknown_plugins:
            return "未检测到第三方插件。"
        
        lines.append("\n" + "=" * 60)
        lines.append("\n📚 建议查阅的文档:")
        
        for plugin_id, plugin_info in self.detected_plugins.items():
            if plugin_info.get('doc_url'):
                lines.append(f"  - {plugin_info['name']}: {plugin_info['doc_url']}")
            else:
                for keyword in plugin_info.get('keywords', []):
                    lines.append(f"  - {plugin_info['name']}: 搜索 '{keyword}' 相关文档")
        
        return "\n".join(lines)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="检测UE项目第三方插件")
    parser.add_argument("project_path", nargs="?", default=".", help="项目路径")
    parser.add_argument("--json", action="store_true", help="JSON格式输出")
    parser.add_argument("--keywords", action="store_true", help="仅输出文档关键词")
    parser.add_argument("--urls", action="store_true", help="仅输出文档URL")
    
    args = parser.parse_args()
    
    detector = ThirdPartyPluginDetector(args.project_path)
    result = detector.detect()
    
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    elif args.keywords:
        for plugin_id, plugin_info in result.items():
            for keyword in plugin_info.get("keywords", []):
                print(keyword)
    elif args.urls:
        for plugin_id, plugin_info in result.items():
            if plugin_info.get("doc_url"):
                print(f"{plugin_info['name']}: {plugin_info['doc_url']}")
    else:
        print(detector.format_report())

if __name__ == "__main__":
    main()
