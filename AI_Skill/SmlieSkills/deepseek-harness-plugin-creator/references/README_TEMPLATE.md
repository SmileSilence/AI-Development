# <插件名称>

<插件描述>

---

## 安装

### 从 GitHub 安装

`ash
dsh add https://github.com/<username>/<plugin-name>
`

### 从本地安装

`ash
dsh add --local /path/to/<plugin-name>
`

---

## 使用

`ash
dsh <command> [args]
`

---

## 命令列表

| 命令 | 说明 | 用法 |
|------|------|------|
| <command> | <命令说明> | <command> [args] |

---

## 配置

<如有配置项，在此说明>

---

## 开发

### 环境要求

- Python 3.10+
- DeepSeek Harness 1.0.0+

### 本地开发

`ash
# 克隆仓库
git clone https://github.com/<username>/<plugin-name>.git
cd <plugin-name>

# 本地安装
dsh add --local .

# 运行测试
dsh <command> --test
`

---

## 许可证

[MIT License](LICENSE)

---

*最后更新：{日期}*
