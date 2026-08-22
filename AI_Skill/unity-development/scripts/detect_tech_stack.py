#!/usr/bin/env python3
"""
Unity项目技术栈检测脚本
检测项目中使用的渲染管线、框架、SDK等
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Set, Optional

# Unity技术栈配置
UNITY_TECH_STACK = {
    # 渲染管线
    "urp": {
        "name": "Universal Render Pipeline (URP)",
        "detect_patterns": [
            r"com\.unity\.render-pipelines\.universal",
            r"UniversalRenderPipeline",
            r"URP"
        ],
        "search_paths": [
            "Packages/manifest.json",
            "Assets/**/URP*"
        ],
        "doc_keywords": ["urp", "universal render pipeline", "渲染管线"]
    },
    "hdrp": {
        "name": "High Definition Render Pipeline (HDRP)",
        "detect_patterns": [
            r"com\.unity\.render-pipelines\.high-definition",
            r"HDRenderPipeline",
            r"HDRP"
        ],
        "search_paths": [
            "Packages/manifest.json",
            "Assets/**/HDRP*"
        ],
        "doc_keywords": ["hdrp", "high definition", "渲染管线"]
    },
    "birp": {
        "name": "Built-in Render Pipeline",
        "detect_patterns": [
            r"RenderPipelineManager",
            r"GraphicsSettings"
        ],
        "search_paths": [],
        "doc_keywords": ["built-in", "render pipeline", "渲染管线"]
    },
    
    # UI框架
    "ui_toolkit": {
        "name": "UI Toolkit",
        "detect_patterns": [
            r"com\.unity\.ui",
            r"UIElements",
            r"UIDocument",
            r"VisualElement"
        ],
        "search_paths": [
            "Packages/manifest.json",
            "Assets/**/*.uxml",
            "Assets/**/*.uss"
        ],
        "doc_keywords": ["ui toolkit", "uitoolkit", "ui", "界面"]
    },
    "ugui": {
        "name": "Unity UI (uGUI)",
        "detect_patterns": [
            r"UnityEngine\.UI",
            r"Canvas",
            r"RectTransform",
            r"Button",
            r"TextMeshPro"
        ],
        "search_paths": [
            "Assets/**/*.prefab"
        ],
        "doc_keywords": ["ugui", "canvas", "ui", "界面"]
    },
    
    # 网络框架
    "netcode": {
        "name": "Netcode for GameObjects",
        "detect_patterns": [
            r"com\.unity\.netcode\.gameobjects",
            r"NetworkManager",
            r"NetworkBehaviour",
            r"NetworkObject"
        ],
        "search_paths": [
            "Packages/manifest.json"
        ],
        "doc_keywords": ["netcode", "networking", "多人游戏", "网络"]
    },
    "fishnet": {
        "name": "Fish-Networking",
        "detect_patterns": [
            r"FishNet",
            r"FishNetworking",
            r"NetworkManager"
        ],
        "search_paths": [
            "Assets/**/FishNet*",
            "Plugins/**/FishNet*"
        ],
        "doc_keywords": ["fishnet", "networking", "多人游戏"]
    },
    "mirror": {
        "name": "Mirror Networking",
        "detect_patterns": [
            r"Mirror",
            r"NetworkManager",
            r"NetworkBehaviour"
        ],
        "search_paths": [
            "Assets/**/Mirror*",
            "Plugins/**/Mirror*"
        ],
        "doc_keywords": ["mirror", "networking", "多人游戏"]
    },
    
    # ECS框架
    "dots": {
        "name": "Unity DOTS (ECS)",
        "detect_patterns": [
            r"com\.unity\.entities",
            r"EntityManager",
            r"IComponentData",
            r"SystemBase",
            r"ISystem"
        ],
        "search_paths": [
            "Packages/manifest.json"
        ],
        "doc_keywords": ["dots", "ecs", "entities", "实体组件系统"]
    },
    
    # 动画系统
    "animation_rigging": {
        "name": "Animation Rigging",
        "detect_patterns": [
            r"com\.unity\.animation",
            r"RigBuilder",
            r"Rig"
        ],
        "search_paths": [
            "Packages/manifest.json"
        ],
        "doc_keywords": ["animation rigging", "动画", "骨骼"]
    },
    
    # 物理系统
    "havok": {
        "name": "Havok Physics",
        "detect_patterns": [
            r"com\.unity\.havok\.physics",
            r"Havok"
        ],
        "search_paths": [
            "Packages/manifest.json"
        ],
        "doc_keywords": ["havok", "physics", "物理"]
    },
    
    # 粒子系统
    "vfx_graph": {
        "name": "Visual Effect Graph",
        "detect_patterns": [
            r"com\.unity\.visualeffectgraph",
            r"VisualEffect",
            r"VFXGraph"
        ],
        "search_paths": [
            "Packages/manifest.json",
            "Assets/**/*.vfx"
        ],
        "doc_keywords": ["vfx graph", "visual effect", "粒子", "特效"]
    },
    
    # 音频
    "fmod": {
        "name": "FMOD",
        "detect_patterns": [
            r"FMOD",
            r"FMODUnity",
            r"StudioEventEmitter"
        ],
        "search_paths": [
            "Assets/**/FMOD*",
            "Plugins/**/FMOD*"
        ],
        "doc_keywords": ["fmod", "audio", "音频"]
    },
    "wwise": {
        "name": "Wwise",
        "detect_patterns": [
            r"Wwise",
            r"AkSoundEngine",
            r"AkEvent"
        ],
        "search_paths": [
            "Assets/**/Wwise*",
            "Plugins/**/Wwise*"
        ],
        "doc_keywords": ["wwise", "audio", "音频"]
    },
    
    # AI系统
    "behavior_desinger": {
        "name": "Behavior Designer",
        "detect_patterns": [
            r"BehaviorDesigner",
            r"BehaviorTree",
            r"Task"
        ],
        "search_paths": [
            "Assets/**/BehaviorDesigner*",
            "Plugins/**/BehaviorDesigner*"
        ],
        "doc_keywords": ["behavior designer", "ai", "行为树"]
    },
    "a_star": {
        "name": "A* Pathfinding Project",
        "detect_patterns": [
            r"Pathfinding",
            r"AstarPath",
            r"Seeker"
        ],
        "search_paths": [
            "Assets/**/AstarPathfindingProject*",
            "Plugins/**/AstarPathfindingProject*"
        ],
        "doc_keywords": ["a star", "pathfinding", "寻路", "ai"]
    },
    
    # 跨平台
    "xr": {
        "name": "XR Interaction Toolkit",
        "detect_patterns": [
            r"com\.unity\.xr\.interaction",
            r"XRInteractionToolkit",
            r"XRController"
        ],
        "search_paths": [
            "Packages/manifest.json"
        ],
        "doc_keywords": ["xr", "vr", "ar", "虚拟现实"]
    },
    
    # 移动平台
    "admob": {
        "name": "Google AdMob",
        "detect_patterns": [
            r"GoogleMobileAds",
            r"AdMob",
            r"BannerView"
        ],
        "search_paths": [
            "Assets/**/GoogleMobileAds*",
            "Plugins/**/GoogleMobileAds*"
        ],
        "doc_keywords": ["admob", "ads", "广告"]
    },
    
    # 分析工具
    "analytics": {
        "name": "Unity Analytics",
        "detect_patterns": [
            r"com\.unity\.analytics",
            r"AnalyticsService",
            r"AnalyticsEvent"
        ],
        "search_paths": [
            "Packages/manifest.json"
        ],
        "doc_keywords": ["analytics", "分析", "数据"]
    }
}

class UnityTechStackDetector:
    """Unity技术栈检测器"""
    
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.detected_stack: Dict[str, Dict] = {}
        
    def detect(self) -> Dict[str, Dict]:
        """检测项目技术栈"""
        self.detected_stack = {}
        
        # 首先读取manifest.json
        manifest = self._read_manifest()
        
        for tech_id, config in UNITY_TECH_STACK.items():
            if self._detect_technology(tech_id, config, manifest):
                self.detected_stack[tech_id] = {
                    "name": config["name"],
                    "doc_keywords": config["doc_keywords"]
                }
        
        return self.detected_stack
    
    def _read_manifest(self) -> Dict:
        """读取Packages/manifest.json"""
        manifest_file = self.project_path / "Packages" / "manifest.json"
        if manifest_file.exists():
            try:
                with open(manifest_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {}
    
    def _detect_technology(self, tech_id: str, config: Dict, manifest: Dict) -> bool:
        """检测特定技术"""
        # 检查manifest.json中的依赖
        if "dependencies" in manifest:
            for pattern in config["detect_patterns"]:
                for key in manifest["dependencies"]:
                    if re.search(pattern, key, re.IGNORECASE):
                        return True
        
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
        extensions = [".cs", ".json", ".asset", ".unity", ".prefab", ".uxml", ".uss"]
        
        for ext in extensions:
            for file_path in self.project_path.rglob(f"*{ext}"):
                try:
                    if file_path.stat().st_size > 1_000_000:
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
            return "未检测到特殊技术栈，使用标准Unity开发流程。"
        
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
    
    parser = argparse.ArgumentParser(description="检测Unity项目技术栈")
    parser.add_argument("project_path", nargs="?", default=".", help="项目路径")
    parser.add_argument("--json", action="store_true", help="JSON格式输出")
    parser.add_argument("--keywords", action="store_true", help="仅输出文档关键词")
    
    args = parser.parse_args()
    
    detector = UnityTechStackDetector(args.project_path)
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
