# {项目名} — 项目规范

> 本文档是项目的规范说明与 AI 助手行为指南。
> **工作区通用规范**参见父目录的 CLAUDE.md（语言、命名、错误处理、Git、AI 行为等基础规范）。
> **项目特殊规范**参见本项目的 PROJECT_SPEC.md（差异、配置、已知问题）。
>
> **优先级**：PROJECT_SPEC.md > 本文档 > ../CLAUDE.md

---

## 一、项目概述

_在此描述项目的功能定位、目标用户和技术栈。_

---

## 二、项目结构

`
{项目名}/
├── main.py                 # 程序入口
├── CLAUDE.md               # 项目规范（本文档）
├── PROJECT_SPEC.md         # 项目特殊规范
├── README.md               # 使用说明
├── requirements.txt        # Python 依赖
├── .gitignore              # Git 忽略规则
│
├── src/ 或 app/ 或 core/   # 源代码
│   └── __init__.py
│
├── build_exe.py            # 打包脚本（如适用）
├── output/                 # 运行时输出（如有，不提交 Git）
├── resources/              # 静态资源（如有）
└── dist/                   # 构建产物（如有，不提交 Git）
`

---

## 三、项目专属规范

### 3.1 代码约定

_在此记录项目特有的命名、架构或设计约定。示例：_
- _项目使用的设计模式_
- _模块分层规则_
- _数据流方向约定_

### 3.2 特殊配置

_在此记录项目所需的环境变量、第三方服务等配置项。示例：_

| 变量 | 说明 | 默认值 |
|------|------|--------|
| API_KEY | 第三方服务密钥 | — |

### 3.3 已知问题

_在此记录已知问题和临时解决方案。_

---

## 四、开发环境

### 4.1 环境要求

- Python 3.10+
- 依赖见 equirements.txt

### 4.2 快速开始

`ash
# 创建虚拟环境
python -m venv venv
venv\Scripts\activate    # Windows

# 安装依赖
pip install -r requirements.txt

# 运行
python main.py
`

### 4.3 打包（如适用）

`ash
python build_exe.py
`

输出文件：dist/{项目名}.exe

---

## 五、注意事项

_在此记录项目特有的注意事项。_

---

## 六、版本记录

> 版本号规则：{顺序号}（1、2、3...），每次实质性修改后 +1。
> 修改项目代码或文档时，必须在下方追加版本记录。

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| {创建日期} | v1 | 初始版本 — 根据 CLAUDE_PROJECT_TEMPLATE.md 生成 |

---

*本文档由 CLAUDE_PROJECT_TEMPLATE.md 生成，请根据实际项目需求修改完善。*
