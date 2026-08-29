# Unreal Engine C++ 最佳实践

## 类设计

### 1. UObject 和 AActor 派生类
- 使用 UCLASS() 宏标记类
- 合理使用 UPROPERTY() 和 UFUNCTION()
- 避免在构造函数中执行复杂逻辑
- 使用 BeginPlay() 进行初始化

### 2. 内存管理
- 使用智能指针（TSharedPtr, TWeakPtr）
- 合理使用垃圾回收系统
- 避免内存泄漏和悬挂指针

### 3. 接口设计
- 使用 UINTERFACE() 定义接口
- 保持接口简洁单一
- 使用接口实现松耦合

## 性能优化

### 1. Tick 优化
- 减少 Tick 函数的使用
- 使用定时器替代 Tick
- 合理设置 Tick 频率

### 2. 渲染优化
- 使用 LOD 系统
- 优化材质复杂度
- 合理使用实例化渲染

### 3. 内存优化
- 使用对象池
- 避免不必要的复制
- 合理使用资产引用

## 调试技巧

### 1. 日志系统
```cpp
UE_LOG(LogTemp, Warning, TEXT("Debug message: %s"), *SomeString);
```

### 2. 断言
```cpp
check(SomePointer != nullptr);
ensure(SomeCondition);
```

### 3. 性能分析
- 使用 stat 命令
- 使用 Unreal Insights
- 分析 CPU 和 GPU 性能

## 常见问题

### 1. 循环依赖
- 使用前置声明
- 将实现分离到 .cpp 文件
- 使用接口解耦

### 2. 编译时间
- 减少头文件包含
- 使用前置声明
- 合理划分模块

### 3. 运行时错误
- 检查空指针
- 验证资产引用
- 检查多线程同步

## 代码示例

### 基本 Actor 类
```cpp
UCLASS()
class MYPROJECT_API AMyActor : public AActor
{
    GENERATED_BODY()

public:
    AMyActor();

protected:
    virtual void BeginPlay() override;

public:
    virtual void Tick(float DeltaTime) override;

private:
    UPROPERTY(VisibleAnywhere)
    UStaticMeshComponent* MeshComponent;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (AllowPrivateAccess = "true"))
    float Speed;
};
```

### 接口实现
```cpp
UINTERFACE(MinimalAPI)
class UMyInterface : public UInterface
{
    GENERATED_BODY()
};

class IMyInterface
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, BlueprintNativeEvent, Category = "MyInterface")
    void DoSomething();
};
```

## 参考资源

- [UE C++ 编码规范](https://docs.unrealengine.com/en-US/ProductionPipelines/DevelopmentSetup/CodingStandard/)
- [UE 反射系统](https://docs.unrealengine.com/en-US/ProgrammingAndScripting/)
- [性能优化指南](https://docs.unrealengine.com/en-US/TestingAndOptimization/)
