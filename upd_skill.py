# -*- coding: utf-8 -*-
import io
path = "C:/Users/19163/.codex/skills/SmileGlobalConfig/SKILL.md"
with io.open(path, "r", encoding="utf-8") as f:
    content = f.read()
content = content.replace("version: \"v10\"", "version: \"v11\"")
content = content.replace("last-updated: \"2026-08-23\"", "last-updated: \"2026-08-24\"")
new_rule = "- **配置精简**：刻入全局指令时无需刻入版本记录，只需将技能状态和核心规则刻入即可"
marker = "- **验证配置**：配置完成后，测试技能是否正常工作"
content = content.replace(marker, marker + "\n" + new_rule)
new_row = "| 2026-08-24 | v11 | 新增配置精简规范：刻入全局指令时仅刻入技能状态和核心规则 |"
row10 = "| 2026-08-23 | v10 | 新增文档内容规范：文档型文件内容使用中文，专业术语需附带中文翻译 |"
content = content.replace(row10, row10 + "\n" + new_row)
with io.open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("v11 SKILL.md updated")
