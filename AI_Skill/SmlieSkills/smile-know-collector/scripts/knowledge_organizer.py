#!/usr/bin/env python3
"""
知识库整理脚本
用于整理、优化和维护个人知识库，提炼方式和习惯。
"""

import json
import os
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import re
from collections import defaultdict
import difflib

class KnowledgeOrganizer:
    """知识库整理器"""
    
    def __init__(self, data_dir: str = None):
        """初始化整理器"""
        if data_dir is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            data_dir = os.path.join(os.path.dirname(script_dir), "data")
        
        self.data_dir = data_dir
        self.records_file = os.path.join(data_dir, "records.json")
        self.tags_file = os.path.join(data_dir, "tags.json")
        self.methods_file = os.path.join(data_dir, "methods.json")
        self.habits_file = os.path.join(data_dir, "habits.json")
        self.archive_dir = os.path.join(data_dir, "archive")
        
        os.makedirs(self.archive_dir, exist_ok=True)
        self._init_files()
    
    def _init_files(self):
        """初始化数据文件"""
        for file_path in [self.methods_file, self.habits_file]:
            if not os.path.exists(file_path):
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump([], f)
    
    def _load_json(self, file_path: str, default=None):
        """加载JSON文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return default if default is not None else []
    
    def _save_json(self, file_path: str, data):
        """保存JSON文件"""
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_records(self): return self._load_json(self.records_file)
    def _save_records(self, records): self._save_json(self.records_file, records)
    def _load_tags(self): return self._load_json(self.tags_file, {})
    def _save_tags(self, tags): self._save_json(self.tags_file, tags)
    def _load_methods(self): return self._load_json(self.methods_file)
    def _save_methods(self, methods): self._save_json(self.methods_file, methods)
    def _load_habits(self): return self._load_json(self.habits_file)
    def _save_habits(self, habits): self._save_json(self.habits_file, habits)
    
    def extract_methods(self) -> Dict:
        """从记录中提炼方式"""
        records = self._load_records()
        if not records:
            return {"extracted": 0, "methods": []}
        
        # 按标签分组记录
        records_by_tags = defaultdict(list)
        for record in records:
            for tag in record.get('tags', []):
                records_by_tags[tag].append(record)
        
        methods = []
        extracted_count = 0
        
        for tag, tag_records in records_by_tags.items():
            if len(tag_records) < 2:
                continue
            
            solution_records = [r for r in tag_records if r.get('type') == 'solution']
            if not solution_records:
                continue
            
            # 提取共同步骤
            steps = []
            for record in solution_records:
                content = record.get('content', '')
                lines = content.split('\n')
                for line in lines:
                    line = line.strip()
                    if re.match(r'^\d+[\.\)、]', line) or line.startswith('-'):
                        steps.append(line)
            
            if steps:
                method = {
                    "id": f"method_{tag}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "name": f"{tag}问题解决方法",
                    "description": f"解决{tag}相关问题的通用方法",
                    "category": tag,
                    "steps": list(set(steps))[:5],
                    "tools": [],
                    "examples": [r.get('content', '')[:100] for r in solution_records[:3]],
                    "frequency": len(solution_records),
                    "tags": [tag, "提炼方式"],
                    "extracted_from": [r.get('id') for r in solution_records],
                    "extracted_time": datetime.now().isoformat()
                }
                methods.append(method)
                extracted_count += 1
        
        existing_methods = self._load_methods()
        existing_methods.extend(methods)
        self._save_methods(existing_methods)
        
        return {"extracted": extracted_count, "methods": methods}
    
    def extract_habits(self) -> Dict:
        """从记录中总结习惯"""
        records = self._load_records()
        if not records:
            return {"extracted": 0, "habits": []}
        
        search_records = [r for r in records if r.get('type') == 'search']
        habits = []
        extracted_count = 0
        
        if search_records:
            search_keywords = []
            for record in search_records:
                content = record.get('content', '')
                keywords = re.findall(r'\b\w+\b', content.lower())
                search_keywords.extend(keywords)
            
            keyword_counts = defaultdict(int)
            for keyword in search_keywords:
                if len(keyword) > 2:
                    keyword_counts[keyword] += 1
            
            frequent_keywords = [word for word, count in keyword_counts.items() if count >= 2]
            
            if frequent_keywords:
                habit = {
                    "id": f"habit_search_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "name": "问题查找习惯",
                    "description": "查找问题时的常用方法和习惯",
                    "category": "查找习惯",
                    "triggers": ["遇到问题时", "需要查找信息时"],
                    "actions": [f"搜索关键词：{', '.join(frequent_keywords[:5])}"],
                    "benefits": ["提高查找效率", "快速定位问题"],
                    "frequency": len(search_records),
                    "tags": ["查找习惯", "提炼习惯"],
                    "extracted_from": [r.get('id') for r in search_records],
                    "extracted_time": datetime.now().isoformat()
                }
                habits.append(habit)
                extracted_count += 1
        
        existing_habits = self._load_habits()
        existing_habits.extend(habits)
        self._save_habits(existing_habits)
        
        return {"extracted": extracted_count, "habits": habits}
    
    def delete_records_keep_methods(self) -> Dict:
        """删除记录，只保留提炼的方式和习惯"""
        records = self._load_records()
        methods = self._load_methods()
        habits = self._load_habits()
        
        if not records:
            return {"deleted": 0, "remaining_methods": len(methods), "remaining_habits": len(habits)}
        
        archive_file = os.path.join(
            self.archive_dir, 
            f"all_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        
        with open(archive_file, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        
        self._save_records([])
        self._save_tags({})
        
        return {
            "deleted": len(records),
            "archive_file": archive_file,
            "remaining_methods": len(methods),
            "remaining_habits": len(habits)
        }
    
    def extract_and_clean(self) -> Dict:
        """提炼方式和习惯，然后删除具体记录"""
        print("开始提炼方式和习惯...")
        
        print("1. 提炼方式...")
        method_result = self.extract_methods()
        
        print("2. 总结习惯...")
        habit_result = self.extract_habits()
        
        print("3. 删除记录，只保留方式和习惯...")
        delete_result = self.delete_records_keep_methods()
        
        return {
            "提炼方式": method_result.get('extracted', 0),
            "总结习惯": habit_result.get('extracted', 0),
            "删除记录": delete_result.get('deleted', 0),
            "归档文件": delete_result.get('archive_file', ''),
            "剩余方式": delete_result.get('remaining_methods', 0),
            "剩余习惯": delete_result.get('remaining_habits', 0)
        }
    
    def generate_summary_report(self) -> Dict:
        """生成知识库总结报告"""
        records = self._load_records()
        methods = self._load_methods()
        habits = self._load_habits()
        
        tags_count = defaultdict(int)
        for record in records:
            for tag in record.get('tags', []):
                tags_count[tag] += 1
        
        return {
            "生成时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "统计概览": {
                "总记录数": len(records),
                "提炼方式数": len(methods),
                "总结习惯数": len(habits),
                "标签数量": len(tags_count)
            },
            "提炼方式": [
                {"名称": m.get('name', ''), "描述": m.get('description', '')}
                for m in methods[:5]
            ],
            "总结习惯": [
                {"名称": h.get('name', ''), "描述": h.get('description', '')}
                for h in habits[:5]
            ],
            "建议": self._generate_suggestions(records, methods, habits)
        }
    
    def _generate_suggestions(self, records, methods, habits):
        """生成建议"""
        suggestions = []
        if len(records) > 0:
            suggestions.append("有具体记录，建议提炼方式和习惯")
        if len(methods) == 0:
            suggestions.append("建议提炼通用解决方式")
        if len(habits) == 0:
            suggestions.append("建议总结工作习惯")
        if not suggestions:
            suggestions.append("知识库状态良好")
        return suggestions


def main():
    """命令行接口"""
    if len(sys.argv) < 2:
        print("用法：python knowledge_organizer.py <命令>")
        print("命令：")
        print("  extract_methods      提炼方式")
        print("  extract_habits       总结习惯")
        print("  extract_and_clean    提炼并删除记录")
        print("  summary              生成总结报告")
        return
    
    organizer = KnowledgeOrganizer()
    command = sys.argv[1]
    
    if command == "extract_methods":
        result = organizer.extract_methods()
        print(f"方式提炼完成：{result['extracted']} 种")
        for method in result.get('methods', []):
            print(f"  - {method['name']}: {method['description']}")
    
    elif command == "extract_habits":
        result = organizer.extract_habits()
        print(f"习惯总结完成：{result['extracted']} 种")
        for habit in result.get('habits', []):
            print(f"  - {habit['name']}: {habit['description']}")
    
    elif command == "extract_and_clean":
        print("开始提炼方式和习惯，并删除记录...")
        result = organizer.extract_and_clean()
        
        print("\n提炼和清理完成！")
        print("=" * 50)
        print(f"提炼方式：{result['提炼方式']} 种")
        print(f"总结习惯：{result['总结习惯']} 种")
        print(f"删除记录：{result['删除记录']} 条")
        print(f"归档文件：{result['归档文件']}")
        print(f"剩余方式：{result['剩余方式']} 种")
        print(f"剩余习惯：{result['剩余习惯']} 种")
    
    elif command == "summary":
        report = organizer.generate_summary_report()
        print("知识库总结报告")
        print("=" * 50)
        print(f"生成时间：{report['生成时间']}")
        print("\n统计概览：")
        for key, value in report['统计概览'].items():
            print(f"  {key}：{value}")
        
        if report.get('提炼方式'):
            print("\n提炼方式：")
            for method in report['提炼方式']:
                print(f"  - {method['名称']}: {method['描述']}")
        
        if report.get('总结习惯'):
            print("\n总结习惯：")
            for habit in report['总结习惯']:
                print(f"  - {habit['名称']}: {habit['描述']}")
        
        print("\n建议：")
        for suggestion in report['建议']:
            print(f"  - {suggestion}")
    
    else:
        print(f"未知命令：{command}")


if __name__ == "__main__":
    main()
