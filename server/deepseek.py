"""
DeepSeek 单词信息 API
"""

import os
import json
import sys
import requests
from flask import Blueprint, request, jsonify

from cache import get_cached_words, update_cache, get_cache_stats, get_cached_word_base, add_translation
from utils import strip_markdown_code_blocks, parse_deepseek_response
from youdao import get_word_complete_info
from constants import (
    LANG_PATTERNS,
    LANG_NAMES,
    LANG_PHONETIC_FORMAT,
    MAX_BATCH_SIZE,
    API_TIMEOUT_DEEPSEEK,
    API_TIMEOUT_TRANSLATION
)
from validators import validate_word

# DeepSeek API 配置 (必须设置环境变量)
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")

deepseek_bp = Blueprint('deepseek', __name__)


def _normalize_examples(examples_raw):
    """标准化例句格式（支持新旧格式）"""
    if isinstance(examples_raw, dict):
        return {
            "common": examples_raw.get("common", [])[:2],
            "fun": examples_raw.get("fun", [])[:2]
        }
    else:
        # 兼容旧格式：数组转换为新格式
        return {
            "common": examples_raw[:2] if examples_raw else [],
            "fun": []
        }


def _parse_word_info(word, info, include_phonetic=False):
    """
    解析单词信息为标准格式

    Args:
        word: 单词
        info: API 返回的原始信息
        include_phonetic: 是否包含音标

    Returns:
        dict: 标准化的单词信息
    """
    result = {
        "word": word,
        "translation": info.get("translation", ""),
        "nativeDefinitions": info.get("nativeDefinitions", info.get("chineseDefinitions", [])),
        "targetDefinitions": info.get("targetDefinitions", info.get("definitions", [])),
        "examples": _normalize_examples(info.get("examples", {})),
        "synonyms": info.get("synonyms", [])[:5],
        "antonyms": info.get("antonyms", [])[:3]
    }

    if include_phonetic:
        result["phonetic"] = info.get("phonetic", "")

    return result


def _call_deepseek_api(prompt, temperature=1.3, timeout=API_TIMEOUT_DEEPSEEK):
    """
    调用 DeepSeek API

    Returns:
        (success, content, error)
    """
    response = requests.post(
        "https://api.deepseek.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature
        },
        timeout=timeout
    )

    return parse_deepseek_response(response)


def _process_api_results(raw_results, words, include_phonetic=False):
    """
    处理 API 返回的结果

    Args:
        raw_results: API 返回的原始结果
        words: 要处理的单词列表
        include_phonetic: 是否包含音标

    Returns:
        dict: 处理后的结果字典
    """
    # 创建大小写不敏感的查找表
    raw_lower = {k.lower(): v for k, v in raw_results.items()}

    api_results = {}
    for word in words:
        info = raw_results.get(word) or raw_lower.get(word.lower(), {})
        api_results[word] = _parse_word_info(word, info, include_phonetic)

    return api_results


