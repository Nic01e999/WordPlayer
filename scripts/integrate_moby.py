#!/usr/bin/env python3
"""
集成 Moby Thesaurus 同义词数据到英文词典
数据源：moby_thesaurus.txt (24MB, 约30,000个词条)
"""

import sqlite3
import json
import sys
from pathlib import Path

# 路径配置
DB_DIR = Path(__file__).parent.parent / 'data' / 'databases'
SOURCE_DIR = Path(__file__).parent.parent / 'data' / 'resources' / 'moby'
EN_DB = DB_DIR / 'en_dict.db'
MOBY_FILE = SOURCE_DIR / 'moby_thesaurus.txt'


class MobyIntegrator:
    """Moby Thesaurus 集成器"""

    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None

    def connect(self):
        """连接数据库"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.execute('PRAGMA journal_mode=WAL')
        self.conn.execute('PRAGMA synchronous=NORMAL')
        print(f"✓ 连接数据库: {self.db_path}")

    def add_synonyms_column(self):
        """添加 synonyms_moby 字段"""
        print("检查并添加 synonyms_moby 字段...")

        cursor = self.conn.cursor()

        # 检查字段是否已存在
        cursor.execute("PRAGMA table_info(words)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'synonyms_moby' not in columns:
            cursor.execute('ALTER TABLE words ADD COLUMN synonyms_moby TEXT')
            self.conn.commit()
            print("✓ 已添加 synonyms_moby 字段")
        else:
            print("✓ synonyms_moby 字段已存在")

    def parse_moby_line(self, line):
        """解析 Moby Thesaurus 的一行数据"""
        line = line.strip()
        if not line:
            return None, None

        parts = [p.strip() for p in line.split(',')]
        if len(parts) < 2:
            return None, None

        word = parts[0].lower()
        synonyms = [s.lower() for s in parts[1:] if s]

        # 去重并排序
        synonyms = sorted(list(set(synonyms)))

        return word, synonyms

    def integrate_moby(self, moby_file):
        """集成 Moby Thesaurus 数据"""
        print(f"导入 Moby Thesaurus: {moby_file}")

        if not moby_file.exists():
            print(f"✗ 文件不存在: {moby_file}")
            return False

        count = 0
        updated = 0
        batch = []
        batch_size = 1000

        with open(moby_file, 'r', encoding='utf-8') as f:
            for line in f:
                word, synonyms = self.parse_moby_line(line)
                if not word or not synonyms:
                    continue

                synonyms_json = json.dumps(synonyms, ensure_ascii=False)
                batch.append((synonyms_json, word))
                count += 1

                if len(batch) >= batch_size:
                    cursor = self.conn.cursor()
                    cursor.executemany(
                        'UPDATE words SET synonyms_moby = ? WHERE word = ?',
                        batch
                    )
                    updated += cursor.rowcount
                    self.conn.commit()
                    batch = []
                    print(f"  已处理 {count} 个词条，更新 {updated} 条记录...", end='\r')

        # 处理剩余数据
        if batch:
            cursor = self.conn.cursor()
            cursor.executemany(
                'UPDATE words SET synonyms_moby = ? WHERE word = ?',
                batch
            )
            updated += cursor.rowcount
            self.conn.commit()

        print(f"\n✓ Moby Thesaurus 导入完成")
        print(f"  处理词条: {count}")
        print(f"  更新记录: {updated}")
        print(f"  覆盖率: {updated/count*100:.1f}%")

        return True

    def create_index(self):
        """为 synonyms_moby 字段创建索引"""
        print("创建索引...")
        try:
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_words_synonyms ON words(synonyms_moby)')
            self.conn.commit()
            print("✓ 索引创建完成")
        except Exception as e:
            print(f"⚠ 索引创建失败: {e}")

    def close(self):
        """关闭数据库"""
        if self.conn:
            self.conn.close()


def main():
    """主函数"""
    print("=" * 60)
    print("集成 Moby Thesaurus 同义词数据")
    print("=" * 60)
    print()

    # 检查数据库
    if not EN_DB.exists():
        print(f"✗ 数据库不存在: {EN_DB}")
        print("请先运行: python scripts/build_en_dict.py")
        return 1

    # 检查数据文件
    if not MOBY_FILE.exists():
        print(f"✗ 数据文件不存在: {MOBY_FILE}")
        return 1

    # 集成数据
    integrator = MobyIntegrator(EN_DB)
    integrator.connect()
    integrator.add_synonyms_column()

    if not integrator.integrate_moby(MOBY_FILE):
        print("✗ 集成失败")
        return 1

    integrator.create_index()
    integrator.close()

    print("\n" + "=" * 60)
    print("✓ Moby Thesaurus 集成完成！")
    print("=" * 60)

    return 0


if __name__ == '__main__':
    sys.exit(main())
