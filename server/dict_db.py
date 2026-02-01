"""
词典数据库查询模块
支持混合架构：中文本地数据库 + 英文 API
"""

import sqlite3
import json
from pathlib import Path
from typing import Dict, List, Optional

# 数据库路径
DB_DIR = Path(__file__).parent.parent / 'data' / 'databases'
ZH_DB = DB_DIR / 'zh_dict.db'
EN_DB = DB_DIR / 'en_dict.db'
SENTENCE_PAIRS_DB = DB_DIR / 'sentence_pairs.db'


class DictDatabase:
    """词典数据库查询类"""

    def __init__(self):
        self.zh_conn = None
        self.en_conn = None
        self.sentence_conn = None
        self._connect_zh()
        self._connect_en()
        self._connect_sentences()

    def _connect_zh(self):
        """连接中文数据库"""
        if ZH_DB.exists():
            try:
                self.zh_conn = sqlite3.connect(str(ZH_DB), check_same_thread=False)
                self.zh_conn.row_factory = sqlite3.Row
                print(f"✓ 中文词典数据库已连接: {ZH_DB}")
            except Exception as e:
                print(f"✗ 连接中文数据库失败: {e}")
                self.zh_conn = None
        else:
            print(f"⚠ 中文词典数据库不存在: {ZH_DB}")
            self.zh_conn = None

    def _connect_en(self):
        """连接英文数据库（ECDICT）"""
        if EN_DB.exists():
            try:
                self.en_conn = sqlite3.connect(str(EN_DB), check_same_thread=False)
                self.en_conn.row_factory = sqlite3.Row

                # 检查 ECDICT 表结构
                cursor = self.en_conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='words'")
                if cursor.fetchone():
                    # 获取词条数量
                    cursor.execute("SELECT COUNT(*) FROM words")
                    count = cursor.fetchone()[0]
                    print(f"✓ 英文词典数据库已连接: {EN_DB} ({count:,} 词条)")
                else:
                    print(f"⚠ 英文词典表结构不正确（缺少 words 表）")
                    self.en_conn = None
            except Exception as e:
                print(f"✗ 连接英文数据库失败: {e}")
                self.en_conn = None
        else:
            print(f"⚠ 英文词典数据库不存在: {EN_DB}")
            self.en_conn = None

    def _connect_sentences(self):
        """连接例句数据库"""
        if SENTENCE_PAIRS_DB.exists():
            try:
                self.sentence_conn = sqlite3.connect(str(SENTENCE_PAIRS_DB), check_same_thread=False)
                self.sentence_conn.row_factory = sqlite3.Row

                # 获取例句数量
                cursor = self.sentence_conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM sentence_pairs")
                count = cursor.fetchone()[0]
                print(f"✓ 例句数据库已连接: {SENTENCE_PAIRS_DB} ({count:,} 句子对)")
            except Exception as e:
                print(f"✗ 连接例句数据库失败: {e}")
                self.sentence_conn = None
        else:
            print(f"⚠ 例句数据库不存在: {SENTENCE_PAIRS_DB}")
            self.sentence_conn = None


    def query_chinese_word(self, word: str) -> Optional[Dict]:
        """查询中文词语"""
        if not self.zh_conn:
            return None

        try:
            cursor = self.zh_conn.cursor()

            # 检查是否有扩展字段
            cursor.execute("PRAGMA table_info(words)")
            columns = [row[1] for row in cursor.fetchall()]
            has_extensions = 'synonyms' in columns and 'cilin_code' in columns

            # 查询简体或繁体
            if has_extensions:
                cursor.execute('''
                    SELECT simplified, traditional, pinyin, translation, pos, frequency,
                           synonyms, cilin_code
                    FROM words
                    WHERE simplified = ? OR traditional = ?
                    LIMIT 1
                ''', (word, word))
            else:
                cursor.execute('''
                    SELECT simplified, traditional, pinyin, translation, pos, frequency
                    FROM words
                    WHERE simplified = ? OR traditional = ?
                    LIMIT 1
                ''', (word, word))

            row = cursor.fetchone()
            if not row:
                return None

            result = {
                'word': row['simplified'],
                'traditional': row['traditional'],
                'pinyin': row['pinyin'],
                'translation': row['translation'],
                'pos': row['pos'],
                'source': 'local_db'
            }

            # 添加扩展数据
            if has_extensions:
                result['cilin_code'] = row['cilin_code']

                # 解析 synonyms JSON
                if row['synonyms']:
                    try:
                        import json
                        result['synonyms'] = json.loads(row['synonyms'])
                    except:
                        result['synonyms'] = []
                else:
                    result['synonyms'] = []

            return result

        except Exception as e:
            print(f"✗ 查询中文词语失败: {e}")
            return None

    def query_chinese_batch(self, words: List[str]) -> Dict[str, Dict]:
        """批量查询中文词语"""
        results = {}
        for word in words:
            info = self.query_chinese_word(word)
            if info:
                results[word] = info
        return results

    def query_english_word(self, word: str) -> Optional[Dict]:
        """查询英文单词（ECDICT 本地数据库）

        Args:
            word: 要查询的英文单词

        Returns:
            包含单词信息的字典，如果未找到则返回 None
        """
        if not self.en_conn:
            return None

        try:
            cursor = self.en_conn.cursor()

            # 检查是否有 lemma 扩展字段
            cursor.execute("PRAGMA table_info(words)")
            columns = [row[1] for row in cursor.fetchall()]
            has_lemma = 'lemma' in columns

            if has_lemma:
                cursor.execute('''
                    SELECT word, phonetic, translation, pos, extra_data, frequency,
                           lemma, lemma_frequency
                    FROM words
                    WHERE word = ? COLLATE NOCASE
                    LIMIT 1
                ''', (word.lower(),))
            else:
                cursor.execute('''
                    SELECT word, phonetic, translation, pos, extra_data, frequency
                    FROM words
                    WHERE word = ? COLLATE NOCASE
                    LIMIT 1
                ''', (word.lower(),))

            row = cursor.fetchone()
            if not row:
                return None

            # 解析 phonetic JSON
            phonetic_data = {}
            if row['phonetic']:
                try:
                    import json
                    phonetic_data = json.loads(row['phonetic'])
                except:
                    phonetic_data = {'us': row['phonetic']}

            # 解析 extra_data JSON
            extra_data = {}
            if row['extra_data']:
                try:
                    import json
                    extra_data = json.loads(row['extra_data'])
                except:
                    pass

            result = {
                'word': row['word'],
                'phonetic': phonetic_data,
                'translation': row['translation'] or '',
                'pos': row['pos'] or '',
                'extra_data': extra_data,
                'frequency': row['frequency'] or 0,
                'source': 'local_db'
            }

            # 添加词根信息（如果有）
            if has_lemma:
                result['lemma'] = row['lemma'] or ''
                result['lemma_frequency'] = row['lemma_frequency'] or 0

            return result

        except Exception as e:
            print(f"✗ 查询英文单词失败 [{word}]: {e}")
            return None

    def query_english_batch(self, words: List[str]) -> Dict[str, Dict]:
        """批量查询英文单词"""
        results = {}
        for word in words:
            info = self.query_english_word(word)
            if info:
                results[word] = info
        return results

    def format_english_to_wordinfo(self, db_result: Dict) -> Dict:
        """将 ECDICT 格式转换为前端 wordinfo 格式"""
        if not db_result:
            return None

        # 1. 解析音标（已经是 JSON 格式）
        phonetic_data = db_result.get('phonetic', {})
        if not isinstance(phonetic_data, dict):
            phonetic_data = {}

        # 2. 解析词形变化（从 extra_data.wordForms）
        word_forms = {}
        extra_data = db_result.get('extra_data', {})
        if isinstance(extra_data, dict) and 'wordForms' in extra_data:
            # extra_data.wordForms 格式: {"过去式": "appled", "复数": "apples"}
            # 需要转换为英文键名
            form_map = {
                '过去式': 'past',
                '过去分词': 'pastParticiple',
                '现在分词': 'doing',
                '第三人称单数': 'third',
                '比较级': 'comparative',
                '最高级': 'superlative',
                '复数': 'plural',
                '原型': 'lemma',
                '词根': 'root'
            }
            for cn_key, value in extra_data['wordForms'].items():
                en_key = form_map.get(cn_key, cn_key)
                word_forms[en_key] = value

        # 3. 解析定义（从 extra_data.definitions 或 translation）
        target_definitions = []
        native_definitions = []

        if isinstance(extra_data, dict) and 'definitions' in extra_data:
            # extra_data.definitions 格式: [{"pos": "n.", "meanings": ["苹果", "苹果树"]}]
            definitions = extra_data['definitions']
            if isinstance(definitions, list):
                target_definitions = definitions

        # 如果没有 definitions，使用 translation
        if not target_definitions and db_result.get('translation'):
            translations = db_result['translation'].split(';')
            target_definitions = [{
                'pos': db_result.get('pos', 'n.'),
                'meanings': [t.strip() for t in translations if t.strip()]
            }]

        # 中文释义（与 target 相同）
        native_definitions = target_definitions

        # 4. 提取元数据
        collins = 0
        oxford = False
        if isinstance(extra_data, dict):
            collins = extra_data.get('collins', 0)
            oxford = extra_data.get('oxford', False)

        # 5. 构建最终的 wordinfo 格式
        wordinfo = {
            'word': db_result['word'],
            'phonetic': phonetic_data,
            'translation': db_result.get('translation', ''),
            'targetDefinitions': target_definitions,
            'nativeDefinitions': native_definitions,
            'examples': {
                'common': [],  # ECDICT 不包含例句，后续可扩展
                'fun': []
            },
            'wordForms': word_forms,
            'meta': {
                'source': 'local_db',
                'db': 'ECDICT',
                'frequency': db_result.get('frequency', 0),
                'collins': collins,
                'oxford': oxford
            }
        }

        # 添加词根信息（如果有）
        if db_result.get('lemma'):
            wordinfo['lemma'] = db_result['lemma']
            wordinfo['lemma_frequency'] = db_result.get('lemma_frequency', 0)

        return wordinfo

    def format_chinese_to_wordinfo(self, db_result: Dict) -> Dict:
        """将中文数据库格式转换为前端 wordinfo 格式"""
        if not db_result:
            return None

        # 解析释义（英文翻译）
        translations = db_result.get('translation', '').split('; ')

        wordinfo = {
            'word': db_result['word'],
            'traditional': db_result.get('traditional', ''),
            'pinyin': db_result.get('pinyin', ''),
            'translation': db_result.get('translation', ''),
            'targetDefinitions': [
                {
                    'pos': db_result.get('pos', 'n.'),
                    'meanings': translations[:3]  # 只取前3个释义
                }
            ],
            'nativeDefinitions': {
                'en': [
                    {
                        'pos': db_result.get('pos', 'n.'),
                        'meanings': translations[:3]
                    }
                ]
            },
            'examples': {
                'common': [],
                'fun': []
            },
            'wordForms': {},
            'meta': {
                'source': 'local_db',
                'db': 'CC-CEDICT'
            }
        }


        return wordinfo

    def search_chinese_fuzzy(self, prefix: str, limit: int = 20) -> List[str]:
        """模糊搜索中文词语（用于自动补全）"""
        if not self.zh_conn:
            return []

        try:
            cursor = self.zh_conn.cursor()
            cursor.execute('''
                SELECT simplified FROM words
                WHERE simplified LIKE ? OR pinyin LIKE ?
                LIMIT ?
            ''', (f'{prefix}%', f'{prefix}%', limit))

            return [r['simplified'] for r in cursor.fetchall()]

        except Exception as e:
            print(f"✗ 模糊搜索失败: {e}")
            return []

    def search_by_lemma(self, lemma: str, limit: int = 50) -> List[Dict]:
        """根据词根查找所有变体形式

        Args:
            lemma: 词根（如 'be'）
            limit: 返回结果数量限制

        Returns:
            包含所有变体的列表，按词频排序
        """
        if not self.en_conn:
            return []

        try:
            cursor = self.en_conn.cursor()

            # 检查是否有 lemma 字段
            cursor.execute("PRAGMA table_info(words)")
            columns = [row[1] for row in cursor.fetchall()]
            if 'lemma' not in columns:
                return []

            # 查询所有具有相同词根的单词
            cursor.execute('''
                SELECT word, pos, translation, frequency, lemma_frequency
                FROM words
                WHERE lemma = ?
                ORDER BY frequency ASC
                LIMIT ?
            ''', (lemma.lower(), limit))

            results = []
            for row in cursor.fetchall():
                results.append({
                    'word': row['word'],
                    'pos': row['pos'] or '',
                    'translation': row['translation'] or '',
                    'frequency': row['frequency'] or 0,
                    'lemma': lemma,
                    'lemma_frequency': row['lemma_frequency'] or 0
                })

            return results

        except Exception as e:
            print(f"✗ 词根查询失败 [{lemma}]: {e}")
            return []


    def search_examples(self, word: str, lang: str = 'en', limit: int = 5) -> List[Dict]:
        """搜索包含指定单词的例句

        Args:
            word: 要搜索的单词或词语
            lang: 语言 ('en' 或 'zh')
            limit: 返回结果数量限制

        Returns:
            例句列表，每个例句包含 en_sentence 和 zh_sentence
        """
        if not self.sentence_conn:
            return []

        try:
            cursor = self.sentence_conn.cursor()

            if lang == 'en':
                # 英文使用 FTS5 全文搜索
                try:
                    cursor.execute("""
                        SELECT en_sentence, zh_sentence
                        FROM sentence_pairs_fts
                        WHERE en_sentence MATCH ?
                        LIMIT ?
                    """, (word, limit))
                except:
                    # 如果 FTS5 不可用，降级到 LIKE 搜索
                    cursor.execute("""
                        SELECT en_sentence, zh_sentence
                        FROM sentence_pairs
                        WHERE en_sentence LIKE ?
                        LIMIT ?
                    """, (f'%{word}%', limit))
            else:
                # 中文直接使用 LIKE 搜索（FTS5 对中文分词支持不好）
                cursor.execute("""
                    SELECT en_sentence, zh_sentence
                    FROM sentence_pairs
                    WHERE zh_sentence LIKE ?
                    LIMIT ?
                """, (f'%{word}%', limit))

            results = []
            for row in cursor.fetchall():
                results.append({
                    'en': row['en_sentence'],
                    'zh': row['zh_sentence']
                })

            return results

        except Exception as e:
            print(f"✗ 例句搜索失败 [{word}]: {e}")
            return []

    def close(self):
        """关闭数据库连接"""
        if self.zh_conn:
            self.zh_conn.close()
        if self.en_conn:
            self.en_conn.close()
        if self.sentence_conn:
            self.sentence_conn.close()


