---
name: ue-development
description: "用于Unreal Engine项目开发：C++编程、蓝图设计、项目结构、构建配置与部署。自动检测项目UE版本并提供对应版本文档。当用户询问UE/虚幻引擎项目开发、游戏开发、C++/蓝图编程、项目初始化或构建时激活。"
metadata:
  version: "v2"
---

# Unreal Engine 开发指南

本技能为Unreal Engine项目开发提供指导，核心原则：**根据项目使用的UE版本，查阅对应版本的官方文档**。

## 触发条件

### 自动触发
- 用户说「UE」「虚幻引擎」「Unreal Engine」
- 用户询问 C++ 编程、蓝图设计、关卡/场景、动画、AI、UI(UMG)、网络等游戏功能开发
- 用户请求 UE 项目初始化、构建配置、部署打包、编译报错排查
- 用户说「ue-development」

### 不触发（避免误用）
- 只做 UE 插件/模块/编辑器扩展/蓝图函数库/自定义资产（引擎扩展层）→ 不激活本技能
- 非 UE 的通用编码 → 不激活本技能

## 核心工作流程

### 步骤1：检测项目UE版本

查看项目根目录的`.uproject`文件：
```json
{
    "EngineAssociation": "5.3"  // ← 这就是版本号
}
```

或询问用户使用的UE版本。


### 步骤1.5：检测项目技术栈（可选）

检测项目中使用的第三方库、框架、插件，获取对应文档：

```bash
python scripts/detect_tech_stack.py [项目路径]
```

#### 支持检测的技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| **脚本语言** | Lua (slua/unlua/puerts) | Lua脚本集成 |
| | Python | Python脚本/自动化 |
| **UI框架** | CommonUI | 跨平台UI框架 |
| **网络** | Epic Online Services | Epic在线服务 |
| | Steam | Steam平台集成 |
| **物理** | Chaos Physics | Chaos物理引擎 |
| **动画** | ControlRig | 程序化动画 |
| **粒子** | Niagara | Niagara粒子系统 |
| **AI** | Mass AI | 大规模AI系统 |
| | Behavior Tree | 行为树AI |
| **音频** | MetaSounds | MetaSounds音频 |
| **编辑器** | Editor Extensions | 编辑器扩展 |
| **序列化** | JSON | JSON序列化 |
| **图形** | Vulkan | Vulkan图形API |
| **平台** | Android / iOS | 移动平台 |

#### 根据技术栈获取文档

检测到技术栈后，查询对应文档：

```bash
# 示例：检测到Lua集成
python scripts/doc_manager.py --mode cloud --topic lua --version 5.3

# 示例：检测到CommonUI
python scripts/doc_manager.py --mode cloud --topic commonui --version 5.3

# 示例：检测到Steam集成
python scripts/doc_manager.py --mode cloud --topic steam --version 5.3
```


### 步骤1.6：检测第三方插件（可选）

检测项目中使用的第三方插件，获取对应文档：

```bash
python scripts/detect_third_party.py [项目路径]
```

#### 常见第三方插件

| 类别 | 插件 | 说明 |
|------|------|------|
| **会话管理** | Advanced Sessions | 高级会话/大厅系统 |
| **网络请求** | VaRest | REST API请求 |
| **UI系统** | UIWS | UI组件系统 |
| **对话系统** | Dialogue Plugin | NPC对话系统 |
| **背包系统** | Inventory System | 物品管理 |
| **任务系统** | Quest System | 任务/成就系统 |
| **存档系统** | Save System | 游戏存档 |
| **平台集成** | Steam/EOS SDK | 平台服务集成 |
| **编辑器工具** | Editor Scripting | 编辑器自动化 |

#### 获取第三方插件文档

```bash
# 获取插件文档URL
python scripts/detect_third_party.py [项目路径] --urls

# 获取插件相关关键词
python scripts/detect_third_party.py [项目路径] --keywords

# JSON格式输出
python scripts/detect_third_party.py [项目路径] --json
```

#### 第三方插件文档来源

| 来源 | 说明 |
|------|------|
| 官方文档 | 插件自带的Documentation目录 |
| GitHub | 开源插件的README和Wiki |
| 论坛帖子 | Unreal Engine论坛讨论 |
| Marketplace | Epic商城插件页面 |
| 官方网站 | 插件开发商网站 |

### 步骤2：选择文档获取方式

