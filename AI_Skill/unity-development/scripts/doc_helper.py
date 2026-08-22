#!/usr/bin/env python3
"""
UE文档查询辅助脚本
根据用户问题自动推荐相关文档和解决方案
"""

import re
from typing import List, Dict, Tuple

# 问题关键词到文档分类的映射
KEYWORD_MAPPING = {
    # C++编程相关
    "actor": ("programming", "Actor"),
    "component": ("programming", "Components"),
    "uclass": ("programming", "UCLASS"),
    "uproperty": ("programming", "UPROPERTY"),
    "ufunction": ("programming", "UFUNCTION"),
    "delegate": ("programming", "Delegates"),
    "interface": ("programming", "Interfaces"),
    "struct": ("programming", "Structures"),
    "enum": ("programming", "Enumerations"),
    "template": ("programming", "Templates"),
    "pointer": ("programming", "SmartPointers"),
    "memory": ("programming", "MemoryManagement"),
    "garbage": ("programming", "GarbageCollection"),
    
    # 蓝图相关
    "blueprint": ("blueprint", "Blueprints"),
    "蓝图": ("blueprint", "Blueprints"),
    "node": ("blueprint", "BlueprintNodes"),
    "event": ("blueprint", "BlueprintEvents"),
    "function": ("blueprint", "BlueprintFunctions"),
    "variable": ("blueprint", "BlueprintVariables"),
    "macro": ("blueprint", "BlueprintMacros"),
    "interface": ("blueprint", "BlueprintInterfaces"),
    
    # 动画相关
    "animation": ("animation", "Animation"),
    "动画": ("animation", "Animation"),
    "skeleton": ("animation", "Skeleton"),
    "mesh": ("animation", "SkeletalMesh"),
    "montage": ("animation", "AnimationMontage"),
    "sequence": ("animation", "Sequencer"),
    "blend": ("animation", "AnimationBlending"),
    "state machine": ("animation", "AnimationStateMachines"),
    
    # 渲染相关
    "material": ("rendering", "Materials"),
    "材质": ("rendering", "Materials"),
    "texture": ("rendering", "Textures"),
    "纹理": ("rendering", "Textures"),
    "light": ("rendering", "Lighting"),
    "光照": ("rendering", "Lighting"),
    "shadow": ("rendering", "Shadows"),
    "shadow": ("rendering", "Shadows"),
    "post process": ("rendering", "PostProcessing"),
    "后期处理": ("rendering", "PostProcessing"),
    "particle": ("rendering", "ParticleSystems"),
    "粒子": ("rendering", "ParticleSystems"),
    "niagara": ("rendering", "Niagara"),
    
    # AI相关
    "ai": ("ai", "AI"),
    "人工智能": ("ai", "AI"),
    "behavior tree": ("ai", "BehaviorTrees"),
    "行为树": ("ai", "BehaviorTrees"),
    "navmesh": ("ai", "NavigationMesh"),
    "navigation": ("ai", "NavigationSystem"),
    "导航": ("ai", "NavigationSystem"),
    "blackboard": ("ai", "Blackboard"),
    "perception": ("ai", "AIPerception"),
    
    # 网络相关
    "network": ("networking", "Networking"),
    "网络": ("networking", "Networking"),
    "replicate": ("networking", "Replication"),
    "复制": ("networking", "Replication"),
    "server": ("networking", "Server"),
    "服务器": ("networking", "Server"),
    "client": ("networking", "Client"),
    "客户端": ("networking", "Client"),
    "rpc": ("networking", "RPC"),
    
    # 音频相关
    "audio": ("audio", "Audio"),
    "音频": ("audio", "Audio"),
    "sound": ("audio", "SoundCue"),
    "音效": ("audio", "SoundCue"),
    "metasound": ("audio", "MetaSounds"),
    
    # UI相关
    "ui": ("ui", "UMG"),
    "界面": ("ui", "UMG"),
    "widget": ("ui", "Widgets"),
    "控件": ("ui", "Widgets"),
    "slate": ("ui", "Slate"),
    "button": ("ui", "Buttons"),
    "按钮": ("ui", "Buttons"),
    "text": ("ui", "Text"),
    "文本": ("ui", "Text"),
    
    # 性能相关
    "performance": ("performance", "Performance"),
    "性能": ("performance", "Performance"),
    "optimize": ("performance", "Optimization"),
    "优化": ("performance", "Optimization"),
    "profiling": ("performance", "Profiling"),
    "分析": ("performance", "Profiling"),
    "stat": ("performance", "StatCommands"),
    "insights": ("performance", "UnrealInsights"),
    "memory": ("performance", "MemoryProfiling"),
    "内存": ("performance", "MemoryProfiling"),
}

