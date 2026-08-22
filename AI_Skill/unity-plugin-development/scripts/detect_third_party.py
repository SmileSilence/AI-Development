#!/usr/bin/env python3
"""
Unity第三方包检测脚本
检测项目中使用的Asset Store资源和第三方包
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Set, Optional

# 已知第三方包配置
KNOWN_UNITY_PACKAGES = {
    # UI框架
    "TextMeshPro": {
        "name": "TextMeshPro",
        "description": "高质量文本渲染",
        "keywords": ["text", "tmp", "ui", "文本"],
        "doc_url": "https://docs.unity3d.com/Packages/com.unity.textmeshpro@latest"
    },
    "DOTween": {
        "name": "DOTween",
        "description": "动画缓动库",
        "keywords": ["tween", "animation", "动画", "缓动"],
        "doc_url": "http://dotween.demigiant.com/"
    },
    "LeanTween": {
        "name": "LeanTween",
        "description": "轻量级动画库",
        "keywords": ["tween", "animation", "动画"],
        "doc_url": ""
    },
    
    # 网络框架
    "Photon": {
        "name": "Photon Networking",
        "description": "Photon多人游戏网络框架",
        "keywords": ["photon", "networking", "多人游戏", "网络"],
        "doc_url": "https://doc.photonengine.com/"
    },
    "Mirror": {
        "name": "Mirror Networking",
        "description": "开源网络框架",
        "keywords": ["mirror", "networking", "多人游戏"],
        "doc_url": "https://mirror-networking.com/"
    },
    "FishNet": {
        "name": "Fish-Networking",
        "description": "高性能网络框架",
        "keywords": ["fishnet", "networking", "多人游戏"],
        "doc_url": "https://fish-networking.gitbook.io/"
    },
    
    # AI系统
    "BehaviorDesigner": {
        "name": "Behavior Designer",
        "description": "行为树编辑器",
        "keywords": ["behaviortree", "ai", "行为树"],
        "doc_url": "https://opsive.com/assets/behavior-designer/"
    },
    "AstarPathfinding": {
        "name": "A* Pathfinding Project",
        "description": "寻路系统",
        "keywords": ["pathfinding", "ai", "寻路"],
        "doc_url": "https://arongranberg.com/astar/"
    },
    "EmeraldAI": {
        "name": "Emerald AI",
        "description": "AI系统",
        "keywords": ["ai", "npc", "敌人"],
        "doc_url": "https://assetstore.unity.com/packages/tools/ai/emerald-ai-2-0-108525"
    },
    
    # 动画系统
    "Spine": {
        "name": "Spine",
        "description": "2D骨骼动画",
        "keywords": ["spine", "2d", "骨骼", "动画"],
        "doc_url": "https://esotericsoftware.com/spine-unity"
    },
    "Anima2D": {
        "name": "Anima2D",
        "description": "2D骨骼动画",
        "keywords": ["anima2d", "2d", "骨骼", "动画"],
        "doc_url": ""
    },
    
    # 物理系统
    "Obi": {
        "name": "Obi Rope/Cloth/Fluid",
        "description": "物理模拟（绳子/布料/流体）",
        "keywords": ["obi", "physics", "绳子", "布料", "流体"],
        "doc_url": "https://obi.virtualmethodstudio.com/"
    },
    
    # 音频系统
    "FMOD": {
        "name": "FMOD",
        "description": "专业音频引擎",
        "keywords": ["fmod", "audio", "音频"],
        "doc_url": "https://www.fmod.com/docs/"
    },
    "Wwise": {
        "name": "Wwise",
        "description": "专业音频引擎",
        "keywords": ["wwise", "audio", "音频"],
        "doc_url": "https://www.audiokinetic.com/library/"
    },
    
    # 特效系统
    "Particle": {
        "name": "Particle System Collections",
        "description": "粒子特效集合",
        "keywords": ["particle", "vfx", "粒子", "特效"],
        "doc_url": ""
    },
    
    # 存档系统
    "EasySave": {
        "name": "Easy Save",
        "description": "存档系统",
        "keywords": ["save", "load", "存档", "序列化"],
        "doc_url": "https://docs.moodkie.com/product/easy-save/"
    },
    
    # 对话系统
    "DialogueSystem": {
        "name": "Dialogue System",
        "description": "对话系统",
        "keywords": ["dialogue", "conversation", "对话"],
        "doc_url": "https://pixelcrushers.com/dialogue-system/"
    },
    "YarnSpinner": {
        "name": "Yarn Spinner",
        "description": "对话脚本系统",
        "keywords": ["yarn", "dialogue", "对话"],
        "doc_url": "https://yarnspinner.dev/"
    },
    
    # UI框架
    "FairyGUI": {
        "name": "FairyGUI",
        "description": "跨平台UI框架",
        "keywords": ["fairygui", "ui", "界面"],
        "doc_url": "https://www.fairygui.com/"
    },
    "NGUI": {
        "name": "NGUI",
        "description": "UI框架",
        "keywords": ["ngui", "ui", "界面"],
        "doc_url": ""
    },
    
    # 跨平台
    "PlayFab": {
        "name": "PlayFab",
        "description": "游戏后端服务",
        "keywords": ["playfab", "backend", "后端", "云服务"],
        "doc_url": "https://docs.microsoft.com/en-us/gaming/playfab/"
    },
    "Firebase": {
        "name": "Firebase",
        "description": "Google后端服务",
        "keywords": ["firebase", "backend", "后端"],
        "doc_url": "https://firebase.google.com/docs/unity"
    },
    
    # 广告和变现
    "AdMob": {
        "name": "Google AdMob",
        "description": "广告SDK",
        "keywords": ["admob", "ads", "广告", "变现"],
        "doc_url": "https://developers.google.com/admob/unity/quick-start"
    },
    "UnityAds": {
        "name": "Unity Ads",
        "description": "Unity广告",
        "keywords": ["unityads", "ads", "广告"],
        "doc_url": "https://docs.unity.com/ads/"
    },
    
    # 分析工具
    "GameAnalytics": {
        "name": "GameAnalytics",
        "description": "游戏分析",
        "keywords": ["analytics", "分析", "数据"],
        "doc_url": "https://gameanalytics.com/docs/"
    },
    
    # 编辑器扩展
    "OdinInspector": {
        "name": "Odin Inspector",
        "description": "编辑器Inspector扩展",
        "keywords": ["odin", "inspector", "editor", "编辑器"],
        "doc_url": "https://odininspector.com/"
    },
    "EditorExtensions": {
        "name": "Editor Extensions",
        "description": "编辑器工具集合",
        "keywords": ["editor", "tools", "编辑器", "工具"],
        "doc_url": ""
    }
}

class UnityPackageDetector:
    """Unity第三方包检测器"""
    
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.detected_packages: Dict[str, Dict] = {}
        self.asset_store_packages: List[str] = []
        
    def detect(self) -> Dict[str, Dict]:
        """检测第三方包"""
        self.detected_packages = {}
        self.asset_store_packages = []
        
        # 读取manifest.json
        manifest = self._read_manifest()
        
        # 扫描Packages目录
        self._scan_packages_directory(manifest)
        
        # 扫描Assets目录
        self._scan_assets_directory()
        
        # 扫描Plugins目录
        self._scan_plugins_directory()
        
        return self.detected_packages
    
    def _read_manifest(self) -> Dict:
        """读取manifest.json"""
        manifest_file = self.project_path / "Packages" / "manifest.json"
        if manifest_file.exists():
            try:
                with open(manifest_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {}
    
    def _scan_packages_directory(self, manifest: Dict):
        """扫描Packages目录"""
        packages_dir = self.project_path / "Packages"
        if not packages_dir.exists():
            return
        
        # 检查manifest中的依赖
        if "dependencies" in manifest:
            for package_name, version in manifest["dependencies"].items():
                # 检查是否是已知包
                for known_id, known_info in KNOWN_UNITY_PACKAGES.items():
                    if known_id.lower() in package_name.lower():
                        self.detected_packages[known_id] = {
                            **known_info,
                            "version": version,
                            "source": "manifest"
                        }
                        break
        
        # 扫描本地包
        for package_dir in packages_dir.iterdir():
            if package_dir.is_dir() and not package_dir.name.startswith('.'):
                package_json = package_dir / "package.json"
                if package_json.exists():
                    try:
                        with open(package_json, 'r', encoding='utf-8') as f:
                            package_data = json.load(f)
                            package_name = package_data.get("name", "")
                            
                            # 检查是否是已知包
                            for known_id, known_info in KNOWN_UNITY_PACKAGES.items():
                                if known_id.lower() in package_name.lower():
                                    if known_id not in self.detected_packages:
                                        self.detected_packages[known_id] = {
                                            **known_info,
                                            "version": package_data.get("version", "Unknown"),
                                            "source": "local_package"
                                        }
                                    break
                    except:
                        pass
    
    def _scan_assets_directory(self):
        """扫描Assets目录"""
        assets_dir = self.project_path / "Assets"
        if not assets_dir.exists():
            return
        
        # 扫描常见第三方插件目录
        for item in assets_dir.rglob("*"):
            if item.is_dir():
                dir_name = item.name
                
                # 检查是否是已知包
                for known_id, known_info in KNOWN_UNITY_PACKAGES.items():
                    if known_id.lower() in dir_name.lower():
                        if known_id not in self.detected_packages:
                            self.detected_packages[known_id] = {
                                **known_info,
                                "path": str(item),
                                "source": "assets_directory"
                            }
                        break
        
        # 检查.unitypackage文件
        for unitypackage in assets_dir.rglob("*.unitypackage"):
            self.asset_store_packages.append(unitypackage.stem)
    
    def _scan_plugins_directory(self):
        """扫描Plugins目录"""
        plugins_dir = self.project_path / "Assets" / "Plugins"
        if not plugins_dir.exists():
            return
        
        for item in plugins_dir.iterdir():
            if item.is_dir():
                dir_name = item.name
                
                for known_id, known_info in KNOWN_UNITY_PACKAGES.items():
                    if known_id.lower() in dir_name.lower():
                        if known_id not in self.detected_packages:
                            self.detected_packages[known_id] = {
                                **known_info,
                                "path": str(item),
                                "source": "plugins_directory"
                            }
                        break
    
    def get_doc_queries(self) -> List[Dict]:
        """获取文档查询建议"""
        queries = []
        
        for pkg_id, pkg_info in self.detected_packages.items():
            for keyword in pkg_info.get("keywords", []):
                queries.append({
                    "package": pkg_info["name"],
                    "keyword": keyword,
                    "query": f"{pkg_info['name']} {keyword}",
                    "doc_url": pkg_info.get("doc_url", "")
                })
        
        return queries
    
    def format_report(self) -> str:
        """格式化检测报告"""
        lines = []
        
        if self.detected_packages:
            lines.append("🔍 检测到的第三方包:")
            lines.append("=" * 60)
            
            for pkg_id, pkg_info in self.detected_packages.items():
                lines.append(f"\n📦 {pkg_info['name']}")
                lines.append(f"   描述: {pkg_info['description']}")
                lines.append(f"   关键词: {', '.join(pkg_info.get('keywords', []))}")
                if pkg_info.get('version'):
                    lines.append(f"   版本: {pkg_info['version']}")
                if pkg_info.get('doc_url'):
                    lines.append(f"   文档: {pkg_info['doc_url']}")
        
        if self.asset_store_packages:
            lines.append("\n\n📦 Asset Store资源:")
            lines.append("=" * 60)
            for pkg_name in self.asset_store_packages:
                lines.append(f"  - {pkg_name}")
        
        if not self.detected_packages and not self.asset_store_packages:
            return "未检测到第三方包。"
        
        lines.append("\n" + "=" * 60)
        lines.append("\n📚 建议查阅的文档:")
        
        for pkg_id, pkg_info in self.detected_packages.items():
            if pkg_info.get('doc_url'):
                lines.append(f"  - {pkg_info['name']}: {pkg_info['doc_url']}")
        
        return "\n".join(lines)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="检测Unity第三方包")
    parser.add_argument("project_path", nargs="?", default=".", help="项目路径")
    parser.add_argument("--json", action="store_true", help="JSON格式输出")
    parser.add_argument("--keywords", action="store_true", help="仅输出文档关键词")
    parser.add_argument("--urls", action="store_true", help="仅输出文档URL")
    
    args = parser.parse_args()
    
    detector = UnityPackageDetector(args.project_path)
    result = detector.detect()
    
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    elif args.keywords:
        for pkg_id, pkg_info in result.items():
            for keyword in pkg_info.get("keywords", []):
                print(keyword)
    elif args.urls:
        for pkg_id, pkg_info in result.items():
            if pkg_info.get("doc_url"):
                print(f"{pkg_info['name']}: {pkg_info['doc_url']}")
    else:
        print(detector.format_report())

if __name__ == "__main__":
    main()