检测到版本后，询问用户：

```
检测到您的项目使用 UE [版本号]
请选择官方文档获取方式：
1. 📥 下载到本地 - 下载PDF/HTML文档到项目目录
2. ☁️ 在线查阅 - 直接访问官方在线文档（推荐）
```

### 步骤3：获取对应版本文档

#### 选项1：下载到本地
```bash
python scripts/doc_manager.py --mode manual --version [版本号]
```
提供官方文档下载链接，用户手动下载到`.ue_docs_cache`目录。

#### 选项2：在线查阅（推荐）
```bash
python scripts/doc_manager.py --mode cloud --topic [主题] --version [版本号]
```
直接返回对应版本的官方文档URL。

---

## 遇到问题时的处理流程

### 1. 优先查阅文档
根据问题类型，查询对应版本的官方文档：

| 问题类型 | 查询命令 |
|----------|----------|
| 编译错误 | `--error compile_error` |
| 运行时错误 | `--error runtime_error` |
| 性能问题 | `--error performance` |
| 蓝图错误 | `--error blueprint_error` |

### 2. 快速查询
```bash
python scripts/doc_helper.py --analyze "问题描述" --version [版本号]
```

### 3. 主题查询
```bash
python scripts/doc_manager.py --mode cloud --topic [主题] --version [版本号]
```

---

## 文档分类

| 分类 | 主题 |
|------|------|
| programming | C++编程、Gameplay框架 |
| blueprint | 蓝图系统 |
| animation | 动画系统 |
| rendering | 渲染、材质、光照 |
| ai | AI系统、行为树 |
| networking | 网络、多人游戏 |
| audio | 音频系统 |
| ui | UI系统、UMG |
| performance | 性能优化 |

---

## 基本开发指导

### 项目结构
```
ProjectName/
├── Source/          # C++源代码
├── Content/         # 资产（蓝图、材质、纹理等）
├── Config/          # 配置文件
├── Plugins/         # 插件
└── .ue_docs_cache/  # 文档缓存（如选择下载）
```

### C++ 命名约定
- 类：`U`前缀(UObject)、`A`前缀(AActor)、`F`前缀(结构体)
- 接口：`I`前缀
- 枚举：`E`前缀
- 函数：PascalCase
- 变量：b前缀(布尔)、camelCase

### 常用宏
```cpp
UCLASS()           // 声明类
UPROPERTY()        // 声明属性
UFUNCTION()        // 声明函数
GENERATED_BODY()   // 生成反射代码
```

---

## 使用示例

### 示例1：新项目
用户："帮我创建一个UE项目"
1. 使用`init_ue_project.py`创建项目结构
2. 检测或询问UE版本
3. 询问文档获取方式
4. 配置对应版本文档

### 示例2：遇到问题
用户："编译报错 C2065"
1. 确认项目UE版本
2. 查询对应版本的编译错误文档
3. 提供解决方案

### 示例3：功能开发
用户："如何实现角色移动？"
1. 确认项目UE版本
2. 查询对应版本的输入系统文档（传统输入/Enhanced Input）
3. 提供版本对应的代码示例

---

## 重要提示

1. **版本差异**：不同UE版本的API可能有显著差异
2. **查阅文档**：遇到问题优先查阅对应版本的官方文档
3. **迁移指南**：大版本升级时，查阅官方迁移文档
4. **弃用警告**：编译时注意deprecated警告

---

## 脚本工具

| 脚本 | 功能 |
|------|------|
| `detect_ue_version.py` | 检测项目UE版本 |
| `doc_manager.py` | 文档管理（下载/在线） |
| `doc_helper.py` | 问题分析与文档推荐 |
| `init_ue_project.py` | 项目初始化 |

---

## 官方文档入口

- UE 4.27: https://docs.unrealengine.com/4.27/en-US/
- UE 5.0: https://docs.unrealengine.com/5.0/en-US/
- UE 5.1: https://docs.unrealengine.com/5.1/en-US/
- UE 5.2: https://docs.unrealengine.com/5.2/en-US/
- UE 5.3: https://docs.unrealengine.com/5.3/en-US/
- UE 5.4: https://docs.unrealengine.com/5.4/en-US/

---

## 版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-27 | v2 | 优化触发条件：补充不触发场景，技能自包含（不引用其他技能） |
| 2026-08-22 | v1 | 初始版本 |