@deepseek_bp.route("/api/wordinfo/batch", methods=["POST"])
def wordinfo_batch():
    """
    批量获取单词信息（带缓存）- 简化版 API，默认英语->中文
    POST /api/wordinfo/batch
    Body: { "words": ["apple", "happy", "run"], "targetLang": "en", "nativeLang": "zh" }
    返回: { "results": { "apple": {...}, "happy": {...}, "run": {...} } }
    """
    data = request.get_json()
    words = data.get("words", []) if data else []
    target_lang = data.get("targetLang", "en")
    native_lang = data.get("nativeLang", "zh")

    if not words:
        return jsonify({"error": "缺少 words 参数"}), 400

    # 过滤无效输入，限制单次最多 5 个
    words = [w for w in words if validate_word(w, target_lang)][:MAX_BATCH_SIZE]

    if not words:
        return jsonify({"error": "无有效单词"}), 400

    # 检查缓存
    cached_results, missing_words = get_cached_words(words, target_lang, native_lang)

    # 如果全部命中缓存，直接返回
    if not missing_words:
        print(f"[Cache] 全部命中: {words}")
        return jsonify({"results": cached_results})

    print(f"[Cache] 命中: {list(cached_results.keys()) or '无'}, 需查询: {missing_words}")

    # 检查 API 配置
    if not DEEPSEEK_API_KEY:
        return jsonify({"error": "未配置 DEEPSEEK_API_KEY"}), 500

    target_lang_name = LANG_NAMES.get(target_lang, 'English')
    native_lang_name = LANG_NAMES.get(native_lang, 'Chinese')

    try:
        # 只查询未缓存的单词
        words_list = ", ".join(f'"{w}"' for w in missing_words)
        prompt = f'''For these {target_lang_name} words: [{words_list}]

Provide information for EACH word in this JSON format:
{{
  "word1": {{
    "translation": "{native_lang_name} translation",
    "nativeDefinitions": [{{"pos": "n.", "meanings": ["meaning1 in {native_lang_name}", "meaning2"]}}],
    "targetDefinitions": [{{"pos": "n.", "meanings": ["meaning1 in {target_lang_name}", "meaning2"]}}],
    "examples": {{
      "common": ["common sentence 1", "common sentence 2"],
      "fun": ["fun/interesting sentence 1", "fun/interesting sentence 2"]
    }},
    "synonyms": ["syn1", "syn2"],
    "antonyms": ["ant1", "ant2"]
  }},
  "word2": {{ ... }}
}}

Rules for each word:
- translation: Most common translation in {native_lang_name}
- nativeDefinitions: Group by part of speech, each POS with meanings in {native_lang_name}
- targetDefinitions: Group by part of speech, each POS with meanings in {target_lang_name}
- examples.common: 2 common/typical usage sentences (must contain the word)
- examples.fun: 2 interesting/creative sentences (must contain the word)
- synonyms: Up to 5 words
- antonyms: Up to 3 words (empty array if none)

Respond ONLY with valid JSON, no markdown.'''

        success, content, error = _call_deepseek_api(prompt)
        if not success:
            print(f"DeepSeek API error: {error}")
            return jsonify({"error": error}), 500

        content = strip_markdown_code_blocks(content)
        raw_results = json.loads(content)

        # 处理 API 结果
        api_results = _process_api_results(raw_results, missing_words, include_phonetic=False)

        # 更新缓存
        update_cache(api_results, target_lang, native_lang)

        # 合并缓存结果和 API 结果
        all_results = {**cached_results, **api_results}
        return jsonify({"results": all_results})

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"Response content: {content[:500] if 'content' in locals() else 'N/A'}")  # 记录前500字符用于调试
        return jsonify({"error": "解析响应失败"}), 500
    except Exception as e:
        print(f"WordInfo batch error: {e}")
        return jsonify({"error": str(e)}), 500