# 常见错误模式
ERROR_PATTERNS = {
    r"error\s*C\d+": "compile_error",
    r"LNK\d+": "compile_error",
    r"unresolved\s+external": "compile_error",
    r"undefined\s+reference": "compile_error",
    r"cannot\s+open\s+source\s+file": "compile_error",
    r"access\s+violation": "runtime_error",
    r"nullptr": "runtime_error",
    r"null\s+pointer": "runtime_error",
    r"crash": "runtime_error",
    r"exception": "runtime_error",
    r"fps\s+drop": "performance",
    r"lag": "performance",
    r"slow": "performance",
    r"stutter": "performance",
    r"blueprint\s+error": "blueprint_error",
    r"blueprint\s+crash": "blueprint_error",
    r"node\s+error": "blueprint_error",
}

class UEDocHelper:
    """UE文档查询助手"""
    
    def __init__(self, version: str = "5.3"):
        self.version = version
        self.base_url = "https://docs.unrealengine.com/en-US"
    
    def analyze_question(self, question: str) -> Dict:
        """分析用户问题，返回相关文档推荐"""
        question_lower = question.lower()
        
        result = {
            "question": question,
            "detected_topics": [],
            "error_type": None,
            "recommended_docs": [],
            "suggested_actions": []
        }
        
        # 检测错误类型
        for pattern, error_type in ERROR_PATTERNS.items():
            if re.search(pattern, question, re.IGNORECASE):
                result["error_type"] = error_type
                break
        
        # 检测相关主题
        found_topics = set()
        for keyword, (category, topic) in KEYWORD_MAPPING.items():
            if keyword.lower() in question_lower:
                found_topics.add((category, topic))
        
        result["detected_topics"] = list(found_topics)
        
        # 生成推荐文档
        if result["error_type"]:
            result["recommended_docs"].append({
                "type": "troubleshooting",
                "title": f"故障排除: {result['error_type']}",
                "url": f"{self.base_url}/Troubleshooting/{result['error_type']}/?version={self.version}"
            })
        
        for category, topic in found_topics:
            result["recommended_docs"].append({
                "type": "topic",
                "title": f"{category}: {topic}",
                "url": f"{self.base_url}/{category}/{topic}/?version={self.version}"
            })
        
        # 生成建议操作
        if not result["recommended_docs"]:
            result["suggested_actions"].append("尝试使用更具体的关键词")
            result["suggested_actions"].append("查看通用文档: " + f"{self.base_url}/?version={self.version}")
        
        return result
    
    def get_quick_help(self, topic: str) -> str:
        """获取快速帮助信息"""
        quick_helps = {
            "actor": """
🎭 Actor 快速指南
==================

Actor是UE中可放置到世界中的对象基类。

创建自定义Actor:
1. 继承AActor类
2. 使用UCLASS()宏标记
3. 实现BeginPlay()和Tick()
4. 添加组件（UActorComponent）

示例代码:
```cpp
UCLASS()
class AMyActor : public AActor
{
    GENERATED_BODY()
public:
    AMyActor();
protected:
    virtual void BeginPlay() override;
public:
    virtual void Tick(float DeltaTime) override;
};
```

📖 详细文档: {base_url}/ProgrammingAndScripting/GameplayProgramming/Actor/?version={version}
""",
            "blueprint": """
🎨 蓝图快速指南
==================

蓝图是UE的可视化脚本系统。

基础概念:
- 事件图表: 处理游戏逻辑
- 函数: 可重用的代码块
- 变量: 存储数据
- 节点: 执行操作

最佳实践:
1. 保持蓝图简洁
2. 复杂逻辑用C++
3. 使用接口实现松耦合
4. 避免在Tick中做复杂计算

📖 详细文档: {base_url}/ProgrammingAndScripting/Blueprints/?version={version}
""",
            "material": """
🎨 材质快速指南
==================

材质定义对象的外观。

基础节点:
- 基础颜色 (Base Color)
- 金属度 (Metallic)
- 粗糙度 (Roughness)
- 法线贴图 (Normal)

创建步骤:
1. 右键创建材质资产
2. 添加纹理和参数节点
3. 连接节点到输出
4. 应用到网格体

📖 详细文档: {base_url}/RenderingAndGraphics/Materials/?version={version}
""",
            "performance": """
⚡ 性能优化快速指南
==================

常用工具:
- stat fps: 显示帧率
- stat unit: 显示各线程耗时
- stat game: 显示游戏线程详情
- Unreal Insights: 详细性能分析

优化策略:
1. 减少Tick使用
2. 使用LOD系统
3. 优化材质复杂度
4. 使用对象池
5. 异步加载资产

📖 详细文档: {base_url}/TestingAndOptimization/PerformanceAndProfiling/?version={version}
"""
        }
        
        topic_lower = topic.lower()
        for key, help_text in quick_helps.items():
            if key in topic_lower:
                return help_text.format(
                    base_url=self.base_url,
                    version=self.version
                )
        
        return f"未找到 '{topic}' 的快速帮助。请查看完整文档: {self.base_url}/?version={self.version}"
    
    def format_response(self, analysis: Dict) -> str:
        """格式化响应"""
        lines = []
        lines.append(f"\n🔍 问题分析: {analysis['question']}")
        lines.append("=" * 60)
        
        if analysis['error_type']:
            lines.append(f"\n⚠️ 检测到错误类型: {analysis['error_type']}")
        
        if analysis['detected_topics']:
            lines.append(f"\n📚 相关主题:")
            for category, topic in analysis['detected_topics']:
                lines.append(f"   • {category}: {topic}")
        
        if analysis['recommended_docs']:
            lines.append(f"\n📖 推荐文档:")
            for i, doc in enumerate(analysis['recommended_docs'], 1):
                lines.append(f"   {i}. {doc['title']}")
                lines.append(f"      🔗 {doc['url']}")
        
        if analysis['suggested_actions']:
            lines.append(f"\n💡 建议:")
            for action in analysis['suggested_actions']:
                lines.append(f"   • {action}")
        
        return "\n".join(lines)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="UE文档查询助手")
    parser.add_argument("question", nargs="?", help="要查询的问题")
    parser.add_argument("--version", default="5.3", help="UE版本")
    parser.add_argument("--quick", help="获取快速帮助（如: actor, blueprint, material）")
    parser.add_argument("--analyze", help="分析问题文本")
    parser.add_argument("--interactive", action="store_true", help="交互模式")
    
    args = parser.parse_args()
    
    helper = UEDocHelper(args.version)
    
    if args.quick:
        print(helper.get_quick_help(args.quick))
        return
    
    if args.analyze:
        analysis = helper.analyze_question(args.analyze)
        print(helper.format_response(analysis))
        return
    
    if args.interactive:
        print("🎮 UE文档查询助手 (输入 'quit' 退出)")
        print("=" * 60)
        
        while True:
            try:
                question = input("\n❓ 请输入问题: ").strip()
                if question.lower() in ['quit', 'exit', 'q']:
                    print("👋 再见!")
                    break
                
                if not question:
                    continue
                
                analysis = helper.analyze_question(question)
                print(helper.format_response(analysis))
                
            except KeyboardInterrupt:
                print("\n👋 再见!")
                break
            except Exception as e:
                print(f"❌ 错误: {e}")
        return
    
    if args.question:
        analysis = helper.analyze_question(args.question)
        print(helper.format_response(analysis))
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
