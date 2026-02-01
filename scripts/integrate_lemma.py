#!/usr/bin/env python3
"""
集成英文词根（Lemma）数据到英文词典
数据源：lemma.en.txt (2.2MB, 186,523个词条, 84,487个词根组)
"""

import sqlite3
import sys
from pathlib import Path

# 路径配置
DB_DIR = Path(__file__).parent.parent / 'data' / 'databases'
SOURCE_DIR = Path(__file__).parent.parent / 'data' / 'resources' / 'auxiliary'
EN_DB = DB_DIR / 'en_dict.db'
LEMMA_FILE = SOURCE_DIR / 'lemma.en.txt'


class LemmaIntegrator:
    """Lemma 词根集成器"""

    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None

    def connect(self):
        """连接数据库"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.execute('PRAGMA journal_mode=WAL')
        self.conn.execute('PRAGMA synchronous=NORMAL')
        print(f"✓ 连接数据库: {self.db_path}")

    def add_lemma_columns(self):
        """添加 lemma 相关字段"""
        print("检查并添加 lemma 相关字段...")

        cursor = self.conn.cursor()

        # 检查字段是否已存在
        cursor.execute("PRAGMA table_info(words)")
        columns = [row[1] for row in cursor.fetchall()]

        added = []
        if 'lemma' not in columns:
            cursor.execute('ALTER TABLE words ADD COLUMN lemma TEXT')
            added.append('lemma')

        if 'lemma_frequency' not in columns:
            cursor.execute('ALTER TABLE words ADD COLUMN lemma_frequency INTEGER')
            added.append('lemma_frequency')

        if added:
            self.conn.commit()
            print(f"✓ 已添加字段: {', '.join(added)}")
        else:
            print("✓ lemma 相关字段已存在")

    def parse_lemma_line(self, line):
        """解析 lemma 文件的一行数据"""
        line = line.strip()

        # 跳过注释和空行
        if not line or line.startswith(';') or '->' not in line:
            return None

        try:
            # 分割 lemma 和 forms
            parts = line.split('->')
            if len(parts) != 2:
                return None

            lemma_part = parts[0].strip()
            forms_part = parts[1].strip()

            # 解析 lemma 和 frequency
            if '/' not in lemma_part:
                return None

            lemma, freq_str = lemma_part.split('/', 1)
            lemma = lemma.strip().lower()
            frequency = int(freq_str.strip())

            # 解析词形变体
            forms = [f.strip().strip("'").lower() for f in forms_part.split(',') if f.strip()]

            return {
                'lemma': lemma,
                'frequency': frequency,
                'forms': forms
            }

        except Exception as e:
            # 跳过解析失败的行
            return None

    def integrate_lemma(self, lemma_file):
        """集成 Lemma 数据"""
        print(f"导入 Lemma 数据: {lemma_file}")

        if not lemma_file.exists():
            print(f"✗ 文件不存在: {lemma_file}")
            return False

        lemma_count = 0
        form_count = 0
        updated_lemmas = 0
        updated_forms = 0
        batch = []
        batch_size = 1000

        with open(lemma_file, 'r', encoding='utf-8') as f:
            for line in f:
                result = self.parse_lemma_line(line)
                if not result:
                    continue

                lemma = result['lemma']
                frequency = result['frequency']
                forms = result['forms']

                lemma_count += 1

                # 添加词根本身
                batch.append((lemma, frequency, lemma))

                # 添加所有变体形式
                for form in forms:
                    if form and form != lemma:  # 避免重复
                        batch.append((lemma, frequency, form))
                        form_count += 1

                if len(batch) >= batch_size:
                    cursor = self.conn.cursor()
                    cursor.executemany(
                        'UPDATE words SET lemma = ?, lemma_frequency = ? WHERE word = ?',
                        batch
                    )
                    updated = cursor.rowcount
                    updated_lemmas += updated
                    self.conn.commit()
                    batch = []
                    print(f"  已处理 {lemma_count} 个词根组，{form_count} 个变体，更新 {updated_lemmas} 条记录...", end='\r')

        # 处理剩余数据
        if batch:
            cursor = self.conn.cursor()
            cursor.executemany(
                'UPDATE words SET lemma = ?, lemma_frequency = ? WHERE word = ?',
                batch
            )
            updated_lemmas += cursor.rowcount
            self.conn.commit()

        print(f"\n✓ Lemma 数据导入完成")
        print(f"  词根组数: {lemma_count}")
        print(f"  变体总数: {form_count}")
        print(f"  更新记录: {updated_lemmas}")

        return True

    def create_index(self):
        """为 lemma 字段创建索引"""
        print("创建索引...")
        try:
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_words_lemma ON words(lemma)')
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_words_lemma_freq ON words(lemma_frequency DESC)')
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
    print("集成英文词根（Lemma）数据")
    print("=" * 60)
    print()

    # 检查数据库
    if not EN_DB.exists():
        print(f"✗ 数据库不存在: {EN_DB}")
        print("请先运行: python scripts/build_en_dict.py")
        return 1

    # 检查数据文件
    if not LEMMA_FILE.exists():
        print(f"✗ 数据文件不存在: {LEMMA_FILE}")
        return 1

    # 集成数据
    integrator = LemmaIntegrator(EN_DB)
    integrator.connect()
    integrator.add_lemma_columns()

    if not integrator.integrate_lemma(LEMMA_FILE):
        print("✗ 集成失败")
        return 1

    integrator.create_index()
    integrator.close()

    print("\n" + "=" * 60)
    print("✓ Lemma 词根集成完成！")
    print("=" * 60)

    return 0


if __name__ == '__main__':
    sys.exit(main())
