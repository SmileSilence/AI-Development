---
name: SmileProjectConfig
description: 项目配置规范 - D:\Work\Project 工作区的项目结构、编码规范、Git规范、AI助手行为指南等。当涉及 Python 桌面应用开发、项目初始化、文档生成时激活。
metadata:
  version: "v1"
metadata:
  version: "v1"
  short-description: Python 项目配置规范
metadata:
  version: "v1"
---

# SmileProjectConfig — 项目配置规范

适用于 D:\Work\Project\ 工作区的项目开发规范。

---

## 触发条件

- 用户说「项目配置」「项目规范」「项目结构」
- 用户要求初始化项目、生成文档、配置 Git
- 用户说「SmileProjectConfig」或「项目配置」

## 一、核心原则

### 1.1 语言与沟通
- **回复语言**：中文 — 所有解释、注释、文档统一使用中文
- **代码标识符**：技术术语、变量名、函数名、类名保持英文
- **沟通风格**：简洁直接，先给结论再展开细节

### 1.2 文档同步与版本记录
**每次对项目功能、UI 或流程做出修改后，必须同步更新对应的文档。**
- 项目级变更 → 更新项目的 AGENTS.md / PROJECT_SPEC.md，并追加版本记录
- 工作区级变更 → 更新本文档，并追加版本记录

### 1.3 版本号规则
- 格式：{顺序号}（1、2、3...），顺序递增，不重置
- 每次对项目代码或文档做出实质性修改后，版本号 +1 并追加变更记录
- 首次创建项目文档时版本号为 1

### 1.4 代码风格
- **Python**：遵循 PEP 8，snake_case 变量/函数，PascalCase 类，UPPER_CASE 常量
- **注释**：写「为什么」而非「是什么」，公共接口必须有 docstring
- **一致性**：与项目已有代码保持风格一致（缩进、引号、空行等）

---

## 二、项目结构约定

所有项目遵循统一目录结构：

`
<项目名>/
├── main.py              # 程序入口
├── requirements.txt     # Python 依赖
├── AGENTS.md            # 项目规范（AI 助手行为指南）
├── PROJECT_SPEC.md      # 项目特殊规范（差异、已知问题、变更记录）
├── README.md            # 使用说明
├── .gitignore           # Git 忽略规则
│
├── src/ 或 app/ 或 core/   # 源代码
├── ui/                     # 界面代码（如有）
├── dist/                   # 构建产物（不提交 Git）
├── build/                  # 构建临时文件（不提交 Git）
├── resources/ 或 assets/   # 静态资源
└── output/                 # 运行时输出
`

---

## 三、通用规范

### 3.1 命名规范

| 语言 | 变量/函数 | 类/组件 | 常量 | 文件名 |
|------|-----------|---------|------|--------|
| Python | snake_case | PascalCase | UPPER_CASE | snake_case |
| TypeScript/JS | camelCase | PascalCase | UPPER_CASE | camelCase 或 kebab-case |

### 3.2 错误处理
- 使用自定义异常类区分业务异常和系统异常
- 不吞异常也不裸抛 — 捕获后记录日志并向用户展示有意义的信息
- 文件操作考虑权限和路径兼容性

### 3.3 防御编程
- 外部输入必须校验类型和边界
- 文件操作使用 pathlib.Path 而非字符串拼接
- Windows 特有逻辑加 sys.platform == "win32" 判断并附 fallback

### 3.4 测试
- 关键路径优先覆盖：核心业务逻辑、边界条件、错误路径
- 测试框架：pytest
- 测试命名：	est_<功能>_<场景>_<预期>

### 3.5 日志
- 桌面应用使用 logging 模块，输出到文件和控制台
- 日志级别：DEBUG（开发调试）、INFO（关键流程）、WARNING（可恢复异常）、ERROR（需关注的错误）

### 3.6 界面素材获取规范
- 项目涉及 UI 界面开发时，优先从网上通用素材库搜索、下载素材
- 常用免费素材库：
  - [Iconfont](https://www.iconfont.cn/) — 矢量图标库
  - [Flaticon](https://www.flaticon.com/) — 矢量图标与贴纸
  - [Material Icons](https://fonts.google.com/icons) — Google Material Design 图标
  - [Pexels](https://www.pexels.com/) / [Unsplash](https://unsplash.com/) — 免费商用图片
  - [Freepik](https://www.freepik.com/) — 矢量图、插画、PSD 素材
- 下载前确认素材的授权协议，确保合规使用
- 素材文件统一归类到项目 esources/ 或 ssets/ 目录

---

## 四、Git 规范

- **主分支**：main
- **分支命名**：
  - eat/<描述> — 新功能
  - ix/<描述> — 修复
  - efactor/<描述> — 重构
  - docs/<描述> — 文档
- **提交粒度**：一个提交对应一个逻辑变更，不混入无关修改
- **提交信息**：中文祈使句，说明「做了什么」而非「改了什么文件」

---

## 五、AI 助手行为指南

### 5.1 主动探索
任务涉及多文件时，先浏览代码库理解上下文再动手，不凭记忆猜测。

### 5.2 逐项确认
- 复杂多步任务按顺序推进，每步完成再进入下一步
- 涉及删除、覆盖、外部发布等不可逆操作前，先确认再执行

### 5.3 工具使用
- 优先使用专用工具（Read、Grep、Glob、Edit、Write）而非 shell 命令
- 文件搜索用 Glob，内容搜索用 Grep
- 不重复读取刚才编辑过的文件来验证修改

### 5.4 报告结果
- 失败如实汇报错误信息
- 跳过说明原因
- 完成说明验证依据

### 5.5 使用项目模版
创建新项目时，参考 eferences/ 目录下的模版文件生成项目文档：
1. 复制模版文件中的对应章节到 AGENTS.md / PROJECT_SPEC.md / README.md
2. 将 {项目名} 替换为实际项目名称
3. 根据项目实际情况填写各章节内容
4. 删除不适用的部分和占位说明

---

## 六、打包与发布

- 使用 PyInstaller 打包为单文件 EXE
- 打包脚本统一命名为 uild_exe.py
- 输出目录：dist/
- 打包后清理临时文件（uild/ 目录和 .spec 文件）

---

## 七、配置管理

| 项目 | 配置路径 |
|------|----------|
| ClaudeSettingsEditor | 编辑 ~/.Codex/settings.json |
| DeepSeekMonitor | ~/.deepseek_monitor/config.json |
| AudioSwitch | 无持久化配置（即用即走） |

---

## 八、注意事项

- 所有项目面向 **Windows 平台**，部分功能依赖 Windows API
- Python 版本要求 **3.10+**，已测试至 3.14
- 虚拟环境目录 (env/)、构建产物 (dist/、uild/)、__pycache__/ 不纳入版本控制
- 使用 Git Bash 作为 shell 环境，注意路径分隔符使用正斜杠 /

---

## 九、版本记录

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-07-25 | v3 | 新增 3.6 界面素材获取规范 |
| 2026-07-25 | v2 | 新增版本号规则（1.3）；新增 5.5 使用项目模板 |
| 2026-07-19 | v1 | 初始版本 |



