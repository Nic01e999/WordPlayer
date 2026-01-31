#!/usr/bin/env python3
"""
构建词典数据库（简化版）
处理 CC-CEDICT 中文词典和用户自定义数据库
"""

import sqlite3
import re
import sys
from pathlib import Path

# 数据目录
DATA_DIR = Path(__file__).parent.parent / 'data' / 'dict'
ZH_DB = DATA_DIR / 'zh_dict.db'
USER_DB = DATA_DIR / 'user_dict.db'


class ChineseDictBuilder:
    """中文词典构建器"""

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
        print("创建中文词典表结构...")

        # 主词典表
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS words (
                simplified TEXT PRIMARY KEY,
                traditional TEXT,
                pinyin TEXT,
                translation TEXT,
                pos TEXT,
                frequency INTEGER
            )
        ''')

        # 创建索引
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_words_traditional ON words(traditional)')
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_words_pinyin ON words(pinyin)')

        self.conn.commit()
        print("✓ 表结构创建完成")

    def import_cedict(self, cedict_file):
        """导入 CC-CEDICT 数据"""
        print(f"导入 CC-CEDICT: {cedict_file}")

        if not cedict_file.exists():
            print(f"✗ 文件不存在: {cedict_file}")
            return False

        count = 0
        batch = []

        with open(cedict_file, 'r', encoding='utf-8') as f:
            for line in f:
                # 跳过注释
                if line.startswith('#'):
                    continue

                # 格式：Traditional Simplified [pin1 yin1] /definition1/definition2/
                match = re.match(r'(\S+) (\S+) \[([^\]]+)\] /(.+)/', line)
                if match:
                    traditional, simplified, pinyin, definitions = match.groups()
                    translation = definitions.replace('/', '; ')

                    batch.append((simplified, traditional, pinyin, translation, None, None))
                    count += 1

                    if len(batch) >= 1000:
                        self.conn.executemany('''
                            INSERT OR REPLACE INTO words VALUES (?,?,?,?,?,?)
                        ''', batch)
                        batch = []
                        print(f"  已导入 {count} 个词条...", end='\r')

        if batch:
            self.conn.executemany('''
                INSERT OR REPLACE INTO words VALUES (?,?,?,?,?,?)
            ''', batch)

        self.conn.commit()
        print(f"\n✓ CC-CEDICT 导入完成，共 {count} 个词条")
        return True

    def close(self):
        """关闭数据库"""
        if self.conn:
            self.conn.close()


class UserDictBuilder:
    """用户自定义词典构建器"""

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
        print("创建用户自定义词典表结构...")

        # 用户自定义表
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS user_definitions (
                word TEXT,
                language TEXT,
                definition TEXT,
                phonetic TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (word, language)
            )
        ''')

        # 创建索引
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_user_word ON user_definitions(word)')
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_user_lang ON user_definitions(language)')

        self.conn.commit()
        print("✓ 用户自定义表结构创建完成")

    def close(self):
        """关闭数据库"""
        if self.conn:
            self.conn.close()


def main():
    """主函数"""
    print("=" * 60)
    print("构建词典数据库")
    print("=" * 60)
    print()

    # 检查数据文件
    cedict_file = DATA_DIR / 'cedict_ts.u8'

    # 构建中文词典
    if cedict_file.exists():
        print("构建中文词典...")
        print("=" * 60)

        zh_builder = ChineseDictBuilder(ZH_DB)
        zh_builder.connect()
        zh_builder.create_tables()

        if not zh_builder.import_cedict(cedict_file):
            print("✗ 中文词典导入失败")
            return 1

        zh_builder.close()
        print()
    else:
        print(f"⚠ 未找到 CC-CEDICT 数据: {cedict_file}")
        print("跳过中文词典构建")
        print()

    # 构建用户自定义数据库
    print("构建用户自定义数据库...")
    print("=" * 60)

    user_builder = UserDictBuilder(USER_DB)
    user_builder.connect()
    user_builder.create_tables()
    user_builder.close()

    print("\n" + "=" * 60)
    print("✓ 词典构建完成！")
    print("=" * 60)

    # 显示数据库大小
    if ZH_DB.exists():
        zh_size = ZH_DB.stat().st_size / 1024 / 1024
        print(f"中文词典: {ZH_DB} ({zh_size:.1f} MB)")

    if USER_DB.exists():
        user_size = USER_DB.stat().st_size / 1024 / 1024
        print(f"用户自定义: {USER_DB} ({user_size:.2f} MB)")

    return 0


if __name__ == '__main__':
    sys.exit(main())
