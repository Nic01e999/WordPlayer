"""
词典数据库查询模块
支持混合架构：中文本地数据库 + 英文 API
"""

import sqlite3
import json
from pathlib import Path
from typing import Dict, List, Optional

# 数据库路径
DB_DIR = Path(__file__).parent.parent / 'data' / 'dict'
ZH_DB = DB_DIR / 'zh_dict.db'
EN_DB = DB_DIR / 'en_dict.db'
USER_DB = DB_DIR / 'user_dict.db'


class DictDatabase:
    """词典数据库查询类"""

    def __init__(self):
        self.zh_conn = None
        self.en_conn = None
        self.user_conn = None
        self._connect_zh()
        self._connect_en()
        self._connect_user()

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

    def _connect_user(self):
        """连接用户自定义数据库"""
        if USER_DB.exists():
            try:
                self.user_conn = sqlite3.connect(str(USER_DB), check_same_thread=False)
                self.user_conn.row_factory = sqlite3.Row
                print(f"✓ 用户自定义数据库已连接: {USER_DB}")
            except Exception as e:
                print(f"✗ 连接用户数据库失败: {e}")
                self.user_conn = None
        else:
            print(f"⚠ 用户自定义数据库不存在: {USER_DB}")
            self.user_conn = None

    def query_chinese_word(self, word: str) -> Optional[Dict]:
        """查询中文词语"""
        if not self.zh_conn:
            return None

        try:
            cursor = self.zh_conn.cursor()

            # 查询简体或繁体
            cursor.execute('''
                SELECT * FROM words
                WHERE simplified = ? OR traditional = ?
                LIMIT 1
            ''', (word, word))

            row = cursor.fetchone()
            if not row:
                return None

            return {
                'word': row['simplified'],
                'traditional': row['traditional'],
                'pinyin': row['pinyin'],
                'translation': row['translation'],
                'pos': row['pos'],
                'source': 'local_db'
            }

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

            return {
                'word': row['word'],
                'phonetic': phonetic_data,
                'translation': row['translation'] or '',
                'pos': row['pos'] or '',
                'extra_data': extra_data,
                'frequency': row['frequency'] or 0,
                'source': 'local_db'
            }

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
        return {
            'word': db_result['word'],
            'phonetic': phonetic_data,
            'translation': db_result.get('translation', ''),
            'targetDefinitions': target_definitions,
            'nativeDefinitions': native_definitions,
            'examples': {
                'common': [],  # ECDICT 不包含例句，后续可扩展
                'fun': []
            },
            'synonyms': [],    # 后续可从 Moby Thesaurus 补充
            'antonyms': [],
            'wordForms': word_forms,
            'meta': {
                'source': 'local_db',
                'db': 'ECDICT',
                'frequency': db_result.get('frequency', 0),
                'collins': collins,
                'oxford': oxford
            }
        }

    def format_chinese_to_wordinfo(self, db_result: Dict) -> Dict:
        """将中文数据库格式转换为前端 wordinfo 格式"""
        if not db_result:
            return None

        # 解析释义（英文翻译）
        translations = db_result.get('translation', '').split('; ')

        return {
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
            'synonyms': [],
            'antonyms': [],
            'wordForms': {},
            'meta': {
                'source': 'local_db',
                'db': 'CC-CEDICT'
            }
        }

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

    def query_user_definition(self, word: str, language: str) -> Optional[Dict]:
        """查询用户自定义释义"""
        if not self.user_conn:
            return None

        try:
            cursor = self.user_conn.cursor()
            cursor.execute('''
                SELECT * FROM user_definitions
                WHERE word = ? AND language = ?
                LIMIT 1
            ''', (word, language))

            row = cursor.fetchone()
            if not row:
                return None

            return {
                'word': row['word'],
                'language': row['language'],
                'definition': row['definition'],
                'phonetic': row['phonetic'],
                'notes': row['notes'],
                'source': 'user_defined'
            }

        except Exception as e:
            print(f"✗ 查询用户自定义失败: {e}")
            return None

    def save_user_definition(self, word: str, language: str, definition: str,
                            phonetic: str = None, notes: str = None) -> bool:
        """保存用户自定义释义"""
        if not self.user_conn:
            return False

        try:
            cursor = self.user_conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO user_definitions
                (word, language, definition, phonetic, notes, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (word, language, definition, phonetic, notes))

            self.user_conn.commit()
            print(f"✓ 保存用户自定义: {word} ({language})")
            return True

        except Exception as e:
            print(f"✗ 保存用户自定义失败: {e}")
            return False

    def query_user_batch(self, words: List[str], language: str) -> Dict[str, Dict]:
        """批量查询用户自定义"""
        results = {}
        for word in words:
            info = self.query_user_definition(word, language)
            if info:
                results[word] = info
        return results

    def format_user_to_wordinfo(self, user_result: Dict) -> Dict:
        """将用户自定义格式转换为前端 wordinfo 格式"""
        if not user_result:
            return None

        return {
            'word': user_result['word'],
            'phonetic': user_result.get('phonetic', ''),
            'translation': user_result.get('definition', ''),
            'targetDefinitions': [{
                'pos': '',
                'meanings': [user_result.get('definition', '')]
            }],
            'nativeDefinitions': {},
            'examples': {'common': [], 'fun': []},
            'synonyms': [],
            'antonyms': [],
            'wordForms': {},
            'meta': {
                'source': 'user_defined',
                'notes': user_result.get('notes', '')
            }
        }

    def close(self):
        """关闭数据库连接"""
        if self.zh_conn:
            self.zh_conn.close()
        if self.en_conn:
            self.en_conn.close()
        if self.user_conn:
            self.user_conn.close()


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
