#!/usr/bin/env python3
"""
构建英文词典数据库
使用 ECDICT 数据源（约 77 万词条）
"""

import sqlite3
import csv
import json
import sys
from pathlib import Path

# 数据目录
DATA_DIR = Path(__file__).parent.parent / 'data' / 'dict'
EN_DB = DATA_DIR / 'en_dict.db'
ECDICT_CSV = DATA_DIR / 'ecdict.csv'


class EnglishDictBuilder:
    """英文词典构建器"""

    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None

    def connect(self):
        """连接数据库"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.execute('PRAGMA journal_mode=WAL')
        self.conn.execute('PRAGMA synchronous=NORMAL')
        print(f"✓ 连接数据库: {self.db_path}")

    def create_tables(self):
        """创建表结构"""
        print("创建英文词典表结构...")

        # 主词典表
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS words (
                word TEXT PRIMARY KEY,
                phonetic TEXT,
                translation TEXT,
                pos TEXT,
                extra_data TEXT,
                frequency INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 创建索引
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_words_frequency ON words(frequency DESC)')
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_words_word ON words(word)')

        self.conn.commit()
        print("✓ 表结构创建完成")

    def parse_exchange(self, exchange_str):
        """解析词形变换字符串"""
        if not exchange_str:
            return {}

        word_forms = {}
        parts = exchange_str.split('/')

        form_map = {
            'p': '过去式',
            'd': '过去分词',
            'i': '现在分词',
            '3': '第三人称单数',
            'r': '比较级',
            't': '最高级',
            's': '复数',
            '0': '原型',
            '1': '词根'
        }

        for part in parts:
            if ':' in part:
                key, value = part.split(':', 1)
                if key in form_map:
                    word_forms[form_map[key]] = value

        return word_forms

    def build_extra_data(self, row):
        """构建 extra_data JSON"""
        extra = {}

        # 词形变换
        if row.get('exchange'):
            word_forms = self.parse_exchange(row['exchange'])
            if word_forms:
                extra['wordForms'] = word_forms

        # 详细释义
        if row.get('detail'):
            try:
                detail = json.loads(row['detail'])
                if isinstance(detail, list):
                    definitions = []
                    for item in detail:
                        if isinstance(item, dict):
                            pos = item.get('pos', '')
                            meanings = item.get('meanings', [])
                            if meanings:
                                definitions.append({
                                    'pos': pos,
                                    'meanings': meanings
                                })
                    if definitions:
                        extra['definitions'] = definitions
            except:
                pass

        # 标签
        if row.get('tag'):
            extra['tags'] = row['tag'].split()

        # 柯林斯星级
        if row.get('collins'):
            try:
                extra['collins'] = int(row['collins'])
            except:
                pass

        # 牛津3000
        if row.get('oxford'):
            extra['oxford'] = row['oxford'] == '1'

        return json.dumps(extra, ensure_ascii=False) if extra else None

    def import_ecdict(self, csv_file):
        """导入 ECDICT CSV 数据"""
        print(f"导入 ECDICT: {csv_file}")

        if not csv_file.exists():
            print(f"✗ 文件不存在: {csv_file}")
            print("请先运行: python scripts/download_data.py")
            return False

        count = 0
        batch = []
        batch_size = 1000

        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)

            for row in reader:
                word = row.get('word', '').strip().lower()
                if not word:
                    continue

                # 音标（优先美式，其次英式）
                phonetic_data = {}
                if row.get('phonetic'):
                    phonetic_data['us'] = row['phonetic']
                if row.get('uk_phonetic'):
                    phonetic_data['uk'] = row['uk_phonetic']
                phonetic = json.dumps(phonetic_data) if phonetic_data else None

                # 翻译
                translation = row.get('translation', '').strip()

                # 词性
                pos = row.get('pos', '').strip()

                # 扩展数据
                extra_data = self.build_extra_data(row)

                # 词频（使用 frq 字段，值越小越常用）
                frequency = None
                if row.get('frq'):
                    try:
                        frequency = int(row['frq'])
                    except:
                        pass

                batch.append((word, phonetic, translation, pos, extra_data, frequency))
                count += 1

                if len(batch) >= batch_size:
                    self.conn.executemany('''
                        INSERT OR REPLACE INTO words (word, phonetic, translation, pos, extra_data, frequency)
                        VALUES (?,?,?,?,?,?)
                    ''', batch)
                    batch = []
                    print(f"  已导入 {count} 个词条...", end='\r')

        # 导入剩余数据
        if batch:
            self.conn.executemany('''
                INSERT OR REPLACE INTO words (word, phonetic, translation, pos, extra_data, frequency)
                VALUES (?,?,?,?,?,?)
            ''', batch)

        self.conn.commit()
        print(f"\n✓ ECDICT 导入完成，共 {count} 个词条")
        return True

    def close(self):
        """关闭数据库"""
        if self.conn:
            self.conn.close()


def main():
    """主函数"""
    print("=" * 60)
    print("构建英文词典数据库")
    print("=" * 60)
    print()

    # 检查数据文件
    if not ECDICT_CSV.exists():
        print(f"✗ 未找到 ECDICT 数据: {ECDICT_CSV}")
        print("请先运行: python scripts/download_data.py")
        return 1

    # 构建英文词典
    print("构建英文词典...")
    print("=" * 60)

    en_builder = EnglishDictBuilder(EN_DB)
    en_builder.connect()
    en_builder.create_tables()

    if not en_builder.import_ecdict(ECDICT_CSV):
        print("✗ 导入失败")
        return 1

    en_builder.close()

    print("\n" + "=" * 60)
    print("✓ 词典构建完成！")
    print("=" * 60)

    # 显示数据库大小
    if EN_DB.exists():
        en_size = EN_DB.stat().st_size / 1024 / 1024
        print(f"英文词典: {EN_DB} ({en_size:.1f} MB)")

    return 0


if __name__ == '__main__':
    sys.exit(main())
