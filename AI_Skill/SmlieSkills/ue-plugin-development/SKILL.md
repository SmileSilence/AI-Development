---
name: ue-plugin-development
description: "开发 Unreal Engine 插件与扩展；涉及模块、编辑器扩展、蓝图函数库或自定义资产时使用。"
metadata:
  publisher: SmileXX
  version: "v3.1"
  short-description: UE 插件与扩展开发指南
  category: 游戏开发
  platforms: [DSH, Claude, OpenAI/Codex]
  keywords: [Unreal, UE, plugin, development, blueprint]
---

# UE插件/扩展开发指南

本技能专注于Unreal Engine插件和扩展开发，核心原则：**根据项目UE版本，查阅对应版本的插件开发文档**。

## 触发条件

### 自动触发
- 用户说「UE 插件」「虚幻引擎插件」「.uplugin」「模块开发」
- 用户询问编辑器扩展（工具栏/面板/菜单）、自定义资产类型、蓝图函数库/自定义节点、详情面板
- 用户请求创建或修改 Plugins/ 下的插件与模块（Runtime/Editor/Developer/ThirdParty）
- 用户说「ue-plugin-development」

### 不触发（避免误用）
- 在 UE 游戏内写玩法逻辑（Actor/蓝图/关卡/UI，游戏内容层）→ 不激活本技能
- 非 UE 的插件/扩展 → 不激活本技能

## 核心工作流程

### 步骤1：检测项目UE版本
查看`.uproject`文件的`EngineAssociation`字段，或询问用户。


### 步骤1.5：检测项目技术栈（可选）

检测项目中使用的第三方库、框架，以便插件开发时做好兼容：

```bash
python scripts/detect_tech_stack.py [项目路径]
```

#### 常见技术栈与插件开发关联

| 技术栈 | 插件开发注意事项 |
|--------|------------------|
| **Lua (slua/unlua/puerts)** | 需要暴露C++接口给Lua调用，注意反射宏使用 |
| **CommonUI** | UI插件需遵循CommonUI规范，使用CommonActivatableWidget |
| **Steam/EOS** | 网络插件需兼容平台SDK，注意在线子系统接口 |
| **Chaos Physics** | 物理插件需使用Chaos API，注意PhysX到Chaos迁移 |
| **ControlRig** | 动画插件可集成ControlRig，提供程序化动画支持 |
| **Niagara** | 特效插件应使用Niagara而非Cascade |
| **Mass AI** | AI插件可使用Mass Entity框架实现大规模AI |
| **MetaSounds** | 音频插件应使用MetaSounds替代SoundCue |

#### 根据技术栈获取插件开发文档

```bash
# 示例：项目使用Lua，获取Lua绑定文档
python scripts/doc_manager.py --mode cloud --topic lua --version 5.3

# 示例：项目使用CommonUI，获取UI插件开发文档
python scripts/doc_manager.py --mode cloud --topic commonui --version 5.3

# 示例：项目使用Steam，获取平台插件文档
python scripts/doc_manager.py --mode cloud --topic steam --version 5.3
```


### 步骤1.6：检测第三方插件（可选）

检测项目中已有的第三方插件，以便做好兼容和集成：

```bash
python scripts/detect_third_party.py [项目路径]
```

#### 插件开发与第三方插件集成

| 第三方插件 | 集成建议 |
|------------|----------|
| **Advanced Sessions** | 网络插件应兼容其会话接口 |
| **VaRest** | API插件可复用其HTTP请求逻辑 |
| **Dialogue System** | 任务插件可集成对话触发 |
| **Inventory System** | 游戏插件应兼容物品接口 |
| **Save System** | 数据插件需考虑存档兼容 |
| **Steam/EOS SDK** | 平台插件需遵循平台规范 |

#### 获取第三方插件信息

```bash
# 获取插件列表和文档URL
python scripts/detect_third_party.py [项目路径] --urls

# 获取插件关键词（用于搜索文档）
python scripts/detect_third_party.py [项目路径] --keywords

# JSON格式输出（用于脚本处理）
python scripts/detect_third_party.py [项目路径] --json
```

### 步骤2：选择文档获取方式
```
检测到项目使用 UE [版本号]
请选择官方文档获取方式：
1. 📥 下载到本地
2. ☁️ 在线查阅（推荐）
```

