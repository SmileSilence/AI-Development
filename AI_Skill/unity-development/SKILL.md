---
name: unity-development
description: "用于Unity项目开发：C#编程、场景设计、项目结构、构建配置与部署。自动检测Unity版本、技术栈（URP/HDRP/DOTS/Netcode等）与第三方插件，并提供对应文档。当用户询问Unity项目开发、游戏开发、C#编程、项目初始化或构建时激活。"
metadata:
  version: "v2"
  short-description: Unity 项目开发指南
  category: 游戏开发
---

# Unity 开发指南

本技能为Unity项目开发提供指导，核心原则：**根据项目使用的Unity版本和技术栈，查阅对应版本的官方文档**。

## 触发条件

### 自动触发
- 用户说「Unity」「Unity 项目」「Unity 开发」
- 用户询问 C# 脚本、场景/预制体、物理/动画/UI/网络、渲染管线（URP/HDRP）配置
- 用户请求 Unity 项目初始化、构建打包、编译/运行报错排查
- 用户说「unity-development」

### 不触发（避免误用）
- 只做 Unity 插件/Package/编辑器扩展（可复用扩展层）→ 不激活本技能
- 非 Unity 的 C#/通用编码 → 不激活本技能

## 核心工作流程

### 步骤1：检测项目Unity版本

查看`ProjectSettings/ProjectVersion.txt`文件：
```
m_EditorVersion: 2022.3.0f1
```

或运行检测脚本：
```bash
python scripts/detect_unity_version.py [项目路径]
```

### 步骤2：检测项目技术栈（可选）

检测项目中使用的渲染管线、框架、SDK等：

```bash
python scripts/detect_tech_stack.py [项目路径]
```

#### 支持检测的技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| **渲染管线** | URP | Universal Render Pipeline |
| | HDRP | High Definition Render Pipeline |
| | Built-in | 内置渲染管线 |
| **UI框架** | UI Toolkit | 新一代UI系统 |
| | uGUI | 传统UI系统 |
| **网络框架** | Netcode for GameObjects | Unity官方网络框架 |
| | FishNet | 高性能网络框架 |
| | Mirror | 开源网络框架 |
| **ECS框架** | DOTS (Entities) | 实体组件系统 |
| **动画系统** | Animation Rigging | 程序化动画 |
| **物理系统** | Havok Physics | Havok物理引擎 |
| **特效系统** | VFX Graph | 可视化特效图 |
| **音频系统** | FMOD / Wwise | 专业音频引擎 |
| **AI系统** | Behavior Designer | 行为树 |
| | A* Pathfinding | 寻路系统 |
| **XR** | XR Interaction Toolkit | VR/AR开发 |

### 步骤3：检测第三方插件（可选）

检测项目中使用的Asset Store资源和第三方包：

```bash
python scripts/detect_third_party.py [项目路径]
```

#### 常见第三方插件

| 类别 | 插件 | 说明 |
|------|------|------|
| **动画** | DOTween | 缓动动画库 |
| | Spine | 2D骨骼动画 |
| **网络** | Photon | 多人游戏网络 |
| **AI** | Behavior Designer | 行为树编辑器 |
| | A* Pathfinding | 寻路系统 |
| **音频** | FMOD / Wwise | 专业音频 |
| **UI** | FairyGUI | 跨平台UI框架 |
| | TextMeshPro | 高质量文本 |
| **存档** | Easy Save | 存档系统 |
| **对话** | Yarn Spinner | 对话脚本 |
| | Dialogue System | 对话系统 |
| **编辑器** | Odin Inspector | Inspector扩展 |
| **广告** | AdMob / Unity Ads | 广告SDK |
| **后端** | PlayFab / Firebase | 游戏后端服务 |

### 步骤4：选择文档获取方式

```
检测到项目使用 Unity [版本号]
请选择官方文档获取方式：
1. 📥 下载到本地
2. ☁️ 在线查阅（推荐）
```

### 步骤5：获取对应版本文档

#### Unity官方文档

| 版本 | 文档URL |
|------|---------|
| Unity 6 | https://docs.unity3d.com/6000.0/Documentation/Manual/ |
| 2023.x | https://docs.unity3d.com/2023.3/Documentation/Manual/ |
| 2022.x LTS | https://docs.unity3d.com/2022.3/Documentation/Manual/ |
| 2021.x LTS | https://docs.unity3d.com/2021.3/Documentation/Manual/ |

#### 技术栈文档

