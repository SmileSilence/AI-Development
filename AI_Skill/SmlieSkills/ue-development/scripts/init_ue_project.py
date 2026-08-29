#!/usr/bin/env python3
"""
Unreal Engine 项目初始化脚本
用于创建基本的UE项目结构
"""

import os
import sys
import argparse
from pathlib import Path

def create_project_structure(project_name, base_path):
    """创建UE项目基本结构"""
    
    # 创建主目录
    project_path = Path(base_path) / project_name
    project_path.mkdir(parents=True, exist_ok=True)
    
    # 创建源代码目录结构
    source_path = project_path / "Source"
    source_path.mkdir(exist_ok=True)
    
    # 主模块目录
    main_module = source_path / project_name
    main_module.mkdir(exist_ok=True)
    
    # Public/Private 目录
    (main_module / "Public").mkdir(exist_ok=True)
    (main_module / "Private").mkdir(exist_ok=True)
    
    # 创建内容目录
    content_path = project_path / "Content"
    content_path.mkdir(exist_ok=True)
    
    content_dirs = [
        "Blueprints",
        "Materials", 
        "Textures",
        "Meshes",
        "Maps",
        "UI",
        "Audio",
        "Animations"
    ]
    
    for dir_name in content_dirs:
        (content_path / dir_name).mkdir(exist_ok=True)
    
    # 创建配置目录
    config_path = project_path / "Config"
    config_path.mkdir(exist_ok=True)
    
    # 创建插件目录
    plugins_path = project_path / "Plugins"
    plugins_path.mkdir(exist_ok=True)
    
    # 创建构建目录
    build_path = project_path / "Build"
    build_path.mkdir(exist_ok=True)
    
    # 创建 .uproject 文件
    uproject_content = f'''{{
    "FileVersion": 3,
    "EngineAssociation": "5.3",
    "Category": "",
    "Description": "{project_name} - Unreal Engine Project",
    "Modules": [
        {{
            "Name": "{project_name}",
            "Type": "Runtime",
            "LoadingPhase": "Default",
            "AdditionalDependencies": [
                "Engine",
                "CoreUObject"
            ]
        }}
    ]
}}'''
    
    uproject_path = project_path / f"{project_name}.uproject"
    with open(uproject_path, 'w', encoding='utf-8') as f:
        f.write(uproject_content)
    
    # 创建基本的 .h 和 .cpp 文件
    header_content = f'''#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "{project_name}Actor.generated.h"

UCLASS()
class {project_name.upper()}_API A{project_name}Actor : public AActor
{{
    GENERATED_BODY()
    
public:
    A{project_name}Actor();

protected:
    virtual void BeginPlay() override;

public:
    virtual void Tick(float DeltaTime) override;

private:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components", meta = (AllowPrivateAccess = "true"))
    USceneComponent* RootSceneComponent;
}};'''
    
    cpp_content = f'''#include "{project_name}Actor.h"

A{project_name}Actor::A{project_name}Actor()
{{
    PrimaryActorTick.bCanEverTick = true;
    
    RootSceneComponent = CreateDefaultSubobject<USceneComponent>(TEXT("RootSceneComponent"));
    RootComponent = RootSceneComponent;
}}

void A{project_name}Actor::BeginPlay()
{{
    Super::BeginPlay();
    
}}

void A{project_name}Actor::Tick(float DeltaTime)
{{
    Super::Tick(DeltaTime);
    
}}'''
    
    # 写入文件
    header_path = main_module / "Public" / f"{project_name}Actor.h"
    cpp_path = main_module / "Private" / f"{project_name}Actor.cpp"
    
    with open(header_path, 'w', encoding='utf-8') as f:
        f.write(header_content)
    
    with open(cpp_path, 'w', encoding='utf-8') as f:
        f.write(cpp_content)
    
    # 创建 Build.cs 文件
    build_cs_content = f'''using UnrealBuildTool;

public class {project_name} : ModuleRules
{{
    public {project_name}(ReadOnlyTargetRules Target) : base(Target)
    {{
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        
        PublicDependencyModuleNames.AddRange(new string[] {{ 
            "Core", 
            "CoreUObject", 
            "Engine", 
            "InputCore" 
        }});
        
        PrivateDependencyModuleNames.AddRange(new string[] {{ }});
    }}
}}'''
    
    build_cs_path = main_module / f"{project_name}.Build.cs"
    with open(build_cs_path, 'w', encoding='utf-8') as f:
        f.write(build_cs_content)
    
    # 创建模块头文件和源文件
    module_header = f'''#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

class F{project_name}Module : public IModuleInterface
{{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
}};'''
    
    module_cpp = f'''#include "{project_name}Module.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "F{project_name}Module"

void F{project_name}Module::StartupModule()
{{
    // 模块启动时执行的代码
}}

void F{project_name}Module::ShutdownModule()
{{
    // 模块关闭时执行的代码
}}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_PRIMARY_GAME_MODULE(F{project_name}Module, {project_name}, "{project_name}");'''
    
    module_header_path = main_module / f"{project_name}Module.h"
    module_cpp_path = main_module / f"{project_name}Module.cpp"
    
    with open(module_header_path, 'w', encoding='utf-8') as f:
        f.write(module_header)
    
    with open(module_cpp_path, 'w', encoding='utf-8') as f:
        f.write(module_cpp)
    
    print(f"✅ UE项目 '{project_name}' 已成功创建于: {project_path}")
    print(f"📁 项目结构:")
    print(f"   - {project_name}.uproject")
    print(f"   - Source/{project_name}/")
    print(f"     - Public/ (头文件)")
    print(f"     - Private/ (源文件)")
    print(f"   - Content/ (资产目录)")
    print(f"   - Config/ (配置文件)")
    print(f"   - Plugins/ (插件)")
    print(f"   - Build/ (构建输出)")
    print(f"\n🚀 下一步:")
    print(f"   1. 在Visual Studio中打开 {project_name}.uproject")
    print(f"   2. 生成项目文件")
    print(f"   3. 编译并运行")

def main():
    parser = argparse.ArgumentParser(description="初始化Unreal Engine项目结构")
    parser.add_argument("project_name", help="项目名称")
    parser.add_argument("--path", default=".", help="项目创建路径 (默认: 当前目录)")
    
    args = parser.parse_args()
    
    # 验证项目名称
    if not args.project_name.isalnum():
        print("❌ 错误: 项目名称只能包含字母和数字")
        sys.exit(1)
    
    create_project_structure(args.project_name, args.path)

if __name__ == "__main__":
    main()