### 步骤3：查阅对应版本插件开发文档

| 主题 | 查询命令 |
|------|----------|
| 插件基础 | `--topic plugins` |
| 模块系统 | `--topic modules` |
| 编辑器扩展 | `--topic editorextensions` |
| 蓝图扩展 | `--topic blueprintextensions` |
| 资产类型 | `--topic assettypes` |

---

## 插件结构规范

### 标准插件目录结构
```
MyPlugin/
├── MyPlugin.uplugin              # 插件描述文件
├── Source/
│   ├── MyPlugin/                 # 运行时模块
│   │   ├── Public/
│   │   │   ├── MyPluginModule.h
│   │   │   └── MyPlugin.h
│   │   ├── Private/
│   │   │   ├── MyPluginModule.cpp
│   │   │   └── MyPlugin.cpp
│   │   └── MyPlugin.Build.cs
│   ├── MyPluginEditor/           # 编辑器模块（可选）
│   │   ├── Public/
│   │   ├── Private/
│   │   └── MyPluginEditor.Build.cs
│   └── MyPluginNodes/            # 蓝图节点模块（可选）
│       ├── Public/
│       ├── Private/
│       └── MyPluginNodes.Build.cs
├── Content/                      # 插件资产
├── Resources/                    # 图标等资源
├── Config/                       # 配置文件
└── Documentation/                # 文档
```

### .uplugin 文件结构
```json
{
    "FileVersion": 3,
    "Version": 1,
    "VersionName": "1.0",
    "FriendlyName": "My Plugin",
    "Description": "插件描述",
    "Category": "Programming",
    "CreatedBy": "Author Name",
    "CreatedByURL": "",
    "DocsURL": "",
    "MarketplaceURL": "",
    "CanContainContent": true,
    "IsBetaVersion": false,
    "IsExperimentalVersion": false,
    "Installed": false,
    "Modules": [
        {
            "Name": "MyPlugin",
            "Type": "Runtime",
            "LoadingPhase": "Default"
        },
        {
            "Name": "MyPluginEditor",
            "Type": "Editor",
            "LoadingPhase": "PostEngineInit"
        }
    ],
    "Plugins": [
        {
            "Name": "SomeDependency",
            "Enabled": true
        }
    ]
}
```

---

## 模块类型说明

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| Runtime | 运行时加载 | 游戏逻辑、核心功能 |
| Editor | 仅编辑器加载 | 编辑器工具、自定义面板 |
| Developer | 开发时加载 | 调试工具、开发辅助 |
| ThirdParty | 第三方库 | 外部SDK集成 |

### LoadingPhase 说明

| 阶段 | 说明 |
|------|------|
| EarliestPossible | 最早加载 |
| PostConfigInit | 配置初始化后 |
| PostSplashScreen | 启动画面后 |
| PreEarlyLoadingScreen | 早期加载界面前 |
| PreLoadingScreen | 加载界面前 |
| PreDefault | 默认前 |
| Default | 默认阶段 |
| PostDefault | 默认后 |
| PostEngineInit | 引擎初始化后 |

---

## Build.cs 模板

### 运行时模块 Build.cs
```csharp
using UnrealBuildTool;

public class MyPlugin : ModuleRules
{
    public MyPlugin(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "Slate",
            "SlateCore",
            "InputCore",
            "UnrealEd",
            "EditorStyle"
        });
    }
}
```

### 编辑器模块 Build.cs
```csharp
using UnrealBuildTool;

public class MyPluginEditor : ModuleRules
{
    public MyPluginEditor(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "MyPlugin"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "Slate",
            "SlateCore",
            "InputCore",
            "UnrealEd",
            "EditorStyle",
            "EditorWidgets",
            "PropertyEditor"
        });
    }
}
```

---

## 常见插件类型

### 1. 蓝图函数库
```cpp
// MyBlueprintFunctionLibrary.h
#pragma once

#include "Kismet/BlueprintFunctionLibrary.h"
#include "MyBlueprintFunctionLibrary.generated.h"

UCLASS()
class MYPLUGIN_API UMyBlueprintFunctionLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    // 纯函数（无副作用）
    UFUNCTION(BlueprintPure, Category = "MyPlugin|Math")
    static FVector GetRandomPointInRadius(FVector Center, float Radius);

    // 可调用函数
    UFUNCTION(BlueprintCallable, Category = "MyPlugin|Utility")
    static void SaveToFile(FString FilePath, FString Content);

    // 带默认参数
    UFUNCTION(BlueprintCallable, Category = "MyPlugin|Utility")
    static bool IsValidActor(AActor* Actor, bool bCheckVisibility = false);
};
```

