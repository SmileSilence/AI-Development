#!/usr/bin/env python3
"""
知识收集器管理脚本
用于管理个人知识库，记录问题、解决方案和查找方式。
"""

import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Optional
import uuid

class KnowledgeManager:
    """知识库管理器"""
    
    def __init__(self, data_dir: str = None):
        """初始化管理器"""
        if data_dir is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            data_dir = os.path.join(os.path.dirname(script_dir), "data")
        
        self.data_dir = data_dir
        self.records_file = os.path.join(data_dir, "records.json")
        self.tags_file = os.path.join(data_dir, "tags.json")
        
        os.makedirs(data_dir, exist_ok=True)
        self._init_files()
    
    def _init_files(self):
        """初始化数据文件"""
        for file_path in [self.records_file, self.tags_file]:
            if not os.path.exists(file_path):
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump({} if 'tags' in file_path else [], f)
    
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
    
    def add_record(self, record_type: str, content: str, tags: List[str] = None, 
                   context: str = None, metadata: Dict = None) -> Dict:
        """添加新记录"""
        if tags is None: tags = []
        if metadata is None: metadata = {}
        
        record_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        record = {
            "id": record_id,
            "timestamp": timestamp,
            "type": record_type,
            "content": content,
            "tags": tags,
            "context": context,
            "metadata": metadata
        }
        
        records = self._load_records()
        records.append(record)
        self._save_records(records)
        
        # 更新标签索引
        tags_index = self._load_tags()
        for tag in tags:
            if tag not in tags_index:
                tags_index[tag] = []
            if record_id not in tags_index[tag]:
                tags_index[tag].append(record_id)
        self._save_tags(tags_index)
        
        return record
    
    def add_problem(self, description: str, tags: List[str] = None, 
                    context: str = None, metadata: Dict = None) -> Dict:
        """添加问题记录"""
        return self.add_record("problem", description, tags, context, metadata)
    
    def add_solution(self, solution: str, problem_id: str = None, 
                     tags: List[str] = None, metadata: Dict = None) -> Dict:
        """添加解决方案记录"""
        metadata = metadata or {}
        if problem_id: metadata["problem_id"] = problem_id
        return self.add_record("solution", solution, tags, None, metadata)
    
    def add_search(self, search_method: str, tags: List[str] = None, 
                   metadata: Dict = None) -> Dict:
        """添加查找方式记录"""
        return self.add_record("search", search_method, tags, None, metadata)
    
    def search_records(self, keyword: str = None, record_type: str = None, 
                       tags: List[str] = None, limit: int = 50) -> List[Dict]:
        """搜索记录"""
        records = self._load_records()
        results = []
        
        for record in records:
            if record_type and record["type"] != record_type:
                continue
            
            if tags:
                record_tags = set(record.get("tags", []))
                if not set(tags).intersection(record_tags):
                    continue
            
            if keyword:
                keyword_lower = keyword.lower()
                content_lower = (record.get("content") or "").lower()
                context_lower = (record.get("context") or "").lower()
                
                if (keyword_lower not in content_lower and 
                    keyword_lower not in context_lower):
                    continue
            
            results.append(record)
            if len(results) >= limit: break
        
        return results
    
    def get_all_records(self, limit: int = 100) -> List[Dict]:
        """获取所有记录"""
        records = self._load_records()
        return records[-limit:]
    
    def get_statistics(self) -> Dict:
        """获取统计信息"""
        records = self._load_records()
        stats = {
            "total_records": len(records),
            "by_type": {"problem": 0, "solution": 0, "search": 0},
            "tags_count": {},
            "recent_records": []
        }
        
        for record in records:
            record_type = record.get("type", "unknown")
            if record_type in stats["by_type"]:
                stats["by_type"][record_type] += 1
            for tag in record.get("tags", []):
                stats["tags_count"][tag] = stats["tags_count"].get(tag, 0) + 1
        
        stats["recent_records"] = records[-5:] if records else []
        return stats
    
    def export_to_markdown(self, output_file: str = None) -> str:
        """导出为Markdown格式"""
        records = self._load_records()
        
        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = os.path.join(self.data_dir, "..", "exports", 
                                      f"knowledge_export_{timestamp}.md")
        
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("# 个人知识库导出\n\n")
            f.write(f"导出时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            problems = [r for r in records if r["type"] == "problem"]
            solutions = [r for r in records if r["type"] == "solution"]
            searches = [r for r in records if r["type"] == "search"]
            
            if problems:
                f.write("## 问题记录\n\n")
                for i, problem in enumerate(problems, 1):
                    f.write(f"### {i}. {problem['content']}\n\n")
                    f.write(f"- **时间**：{problem['timestamp']}\n")
                    if problem.get("tags"):
                        f.write(f"- **标签**：{', '.join(problem['tags'])}\n")
                    if problem.get("context"):
                        f.write(f"- **上下文**：{problem['context']}\n")
                    f.write("\n")
            
            if solutions:
                f.write("## 解决方案\n\n")
                for i, solution in enumerate(solutions, 1):
                    f.write(f"### {i}. {solution['content']}\n\n")
                    f.write(f"- **时间**：{solution['timestamp']}\n")
                    if solution.get("tags"):
                        f.write(f"- **标签**：{', '.join(solution['tags'])}\n")
                    f.write("\n")
            
            if searches:
                f.write("## 查找方式\n\n")
                for i, search in enumerate(searches, 1):
                    f.write(f"### {i}. {search['content']}\n\n")
                    f.write(f"- **时间**：{search['timestamp']}\n")
                    if search.get("tags"):
                        f.write(f"- **标签**：{', '.join(search['tags'])}\n")
                    f.write("\n")
        
        return output_file


def main():
    """命令行接口"""
    if len(sys.argv) < 2:
        print("用法：python knowledge_manager.py <命令> [参数]")
        print("命令：")
        print("  add_problem <描述> [标签1,标签2] [上下文]")
        print("  add_solution <描述> [标签1,标签2]")
        print("  add_search <描述> [标签1,标签2]")
        print("  search <关键词>")
        print("  list [数量]")
        print("  stats")
        print("  export [输出文件]")
        print("")
        print("整理命令：")
        print("  extract_methods            提炼方式")
        print("  extract_habits             总结习惯")
        print("  extract_and_clean          提炼并删除记录")
        print("  summary                    生成总结报告")
        return
    
    manager = KnowledgeManager()
    command = sys.argv[1]
    
    if command == "add_problem":
        if len(sys.argv) < 3:
            print("错误：缺少问题描述")
            return
        description = sys.argv[2]
        tags = sys.argv[3].split(",") if len(sys.argv) > 3 else []
        context = sys.argv[4] if len(sys.argv) > 4 else None
        record = manager.add_problem(description, tags, context)
        print(f"已添加问题记录：{record['id']}")
    
    elif command == "add_solution":
        if len(sys.argv) < 3:
            print("错误：缺少解决方案描述")
            return
        solution = sys.argv[2]
        tags = sys.argv[3].split(",") if len(sys.argv) > 3 else []
        record = manager.add_solution(solution, tags=tags)
        print(f"已添加解决方案记录：{record['id']}")
    
    elif command == "add_search":
        if len(sys.argv) < 3:
            print("错误：缺少查找方式描述")
            return
        search_method = sys.argv[2]
        tags = sys.argv[3].split(",") if len(sys.argv) > 3 else []
        record = manager.add_search(search_method, tags)
        print(f"已添加查找方式记录：{record['id']}")
    
    elif command == "search":
        if len(sys.argv) < 3:
            print("错误：缺少搜索关键词")
            return
        keyword = sys.argv[2]
        results = manager.search_records(keyword=keyword)
        if not results:
            print("未找到相关记录")
        else:
            print(f"找到 {len(results)} 条相关记录：")
            for i, record in enumerate(results, 1):
                print(f"{i}. [{record['type']}] {record['content']}")
                print(f"   时间：{record['timestamp']}")
                if record.get("tags"):
                    print(f"   标签：{', '.join(record['tags'])}")
                print()
    
    elif command == "list":
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        records = manager.get_all_records(limit)
        if not records:
            print("知识库为空")
        else:
            print(f"最近 {len(records)} 条记录：")
            for i, record in enumerate(records, 1):
                print(f"{i}. [{record['type']}] {record['content']}")
                print(f"   时间：{record['timestamp']}")
                print()
    
    elif command == "stats":
        stats = manager.get_statistics()
        print("知识库统计：")
        print(f"总记录数：{stats['total_records']}")
        print(f"问题记录：{stats['by_type']['problem']}")
        print(f"解决方案：{stats['by_type']['solution']}")
        print(f"查找方式：{stats['by_type']['search']}")
        if stats['tags_count']:
            print("\n标签统计：")
            for tag, count in sorted(stats['tags_count'].items(), 
                                    key=lambda x: x[1], reverse=True)[:10]:
                print(f"  {tag}: {count}条")
    
    elif command == "export":
        output_file = sys.argv[2] if len(sys.argv) > 2 else None
        exported_file = manager.export_to_markdown(output_file)
        print(f"已导出到：{exported_file}")
    
    # 整理命令
    elif command == "extract_methods":
        from knowledge_organizer import KnowledgeOrganizer
        organizer = KnowledgeOrganizer()
        result = organizer.extract_methods()
        print(f"方式提炼完成：{result['extracted']} 种")
        for method in result.get('methods', []):
            print(f"  - {method['name']}: {method['description']}")
    
    elif command == "extract_habits":
        from knowledge_organizer import KnowledgeOrganizer
        organizer = KnowledgeOrganizer()
        result = organizer.extract_habits()
        print(f"习惯总结完成：{result['extracted']} 种")
        for habit in result.get('habits', []):
            print(f"  - {habit['name']}: {habit['description']}")
    
    elif command == "extract_and_clean":
        from knowledge_organizer import KnowledgeOrganizer
        organizer = KnowledgeOrganizer()
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
        from knowledge_organizer import KnowledgeOrganizer
        organizer = KnowledgeOrganizer()
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
