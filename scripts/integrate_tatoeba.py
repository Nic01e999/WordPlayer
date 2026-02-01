#!/usr/bin/env python3
"""
集成 Tatoeba 例句数据
数据源：Tatoeba Project (sentences.csv + links.csv)
"""

import sqlite3
import csv
import json
import re
import sys
from pathlib import Path

# 路径配置
DB_DIR = Path(__file__).parent.parent / 'data' / 'databases'
SOURCE_DIR = Path(__file__).parent.parent / 'data' / 'resources' / 'tatoeba'
SENTENCE_PAIRS_DB = DB_DIR / 'sentence_pairs.db'
SENTENCES_CSV = SOURCE_DIR / 'sentences.csv'
LINKS_CSV = SOURCE_DIR / 'links.csv'


class TatoebaIntegrator:
    """Tatoeba 例句集成器"""

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
        print("创建例句表结构...")

        # 句子对表
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS sentence_pairs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                en_sentence TEXT NOT NULL,
                zh_sentence TEXT NOT NULL,
                en_words TEXT,
                zh_words TEXT,
                source TEXT DEFAULT 'tatoeba'
            )
        ''')

        # 创建索引
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_sentence_en ON sentence_pairs(en_sentence)')
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_sentence_zh ON sentence_pairs(zh_sentence)')

        # 创建 FTS5 全文搜索表
        try:
            self.conn.execute('''
                CREATE VIRTUAL TABLE IF NOT EXISTS sentence_pairs_fts USING fts5(
                    en_sentence,
                    zh_sentence,
                    content=sentence_pairs,
                    content_rowid=id
                )
            ''')
            print("✓ FTS5 全文搜索表创建成功")
        except Exception as e:
            print(f"⚠ FTS5 创建失败（将使用 LIKE 搜索）: {e}")

        self.conn.commit()
        print("✓ 表结构创建完成")

    def extract_english_words(self, text):
        """提取英文句子中的单词（小写，去标点）"""
        words = re.findall(r'\b[a-z]+\b', text.lower())
        return list(set(words))  # 去重

    def extract_chinese_words(self, text):
        """提取中文句子中的词语（简单分词）"""
        # 简单的中文分词：提取连续的中文字符
        words = re.findall(r'[\u4e00-\u9fff]+', text)
        # 过滤单字，只保留词语
        words = [w for w in words if len(w) >= 2]
        return list(set(words))

    def integrate_tatoeba(self):
        """集成 Tatoeba 数据"""
        print(f"读取句子数据: {SENTENCES_CSV}")

        if not SENTENCES_CSV.exists():
            print(f"✗ 文件不存在: {SENTENCES_CSV}")
            return False

        if not LINKS_CSV.exists():
            print(f"✗ 文件不存在: {LINKS_CSV}")
            return False

        # 第一步：读取句子数据
        print("加载句子数据...")
        sentences = {}  # {id: (lang, text)}
        skipped = 0

        with open(SENTENCES_CSV, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                try:
                    # 手动分割（避免 CSV 字段大小限制）
                    parts = line.strip().split('\t')
                    if len(parts) < 3:
                        continue

                    sent_id, lang, text = parts[0], parts[1], '\t'.join(parts[2:])

                    # 跳过过长的句子（超过 1000 字符）
                    if len(text) > 1000:
                        skipped += 1
                        continue

                    # 只保留英文和中文
                    if lang in ['eng', 'cmn']:
                        sentences[sent_id] = (lang, text)

                    if line_num % 100000 == 0:
                        print(f"  已读取 {line_num} 行...", end='\r')

                except Exception as e:
                    skipped += 1
                    continue

        print(f"\n✓ 加载了 {len(sentences)} 条句子（英文+中文），跳过 {skipped} 条异常句子")

        # 第二步：读取翻译链接并构建句子对
        print("构建句子对...")
        sentence_pairs = []
        processed = 0

        with open(LINKS_CSV, 'r', encoding='utf-8') as f:
            reader = csv.reader(f, delimiter='\t')
            for row in reader:
                if len(row) < 2:
                    continue

                src_id, tgt_id = row[0], row[1]

                if src_id not in sentences or tgt_id not in sentences:
                    continue

                src_lang, src_text = sentences[src_id]
                tgt_lang, tgt_text = sentences[tgt_id]

                # 提取英文-中文对
                if src_lang == 'eng' and tgt_lang == 'cmn':
                    en_text, zh_text = src_text, tgt_text
                elif src_lang == 'cmn' and tgt_lang == 'eng':
                    en_text, zh_text = tgt_text, src_text
                else:
                    continue

                # 提取关键词（可选，用于加速查询）
                en_words = self.extract_english_words(en_text)
                zh_words = self.extract_chinese_words(zh_text)

                sentence_pairs.append((
                    en_text,
                    zh_text,
                    json.dumps(en_words),
                    json.dumps(zh_words, ensure_ascii=False)
                ))

                processed += 1
                if processed % 10000 == 0:
                    print(f"  已处理 {processed} 条链接...", end='\r')

        print(f"\n✓ 构建了 {len(sentence_pairs)} 条句子对")

        # 第三步：批量插入数据库
        print("导入数据库...")
        batch_size = 1000
        inserted = 0

        for i in range(0, len(sentence_pairs), batch_size):
            batch = sentence_pairs[i:i+batch_size]
            self.conn.executemany('''
                INSERT INTO sentence_pairs (en_sentence, zh_sentence, en_words, zh_words)
                VALUES (?, ?, ?, ?)
            ''', batch)
            inserted += len(batch)
            print(f"  已导入 {inserted}/{len(sentence_pairs)} 条句子对...", end='\r')

        self.conn.commit()
        print(f"\n✓ 数据导入完成")

        # 第四步：同步到 FTS5
        try:
            print("同步到 FTS5 全文搜索索引...")
            self.conn.execute("INSERT INTO sentence_pairs_fts(sentence_pairs_fts) VALUES('rebuild')")
            self.conn.commit()
            print("✓ FTS5 索引同步完成")
        except Exception as e:
            print(f"⚠ FTS5 同步失败（将使用 LIKE 搜索）: {e}")

        return True

    def create_triggers(self):
        """创建 FTS5 同步触发器"""
        try:
            print("创建 FTS5 同步触发器...")

            # 插入触发器
            self.conn.execute('''
                CREATE TRIGGER IF NOT EXISTS sentence_pairs_ai AFTER INSERT ON sentence_pairs BEGIN
                    INSERT INTO sentence_pairs_fts(rowid, en_sentence, zh_sentence)
                    VALUES (new.id, new.en_sentence, new.zh_sentence);
                END
            ''')

            # 删除触发器
            self.conn.execute('''
                CREATE TRIGGER IF NOT EXISTS sentence_pairs_ad AFTER DELETE ON sentence_pairs BEGIN
                    DELETE FROM sentence_pairs_fts WHERE rowid = old.id;
                END
            ''')

            # 更新触发器
            self.conn.execute('''
                CREATE TRIGGER IF NOT EXISTS sentence_pairs_au AFTER UPDATE ON sentence_pairs BEGIN
                    UPDATE sentence_pairs_fts
                    SET en_sentence = new.en_sentence, zh_sentence = new.zh_sentence
                    WHERE rowid = new.id;
                END
            ''')

            self.conn.commit()
            print("✓ 触发器创建完成")
        except Exception as e:
            print(f"⚠ 触发器创建失败: {e}")

    def close(self):
        """关闭数据库"""
        if self.conn:
            self.conn.close()


def main():
    """主函数"""
    print("=" * 60)
    print("集成 Tatoeba 例句数据")
    print("=" * 60)
    print()

    # 检查数据文件
    if not SENTENCES_CSV.exists():
        print(f"✗ 数据文件不存在: {SENTENCES_CSV}")
        print("请先解压 sentences.tar.bz2")
        return 1

    if not LINKS_CSV.exists():
        print(f"✗ 数据文件不存在: {LINKS_CSV}")
        print("请先解压 links.tar.bz2")
        return 1

    # 集成数据
    integrator = TatoebaIntegrator(SENTENCE_PAIRS_DB)
    integrator.connect()
    integrator.create_tables()

    if not integrator.integrate_tatoeba():
        print("✗ 集成失败")
        return 1

    integrator.create_triggers()
    integrator.close()

    print("\n" + "=" * 60)
    print("✓ Tatoeba 例句集成完成！")
    print("=" * 60)

    # 显示数据库大小
    if SENTENCE_PAIRS_DB.exists():
        db_size = SENTENCE_PAIRS_DB.stat().st_size / 1024 / 1024
        print(f"例句数据库: {SENTENCE_PAIRS_DB} ({db_size:.1f} MB)")

    return 0


if __name__ == '__main__':
    sys.exit(main())
