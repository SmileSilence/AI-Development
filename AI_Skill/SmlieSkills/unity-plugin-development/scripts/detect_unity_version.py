#!/usr/bin/env python3
"""
Unity项目版本检测脚本
检测Unity项目使用的引擎版本
"""

import os
import re
import json
from pathlib import Path
from typing import Optional, Dict, Any

def find_project_version(project_path: str = ".") -> Optional[str]:
    """查找Unity项目版本"""
    project_path = Path(project_path)
    
    # 方法1：读取ProjectSettings/ProjectVersion.txt
    version_file = project_path / "ProjectSettings" / "ProjectVersion.txt"
    if version_file.exists():
        try:
            with open(version_file, 'r', encoding='utf-8') as f:
                content = f.read()
                # 格式：m_EditorVersion: 2022.3.0f1
                match = re.search(r'm_EditorVersion:\s*(\d+\.\d+\.\d+[a-z]\d+)', content)
                if match:
                    return match.group(1)
        except Exception as e:
            pass
    
    # 方法2：读取ProjectVersion.asset
    version_asset = project_path / "ProjectSettings" / "ProjectVersion.asset"
    if version_asset.exists():
        try:
            with open(version_asset, 'r', encoding='utf-8') as f:
                content = f.read()
                match = re.search(r'm_EditorVersion:\s*(\d+\.\d+\.\d+[a-z]\d+)', content)
                if match:
                    return match.group(1)
        except Exception as e:
            pass
    
    # 方法3：检查Packages/manifest.json中的版本线索
    manifest_file = project_path / "Packages" / "manifest.json"
    if manifest_file.exists():
        try:
            with open(manifest_file, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
                # 检查com.unity.ide.visualstudio版本推断Unity版本
                if "dependencies" in manifest:
                    for key, value in manifest["dependencies"].items():
                        if "com.unity.ide" in key:
                            # 某些包版本与Unity版本相关
                            pass
        except Exception as e:
            pass
    
    return None

def detect_project_info(project_path: str = ".") -> Dict[str, Any]:
    """检测项目详细信息"""
    project_path = Path(project_path)
    
    result = {
        "found": False,
        "project_path": str(project_path),
        "project_name": None,
        "unity_version": None,
        "render_pipeline": None,
        "scripting_backend": None,
        "api_compatibility": None,
        "platform": None,
        "modules": []
    }
    
    # 检查是否是Unity项目
    project_settings = project_path / "ProjectSettings"
    if not project_settings.exists():
        return result
    
    # 获取版本
    version = find_project_version(project_path)
    if version:
        result["found"] = True
        result["unity_version"] = version
    
    # 获取项目名称
    project_file = project_path / "Assets"
    if project_file.exists():
        result["project_name"] = project_path.name
    
    # 读取ProjectSettings.asset获取更多信息
    settings_file = project_settings / "ProjectSettings.asset"
    if settings_file.exists():
        try:
            with open(settings_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
                # 检测渲染管线
                if "m_ActiveColorSpace: 1" in content:
                    result["render_pipeline"] = "Linear"
                else:
                    result["render_pipeline"] = "Gamma"
                
                # 检测脚本后端
                if "scriptingBackend: 1" in content:
                    result["scripting_backend"] = "IL2CPP"
                else:
                    result["scripting_backend"] = "Mono"
                    
        except Exception as e:
            pass
    
    # 检查Packages/manifest.json获取模块
    manifest_file = project_path / "Packages" / "manifest.json"
    if manifest_file.exists():
        try:
            with open(manifest_file, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
                if "dependencies" in manifest:
                    result["modules"] = list(manifest["dependencies"].keys())
        except Exception as e:
            pass
    
    return result

def format_version(version: str) -> str:
    """格式化版本号显示"""
    # 2022.3.0f1 -> 2022.3.0f1 (LTS)
    if "f" in version:
        base = version.split("f")[0]
        parts = base.split(".")
        if len(parts) >= 2:
            # 检查是否是LTS版本（偶数年份，.3版本）
            try:
                year = int(parts[0])
                if year % 2 == 0 and parts[1] == "3":
                    return f"{version} (LTS)"
            except:
                pass
    return version

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="检测Unity项目版本")
    parser.add_argument("project_path", nargs="?", default=".", help="项目路径")
    parser.add_argument("--json", action="store_true", help="JSON格式输出")
    parser.add_argument("--version-only", action="store_true", help="仅输出版本号")
    
    args = parser.parse_args()
    
    result = detect_project_info(args.project_path)
    
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return
    
    if args.version_only:
        if result["found"] and result["unity_version"]:
            print(result["unity_version"])
        else:
            print("未找到Unity版本信息")
        return
    
    # 详细输出
    if not result["found"]:
        print("❌ 未找到Unity项目")
        print(f"   搜索路径: {os.path.abspath(args.project_path)}")
        return
    
    print("🎮 Unity项目信息检测结果")
    print("=" * 50)
    print(f"📁 项目路径: {result['project_path']}")
    print(f"📦 项目名称: {result['project_name'] or '未知'}")
    print(f"🔧 Unity版本: {format_version(result['unity_version']) or '未检测到'}")
    
    if result["render_pipeline"]:
        print(f"🎨 渲染管线: {result['render_pipeline']}")
    
    if result["scripting_backend"]:
        print(f"⚙️ 脚本后端: {result['scripting_backend']}")
    
    if result["modules"]:
        print(f"📦 已安装包: {len(result['modules'])}个")
        
    print("=" * 50)
    
    return result

if __name__ == "__main__":
    main()
