"""
词典 API - 数据库架构
中文和英文词典使用本地数据库，支持用户自定义释义
"""

from flask import Blueprint, request, jsonify
from dict_db import dict_db
from validators import validate_word
from constants import MAX_BATCH_SIZE

dict_api_bp = Blueprint('dict_api', __name__)


def _is_chinese(text):
    """判断文本是否为中文"""
    if not text:
        return False
    # 检查是否包含中文字符
    return any('\u4e00' <= char <= '\u9fff' for char in text)


def _query_word_info(word, target_lang='en', native_lang='zh'):
    """
    查询单词信息（数据库架构）

    Args:
        word: 要查询的词
        target_lang: 目标语言
        native_lang: 母语

    Returns:
        dict: 单词信息，如果未找到返回默认翻译
    """
    # 1. 如果是中文词，使用本地数据库
    if _is_chinese(word):
        print(f"[Dict] 查询中文词典: {word}")
        db_result = dict_db.query_chinese_word(word)
        if db_result:
            wordinfo = dict_db.format_chinese_to_wordinfo(db_result)
            print(f"[Dict] ✓ 中文数据库找到: {word}")
            return wordinfo
        else:
            print(f"[Dict] ✗ 中文数据库未找到: {word}")
            # 返回默认翻译
            return {
                'word': word,
                'translation': '未找到释义，请自定义',
                'targetDefinitions': [{'pos': '', 'meanings': ['非中英，请自定义']}],
                'nativeDefinitions': {},
                'examples': {},
                'wordForms': {},
                'meta': {'source': 'default', 'language': target_lang}
            }

    # 2. 如果是英文词，使用混合模式（本地优先，API 兜底）
    elif target_lang == 'en':
        print(f"[Dict] 查询英文词典: {word}")

        # 2.1 先查本地数据库
        db_result = dict_db.query_english_word(word)
        if db_result:
            wordinfo = dict_db.format_english_to_wordinfo(db_result)
            print(f"[Dict] ✓ 英文数据库找到: {word}")
            return wordinfo

        # 2.2 本地未找到，尝试 API 兜底（待实现）
        print(f"[Dict] ✗ 英文数据库未找到: {word}")
        # TODO: 实现有道词典 API 查询作为兜底
        # 可以参考 tts.py 中的有道 API 调用方式
        # 示例：
        # try:
        #     from youdao_dict_api import query_youdao_dict
        #     api_result = query_youdao_dict(word, 'en', 'zh')
        #     if api_result:
        #         print(f"[Dict] ✓ 有道 API 找到: {word}")
        #         return api_result
        # except Exception as e:
        #     print(f"[Dict] ✗ 有道 API 查询失败: {e}")

        # 2.3 都失败，返回默认
        print(f"[Dict] ✗ 所有数据源都未找到: {word}")
        return {
            'word': word,
            'translation': '未找到释义，请自定义',
            'targetDefinitions': [{'pos': '', 'meanings': ['未找到释义，请自定义']}],
            'nativeDefinitions': {},
            'examples': {'common': [], 'fun': []},
            'wordForms': {},
            'meta': {'source': 'default', 'language': target_lang}
        }

    # 3. 日语、韩语等其他语言：返回默认翻译
    else:
        print(f"[Dict] 非中英语言: {word} ({target_lang})")
        return {
            'word': word,
            'translation': '非中英，请自定义',
            'targetDefinitions': [{'pos': '', 'meanings': ['非中英，请自定义']}],
            'nativeDefinitions': {},
            'examples': {'common': [], 'fun': []},
            'wordForms': {},
            'meta': {'source': 'default', 'language': target_lang}
        }


@dict_api_bp.route("/api/dict/batch", methods=["POST"])
def dict_batch():
    """
    批量获取词语信息（数据库架构）
    POST /api/dict/batch
    Body: { "words": ["apple", "你好", "学习"], "targetLang": "en", "nativeLang": "zh" }
    返回: { "results": { "apple": {...}, "你好": {...}, "学习": {...} } }
    """
    data = request.get_json()
    words = data.get("words", []) if data else []
    target_lang = data.get("targetLang", "en")
    native_lang = data.get("nativeLang", "zh")

    if not words:
        return jsonify({"error": "缺少 words 参数"}), 400

    # 过滤无效输入，限制单次最多 MAX_BATCH_SIZE 个
    words = [w for w in words if w and w.strip()][:MAX_BATCH_SIZE]

    if not words:
        return jsonify({"error": "无有效词语"}), 400

    print(f"[Dict] 批量查询: {words}")

    # 直接查询所有词语
    results = {}
    for word in words:
        wordinfo = _query_word_info(word, target_lang, native_lang)
        if wordinfo:
            results[word] = wordinfo

    return jsonify({"results": results})