# 全局数据库实例
dict_db = DictDatabase()


def test_query():
    """测试查询功能"""
    print("\n" + "=" * 60)
    print("测试中文词典查询")
    print("=" * 60)

    # 测试单个查询
    test_words = ['你好', '学习', '电脑', '快乐', '中国']

    for word in test_words:
        print(f"\n查询: {word}")
        result = dict_db.query_chinese_word(word)
        if result:
            print(f"  简体: {result['word']}")
            print(f"  繁体: {result['traditional']}")
            print(f"  拼音: {result['pinyin']}")
            print(f"  释义: {result['translation'][:100]}...")
        else:
            print(f"  未找到")

    # 测试批量查询
    print(f"\n批量查询: {test_words}")
    results = dict_db.query_chinese_batch(test_words)
    print(f"找到 {len(results)} 个词条")

    # 测试格式转换
    if results:
        word = test_words[0]
        if word in results:
            print(f"\n格式转换测试: {word}")
            wordinfo = dict_db.format_chinese_to_wordinfo(results[word])
            print(json.dumps(wordinfo, ensure_ascii=False, indent=2))

    # 测试模糊搜索
    print(f"\n模糊搜索: '学'")
    fuzzy_results = dict_db.search_chinese_fuzzy('学', 10)
    print(f"找到: {fuzzy_results}")


if __name__ == '__main__':
    test_query()
