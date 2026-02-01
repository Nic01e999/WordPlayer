#!/usr/bin/env python3
"""
集成词林（Cilin）同义词数据到中文词典
数据源：cilin.txt (696KB, 中文同义词词林)
"""

import sqlite3
import json
import sys
from pathlib import Path

# 路径配置
DB_DIR = Path(__file__).parent.parent / 'data' / 'databases'
SOURCE_DIR = Path(__file__).parent.parent / 'data' / 'resources' / 'auxiliary'
ZH_DB = DB_DIR / 'zh_dict.db'
CILIN_FILE = SOURCE_DIR / 'cilin.txt'


class CilinIntegrator:
    """词林同义词集成器"""

    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None

    def connect(self):
        """连接数据库"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.execute('PRAGMA journal_mode=WAL')
        self.conn.execute('PRAGMA synchronous=NORMAL')
        print(f"✓ 连接数据库: {self.db_path}")

    def add_synonyms_columns(self):
        """添加同义词相关字段"""
        print("检查并添加同义词相关字段...")

        cursor = self.conn.cursor()

        # 检查字段是否已存在
        cursor.execute("PRAGMA table_info(words)")
        columns = [row[1] for row in cursor.fetchall()]

        added = []
        if 'synonyms' not in columns:
            cursor.execute('ALTER TABLE words ADD COLUMN synonyms TEXT')
            added.append('synonyms')

        if 'cilin_code' not in columns:
            cursor.execute('ALTER TABLE words ADD COLUMN cilin_code TEXT')
            added.append('cilin_code')

        if added:
            self.conn.commit()
            print(f"✓ 已添加字段: {', '.join(added)}")
        else:
            print("✓ 同义词相关字段已存在")

    def read_cilin_file(self, cilin_file):
        """读取词林文件（处理编码问题）"""
        print(f"读取词林文件: {cilin_file}")

        if not cilin_file.exists():
            print(f"✗ 文件不存在: {cilin_file}")
            return None

        # 尝试多种编码
        encodings = ['gbk', 'gb2312', 'gb18030', 'utf-8']

        for encoding in encodings:
            try:
                with open(cilin_file, 'r', encoding=encoding) as f:
                    content = f.read()
                print(f"✓ 使用 {encoding} 编码成功读取文件")
                return content
            except Exception as e:
                continue

        print("✗ 无法读取文件，尝试了所有常见编码")
        return None

    def parse_cilin_line(self, line):
        """解析词林的一行数据"""
        line = line.strip()
        if not line or '=' not in line:
            return None

        try:
            # 分割编码和词语列表
            # 格式：Aa01A01= 人 士 人物 人士 人氏 人选
            # 或：Aa01B03# 人人 顺次（带 # 或 @ 标记）
            code_part, words_part = line.split('=', 1)

            # 提取编码（去除可能的标记符号 # 或 @）
            code = code_part.strip().rstrip('#@')

            # 提取词语列表
            words = [w.strip() for w in words_part.split() if w.strip()]

            if not code or not words:
                return None

            return {
                'code': code,
                'words': words
            }

        except Exception as e:
            return None

    def integrate_cilin(self, cilin_file):
        """集成词林数据"""
        # 读取文件
        content = self.read_cilin_file(cilin_file)
        if not content:
            return False

        print("解析并导入词林数据...")

        code_count = 0
        word_count = 0
        updated = 0
        batch = []
        batch_size = 1000

        for line in content.split('\n'):
            result = self.parse_cilin_line(line)
            if not result:
                continue

            code = result['code']
            words = result['words']
            code_count += 1

            # 为每个词添加同义词（排除自己）
            for word in words:
                # 同义词列表（排除自己）
                synonyms = [w for w in words if w != word]

                if synonyms:
                    synonyms_json = json.dumps(synonyms, ensure_ascii=False)
                    batch.append((synonyms_json, code, word))
                    word_count += 1

            if len(batch) >= batch_size:
                cursor = self.conn.cursor()
                cursor.executemany(
                    'UPDATE words SET synonyms = ?, cilin_code = ? WHERE simplified = ?',
                    batch
                )
                updated += cursor.rowcount
                self.conn.commit()
                batch = []
                print(f"  已处理 {code_count} 个词组，{word_count} 个词语，更新 {updated} 条记录...", end='\r')

        # 处理剩余数据
        if batch:
            cursor = self.conn.cursor()
            cursor.executemany(
                'UPDATE words SET synonyms = ?, cilin_code = ? WHERE simplified = ?',
                batch
            )
            updated += cursor.rowcount
            self.conn.commit()

        print(f"\n✓ 词林数据导入完成")
        print(f"  词组数量: {code_count}")
        print(f"  词语总数: {word_count}")
        print(f"  更新记录: {updated}")
        print(f"  覆盖率: {updated/word_count*100:.1f}%")

        return True

    def create_index(self):
        """为同义词字段创建索引"""
        print("创建索引...")
        try:
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_words_cilin_code ON words(cilin_code)')
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
    print("集成词林（Cilin）同义词数据")
    print("=" * 60)
    print()

    # 检查数据库
    if not ZH_DB.exists():
        print(f"✗ 数据库不存在: {ZH_DB}")
        print("请先运行: python scripts/build_dict.py")
        return 1

    # 检查数据文件
    if not CILIN_FILE.exists():
        print(f"✗ 数据文件不存在: {CILIN_FILE}")
        return 1

    # 集成数据
    integrator = CilinIntegrator(ZH_DB)
    integrator.connect()
    integrator.add_synonyms_columns()

    if not integrator.integrate_cilin(CILIN_FILE):
        print("✗ 集成失败")
        return 1

    integrator.create_index()
    integrator.close()

    print("\n" + "=" * 60)
    print("✓ 词林同义词集成完成！")
    print("=" * 60)

    return 0


if __name__ == '__main__':
    sys.exit(main())
