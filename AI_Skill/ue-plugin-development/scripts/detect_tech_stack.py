#!/usr/bin/env python3
"""
UE项目技术栈检测脚本
检测项目中使用的第三方库、插件、框架
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Set, Optional

# 技术栈配置
TECH_STACK_CONFIG = {
    # Lua集成
    "lua": {
        "name": "Lua脚本",
        "detect_patterns": [
            r"slua[\-_]unreal",
            r"unlua",
            r"puerts",
            r"lua[\-_]plugin",
            r"lua\.h",
            r"luaconf\.h",
            r"\.lua$"
        ],
        "search_paths": [
            "Plugins/*lua*",
            "Plugins/*Lua*",
            "Plugins/*slua*",
            "Plugins/*unlua*",
            "Plugins/*puerts*",
            "Source/**/lua*",
            "Content/**/*.lua"
        ],
        "doc_keywords": ["lua", "slua", "unlua", "puerts", "脚本绑定"]
    },
    
    # Python集成
    "python": {
        "name": "Python脚本",
        "detect_patterns": [
            r"python",
            r"PythonEnvironment",
            r"\.py$"
        ],
        "search_paths": [
            "Plugins/*python*",
            "Plugins/*Python*",
            "Content/**/*.py"
        ],
        "doc_keywords": ["python", "scripting", "automation"]
    },
    
    # UI框架
    "commonui": {
        "name": "CommonUI框架",
        "detect_patterns": [
            r"CommonUI",
            r"CommonActivatableWidget",
            r"UCommonUIExtensions"
        ],
        "search_paths": [
            "Plugins/*CommonUI*",
            "Source/**/CommonUI*"
        ],
        "doc_keywords": ["commonui", "ui", "界面框架"]
    },
    
    # 网络框架
    "eos": {
        "name": "Epic Online Services",
        "detect_patterns": [
            r"EOS",
            r"OnlineSubsystemEOS",
            r"EpicOnlineServices"
        ],
        "search_paths": [
            "Plugins/*EOS*",
            "Plugins/*Online*",
            "Source/**/EOS*"
        ],
        "doc_keywords": ["eos", "online", "多人游戏", "网络"]
    },
    
    "steam": {
        "name": "Steam集成",
        "detect_patterns": [
            r"Steam",
            r"OnlineSubsystemSteam",
            r"Steamworks"
        ],
        "search_paths": [
            "Plugins/*Steam*",
            "Source/**/Steam*"
        ],
        "doc_keywords": ["steam", "steamworks", "平台集成"]
    },
    
    # 物理引擎
    "chaos": {
        "name": "Chaos物理",
        "detect_patterns": [
            r"Chaos",
            r"ChaosPhysics",
            r"GeometryCollection"
        ],
        "search_paths": [
            "Source/**/Chaos*"
        ],
        "doc_keywords": ["chaos", "physics", "物理"]
    },
    
    # 动画系统
    "controlrig": {
        "name": "ControlRig",
        "detect_patterns": [
            r"ControlRig",
            r"UControlRig"
        ],
        "search_paths": [
            "Plugins/*ControlRig*",
            "Source/**/ControlRig*"
        ],
        "doc_keywords": ["controlrig", "动画", "骨骼"]
    },
    
    # 渲染
    "niagara": {
        "name": "Niagara粒子",
        "detect_patterns": [
            r"Niagara",
            r"UNiagaraComponent",
            r"NiagaraSystem"
        ],
        "search_paths": [
            "Source/**/Niagara*"
        ],
        "doc_keywords": ["niagara", "粒子", "特效"]
    },
    
    # 人工智能
    "massai": {
        "name": "Mass AI",
        "detect_patterns": [
            r"MassAI",
            r"MassEntity",
            r"UMassEntity"
        ],
        "search_paths": [
            "Plugins/*Mass*",
            "Source/**/Mass*"
        ],
        "doc_keywords": ["mass", "ai", "entity", "大规模AI"]
    },
    
    "behaviortree": {
        "name": "行为树",
        "detect_patterns": [
            r"BehaviorTree",
            r"UBehaviorTree",
            r"BlackboardComponent"
        ],
        "search_paths": [
            "Source/**/BehaviorTree*"
        ],
        "doc_keywords": ["behaviortree", "ai", "行为树", "黑板"]
    },
    
    # 音频
    "metasounds": {
        "name": "MetaSounds",
        "detect_patterns": [
            r"MetaSounds",
            r"UMetaSoundSource"
        ],
        "search_paths": [
            "Source/**/MetaSound*"
        ],
        "doc_keywords": ["metasounds", "audio", "音频"]
    },
    
    # 编辑器扩展
    "editorextension": {
        "name": "编辑器扩展",
        "detect_patterns": [
            r"FExtensibilityManager",
            r"IToolkit",
            r"FTabManager",
            r"IDetailCustomization"
        ],
        "search_paths": [
            "Source/**/Editor*"
        ],
        "doc_keywords": ["editor", "extension", "编辑器扩展"]
    },
    
    # 数据序列化
    "json": {
        "name": "JSON序列化",
        "detect_patterns": [
            r"FJsonObject",
            r"FJsonSerializer",
            r"JsonUtilities"
        ],
        "search_paths": [
            "Source/**/Json*"
        ],
        "doc_keywords": ["json", "serialization", "序列化"]
    },
    
    # 图形API
    "vulkan": {
        "name": "Vulkan图形API",
        "detect_patterns": [
            r"Vulkan",
            r"VK_",
            r"vulkan\.h"
        ],
        "search_paths": [
            "Source/**/Vulkan*"
        ],
        "doc_keywords": ["vulkan", "graphics", "图形"]
    },
    
    # 平台特定
    "android": {
        "name": "Android平台",
        "detect_patterns": [
            r"Android",
            r"\.java$",
            r"\.gradle$",
            r"AndroidManifest\.xml"
        ],
        "search_paths": [
            "Source/**/Android*",
            "Build/Android*"
        ],
        "doc_keywords": ["android", "mobile", "移动端"]
    },
    
    "ios": {
        "name": "iOS平台",
        "detect_patterns": [
            r"iOS",
            r"\.m$",
            r"\.mm$",
            r"Info\.plist"
        ],
        "search_paths": [
            "Source/**/iOS*",
            "Build/IOS*"
        ],
        "doc_keywords": ["ios", "mobile", "移动端"]
    }
}

class TechStackDetector:
    """技术栈检测器"""
    
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.detected_stack: Dict[str, Dict] = {}
        
    def detect(self) -> Dict[str, Dict]:
        """检测项目技术栈"""
        self.detected_stack = {}
        
        for tech_id, config in TECH_STACK_CONFIG.items():
            if self._detect_technology(tech_id, config):
                self.detected_stack[tech_id] = {
                    "name": config["name"],
                    "doc_keywords": config["doc_keywords"]
                }
        
        return self.detected_stack
    
    def _detect_technology(self, tech_id: str, config: Dict) -> bool:
        """检测特定技术"""
        # 检查文件内容
        for pattern in config["detect_patterns"]:
            if self._search_in_files(pattern):
                return True
        
        # 检查目录结构
        for search_path in config["search_paths"]:
            if self._check_directory_pattern(search_path):
                return True
        
        return False
    
    def _search_in_files(self, pattern: str) -> bool:
        """在文件中搜索模式"""
        extensions = [".h", ".cpp", ".cs", ".uplugin", ".uproject", ".ini"]
        
        for ext in extensions:
            for file_path in self.project_path.rglob(f"*{ext}"):
                try:
                    if file_path.stat().st_size > 1_000_000:  # 跳过大文件
                        continue
                    content = file_path.read_text(encoding='utf-8', errors='ignore')
                    if re.search(pattern, content, re.IGNORECASE):
                        return True
                except:
                    continue
        
        return False
    
    def _check_directory_pattern(self, pattern: str) -> bool:
        """检查目录模式"""
        try:
            # 处理通配符
            matches = list(self.project_path.glob(pattern))
            return len(matches) > 0
        except:
            return False
    
    def get_doc_queries(self) -> List[Dict]:
        """获取文档查询建议"""
        queries = []
        
        for tech_id, tech_info in self.detected_stack.items():
            for keyword in tech_info["doc_keywords"]:
                queries.append({
                    "technology": tech_info["name"],
                    "keyword": keyword,
                    "query": f"{tech_info['name']} {keyword}"
                })
        
        return queries
    
    def format_report(self) -> str:
        """格式化检测报告"""
        if not self.detected_stack:
            return "未检测到特殊技术栈，使用标准UE开发流程。"
        
        lines = []
        lines.append("🔍 检测到的技术栈:")
        lines.append("=" * 50)
        
        for tech_id, tech_info in self.detected_stack.items():
            lines.append(f"\n📦 {tech_info['name']}")
            lines.append(f"   关键词: {', '.join(tech_info['doc_keywords'])}")
        
        lines.append("\n" + "=" * 50)
        lines.append("\n📚 建议查阅的文档主题:")
        
        for tech_id, tech_info in self.detected_stack.items():
            lines.append(f"  - {tech_info['name']} 官方文档")
        
        return "\n".join(lines)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="检测UE项目技术栈")
    parser.add_argument("project_path", nargs="?", default=".", help="项目路径")
    parser.add_argument("--json", action="store_true", help="JSON格式输出")
    parser.add_argument("--keywords", action="store_true", help="仅输出文档关键词")
    
    args = parser.parse_args()
    
    detector = TechStackDetector(args.project_path)
    result = detector.detect()
    
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    elif args.keywords:
        for tech_id, tech_info in result.items():
            for keyword in tech_info["doc_keywords"]:
                print(keyword)
    else:
        print(detector.format_report())

if __name__ == "__main__":
    main()
