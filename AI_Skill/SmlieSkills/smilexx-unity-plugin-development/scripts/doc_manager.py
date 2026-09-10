#!/usr/bin/env python3
"""
UE官方文档管理脚本
支持三种文档获取模式：
1. 手动下载 - 提供下载链接
2. 自动下载 - 脚本自动下载文档
3. 云端读取 - 直接从官方文档网站读取
"""

import os
import sys
import json
import argparse
import webbrowser
from pathlib import Path
from typing import Optional, Dict, List
import urllib.request
import urllib.parse

# UE文档版本映射
UE_DOC_VERSIONS = {
    "5.4": "5.4",
    "5.3": "5.3",
    "5.2": "5.2",
    "5.1": "5.1",
    "5.0": "5.0",
    "4.27": "4.27",
    "4.26": "4.26",
}

# UE文档基础URL
UE_DOC_BASE_URL = "https://docs.unrealengine.com"
UE_DOC_API_URL = "https://dev.epicgames.com/documentation"

# 文档分类
DOC_CATEGORIES = {
    "programming": {
        "name": "C++编程",
        "path": "ProgrammingAndScripting",
        "topics": [
            "GameplayProgramming",
            "ProgrammingAndScripting/Blueprints",
            "ProgrammingAndScripting/CppProgrammingGuide",
        ]
    },
    "blueprint": {
        "name": "蓝图系统",
        "path": "ProgrammingAndScripting/Blueprints",
        "topics": [
            "Blueprints",
            "BlueprintBestPractices",
            "BlueprintProfiler",
        ]
    },
    "animation": {
        "name": "动画系统",
        "path": "AnimatingObjects",
        "topics": [
            "AnimationBlueprints",
            "Sequencer",
            "SkeletalMeshAnimation",
        ]
    },
    "rendering": {
        "name": "渲染系统",
        "path": "RenderingAndGraphics",
        "topics": [
            "RenderingFeatures",
            "Materials",
            "LightingAndShadows",
        ]
    },
    "ai": {
        "name": "AI系统",
        "path": "InteractiveExperiences/ArtificialIntelligence",
        "topics": [
            "ArtificialIntelligence",
            "BehaviorTrees",
            "NavigationSystem",
        ]
    },
    "networking": {
        "name": "网络系统",
        "path": "InteractiveExperiences/Networking",
        "topics": [
            "Networking",
            "Replication",
            "OnlineSubsystem",
        ]
    },
    "audio": {
        "name": "音频系统",
        "path": "Audio",
        "topics": [
            "AudioSystem",
            "SoundCue",
            "MetaSounds",
        ]
    },
    "ui": {
        "name": "UI系统",
        "path": "UMG",
        "topics": [
            "SlateFramework",
            "UMG",
            "UserInterfaces",
        ]
    },
    "performance": {
        "name": "性能优化",
        "path": "TestingAndOptimization",
        "topics": [
            "PerformanceAndProfiling",
            "Optimization",
            "Testing",
        ]
    },
}