### 2. 自定义资产类型
```cpp
// MyCustomAsset.h
#pragma once

#include "Engine/DataAsset.h"
#include "MyCustomAsset.generated.h"

UCLASS(BlueprintType)
class MYPLUGIN_API UMyCustomAsset : public UDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Config")
    FString AssetName;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Config")
    FLinearColor Color;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Config")
    TArray<FVector> Points;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Config")
    UTexture2D* Thumbnail;
};
```

### 3. 编辑器自定义面板
```cpp
// MyCustomPanel.h
#pragma once

#include "IDetailCustomization.h"
#include "MyCustomPanel.generated.h"

class FMyCustomPanelCustomization : public IDetailCustomization
{
public:
    static TSharedRef<IDetailCustomization> MakeInstance();
    virtual void CustomizeDetails(IDetailLayoutBuilder& DetailBuilder) override;
};

// MyCustomPanel.cpp
#include "MyCustomPanel.h"
#include "DetailLayoutBuilder.h"
#include "DetailCategoryBuilder.h"
#include "DetailWidgetRow.h"

TSharedRef<IDetailCustomization> FMyCustomPanelCustomization::MakeInstance()
{
    return MakeShareable(new FMyCustomPanelCustomization());
}

void FMyCustomPanelCustomization::CustomizeDetails(IDetailLayoutBuilder& DetailBuilder)
{
    // 自定义详情面板
    IDetailCategoryBuilder& Category = DetailBuilder.EditCategory("MyCategory", FText::GetEmpty(), ECategoryPriority::Important);
    
    Category.AddCustomRow(FText::FromString("MyRow"))
    .NameContent()
    [
        SNew(STextBlock)
        .Text(FText::FromString("Custom Property"))
    ]
    .ValueContent()
    [
        SNew(SButton)
        .Text(FText::FromString("Click Me"))
    ];
}
```

### 4. 自定义蓝图节点
```cpp
// MyBlueprintNode.h
#pragma once

#include "EdGraph/EdGraphNode.h"
#include "MyBlueprintNode.generated.h"

UCLASS()
class UMyBlueprintNode : public UEdGraphNode
{
    GENERATED_BODY()

public:
    virtual FText GetNodeTitle(ENodeTitleType::Type TitleType) const override;
    virtual FText GetTooltipText() const override;
    virtual FLinearColor GetNodeTitleColor() const override;
    
    virtual void AllocateDefaultPins() override;
    virtual FText GetMenuCategory() const override;
};
```

### 5. 编辑器工具栏按钮
```cpp
// MyToolbarButton.cpp
#include "MyToolbarButton.h"
#include "ToolMenus.h"
#include "Styling/SlateStyle.h"

void FMyToolbarButton::Register()
{
    UToolMenus::RegisterStartupCallback(FSimpleMulticastDelegate::FDelegate::CreateRaw(this, &FMyToolbarButton::RegisterMenus));
}

void FMyToolbarButton::RegisterMenus()
{
    FToolMenuOwnerScoped OwnerScoped(this);
    
    UToolMenu* Menu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu.Tools");
    FToolMenuSection& Section = Menu->FindOrAddSection("MyPluginSection");
    
    Section.AddMenuEntry(
        "MyPluginAction",
        FText::FromString("My Plugin Action"),
        FText::FromString("Execute my plugin action"),
        FSlateIcon(),
        FUIAction(FExecuteAction::CreateRaw(this, &FMyToolbarButton::OnButtonClicked))
    );
}

void FMyToolbarButton::OnButtonClicked()
{
    // 按钮点击逻辑
}
```