```bash
# URP文档
python scripts/doc_manager.py --mode cloud --topic urp --version 2022.3

# HDRP文档
python scripts/doc_manager.py --mode cloud --topic hdrp --version 2022.3

# DOTS/ECS文档
python scripts/doc_manager.py --mode cloud --topic dots --version 2022.3

# Netcode文档
python scripts/doc_manager.py --mode cloud --topic netcode --version 2022.3
```

---

## 遇到问题时的处理流程

### 1. 优先查阅文档

```bash
# 分析问题
python scripts/doc_helper.py --analyze "问题描述"

# 错误类型查询
python scripts/doc_manager.py --error compile_error
python scripts/doc_manager.py --error runtime_error
python scripts/doc_manager.py --error performance
```

### 2. 常见问题类型

| 问题类型 | 查阅主题 |
|----------|----------|
| 编译错误 | C#编程、程序集定义 |
| 运行时错误 | MonoBehaviour、生命周期 |
| 性能问题 | Profiler、优化 |
| 渲染问题 | 渲染管线、Shader |
| UI问题 | UI Toolkit / uGUI |
| 物理问题 | Physics、Collision |

---

## 基本开发指导

### 项目结构
```
Assets/
├── Scenes/          # 游戏场景
├── Scripts/         # C#脚本
│   ├── Core/        # 核心逻辑
│   ├── Managers/    # 管理器类
│   ├── UI/          # UI脚本
│   └── Utils/       # 工具类
├── Prefabs/         # 预制体
├── Materials/       # 材质
├── Textures/        # 纹理
├── Models/          # 3D模型
├── Audio/           # 音频
├── Animations/      # 动画
└── Resources/       # 运行时加载资源
```

### C# 命名约定
- 类名：PascalCase
- 方法名：PascalCase
- 变量名：camelCase
- 私有字段：_camelCase 或 camelCase
- 常量：PascalCase 或 UPPER_SNAKE_CASE
- 接口：I前缀 + PascalCase

### MonoBehaviour生命周期
```csharp
public class MyComponent : MonoBehaviour
{
    void Awake() { }        // 实例化时调用
    void OnEnable() { }     // 启用时调用
    void Start() { }        // 第一次Update前调用
    void Update() { }       // 每帧调用
    void FixedUpdate() { }  // 固定时间步调用
    void LateUpdate() { }   // Update后调用
    void OnDisable() { }    // 禁用时调用
    void OnDestroy() { }    // 销毁时调用
}
```

### 单例模式
```csharp
public class Singleton<T> : MonoBehaviour where T : MonoBehaviour
{
    private static T _instance;
    
    public static T Instance
    {
        get
        {
            if (_instance == null)
            {
                _instance = FindObjectOfType<T>();
                if (_instance == null)
                {
                    GameObject go = new GameObject(typeof(T).Name);
                    _instance = go.AddComponent<T>();
                }
            }
            return _instance;
        }
    }
    
    protected virtual void Awake()
    {
        if (_instance == null)
        {
            _instance = this as T;
            DontDestroyOnLoad(gameObject);
        }
        else if (_instance != this)
        {
            Destroy(gameObject);
        }
    }
}
```

---

## 使用示例

### 示例1：新项目初始化
```bash
# 创建项目结构
python scripts/init_unity_project.py MyGame

# 检测版本和技术栈
python scripts/detect_unity_version.py MyGame
python scripts/detect_tech_stack.py MyGame
```

### 示例2：解决编译错误
```bash
# 分析问题
python scripts/doc_helper.py --analyze "CS0246: The type or namespace name could not be found"

# 获取C#编程文档
python scripts/doc_manager.py --mode cloud --topic csharp --version 2022.3
```

### 示例3：渲染管线配置
```bash
# 检测使用的渲染管线
python scripts/detect_tech_stack.py .

# 获取URP文档
python scripts/doc_manager.py --mode cloud --topic urp --version 2022.3
```

---

## 脚本工具

| 脚本 | 功能 |
|------|------|
| `detect_unity_version.py` | 检测Unity版本 |
| `detect_tech_stack.py` | 检测技术栈 |
| `detect_third_party.py` | 检测第三方插件 |
| `doc_manager.py` | 文档管理 |
| `doc_helper.py` | 问题分析 |
| `init_unity_project.py` | 项目初始化 |

---

## 官方资源

- [Unity Manual](https://docs.unity3d.com/Manual/)
- [Unity Scripting API](https://docs.unity3d.com/ScriptReference/)
- [Unity Learn](https://learn.unity.com/)
- [Unity Forum](https://forum.unity.com/)
- [Asset Store](https://assetstore.unity.com/)

---

## 版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-27 | v2 | 优化触发条件：补充不触发场景，技能自包含（不引用其他技能） |
| 2026-08-22 | v1 | 初始版本 |