@deepseek_bp.route("/api/wordinfo/details", methods=["POST"])
def wordinfo_details():
    """
    获取单词完整信息（音标、翻译、释义、例句、同义词、反义词）- 使用有道 API
    POST /api/wordinfo/details
    Body: { "words": ["apple", "happy"], "targetLang": "en", "nativeLang": "zh" }
    返回: { "results": { "apple": { phonetic, translation, nativeDefinitions, targetDefinitions, examples, synonyms, antonyms, wordForms }, ... } }

    缓存逻辑：
    - 按目标语言分文件存储 (cache/wordinfo/en.json 等)
    - 翻译按母语存储在 translations 字典中
    - 如果单词已缓存但没有该母语翻译，只请求翻译部分
    """
    data = request.get_json()
    words = data.get("words", []) if data else []
    target_lang = data.get("targetLang", data.get("lang", "en"))  # 兼容旧参数
    native_lang = data.get("nativeLang", "zh")

    if not words:
        return jsonify({"error": "缺少 words 参数"}), 400

    # 验证语言
    if target_lang not in LANG_PATTERNS:
        return jsonify({"error": f"不支持的目标语言: {target_lang}"}), 400
    if native_lang not in LANG_PATTERNS:
        return jsonify({"error": f"不支持的母语: {native_lang}"}), 400

    # 过滤无效输入，限制单次最多 5 个
    words = [w for w in words if validate_word(w, target_lang)][:MAX_BATCH_SIZE]

    if not words:
        return jsonify({"error": "无有效单词"}), 400

    # 检查缓存
    cached_results, missing_words = get_cached_words(words, target_lang, native_lang)

    # 如果全部命中缓存，直接返回
    if not missing_words:
        print(f"[Cache] 全部命中: {words}")
        return jsonify({"results": cached_results})

    # 区分：完全没缓存的单词 vs 只缺翻译的单词
    words_need_full = []  # 需要完整查询
    words_need_translation = []  # 只需要翻译

    for word in missing_words:
        base_info = get_cached_word_base(word, target_lang)
        if base_info:
            # 有基础信息，只需要翻译
            words_need_translation.append(word)
        else:
            # 完全没缓存
            words_need_full.append(word)

    print(f"[Cache] 命中: {list(cached_results.keys()) or '无'}, 需完整查询: {words_need_full}, 需翻译: {words_need_translation}")

    # 初始化 API 结果字典
    api_results = {}

    try:
        # 1. 完整查询（没缓存的单词）- 使用有道 API
        if words_need_full:
            print(f"[有道API] 开始查询 {len(words_need_full)} 个单词的完整信息")
            for word in words_need_full:
                try:
                    result = get_word_complete_info(word, target_lang, native_lang)

                    # 检查是否有错误
                    if "error" in result:
                        print(f"[有道API] 单词 '{word}' 查询失败")
                        api_results[word] = {
                            "error": "word_not_found",
                            "word": word
                        }
                    else:
                        api_results[word] = result
                        print(f"[有道API] 单词 '{word}' 查询成功")

                except Exception as e:
                    print(f"[有道API] 查询单词 '{word}' 时出错: {str(e)}")
                    api_results[word] = {
                        "error": "word_not_found",
                        "word": word
                    }

            # 更新缓存（只缓存成功的结果）
            successful_results = {k: v for k, v in api_results.items() if "error" not in v}
            if successful_results:
                update_cache(successful_results, target_lang, native_lang)
                print(f"[Cache] 已缓存 {len(successful_results)} 个单词")

        # 2. 仅翻译查询（有基础信息但缺翻译的单词）- 使用有道 API
        if words_need_translation:
            print(f"[有道API] 开始查询 {len(words_need_translation)} 个单词的翻译")
            for word in words_need_translation:
                try:
                    result = get_word_complete_info(word, target_lang, native_lang)

                    if "error" not in result:
                        # 从缓存获取基础信息
                        base_info = get_cached_word_base(word, target_lang)
                        if base_info:
                            # 合并基础信息和新翻译
                            api_results[word] = {
                                "word": word,
                                "phonetic": base_info.get("phonetic", result.get("phonetic", "")),
                                "translation": result.get("translation", ""),
                                "nativeDefinitions": result.get("nativeDefinitions", []),
                                "targetDefinitions": base_info.get("targetDefinitions", result.get("targetDefinitions", [])),
                                "examples": base_info.get("examples", result.get("examples", {})),
                                "synonyms": base_info.get("synonyms", result.get("synonyms", [])),
                                "antonyms": base_info.get("antonyms", result.get("antonyms", [])),
                                "wordForms": base_info.get("wordForms", result.get("wordForms", {}))
                            }

                            # 添加翻译到缓存
                            add_translation(word, target_lang, native_lang,
                                          result.get("translation", ""),
                                          result.get("nativeDefinitions", []))
                            print(f"[有道API] 单词 '{word}' 翻译查询成功")
                        else:
                            # 如果基础信息丢失，使用完整结果
                            api_results[word] = result

                except Exception as e:
                    print(f"[有道API] 查询单词 '{word}' 翻译时出错: {str(e)}")

        # 合并所有结果
        all_results = {**cached_results, **api_results}
        return jsonify({"results": all_results})

    except Exception as e:
        print(f"WordInfo details error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@deepseek_bp.route("/api/cache/stats", methods=["GET"])
def cache_stats():
    """获取缓存统计信息"""
    return jsonify(get_cache_stats())