### 6. 自定义资产编辑器
```cpp
// MyAssetEditor.h
#pragma once

#include "Toolkits/AssetEditorToolkit.h"

class FMyAssetEditor : public FAssetEditorToolkit
{
public:
    void InitEditor(const TArray<UObject*>& InObjects);

    // IToolkit interface
    virtual FName GetToolkitFName() const override { return "MyAssetEditor"; }
    virtual FText GetBaseToolkitName() const override { return FText::FromString("My Asset Editor"); }
    virtual FLinearColor GetWorldCentricTabColorScale() const override { return FLinearColor::White; }
    virtual FString GetWorldCentricTabPrefix() const override { return "MyAsset"; }
    
    virtual void RegisterTabSpawners(const TSharedRef<FTabManager>& TabManager) override;
    virtual void UnregisterTabSpawners(const TSharedRef<FTabManager>& TabManager) override;
};
```

---

## 模块注册

### 模块头文件
```cpp
// MyPluginModule.h
#pragma once

#include "Modules/ModuleManager.h"

class FMyPluginModule : public IModuleInterface
{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
    
    static FMyPluginModule& Get()
    {
        return FModuleManager::GetModuleChecked<FMyPluginModule>("MyPlugin");
    }
    
    static bool IsAvailable()
    {
        return FModuleManager::Get().IsModuleLoaded("MyPlugin");
    }
};
```

### 模块实现
```cpp
// MyPluginModule.cpp
#include "MyPluginModule.h"

#define LOCTEXT_NAMESPACE "FMyPluginModule"

void FMyPluginModule::StartupModule()
{
    // 模块启动时执行
    UE_LOG(LogTemp, Log, TEXT("MyPlugin module started"));
}

void FMyPluginModule::ShutdownModule()
{
    // 模块关闭时执行
    UE_LOG(LogTemp, Log, TEXT("MyPlugin module shutdown"));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FMyPluginModule, MyPlugin)
```

---

## 插件开发流程

### 1. 创建插件骨架
```bash
# 使用编辑器创建
UnrealEditor -run=NewPlugin -Name=MyPlugin -Path=./Plugins

# 或手动创建目录结构
```

### 2. 开发迭代
1. 编写代码
2. 编译测试
3. 在编辑器中启用插件
4. 测试功能
5. 打包发布

### 3. 编译命令
```bash
# Windows
UnrealBuildTool.exe MyPlugin Win64 Development -Plugin="Path/To/MyPlugin.uplugin"

# 或通过项目编译
UnrealBuildTool.exe MyProject Win64 Development
```

---

## 遇到问题时

### 优先查阅文档
```bash
# 插件开发文档
python scripts/doc_manager.py --mode cloud --topic plugins --version [版本号]

# 模块系统文档
python scripts/doc_manager.py --mode cloud --topic modules --version [版本号]

# 编辑器扩展文档
python scripts/doc_manager.py --mode cloud --topic editorextensions --version [版本号]
```

### 常见问题
| 问题 | 查阅主题 |
|------|----------|
| 模块加载失败 | modules |
| 编辑器扩展不显示 | editorextensions |
| 蓝图节点不出现 | blueprintextensions |
| 资产类型无法创建 | assettypes |
| 依赖模块错误 | modules |

---

## 官方文档入口

- UE 4.27: https://docs.unrealengine.com/4.27/en-US/ProductionPipelines/Plugins/
- UE 5.0: https://docs.unrealengine.com/5.0/en-US/ProductionPipelines/Plugins/
- UE 5.1: https://docs.unrealengine.com/5.1/en-US/ProductionPipelines/Plugins/
- UE 5.2: https://docs.unrealengine.com/5.2/en-US/ProductionPipelines/Plugins/
- UE 5.3: https://docs.unrealengine.com/5.3/en-US/ProductionPipelines/Plugins/
- UE 5.4: https://docs.unrealengine.com/5.4/en-US/ProductionPipelines/Plugins/

---

## 脚本工具

| 脚本 | 功能 |
|------|------|
| `detect_ue_version.py` | 检测项目UE版本 |
| `doc_manager.py` | 文档管理（下载/在线） |
| `create_plugin.py` | 创建插件骨架 |

---

## 版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-09-03 | v3.1 | 补充 metadata.platforms 与 metadata.keywords 字段，符合 skill-creator v7 元数据规范 |
| 2026-08-29 | v3 | 精简技能目录描述，保留 UE 插件开发触发条件 |
| 2026-08-27 | v2 | 优化触发条件：删除重复的触发条件小节，补充不触发场景，技能自包含（不引用其他技能） |
| 2026-08-22 | v1 | 初始版本 |