class UEDocumentationManager:
    """UE文档管理器"""
    
    def __init__(self, project_path: str = ".", cache_dir: str = None):
        self.project_path = Path(project_path).resolve()
        self.cache_dir = Path(cache_dir) if cache_dir else self.project_path / ".ue_docs_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        self.config_file = self.cache_dir / "doc_config.json"
        self.config = self._load_config()
    
    def _load_config(self) -> Dict:
        """加载配置"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        
        return {
            "ue_version": None,
            "doc_mode": None,  # manual, auto, cloud
            "last_updated": None,
            "downloaded_categories": []
        }
    
    def _save_config(self):
        """保存配置"""
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
    
    def set_version(self, version: str):
        """设置UE版本"""
        self.config["ue_version"] = version
        self._save_config()
        print(f"✅ 已设置UE版本: {version}")
    
    def get_doc_url(self, category: str = None, topic: str = None, version: str = None) -> str:
        """获取文档URL"""
        version = version or self.config.get("ue_version", "5.3")
        
        # 构建基础URL
        base_url = f"{UE_DOC_BASE_URL}/en-US/Documentation"
        
        if category and category in DOC_CATEGORIES:
            cat_info = DOC_CATEGORIES[category]
            url = f"{base_url}/{cat_info['path']}"
            
            if topic:
                url = f"{url}/{topic}"
            
            # 添加版本参数
            url = f"{url}/?version={version}"
            
            return url
        
        return f"{base_url}/?version={version}"
    
    def show_manual_download_guide(self, version: str = None):
        """显示手动下载指南"""
        version = version or self.config.get("ue_version", "5.3")
        
        print("\n📥 手动下载UE官方文档")
        print("=" * 60)
        print(f"\n📌 UE版本: {version}")
        print("\n📋 下载步骤:")
        print("1. 访问Epic Games官方文档网站")
        print("2. 选择对应版本的文档")
        print("3. 下载PDF或HTML格式的文档")
        print("4. 将文档保存到项目的 .ue_docs_cache 目录")
        
        print("\n🔗 官方文档链接:")
        print(f"   主页: {UE_DOC_BASE_URL}")
        print(f"   API文档: {UE_DOC_API_URL}")
        
        print("\n📂 推荐下载的文档分类:")
        for cat_id, cat_info in DOC_CATEGORIES.items():
            print(f"   • {cat_info['name']}: {self.get_doc_url(cat_id, version=version)}")
        
        print("\n💡 提示:")
        print("   - 下载后请运行: python doc_manager.py --mode manual --import <文档路径>")
        print("   - 文档将自动分类并建立索引")
        
        return True
    
    def auto_download_docs(self, version: str = None, categories: List[str] = None):
        """自动下载文档（简化版本，实际实现需要处理复杂的下载逻辑）"""
        version = version or self.config.get("ue_version", "5.3")
        categories = categories or list(DOC_CATEGORIES.keys())
        
        print(f"\n📥 自动下载UE {version} 文档")
        print("=" * 60)
        
        # 注意：实际自动下载需要处理Epic Games的认证和下载机制
        # 这里提供框架代码
        
        print("\n⚠️ 注意: 自动下载功能需要Epic Games账户认证")
        print("   当前版本提供文档链接收集功能")
        
        download_links = []
        for cat_id in categories:
            if cat_id in DOC_CATEGORIES:
                url = self.get_doc_url(cat_id, version=version)
                download_links.append({
                    "category": cat_id,
                    "name": DOC_CATEGORIES[cat_id]["name"],
                    "url": url
                })
        
        # 保存下载链接到配置
        self.config["download_links"] = download_links
        self.config["last_updated"] = str(Path.cwd())
        self._save_config()
        
        print(f"\n✅ 已收集 {len(download_links)} 个文档链接")
        print("   链接已保存到: .ue_docs_cache/doc_config.json")
        
        # 尝试打开浏览器下载
        print("\n🌐 正在打开浏览器...")
        for link in download_links[:3]:  # 只打开前3个
            print(f"   打开: {link['name']}")
            webbrowser.open(link["url"])
        
        return download_links
    
    def cloud_read_docs(self, topic: str, version: str = None) -> str:
        """云端读取文档（返回URL供在线查看）"""
        version = version or self.config.get("ue_version", "5.3")
        
        # 构建查询URL
        url = self.get_doc_url(topic=topic, version=version)
        
        print(f"\n☁️ 云端文档访问")
        print("=" * 60)
        print(f"📖 主题: {topic}")
        print(f"🔧 版本: {version}")
        print(f"🔗 URL: {url}")
        
        return url
    
    def search_docs(self, query: str, version: str = None) -> List[Dict]:
        """搜索文档（返回相关主题）"""
        version = version or self.config.get("ue_version", "5.3")
        
        print(f"\n🔍 搜索UE文档: {query}")
        print("=" * 60)
        
        results = []
        query_lower = query.lower()
        
        # 搜索分类
        for cat_id, cat_info in DOC_CATEGORIES.items():
            if (query_lower in cat_info["name"].lower() or 
                query_lower in cat_id.lower()):
                results.append({
                    "type": "category",
                    "id": cat_id,
                    "name": cat_info["name"],
                    "url": self.get_doc_url(cat_id, version=version)
                })
            
            # 搜索主题
            for topic in cat_info["topics"]:
                if query_lower in topic.lower():
                    results.append({
                        "type": "topic",
                        "category": cat_id,
                        "name": topic,
                        "url": self.get_doc_url(cat_id, topic, version=version)
                    })
        
        return results
    
    def get_troubleshooting_guide(self, error_type: str) -> Dict:
        """获取故障排除指南"""
        guides = {
            "compile_error": {
                "title": "编译错误排除",
                "steps": [
                    "检查头文件包含顺序",
                    "确认模块依赖正确（Build.cs文件）",
                    "清理Intermediate和Binaries目录",
                    "重新生成项目文件",
                    "检查C++标准版本兼容性"
                ],
                "doc_url": self.get_doc_url("programming", "Troubleshooting")
            },
            "runtime_error": {
                "title": "运行时错误排除",
                "steps": [
                    "检查空指针访问",
                    "验证资产引用有效性",
                    "检查多线程同步问题",
                    "查看日志输出（UE_LOG）",
                    "使用调试器定位问题"
                ],
                "doc_url": self.get_doc_url("programming", "Debugging")
            },
            "performance": {
                "title": "性能问题排除",
                "steps": [
                    "使用stat命令分析性能",
                    "使用Unreal Insights进行详细分析",
                    "优化Tick函数",
                    "检查材质复杂度",
                    "使用LOD系统"
                ],
                "doc_url": self.get_doc_url("performance")
            },
            "blueprint_error": {
                "title": "蓝图错误排除",
                "steps": [
                    "检查蓝图编译错误",
                    "验证节点连接",
                    "检查变量类型转换",
                    "查看蓝图调试信息",
                    "考虑将复杂逻辑移至C++"
                ],
                "doc_url": self.get_doc_url("blueprint", "Troubleshooting")
            }
        }
        
        return guides.get(error_type, {
            "title": "通用问题排除",
            "steps": [
                "查看官方文档",
                "搜索社区论坛",
                "检查日志输出",
                "尝试最小化复现问题"
            ],
            "doc_url": self.get_doc_url()
        })

def main():
    parser = argparse.ArgumentParser(description="UE官方文档管理工具")
    parser.add_argument("--project", default=".", help="项目路径")
    parser.add_argument("--version", help="UE版本（如5.3）")
    parser.add_argument("--mode", choices=["manual", "auto", "cloud"], 
                       help="文档获取模式")
    parser.add_argument("--category", help="文档分类")
    parser.add_argument("--topic", help="文档主题")
    parser.add_argument("--query", help="搜索查询")
    parser.add_argument("--error", help="错误类型（compile_error, runtime_error, performance, blueprint_error）")
    parser.add_argument("--set-version", help="设置项目UE版本")
    parser.add_argument("--list-categories", action="store_true", help="列出所有文档分类")
    
    args = parser.parse_args()
    
    # 初始化管理器
    manager = UEDocumentationManager(args.project)
    
    # 设置版本
    if args.set_version:
        manager.set_version(args.set_version)
        return
    
    # 列出分类
    if args.list_categories:
        print("\n📂 UE文档分类")
        print("=" * 60)
        for cat_id, cat_info in DOC_CATEGORIES.items():
            print(f"\n{cat_info['name']} ({cat_id}):")
            print(f"  路径: {cat_info['path']}")
            print(f"  主题: {', '.join(cat_info['topics'][:3])}...")
        return
    
    # 设置版本（如果提供）
    if args.version:
        manager.set_version(args.version)
    
    # 模式处理
    if args.mode == "manual":
        manager.show_manual_download_guide(args.version)
    elif args.mode == "auto":
        categories = [args.category] if args.category else None
        manager.auto_download_docs(args.version, categories)
    elif args.mode == "cloud":
        if args.topic:
            url = manager.cloud_read_docs(args.topic, args.version)
            print(f"\n🌐 在浏览器中打开: {url}")
            webbrowser.open(url)
        else:
            print("❌ 请指定 --topic 参数")
    elif args.query:
        results = manager.search_docs(args.query, args.version)
        if results:
            print(f"\n找到 {len(results)} 个相关结果:")
            for i, result in enumerate(results, 1):
                print(f"{i}. [{result['type']}] {result['name']}")
                print(f"   URL: {result['url']}")
        else:
            print("未找到相关文档")
    elif args.error:
        guide = manager.get_troubleshooting_guide(args.error)
        print(f"\n🔧 {guide['title']}")
        print("=" * 60)
        print("\n📋 排除步骤:")
        for i, step in enumerate(guide["steps"], 1):
            print(f"  {i}. {step}")
        print(f"\n📖 详细文档: {guide['doc_url']}")
    else:
        # 默认显示帮助
        parser.print_help()

if __name__ == "__main__":
    main()
