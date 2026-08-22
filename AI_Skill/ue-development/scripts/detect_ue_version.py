#!/usr/bin/env python3
"""
UE项目版本检测脚本
用于检测Unreal Engine项目使用的引擎版本
"""

import json
import os
import sys
import glob
from pathlib import Path
from typing import Optional, Dict, Any

def find_uproject_files(search_path: str = ".") -> list:
    """查找目录下的所有.uproject文件"""
    search_path = Path(search_path).resolve()
    uproject_files = []
    
    # 在当前目录查找
    for file in search_path.glob("*.uproject"):
        uproject_files.append(file)
    
    # 在子目录查找（最多2层深度）
    for depth in range(3):
        pattern = "*/" * (depth + 1) + "*.uproject"
        for file in search_path.glob(pattern):
            uproject_files.append(file)
    
    return uproject_files

def parse_uproject_file(uproject_path: Path) -> Optional[Dict[str, Any]]:
    """解析.uproject文件，提取项目信息"""
    try:
        with open(uproject_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 移除注释（UE的JSON支持注释）
        import re
        content = re.sub(r'//.*?\n', '\n', content)
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        
        project_data = json.loads(content)
        return project_data
    except (json.JSONDecodeError, IOError) as e:
        print(f"⚠️ 无法解析 {uproject_path}: {e}")
        return None

def get_ue_version(project_data: Dict[str, Any]) -> Optional[str]:
    """从项目数据中提取UE版本"""
    # EngineAssociation 字段包含版本信息
    engine_association = project_data.get("EngineAssociation", "")
    
    if not engine_association:
        return None
    
    # 处理不同的版本格式
    # 格式1: "5.3" 或 "5.3.1" (直接版本号)
    # 格式2: "{GUID}" (源码构建的GUID)
    # 格式3: "5.3-UE5" (带后缀)
    
    # 尝试提取版本号
    import re
    
    # 匹配版本号格式 (如 5.3, 5.3.1, 5.3.2-UE5)
    version_match = re.match(r'^(\d+\.\d+(?:\.\d+)?)', engine_association)
    if version_match:
        return version_match.group(1)
    
    # 如果是GUID格式，返回原始值（需要进一步处理）
    if engine_association.startswith('{') and engine_association.endswith('}'):
        return f"源码构建 (GUID: {engine_association})"
    
    return engine_association

def detect_project_version(project_path: str = ".") -> Dict[str, Any]:
    """检测项目版本，返回详细信息"""
    result = {
        "found": False,
        "project_path": None,
        "project_name": None,
        "ue_version": None,
        "engine_association": None,
        "modules": [],
        "category": None,
        "description": None
    }
    
    # 查找.uproject文件
    uproject_files = find_uproject_files(project_path)
    
    if not uproject_files:
        return result
    
    # 使用第一个找到的.uproject文件
    uproject_path = uproject_files[0]
    project_data = parse_uproject_file(uproject_path)
    
    if not project_data:
        return result
    
    # 提取信息
    result["found"] = True
    result["project_path"] = str(uproject_path.parent)
    result["project_name"] = uproject_path.stem
    result["ue_version"] = get_ue_version(project_data)
    result["engine_association"] = project_data.get("EngineAssociation", "")
    result["modules"] = [m.get("Name") for m in project_data.get("Modules", [])]
    result["category"] = project_data.get("Category", "")
    result["description"] = project_data.get("Description", "")
    
    return result

def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="检测UE项目版本")
    parser.add_argument("project_path", nargs="?", default=".", 
                       help="项目路径（默认为当前目录）")
    parser.add_argument("--json", action="store_true", 
                       help="以JSON格式输出")
    parser.add_argument("--version-only", action="store_true",
                       help="仅输出版本号")
    
    args = parser.parse_args()
    
    # 检测版本
    result = detect_project_version(args.project_path)
    
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return
    
    if args.version_only:
        if result["found"] and result["ue_version"]:
            print(result["ue_version"])
        else:
            print("未找到UE版本信息")
            sys.exit(1)
        return
    
    # 详细输出
    if not result["found"]:
        print("❌ 未找到UE项目文件(.uproject)")
        print(f"   搜索路径: {os.path.abspath(args.project_path)}")
        sys.exit(1)
    
    print("🎮 UE项目信息检测结果")
    print("=" * 50)
    print(f"📁 项目路径: {result['project_path']}")
    print(f"📦 项目名称: {result['project_name']}")
    print(f"🔧 引擎版本: {result['ue_version'] or '未指定'}")
    print(f"🔗 引擎关联: {result['engine_association'] or '无'}")
    
    if result["modules"]:
        print(f"📋 项目模块: {', '.join(result['modules'])}")
    
    if result["category"]:
        print(f"📂 项目分类: {result['category']}")
    
    if result["description"]:
        print(f"📝 项目描述: {result['description']}")
    
    print("=" * 50)
    
    # 返回版本信息供其他脚本使用
    return result

if __name__ == "__main__":
    main()
