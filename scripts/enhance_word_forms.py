#!/usr/bin/env python3
"""
增强英文词典的词形变化数据
主要功能：
1. 为形容词和副词生成比较级和最高级（规则变化）
2. 不覆盖 ECDICT 已有的不规则变化数据
"""

import sqlite3
import json
import sys
from pathlib import Path

# 路径配置
DB_DIR = Path(__file__).parent.parent / 'data' / 'databases'
EN_DB = DB_DIR / 'en_dict.db'


class WordFormsEnhancer:
    """词形变化增强器"""

    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None

        # 不规则形容词列表（保护这些词的现有数据）
        self.irregular_adjectives = {
            'good', 'bad', 'far', 'little', 'much', 'many', 'old',
            'well', 'ill', 'late', 'near'
        }

    def connect(self):
        """连接数据库"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.execute('PRAGMA journal_mode=WAL')
        self.conn.execute('PRAGMA synchronous=NORMAL')
        print(f"✓ 连接数据库: {self.db_path}")

    def count_syllables(self, word):
        """
        简单的音节计数（启发式方法）
        用于判断是否使用 -er/-est 还是 more/most
        """
        word = word.lower()
        vowels = 'aeiouy'
        count = 0
        prev_was_vowel = False

        for char in word:
            is_vowel = char in vowels
            if is_vowel and not prev_was_vowel:
                count += 1
            prev_was_vowel = is_vowel

        # 以 e 结尾的单词，e 通常不发音
        if word.endswith('e') and count > 1:
            count -= 1

        return max(1, count)  # 至少1个音节

    def ends_with_consonant_y(self, word):
        """判断是否以辅音+y结尾"""
        if len(word) < 2 or not word.endswith('y'):
            return False
        consonants = 'bcdfghjklmnpqrstvwxz'
        return word[-2] in consonants

    def needs_double_consonant(self, word):
        """判断是否需要双写辅音（如 big -> bigger）"""
        if len(word) < 3:
            return False

        vowels = 'aeiou'
        consonants = 'bcdfghjklmnpqrstvwxz'

        # 检查是否为：辅音+元音+辅音 结尾
        if (word[-1] in consonants and
            word[-2] in vowels and
            word[-3] in consonants):
            # 排除 w, x, y 结尾
            if word[-1] not in 'wxy':
                return True
        return False

    def generate_comparative(self, word):
        """生成比较级"""
        word_lower = word.lower()

        # 单音节词或双音节以-y结尾的词
        syllables = self.count_syllables(word_lower)

        if syllables == 1:
            # 单音节词：-er
            if self.needs_double_consonant(word_lower):
                # big -> bigger
                return word_lower + word_lower[-1] + 'er'
            elif word_lower.endswith('e'):
                # large -> larger
                return word_lower + 'r'
            else:
                # tall -> taller
                return word_lower + 'er'

        elif syllables == 2 and self.ends_with_consonant_y(word_lower):
            # 双音节以辅音+y结尾：happy -> happier
            return word_lower[:-1] + 'ier'

        else:
            # 多音节词：more + 原词
            return f'more {word_lower}'

    def generate_superlative(self, word):
        """生成最高级"""
        word_lower = word.lower()

        # 单音节词或双音节以-y结尾的词
        syllables = self.count_syllables(word_lower)

        if syllables == 1:
            # 单音节词：-est
            if self.needs_double_consonant(word_lower):
                # big -> biggest
                return word_lower + word_lower[-1] + 'est'
            elif word_lower.endswith('e'):
                # large -> largest
                return word_lower + 'st'
            else:
                # tall -> tallest
                return word_lower + 'est'

        elif syllables == 2 and self.ends_with_consonant_y(word_lower):
            # 双音节以辅音+y结尾：happy -> happiest
            return word_lower[:-1] + 'iest'

        else:
            # 多音节词：most + 原词
            return f'most {word_lower}'

    def is_adjective_or_adverb(self, translation):
        """判断词性是否为形容词或副词（从translation字段识别）"""
        if not translation:
            return False
        # ECDICT 的词性标记在 translation 字段开头
        # a. = adjective (形容词)
        # ad. = adverb (副词)
        translation_lower = translation.lower().strip()
        return translation_lower.startswith('a.') or translation_lower.startswith('ad.')

    def enhance_word_forms(self):
        """增强词形变化数据"""
        print("开始增强词形变化数据...")

        cursor = self.conn.cursor()

        # 查询所有词条（需要从translation字段识别词性）
        cursor.execute("""
            SELECT word, translation, extra_data
            FROM words
            WHERE translation IS NOT NULL
        """)

        total_count = 0
        enhanced_count = 0
        skipped_irregular = 0
        skipped_has_data = 0
        batch = []
        batch_size = 1000

        for row in cursor.fetchall():
            word, translation, extra_data_str = row
            total_count += 1

            # 检查是否为形容词或副词
            if not self.is_adjective_or_adverb(translation):
                continue

            # 跳过不规则形容词（保护现有数据）
            if word.lower() in self.irregular_adjectives:
                skipped_irregular += 1
                continue

            # 解析 extra_data
            try:
                extra_data = json.loads(extra_data_str) if extra_data_str else {}
            except:
                extra_data = {}

            # 检查是否已有词形变化数据
            word_forms = extra_data.get('wordForms', {})

            # 如果已有比较级或最高级数据，跳过（保护 ECDICT 数据）
            if word_forms.get('比较级') or word_forms.get('最高级'):
                skipped_has_data += 1
                continue

            # 生成比较级和最高级
            comparative = self.generate_comparative(word)
            superlative = self.generate_superlative(word)

            # 更新 wordForms
            word_forms['比较级'] = comparative
            word_forms['最高级'] = superlative
            extra_data['wordForms'] = word_forms

            # 添加到批处理
            batch.append((json.dumps(extra_data, ensure_ascii=False), word))
            enhanced_count += 1

            # 批量更新
            if len(batch) >= batch_size:
                self.conn.executemany(
                    'UPDATE words SET extra_data = ? WHERE word = ?',
                    batch
                )
                self.conn.commit()
                batch = []
                print(f"  已处理 {total_count} 词条，增强 {enhanced_count} 条...", end='\r')

        # 处理剩余数据
        if batch:
            self.conn.executemany(
                'UPDATE words SET extra_data = ? WHERE word = ?',
                batch
            )
            self.conn.commit()

        print(f"\n✓ 词形变化增强完成")
        print(f"  总词条数: {total_count}")
        print(f"  增强词条: {enhanced_count}")
        print(f"  跳过不规则词: {skipped_irregular}")
        print(f"  跳过已有数据: {skipped_has_data}")

        return enhanced_count

    def verify_coverage(self):
        """验证覆盖率"""
        print("\n验证词形变化覆盖率...")

        cursor = self.conn.cursor()

        # 总词条数
        cursor.execute("SELECT COUNT(*) FROM words")
        total = cursor.fetchone()[0]

        # 有比较级的词条数
        cursor.execute("""
            SELECT COUNT(*) FROM words
            WHERE json_extract(extra_data, '$.wordForms.比较级') IS NOT NULL
        """)
        comparative_count = cursor.fetchone()[0]

        # 有最高级的词条数
        cursor.execute("""
            SELECT COUNT(*) FROM words
            WHERE json_extract(extra_data, '$.wordForms.最高级') IS NOT NULL
        """)
        superlative_count = cursor.fetchone()[0]

        # 有动词时态的词条数
        cursor.execute("""
            SELECT COUNT(*) FROM words
            WHERE json_extract(extra_data, '$.wordForms.过去式') IS NOT NULL
               OR json_extract(extra_data, '$.wordForms.过去分词') IS NOT NULL
               OR json_extract(extra_data, '$.wordForms.现在分词') IS NOT NULL
        """)
        verb_count = cursor.fetchone()[0]

        print(f"\n覆盖率统计:")
        print(f"  总词条数: {total:,}")
        print(f"  比较级覆盖: {comparative_count:,} ({comparative_count/total*100:.2f}%)")
        print(f"  最高级覆盖: {superlative_count:,} ({superlative_count/total*100:.2f}%)")
        print(f"  动词时态覆盖: {verb_count:,} ({verb_count/total*100:.2f}%)")

    def close(self):
        """关闭数据库"""
        if self.conn:
            self.conn.close()


def main():
    """主函数"""
    print("=" * 60)
    print("增强英文词典的词形变化数据")
    print("=" * 60)
    print()

    # 检查数据库
    if not EN_DB.exists():
        print(f"✗ 数据库不存在: {EN_DB}")
        print("请先运行: python scripts/build_en_dict.py")
        return 1

    # 增强数据
    enhancer = WordFormsEnhancer(EN_DB)
    enhancer.connect()

    enhanced_count = enhancer.enhance_word_forms()

    if enhanced_count == 0:
        print("⚠ 未增强任何词条")

    enhancer.verify_coverage()
    enhancer.close()

    print("\n" + "=" * 60)
    print("✓ 词形变化增强完成！")
    print("=" * 60)

    return 0


if __name__ == '__main__':
    sys.exit(main())
