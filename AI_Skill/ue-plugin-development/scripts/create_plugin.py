#!/usr/bin/env python3
"""
UE插件骨架创建脚本
自动生成标准插件目录结构和基础文件
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import List, Optional

class PluginGenerator:
    """插件生成器"""
    
    def __init__(self, plugin_name: str, output_path: str, author: str = ""):
        self.plugin_name = plugin_name
        self.module_name = plugin_name.replace(" ", "").replace("-", "_")
        self.output_path = Path(output_path)
        self.author = author
        self.plugin_path = self.output_path / plugin_name
        
    def generate(self, has_editor: bool = True, has_blueprint_nodes: bool = False):
        """生成插件结构"""
        # 创建目录结构
        self._create_directories(has_editor, has_blueprint_nodes)
        
        # 生成文件
        self._generate_uplugin(has_editor, has_blueprint_nodes)
        self._generate_runtime_module()
        
        if has_editor:
            self._generate_editor_module()
            
        if has_blueprint_nodes:
            self._generate_blueprint_nodes_module()
        
        print(f"\n✅ 插件 '{self.plugin_name}' 已成功创建于: {self.plugin_path}")
        print(f"\n📁 目录结构:")
        self._print_structure()
        
    def _create_directories(self, has_editor: bool, has_blueprint_nodes: bool):
        """创建目录结构"""
        # 运行时模块
        runtime_dirs = [
            "Source/" + self.module_name + "/Public",
            "Source/" + self.module_name + "/Private",
            "Content",
            "Resources",
            "Config",
            "Documentation"
        ]
        
        for dir_path in runtime_dirs:
            (self.plugin_path / dir_path).mkdir(parents=True, exist_ok=True)
            
        # 编辑器模块
        if has_editor:
            editor_dirs = [
                "Source/" + self.module_name + "Editor/Public",
                "Source/" + self.module_name + "Editor/Private"
            ]
            for dir_path in editor_dirs:
                (self.plugin_path / dir_path).mkdir(parents=True, exist_ok=True)
                
        # 蓝图节点模块
        if has_blueprint_nodes:
            bp_dirs = [
                "Source/" + self.module_name + "Nodes/Public",
                "Source/" + self.module_name + "Nodes/Private"
            ]
            for dir_path in bp_dirs:
                (self.plugin_path / dir_path).mkdir(parents=True, exist_ok=True)
    
    def _generate_uplugin(self, has_editor: bool, has_blueprint_nodes: bool):
        """生成.uplugin文件"""
        modules = [
            {
                "Name": self.module_name,
                "Type": "Runtime",
                "LoadingPhase": "Default"
            }
        ]
        
        if has_editor:
            modules.append({
                "Name": self.module_name + "Editor",
                "Type": "Editor",
                "LoadingPhase": "PostEngineInit"
            })
            
        if has_blueprint_nodes:
            modules.append({
                "Name": self.module_name + "Nodes",
                "Type": "UncookedOnly",
                "LoadingPhase": "PostEngineInit"
            })
        
        uplugin = {
            "FileVersion": 3,
            "Version": 1,
            "VersionName": "1.0",
            "FriendlyName": self.plugin_name,
            "Description": f"{self.plugin_name} - UE Plugin",
            "Category": "Programming",
            "CreatedBy": self.author,
            "CreatedByURL": "",
            "DocsURL": "",
            "MarketplaceURL": "",
            "CanContainContent": True,
            "IsBetaVersion": False,
            "IsExperimentalVersion": False,
            "Installed": False,
            "Modules": modules
        }
        
        with open(self.plugin_path / f"{self.plugin_name}.uplugin", 'w', encoding='utf-8') as f:
            json.dump(uplugin, f, indent=4)
    
    def _generate_runtime_module(self):
        """生成运行时模块"""
        module_path = self.plugin_path / "Source" / self.module_name
        
        # Build.cs
        build_cs = f'''using UnrealBuildTool;

public class {self.module_name} : ModuleRules
{{
    public {self.module_name}(ReadOnlyTargetRules Target) : base(Target)
    {{
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {{
            "Core",
            "CoreUObject",
            "Engine"
        }});

        PrivateDependencyModuleNames.AddRange(new string[]
        {{
            "Slate",
            "SlateCore",
            "InputCore"
        }});
    }}
}}'''
        
        with open(module_path / f"{self.module_name}.Build.cs", 'w', encoding='utf-8') as f:
            f.write(build_cs)
        
        # 模块头文件
        header = f'''#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

class F{self.module_name}Module : public IModuleInterface
{{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
    
    static F{self.module_name}Module& Get()
    {{
        return FModuleManager::GetModuleChecked<F{self.module_name}Module>("{self.module_name}");
    }}
    
    static bool IsAvailable()
    {{
        return FModuleManager::Get().IsModuleLoaded("{self.module_name}");
    }}
}};'''
        
        with open(module_path / "Public" / f"{self.module_name}Module.h", 'w', encoding='utf-8') as f:
            f.write(header)
        
        # 模块实现
        cpp = f'''#include "{self.module_name}Module.h"

#define LOCTEXT_NAMESPACE "F{self.module_name}Module"

void F{self.module_name}Module::StartupModule()
{{
    UE_LOG(LogTemp, Log, TEXT("{self.module_name} module started"));
}}

void F{self.module_name}Module::ShutdownModule()
{{
    UE_LOG(LogTemp, Log, TEXT("{self.module_name} module shutdown"));
}}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(F{self.module_name}Module, {self.module_name})'''
        
        with open(module_path / "Private" / f"{self.module_name}Module.cpp", 'w', encoding='utf-8') as f:
            f.write(cpp)
        
        # API宏头文件
        api_header = f'''#pragma once

#include "Modules/ModuleManager.h"

#if WITH_EDITOR
#include "Logging/LogMacros.h"
#endif

DECLARE_LOG_CATEGORY_EXTERN(Log{self.module_name}, Log, All);'''
        
        with open(module_path / "Public" / f"{self.module_name}.h", 'w', encoding='utf-8') as f:
            f.write(api_header)
    
    def _generate_editor_module(self):
        """生成编辑器模块"""
        module_path = self.plugin_path / "Source" / (self.module_name + "Editor")
        
        # Build.cs
        build_cs = f'''using UnrealBuildTool;

public class {self.module_name}Editor : ModuleRules
{{
    public {self.module_name}Editor(ReadOnlyTargetRules Target) : base(Target)
    {{
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {{
            "Core",
            "CoreUObject",
            "Engine",
            "{self.module_name}"
        }});

        PrivateDependencyModuleNames.AddRange(new string[]
        {{
            "Slate",
            "SlateCore",
            "InputCore",
            "UnrealEd",
            "EditorStyle",
            "EditorWidgets",
            "PropertyEditor"
        }});
    }}
}}'''
        
        with open(module_path / f"{self.module_name}Editor.Build.cs", 'w', encoding='utf-8') as f:
            f.write(build_cs)
        
        # 模块头文件
        header = f'''#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

class F{self.module_name}EditorModule : public IModuleInterface
{{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
}};'''
        
        with open(module_path / "Public" / f"{self.module_name}EditorModule.h", 'w', encoding='utf-8') as f:
            f.write(header)
        
        # 模块实现
        cpp = f'''#include "{self.module_name}EditorModule.h"

#define LOCTEXT_NAMESPACE "F{self.module_name}EditorModule"

void F{self.module_name}EditorModule::StartupModule()
{{
    UE_LOG(LogTemp, Log, TEXT("{self.module_name}Editor module started"));
}}

void F{self.module_name}EditorModule::ShutdownModule()
{{
    UE_LOG(LogTemp, Log, TEXT("{self.module_name}Editor module shutdown"));
}}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(F{self.module_name}EditorModule, {self.module_name}Editor)'''
        
        with open(module_path / "Private" / f"{self.module_name}EditorModule.cpp", 'w', encoding='utf-8') as f:
            f.write(cpp)
    
    def _generate_blueprint_nodes_module(self):
        """生成蓝图节点模块"""
        module_path = self.plugin_path / "Source" / (self.module_name + "Nodes")
        
        # Build.cs
        build_cs = f'''using UnrealBuildTool;

public class {self.module_name}Nodes : ModuleRules
{{
    public {self.module_name}Nodes(ReadOnlyTargetRules Target) : base(Target)
    {{
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {{
            "Core",
            "CoreUObject",
            "Engine",
            "{self.module_name}"
        }});

        PrivateDependencyModuleNames.AddRange(new string[]
        {{
            "Slate",
            "SlateCore",
            "UnrealEd",
            "KismetCompiler",
            "BlueprintGraph"
        }});
    }}
}}'''
        
        with open(module_path / f"{self.module_name}Nodes.Build.cs", 'w', encoding='utf-8') as f:
            f.write(build_cs)
        
        # 模块头文件
        header = f'''#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

class F{self.module_name}NodesModule : public IModuleInterface
{{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
}};'''
        
        with open(module_path / "Public" / f"{self.module_name}NodesModule.h", 'w', encoding='utf-8') as f:
            f.write(header)
        
        # 模块实现
        cpp = f'''#include "{self.module_name}NodesModule.h"

#define LOCTEXT_NAMESPACE "F{self.module_name}NodesModule"

void F{self.module_name}NodesModule::StartupModule()
{{
    UE_LOG(LogTemp, Log, TEXT("{self.module_name}Nodes module started"));
}}

void F{self.module_name}NodesModule::ShutdownModule()
{{
    UE_LOG(LogTemp, Log, TEXT("{self.module_name}Nodes module shutdown"));
}}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(F{self.module_name}NodesModule, {self.module_name}Nodes)'''
        
        with open(module_path / "Private" / f"{self.module_name}NodesModule.cpp", 'w', encoding='utf-8') as f:
            f.write(cpp)
    
    def _print_structure(self):
        """打印目录结构"""
        for root, dirs, files in os.walk(self.plugin_path):
            level = root.replace(str(self.plugin_path), '').count(os.sep)
            indent = ' ' * 2 * level
            print(f'{indent}{os.path.basename(root)}/')
            subindent = ' ' * 2 * (level + 1)
            for file in files:
                print(f'{subindent}{file}')

def main():
    parser = argparse.ArgumentParser(description="创建UE插件骨架")
    parser.add_argument("name", help="插件名称")
    parser.add_argument("--path", default=".", help="输出路径")
    parser.add_argument("--author", default="", help="作者名称")
    parser.add_argument("--no-editor", action="store_true", help="不包含编辑器模块")
    parser.add_argument("--blueprint-nodes", action="store_true", help="包含蓝图节点模块")
    
    args = parser.parse_args()
    
    generator = PluginGenerator(args.name, args.path, args.author)
    generator.generate(
        has_editor=not args.no_editor,
        has_blueprint_nodes=args.blueprint_nodes
    )

if __name__ == "__main__":
    main()
