---
name: unity-plugin-development
description: "用于Unity插件和Package开发：Package结构设计、程序集定义(.asmdef)、编辑器扩展、自定义Inspector、ScriptableObject等。自动检测Unity版本、技术栈与第三方插件，并提供对应文档。当用户询问Unity插件/Package开发、编辑器扩展、自定义工具时激活。"
metadata:
  version: "v2"
---

# Unity插件/Package开发指南

本技能专注于Unity插件和Package开发，核心原则：**根据项目Unity版本和技术栈，查阅对应的Package开发文档**。

## 触发条件

### 自动触发
- 用户说「Unity 插件」「Unity Package」「Package 开发」
- 用户询问编辑器扩展（Inspector/窗口/菜单/PropertyDrawer）、程序集定义(.asmdef)、ScriptableObject
- 用户请求创建或修改 Package（package.json、Runtime/、Editor/、Samples~）
- 用户说「unity-plugin-development」

### 不触发（避免误用）
- 在 Unity 项目内写玩法/场景逻辑（MonoBehaviour 游戏内容）→ 不激活本技能
- 非 Unity 的插件/扩展 → 不激活本技能

## 核心工作流程

### 步骤1：检测项目Unity版本
```bash
python scripts/detect_unity_version.py [项目路径]
```

### 步骤2：检测项目技术栈（可选）
```bash
python scripts/detect_tech_stack.py [项目路径]
```

### 步骤3：检测第三方插件（可选）
```bash
python scripts/detect_third_party.py [项目路径]
```

### 步骤4：选择文档获取方式
```
检测到项目使用 Unity [版本号]
请选择官方文档获取方式：
1. 📥 下载到本地
2. ☁️ 在线查阅（推荐）
```

### 步骤5：查阅Package开发文档

```bash
# Package开发文档
python scripts/doc_manager.py --mode cloud --topic package-manager --version 2022.3

# 编辑器扩展文档
python scripts/doc_manager.py --mode cloud --topic editor-extension --version 2022.3

# 程序集定义文档
python scripts/doc_manager.py --mode cloud --topic assembly-definition --version 2022.3
```

---

## Package结构规范

### 标准Package目录结构
```
com.company.package-name/
├── package.json              # Package清单
├── README.md                 # 说明文档
├── CHANGELOG.md              # 更新日志
├── LICENSE.md                # 许可证
├── Documentation~            # 文档（~后缀不导入）
├── Runtime/                  # 运行时代码
│   ├── Scripts/
│   ├── Prefabs/
│   ├── Materials/
│   ├── Shaders/
│   └── package-name.runtime.asmdef
├── Editor/                   # 编辑器代码（仅Editor平台）
│   ├── Scripts/
│   ├── EditorWindows/
│   ├── PropertyDrawers/
│   ├── CustomEditors/
│   └── package-name.editor.asmdef
├── Tests/                    # 测试
│   ├── Runtime/
│   └── Editor/
├── Samples~                  # 示例（可选）
│   ├── ExampleScene/
│   └── ExampleScripts/
└── Resources/
```

### package.json 示例
```json
{
    "name": "com.company.package-name",
    "version": "1.0.0",
    "displayName": "Package Name",
    "description": "Package description",
    "unity": "2021.3",
    "unityRelease": "0f1",
    "documentationUrl": "https://example.com/docs",
    "changelogUrl": "https://example.com/changelog",
    "licensesUrl": "https://example.com/license",
    "dependencies": {
        "com.unity.textmeshpro": "3.0.6"
    },
    "keywords": [
        "keyword1",
        "keyword2"
    ],
    "author": {
        "name": "Company Name",
        "email": "support@company.com",
        "url": "https://company.com"
    },
    "type": "library",
    "samples": [
        {
            "displayName": "Example",
            "description": "Example usage",
            "path": "Samples~/Example"
        }
    ]
}
```

---

## 程序集定义 (Assembly Definition)

### 运行时程序集 (.runtime.asmdef)
```json
{
    "name": "com.company.package-name.runtime",
    "rootNamespace": "Company.PackageName",
    "references": [],
    "includePlatforms": [],
    "excludePlatforms": [],
    "allowUnsafeCode": false,
    "overrideReferences": false,
    "precompiledReferences": [],
    "autoReferenced": true,
    "defineConstraints": [],
    "versionDefines": [],
    "noEngineReferences": false
}
```

### 编辑器程序集 (.editor.asmdef)
```json
{
    "name": "com.company.package-name.editor",
    "rootNamespace": "Company.PackageName.Editor",
    "references": [
        "com.company.package-name.runtime"
    ],
    "includePlatforms": [
        "Editor"
    ],
    "excludePlatforms": [],
    "allowUnsafeCode": false,
    "overrideReferences": false,
    "precompiledReferences": [],
    "autoReferenced": true,
    "defineConstraints": [],
    "versionDefines": [],
    "noEngineReferences": false
}
```

---

## 常见插件类型

### 1. 自定义Inspector
```csharp
using UnityEngine;
using UnityEditor;

namespace MyPackage.Editor
{
    [CustomEditor(typeof(MyComponent))]
    public class MyComponentEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            base.OnInspectorGUI();
            
            EditorGUILayout.Space();
            
            MyComponent target = (MyComponent)this.target;
            
            if (GUILayout.Button("Do Something"))
            {
                target.DoSomething();
            }
        }
    }
}
```

