#!/usr/bin/env python3
"""
Unity包/插件骨架创建脚本
自动生成标准Unity包目录结构和基础文件
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import List, Optional

class UnityPackageGenerator:
    """Unity包生成器"""
    
    def __init__(self, package_name: str, output_path: str, author: str = "", display_name: str = ""):
        self.package_name = package_name.lower().replace(" ", "-").replace("_", "-")
        self.display_name = display_name or package_name
        self.output_path = Path(output_path)
        self.author = author
        self.package_path = self.output_path / self.package_name
        
    def generate(self, has_editor: bool = True, has_runtime: bool = True, has_samples: bool = False):
        """生成包结构"""
        # 创建目录结构
        self._create_directories(has_editor, has_runtime, has_samples)
        
        # 生成文件
        self._generate_package_json()
        self._generate_readme()
        self._generate_changelog()
        self._generate_license()
        
        if has_runtime:
            self._generate_runtime_assembly()
            
        if has_editor:
            self._generate_editor_assembly()
            
        if has_samples:
            self._generate_samples()
        
        print(f"\n✅ Unity包 '{self.package_name}' 已成功创建于: {self.package_path}")
        print(f"\n📁 目录结构:")
        self._print_structure()
        
    def _create_directories(self, has_editor: bool, has_runtime: bool, has_samples: bool):
        """创建目录结构"""
        # 基础目录
        dirs = [
            "Documentation~",
            "Tests"
        ]
        
        # 运行时目录
        if has_runtime:
            dirs.extend([
                "Runtime",
                "Runtime/Scripts",
                "Runtime/Prefabs",
                "Runtime/Materials",
                "Runtime/Shaders"
            ])
        
        # 编辑器目录
        if has_editor:
            dirs.extend([
                "Editor",
                "Editor/Scripts",
                "Editor/EditorWindows",
                "Editor/PropertyDrawers",
                "Editor/CustomEditors"
            ])
        
        # 示例目录
        if has_samples:
            dirs.extend([
                "Samples~",
                "Samples~/ExampleScene",
                "Samples~/ExampleScripts"
            ])
        
        for dir_path in dirs:
            (self.package_path / dir_path).mkdir(parents=True, exist_ok=True)
    
    def _generate_package_json(self):
        """生成package.json"""
        package_data = {
            "name": f"com.{self.author.lower()}.{self.package_name}" if self.author else f"com.example.{self.package_name}",
            "version": "1.0.0",
            "displayName": self.display_name,
            "description": f"{self.display_name} - Unity Package",
            "unity": "2021.3",
            "unityRelease": "0f1",
            "documentationUrl": "",
            "changelogUrl": "",
            "licensesUrl": "",
            "dependencies": {},
            "keywords": [
                "package",
                self.package_name
            ],
            "author": {
                "name": self.author or "Author",
                "email": "",
                "url": ""
            },
            "type": "library",
            "samples": []
        }
        
        if self.author:
            package_data["author"]["name"] = self.author
        
        with open(self.package_path / "package.json", 'w', encoding='utf-8') as f:
            json.dump(package_data, f, indent=2)
    
    def _generate_readme(self):
        """生成README.md"""
        readme = f'''# {self.display_name}

## Overview

{self.display_name} is a Unity package that provides...

## Installation

### Using Unity Package Manager (UPM)

1. Open Unity Package Manager (Window > Package Manager)
2. Click the "+" button and select "Add package from git URL"
3. Enter the repository URL

### Manual Installation

1. Download the package
2. Extract it to your project's `Packages` folder
3. Unity will automatically detect and import it

## Requirements

- Unity 2021.3 or later
- .NET Standard 2.1

## Quick Start

```csharp
using {self.package_name.replace("-", "")};

// Example usage
public class Example : MonoBehaviour
{{
    void Start()
    {{
        // Your code here
    }}
}}
```

## Features

- Feature 1
- Feature 2
- Feature 3

## API Reference

### ClassName

Description of the class.

#### Methods

- `MethodName()` - Description

#### Properties

- `PropertyName` - Description

## Samples

Import samples from the Package Manager window.

## Support

For issues and questions, please visit [GitHub Issues](https://github.com/your-repo/issues).

## License

This package is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.
'''
        
        with open(self.package_path / "README.md", 'w', encoding='utf-8') as f:
            f.write(readme)
    
    def _generate_changelog(self):
        """生成CHANGELOG.md"""
        changelog = f'''# Changelog

All notable changes to the {self.display_name} package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-01

### Added
- Initial release
- Core functionality
'''
        
        with open(self.package_path / "CHANGELOG.md", 'w', encoding='utf-8') as f:
            f.write(changelog)
    
    def _generate_license(self):
        """生成LICENSE.md"""
        license_text = '''MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
'''
        
        with open(self.package_path / "LICENSE.md", 'w', encoding='utf-8') as f:
            f.write(license_text)
    
    def _generate_runtime_assembly(self):
        """生成运行时程序集"""
        namespace = self.package_name.replace("-", ".")
        
        # Assembly Definition
        asmdef = {
            "name": f"{self.package_name}.runtime",
            "rootNamespace": namespace,
            "references": [],
            "includePlatforms": [],
            "excludePlatforms": [],
            "allowUnsafeCode": False,
            "overrideReferences": False,
            "precompiledReferences": [],
            "autoReferenced": True,
            "defineConstraints": [],
            "versionDefines": [],
            "noEngineReferences": False
        }
        
        with open(self.package_path / "Runtime" / f"{self.package_name}.runtime.asmdef", 'w', encoding='utf-8') as f:
            json.dump(asmdef, f, indent=2)
        
        # 示例脚本
        script = f'''using UnityEngine;

namespace {namespace}
{{
    /// <summary>
    /// Main class for {self.display_name}
    /// </summary>
    public class {self.display_name.replace(" ", "").replace("-", "")} : MonoBehaviour
    {{
        [Header("Settings")]
        [SerializeField] private bool enableFeature = true;
        
        private void Awake()
        {{
            Debug.Log("{self.display_name} initialized");
        }}
        
        private void Update()
        {{
            if (enableFeature)
            {{
                // Your update logic here
            }}
        }}
        
        /// <summary>
        /// Example public method
        /// </summary>
        public void DoSomething()
        {{
            // Implementation
        }}
    }}
}}
'''
        
        with open(self.package_path / "Runtime" / "Scripts" / f"{self.display_name.replace(' ', '')}.cs", 'w', encoding='utf-8') as f:
            f.write(script)
    
    def _generate_editor_assembly(self):
        """生成编辑器程序集"""
        namespace = self.package_name.replace("-", ".")
        
        # Assembly Definition
        asmdef = {
            "name": f"{self.package_name}.editor",
            "rootNamespace": f"{namespace}.Editor",
            "references": [
                f"{self.package_name}.runtime"
            ],
            "includePlatforms": [
                "Editor"
            ],
            "excludePlatforms": [],
            "allowUnsafeCode": False,
            "overrideReferences": False,
            "precompiledReferences": [],
            "autoReferenced": True,
            "defineConstraints": [],
            "versionDefines": [],
            "noEngineReferences": False
        }
        
        with open(self.package_path / "Editor" / f"{self.package_name}.editor.asmdef", 'w', encoding='utf-8') as f:
            json.dump(asmdef, f, indent=2)
        
        # 示例编辑器脚本
        script = f'''using UnityEngine;
using UnityEditor;

namespace {namespace}.Editor
{{
    /// <summary>
    /// Custom editor for {self.display_name}
    /// </summary>
    [CustomEditor(typeof({self.display_name.replace(" ", "").replace("-", "")}))]
    public class {self.display_name.replace(" ", "").replace("-", "")}Editor : UnityEditor.Editor
    {{
        public override void OnInspectorGUI()
        {{
            base.OnInspectorGUI();
            
            EditorGUILayout.Space();
            
            if (GUILayout.Button("Do Something"))
            {{
                var target = ({self.display_name.replace(" ", "").replace("-", "")})this.target;
                target.DoSomething();
            }}
        }}
    }}
}}
'''
        
        with open(self.package_path / "Editor" / "Scripts" / f"{self.display_name.replace(' ', '')}Editor.cs", 'w', encoding='utf-8') as f:
            f.write(script)
    
    def _generate_samples(self):
        """生成示例"""
        namespace = self.package_name.replace("-", ".")
        
        # 示例脚本
        script = f'''using UnityEngine;

namespace {namespace}.Samples
{{
    /// <summary>
    /// Example usage of {self.display_name}
    /// </summary>
    public class ExampleUsage : MonoBehaviour
    {{
        void Start()
        {{
            Debug.Log("Example usage of {self.display_name}");
            
            // Get reference to the main component
            var component = GetComponent<{self.display_name.replace(" ", "").replace("-", "")}>();
            
            if (component != null)
            {{
                component.DoSomething();
            }}
        }}
    }}
}}
'''
        
        with open(self.package_path / "Samples~" / "ExampleScripts" / "ExampleUsage.cs", 'w', encoding='utf-8') as f:
            f.write(script)
        
        # 更新package.json添加samples
        package_json_path = self.package_path / "package.json"
        if package_json_path.exists():
            with open(package_json_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)
            
            package_data["samples"] = [
                {
                    "displayName": "Example Scene",
                    "description": "Example scene demonstrating the package features",
                    "path": "Samples~/ExampleScene"
                },
                {
                    "displayName": "Example Scripts",
                    "description": "Example scripts showing how to use the package",
                    "path": "Samples~/ExampleScripts"
                }
            ]
            
            with open(package_json_path, 'w', encoding='utf-8') as f:
                json.dump(package_data, f, indent=2)
    
    def _print_structure(self):
        """打印目录结构"""
        for root, dirs, files in os.walk(self.package_path):
            level = root.replace(str(self.package_path), '').count(os.sep)
            indent = ' ' * 2 * level
            print(f'{indent}{os.path.basename(root)}/')
            subindent = ' ' * 2 * (level + 1)
            for file in files:
                print(f'{subindent}{file}')

def main():
    parser = argparse.ArgumentParser(description="创建Unity包骨架")
    parser.add_argument("name", help="包名称")
    parser.add_argument("--path", default=".", help="输出路径")
    parser.add_argument("--author", default="", help="作者名称")
    parser.add_argument("--display-name", default="", help="显示名称")
    parser.add_argument("--no-editor", action="store_true", help="不包含编辑器程序集")
    parser.add_argument("--no-runtime", action="store_true", help="不包含运行时程序集")
    parser.add_argument("--samples", action="store_true", help="包含示例")
    
    args = parser.parse_args()
    
    generator = UnityPackageGenerator(
        args.name,
        args.path,
        args.author,
        args.display_name or args.name
    )
    generator.generate(
        has_editor=not args.no_editor,
        has_runtime=not args.no_runtime,
        has_samples=args.samples
    )

if __name__ == "__main__":
    main()
