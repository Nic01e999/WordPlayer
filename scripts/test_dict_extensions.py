#!/usr/bin/env python3
"""
测试词典扩展功能
验证同义词、词根、例句等新功能是否正常工作
"""

import sys
import sqlite3
import json
from pathlib import Path

# 添加 server 目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent / 'server'))

from dict_db import DictDatabase

def test_english_synonyms():
    """测试英文同义词功能（已废弃）"""
    print("=" * 60)
    print("测试 1: 英文同义词（已废弃）")
    print("=" * 60)
    print("⚠ 同义词功能已被移除")
    print()

def test_english_lemma():
    """测试英文词根功能"""
    print("=" * 60)
    print("测试 2: 英文词根（Lemma）")
    print("=" * 60)

    db = DictDatabase()

    # 测试单词 "running"
    result = db.query_english_word("running")
    if result:
        print(f"✓ 查询单词: {result['word']}")

        if 'lemma' in result and result['lemma']:
            print(f"  词根: {result['lemma']}")
            print(f"  词根词频: {result.get('lemma_frequency', 0)}")
            print("✓ 词根功能正常")

            # 测试根据词根查找所有变体
            print(f"\n  查找词根 '{result['lemma']}' 的所有变体:")
            forms = db.search_by_lemma(result['lemma'], limit=10)
            if forms:
                for form in forms[:5]:
                    print(f"    - {form['word']} ({form['pos']})")
                print(f"  ✓ 找到 {len(forms)} 个变体")
            else:
                print("  ✗ 未找到变体")
        else:
            print("✗ 未找到词根数据")
    else:
        print("✗ 查询失败")

    db.close()
    print()

def test_chinese_synonyms():
    """测试中文同义词功能"""
    print("=" * 60)
    print("测试 3: 中文同义词（词林）")
    print("=" * 60)

    db = DictDatabase()

    # 测试词语 "人"
    result = db.query_chinese_word("人")
    if result:
        print(f"✓ 查询词语: {result['word']}")
        print(f"  拼音: {result['pinyin']}")
        print(f"  翻译: {result['translation'][:50]}...")

        if 'synonyms' in result and result['synonyms']:
            synonyms = result['synonyms'][:10]  # 只显示前10个
            print(f"  同义词数量: {len(result['synonyms'])}")
            print(f"  同义词示例: {', '.join(synonyms)}")

            if 'cilin_code' in result and result['cilin_code']:
                print(f"  词林编码: {result['cilin_code']}")

            print("✓ 同义词功能正常")
        else:
            print("✗ 未找到同义词数据")
    else:
        print("✗ 查询失败")

    db.close()
    print()

def test_database_stats():
    """测试数据库统计信息"""
    print("=" * 60)
    print("测试 4: 数据库统计信息")
    print("=" * 60)

    # 英文词典统计
    en_db = Path(__file__).parent.parent / 'data' / 'databases' / 'en_dict.db'
    if en_db.exists():
        conn = sqlite3.connect(en_db)
        cursor = conn.cursor()

        # 总词条数
        cursor.execute("SELECT COUNT(*) FROM words")
        total = cursor.fetchone()[0]

        # 有词根的词条数
        cursor.execute("SELECT COUNT(*) FROM words WHERE lemma IS NOT NULL")
        with_lemma = cursor.fetchone()[0]

        print(f"英文词典:")
        print(f"  总词条数: {total:,}")
        print(f"  有词根: {with_lemma:,} ({with_lemma/total*100:.1f}%)")

        conn.close()

    # 中文词典统计
    zh_db = Path(__file__).parent.parent / 'data' / 'databases' / 'zh_dict.db'
    if zh_db.exists():
        conn = sqlite3.connect(zh_db)
        cursor = conn.cursor()

        # 总词条数
        cursor.execute("SELECT COUNT(*) FROM words")
        total = cursor.fetchone()[0]

        print(f"\n中文词典:")
        print(f"  总词条数: {total:,}")

        conn.close()

    # 例句数据库统计
    sentence_db = Path(__file__).parent.parent / 'data' / 'databases' / 'sentence_pairs.db'
    if sentence_db.exists():
        conn = sqlite3.connect(sentence_db)
        cursor = conn.cursor()

        # 总句子对数
        cursor.execute("SELECT COUNT(*) FROM sentence_pairs")
        total = cursor.fetchone()[0]

        print(f"\n例句数据库:")
        print(f"  总句子对数: {total:,}")

        conn.close()

    print()

def test_example_sentences():
    """测试例句查询功能"""
    print("=" * 60)
    print("测试 5: 例句查询")
    print("=" * 60)

    db = DictDatabase()

    # 测试英文例句
    print("\n测试英文例句查询 (apple):")
    examples = db.search_examples("apple", "en", limit=3)
    if examples:
        print(f"✓ 找到 {len(examples)} 条例句:")
        for i, ex in enumerate(examples, 1):
            print(f"  {i}. EN: {ex['en']}")
            print(f"     ZH: {ex['zh']}")
    else:
        print("✗ 未找到例句")

    # 测试中文例句
    print("\n测试中文例句查询 (苹果):")
    examples = db.search_examples("苹果", "zh", limit=3)
    if examples:
        print(f"✓ 找到 {len(examples)} 条例句:")
        for i, ex in enumerate(examples, 1):
            print(f"  {i}. EN: {ex['en']}")
            print(f"     ZH: {ex['zh']}")
    else:
        print("✗ 未找到例句")

    db.close()
    print()

def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("词典扩展功能测试")
    print("=" * 60)
    print()

    try:
        test_english_synonyms()
        test_english_lemma()
        test_chinese_synonyms()
        test_database_stats()
        test_example_sentences()

        print("=" * 60)
        print("✓ 所有测试完成！")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0

if __name__ == '__main__':
    sys.exit(main())