@dict_api_bp.route("/api/dict/details", methods=["POST"])
def dict_details():
    """
    获取单个词语的详细信息
    POST /api/dict/details
    Body: { "word": "apple", "targetLang": "en", "nativeLang": "zh" }
    """
    data = request.get_json()
    word = data.get("word", "") if data else ""
    target_lang = data.get("targetLang", "en")
    native_lang = data.get("nativeLang", "zh")

    if not word:
        return jsonify({"error": "缺少 word 参数"}), 400

    # 查询词语信息
    wordinfo = _query_word_info(word, target_lang, native_lang)

    if not wordinfo:
        return jsonify({"error": f"未找到词语: {word}"}), 404

    return jsonify(wordinfo)


@dict_api_bp.route("/api/dict/search", methods=["GET"])
def dict_search():
    """
    模糊搜索（用于自动补全）
    GET /api/dict/search?q=学&limit=10
    """
    query = request.args.get("q", "")
    limit = int(request.args.get("limit", 20))

    if not query:
        return jsonify({"results": []})

    # 如果是中文，使用本地数据库搜索
    if _is_chinese(query):
        results = dict_db.search_chinese_fuzzy(query, limit)
        return jsonify({"results": results})

    # 英文暂不支持模糊搜索
    return jsonify({"results": []})


@dict_api_bp.route("/api/dict/lemma/<lemma>", methods=["GET"])
def get_lemma_words(lemma):
    """
    查询同词根的所有词汇
    GET /api/dict/lemma/<lemma>?limit=50&exclude_word=current_word
    """
    limit = request.args.get("limit", 50, type=int)
    exclude_word = request.args.get("exclude_word", "", type=str)

    # 限制最大返回数量
    limit = min(limit, 100)

    print(f"[Dict] 查询同词根词汇: {lemma}, limit={limit}, exclude_word={exclude_word}")

    # 调用 dict_db 的 search_by_lemma 方法
    words = dict_db.search_by_lemma(lemma, limit)

    # 过滤掉当前单词
    if exclude_word:
        words = [w for w in words if w['word'].lower() != exclude_word.lower()]
        print(f"[Dict] 过滤掉当前单词: {exclude_word}")

    if words:
        print(f"[Dict] ✓ 找到 {len(words)} 个同词根词汇")
    else:
        print(f"[Dict] ✗ 未找到同词根词汇")

    return jsonify({
        "lemma": lemma,
        "count": len(words),
        "words": words
    })


@dict_api_bp.route("/api/dict/stats", methods=["GET"])
def dict_stats():
    """
    获取词典统计信息
    GET /api/dict/stats
    """
    # 获取实际词条数量
    zh_count = 0
    en_count = 0

    if dict_db.zh_conn:
        try:
            cursor = dict_db.zh_conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM words")
            zh_count = cursor.fetchone()[0]
        except:
            pass

    if dict_db.en_conn:
        try:
            cursor = dict_db.en_conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM words")
            en_count = cursor.fetchone()[0]
        except:
            pass

    stats = {
        "chinese": {
            "available": dict_db.zh_conn is not None,
            "source": "CC-CEDICT",
            "count": zh_count,
            "status": "✓ 本地数据库" if dict_db.zh_conn else "✗ 未连接"
        },
        "english": {
            "available": dict_db.en_conn is not None,
            "source": "ECDICT" if dict_db.en_conn else "未安装",
            "count": en_count,
            "status": "✓ 本地数据库" if dict_db.en_conn else "⚠ 未安装"
        }
    }
    return jsonify(stats)


@dict_api_bp.route("/api/dict/examples/<word>", methods=["GET"])
def get_examples(word):
    """
    获取单词例句
    GET /api/dict/examples/<word>?lang=en&limit=10

    Args:
        word: 单词
        lang: 语言 (en/zh)
        limit: 返回数量限制

    Returns:
        {
            "word": "happy",
            "lang": "en",
            "count": 5,
            "examples": [
                {"en": "I am happy.", "zh": "我很开心。"},
                ...
            ]
        }
    """
    lang = request.args.get('lang', 'en')
    limit = int(request.args.get('limit', 10))

    print(f"[Dict] 查询例句: word={word}, lang={lang}, limit={limit}")

    # 调用数据库查询例句
    examples = dict_db.search_examples(word, lang=lang, limit=limit)

    print(f"[Dict] 找到 {len(examples)} 条例句")

    return jsonify({
        "word": word,
        "lang": lang,
        "count": len(examples),
        "examples": examples
    })