### 2. 编辑器窗口
```csharp
using UnityEditor;
using UnityEngine;

namespace MyPackage.Editor
{
    public class MyEditorWindow : EditorWindow
    {
        [MenuItem("Window/My Package/My Window")]
        public static void ShowWindow()
        {
            GetWindow<MyEditorWindow>("My Window");
        }
        
        private void OnGUI()
        {
            EditorGUILayout.LabelField("My Editor Window", EditorStyles.boldLabel);
            
            if (GUILayout.Button("Click Me"))
            {
                Debug.Log("Button clicked!");
            }
        }
    }
}
```

### 3. ScriptableObject
```csharp
using UnityEngine;

namespace MyPackage
{
    [CreateAssetMenu(fileName = "NewMyData", menuName = "My Package/My Data")]
    public class MyData : ScriptableObject
    {
        [Header("Settings")]
        public string dataName;
        public int value;
        public Sprite icon;
        
        [Header("Advanced")]
        public Vector3[] points;
        public Color color = Color.white;
    }
}
```

### 4. 自定义PropertyDrawer
```csharp
using UnityEditor;
using UnityEngine;

namespace MyPackage.Editor
{
    [CustomPropertyDrawer(typeof(MyData))]
    public class MyDataDrawer : PropertyDrawer
    {
        public override void OnGUI(Rect position, SerializedProperty property, GUIContent label)
        {
            EditorGUI.BeginProperty(position, label, property);
            
            Rect nameRect = new Rect(position.x, position.y, position.width, EditorGUIUtility.singleLineHeight);
            EditorGUI.PropertyField(nameRect, property.FindPropertyRelative("dataName"), label);
            
            EditorGUI.EndProperty();
        }
        
        public override float GetPropertyHeight(SerializedProperty property, GUIContent label)
        {
            return EditorGUIUtility.singleLineHeight;
        }
    }
}
```

### 5. 自定义菜单
```csharp
using UnityEditor;
using UnityEngine;

namespace MyPackage.Editor
{
    public static class MyMenus
    {
        [MenuItem("My Package/Create Asset")]
        public static void CreateAsset()
        {
            // Create asset logic
        }
        
        [MenuItem("My Package/Tools/Do Something")]
        public static void DoSomething()
        {
            // Tool logic
        }
        
        [MenuItem("My Package/Create Asset", true)]
        private static bool CreateAssetValidation()
        {
            // Validation logic
            return true;
        }
    }
}
```

### 6. 运行时组件
```csharp
using UnityEngine;

namespace MyPackage
{
    /// <summary>
    /// Example runtime component
    /// </summary>
    [AddComponentMenu("My Package/My Component")]
    [HelpURL("https://docs.example.com")]
    public class MyComponent : MonoBehaviour
    {
        [Header("Settings")]
        [SerializeField] private bool enableFeature = true;
        [SerializeField] [Range(0f, 1f)] private float intensity = 0.5f;
        
        [Header("References")]
        [SerializeField] private Transform target;
        
        public float Intensity
        {
            get => intensity;
            set => intensity = Mathf.Clamp01(value);
        }
        
        private void Awake()
        {
            Debug.Log("MyComponent initialized");
        }
        
        private void Update()
        {
            if (enableFeature && target != null)
            {
                // Update logic
            }
        }
        
        /// <summary>
        /// Example public method
        /// </summary>
        public void DoSomething()
        {
            // Implementation
        }
    }
}
```

---

## Package开发流程

### 1. 创建Package骨架
```bash
python scripts/create_package.py MyPackage --author "Company" --samples
```

### 2. 开发迭代
1. 编写代码
2. 在Unity中测试（本地Package引用）
3. 打包发布

### 3. 本地测试
在项目`Packages/manifest.json`中添加：
```json
{
    "dependencies": {
        "com.company.package-name": "file:../path/to/package"
    }
}
```

### 4. 发布到Unity Package Manager
1. 创建Git仓库
2. 打Tag（如v1.0.0）
3. 提交到Unity Package Registry或使用Git URL

---

## 遇到问题时

### 优先查阅文档
```bash
# Package开发文档
python scripts/doc_manager.py --mode cloud --topic package-manager --version 2022.3

# 编辑器扩展文档
python scripts/doc_manager.py --mode cloud --topic editor-extension --version 2022.3

# 程序集定义文档
python scripts/doc_manager.py --mode cloud --topic assembly-definition --version 2022.3
```

### 常见问题
| 问题 | 查阅主题 |
|------|----------|
| Package不被识别 | package-manager, package-json |
| 程序集引用错误 | assembly-definition |
| 编辑器脚本不执行 | editor-extension |
| 资源不被导入 | asset-importer |
| 依赖解析失败 | package-manager, dependencies |

---

## 脚本工具

| 脚本 | 功能 |
|------|------|
| `create_package.py` | 创建Package骨架 |
| `detect_unity_version.py` | 检测Unity版本 |
| `detect_tech_stack.py` | 检测技术栈 |
| `detect_third_party.py` | 检测第三方插件 |
| `doc_manager.py` | 文档管理 |
| `doc_helper.py` | 问题分析 |

---

## 官方资源

- [Unity Package Manager Manual](https://docs.unity3d.com/Manual/upm-ui.html)
- [Creating Custom Packages](https://docs.unity3d.com/Manual/CustomPackages.html)
- [Assembly Definitions](https://docs.unity3d.com/Manual/ScriptCompilationAssemblyDefinitionFiles.html)
- [Editor Extensions](https://docs.unity3d.com/Manual/ExtendingTheEditor.html)
- [ScriptableObject](https://docs.unity3d.com/Manual/class-ScriptableObject.html)

---

## 版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-08-27 | v2 | 优化触发条件：补充不触发场景，技能自包含（不引用其他技能） |
| 2026-08-22 | v1 | 初始版本 |



