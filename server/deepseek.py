"""
DeepSeek 单词信息 API
"""

import os
import re
import json
import requests
from flask import Blueprint, request, jsonify

from cache import get_cached_words, update_cache, get_cache_stats, get_cached_word_base, add_translation


# 各语言的字符验证正则
LANG_PATTERNS = {
    'en': r"^[a-zA-Z\s\-']+$",                                    # 英语
    'ja': r"^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\s]+$",  # 日语
    'ko': r"^[\uAC00-\uD7AF\u1100-\u11FF\s]+$",                   # 韩语
    'fr': r"^[a-zA-Z\u00C0-\u00FF\s\-']+$",                       # 法语
    'zh': r"^[\u4e00-\u9fff\s]+$"                                  # 中文
}

# 语言名称映射（用于 prompt）
LANG_NAMES = {
    'en': 'English',
    'ja': 'Japanese',
    'ko': 'Korean',
    'fr': 'French',
    'zh': 'Chinese'
}

# 各语言的发音格式描述
LANG_PHONETIC_FORMAT = {
    'en': 'IPA phonetic transcription (e.g. /ˈæp.əl/ for "apple")',
    'zh': 'Pinyin with tone marks (e.g. "píng guǒ" for "苹果")',
    'ja': 'Hiragana reading (e.g. "りんご" for "林檎")',
    'ko': 'Romanization (e.g. "sagwa" for "사과")',
    'fr': 'IPA phonetic transcription (e.g. /pɔm/ for "pomme")'
}


def _validate_word(word, lang='en'):
    """验证单词/短语是否有效"""
    if not word or not isinstance(word, str):
        return False
    if len(word) > 100:
        return False
    pattern = LANG_PATTERNS.get(lang, LANG_PATTERNS['en'])
    if not re.match(pattern, word):
        return False
    return True

# DeepSeek API 配置 (必须设置环境变量)
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")

deepseek_bp = Blueprint('deepseek', __name__)


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
    words = [w for w in words if _validate_word(w, target_lang)][:5]

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

        response = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 1.3
            },
            timeout=60
        )

        if response.ok:
            resp_data = response.json()

            # 验证 API 响应结构
            choices = resp_data.get("choices")
            if not choices or len(choices) == 0:
                print(f"DeepSeek API 返回异常结构: {resp_data}")
                return jsonify({"error": "API 返回格式异常"}), 500
            message = choices[0].get("message", {})
            content = message.get("content", "")
            if not content:
                print(f"DeepSeek API 返回内容为空: {choices[0]}")
                return jsonify({"error": "API 返回内容为空"}), 500

            content = content.strip()
            # 更健壮的 markdown 代码块提取
            if content.startswith("```"):
                lines = content.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]  # 移除开头的 ```json 或 ```
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]  # 移除结尾的 ```
                content = "\n".join(lines)

            raw_results = json.loads(content)

            # 创建大小写不敏感的查找表
            raw_lower = {k.lower(): v for k, v in raw_results.items()}

            # 标准化结果（只处理 missing_words）
            api_results = {}
            for word in missing_words:
                info = raw_results.get(word) or raw_lower.get(word.lower(), {})

                # 处理 examples 格式（支持新旧格式）
                examples_raw = info.get("examples", {})
                if isinstance(examples_raw, dict):
                    examples = {
                        "common": examples_raw.get("common", [])[:2],
                        "fun": examples_raw.get("fun", [])[:2]
                    }
                else:
                    # 兼容旧格式：数组转换为新格式
                    examples = {
                        "common": examples_raw[:2] if examples_raw else [],
                        "fun": []
                    }

                api_results[word] = {
                    "word": word,
                    "translation": info.get("translation", ""),
                    "nativeDefinitions": info.get("nativeDefinitions", info.get("chineseDefinitions", [])),
                    "targetDefinitions": info.get("targetDefinitions", info.get("definitions", [])),
                    "examples": examples,
                    "synonyms": info.get("synonyms", [])[:5],
                    "antonyms": info.get("antonyms", [])[:3]
                }

            # 更新缓存
            update_cache(api_results, target_lang, native_lang)

            # 合并缓存结果和 API 结果
            all_results = {**cached_results, **api_results}
            return jsonify({"results": all_results})
        else:
            print(f"DeepSeek API error: {response.status_code} - {response.text}")
            return jsonify({"error": f"API 错误: {response.status_code}"}), 500

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return jsonify({"error": "解析响应失败"}), 500
    except Exception as e:
        print(f"WordInfo batch error: {e}")
        return jsonify({"error": str(e)}), 500


@deepseek_bp.route("/api/wordinfo/details", methods=["POST"])
def wordinfo_details():
    """
    获取单词完整信息（音标、翻译、释义、例句、同义词、反义词）- 全功能API
    POST /api/wordinfo/details
    Body: { "words": ["apple", "happy"], "targetLang": "en", "nativeLang": "zh" }
    返回: { "results": { "apple": { phonetic, translation, nativeDefinitions, targetDefinitions, examples, synonyms, antonyms }, ... } }

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
    words = [w for w in words if _validate_word(w, target_lang)][:5]

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

    # 检查 API 配置
    if not DEEPSEEK_API_KEY:
        return jsonify({"error": "未配置 DEEPSEEK_API_KEY"}), 500

    target_lang_name = LANG_NAMES.get(target_lang, 'English')
    native_lang_name = LANG_NAMES.get(native_lang, 'Chinese')
    phonetic_format = LANG_PHONETIC_FORMAT.get(target_lang, LANG_PHONETIC_FORMAT['en'])

    api_results = {}

    try:
        # 1. 完整查询（没缓存的单词）
        if words_need_full:
            words_list = ", ".join(f'"{w}"' for w in words_need_full)
            prompt = f'''For these {target_lang_name} words: [{words_list}]

Provide complete information for EACH word in this JSON format:
{{
  "word1": {{
    "phonetic": "IPA phonetic transcription",
    "translation": "main translation in {native_lang_name}",
    "nativeDefinitions": [
      {{"pos": "n.", "meanings": ["meaning1 in {native_lang_name}", "meaning2"]}}
    ],
    "targetDefinitions": [
      {{"pos": "n.", "meanings": ["meaning1 in {target_lang_name}", "meaning2"]}}
    ],
    "examples": {{
      "common": ["common sentence 1", "common sentence 2"],
      "fun": ["fun/interesting sentence 1", "fun/interesting sentence 2"]
    }},
    "synonyms": ["syn1", "syn2", "syn3"],
    "antonyms": ["ant1", "ant2"]
  }},
  "word2": {{ ... }}
}}

Rules for each word:
- phonetic: {phonetic_format}
- translation: Most common translation in {native_lang_name}
- nativeDefinitions: Group by part of speech (n./v./adj./adv./etc.), meanings in {native_lang_name}
- targetDefinitions: Group by part of speech, meanings in {target_lang_name}
- examples.common: 2 common/typical usage sentences in {target_lang_name} (must contain the word)
- examples.fun: 2 interesting/creative sentences in {target_lang_name} (must contain the word)
- synonyms: Up to 5 {target_lang_name} words with similar meaning
- antonyms: Up to 3 {target_lang_name} words with opposite meaning (empty array if none)

Respond ONLY with valid JSON, no markdown.'''

            response = requests.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 1.3
                },
                timeout=60
            )

            if response.ok:
                api_data = response.json()
                choices = api_data.get("choices")
                if not choices or len(choices) == 0:
                    return jsonify({"error": "API 返回格式异常"}), 500

                content = choices[0].get("message", {}).get("content", "").strip()
                if not content:
                    return jsonify({"error": "API 返回内容为空"}), 500

                # 提取 JSON
                if content.startswith("```"):
                    lines = content.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].strip() == "```":
                        lines = lines[:-1]
                    content = "\n".join(lines)

                raw_results = json.loads(content)
                raw_lower = {k.lower(): v for k, v in raw_results.items()}

                for word in words_need_full:
                    info = raw_results.get(word) or raw_lower.get(word.lower(), {})
                    examples_raw = info.get("examples", {})

                    if isinstance(examples_raw, dict):
                        examples = {
                            "common": examples_raw.get("common", [])[:2],
                            "fun": examples_raw.get("fun", [])[:2]
                        }
                    else:
                        examples = {"common": examples_raw[:2] if examples_raw else [], "fun": []}

                    api_results[word] = {
                        "word": word,
                        "phonetic": info.get("phonetic", ""),
                        "translation": info.get("translation", ""),
                        "nativeDefinitions": info.get("nativeDefinitions", []),
                        "targetDefinitions": info.get("targetDefinitions", []),
                        "examples": examples,
                        "synonyms": info.get("synonyms", [])[:5],
                        "antonyms": info.get("antonyms", [])[:3]
                    }

                # 更新缓存
                update_cache(api_results, target_lang, native_lang)
            else:
                print(f"DeepSeek API error: {response.status_code} - {response.text}")
                return jsonify({"error": f"API 错误: {response.status_code}"}), 500

        # 2. 仅翻译查询（有基础信息但缺翻译的单词）
        if words_need_translation:
            words_list = ", ".join(f'"{w}"' for w in words_need_translation)
            prompt = f'''Translate these {target_lang_name} words to {native_lang_name}:
[{words_list}]

Respond in this JSON format:
{{
  "word1": {{
    "translation": "main translation",
    "nativeDefinitions": [
      {{"pos": "n.", "meanings": ["meaning1", "meaning2"]}}
    ]
  }},
  "word2": {{ ... }}
}}

Rules:
- translation: Most common translation in {native_lang_name}
- nativeDefinitions: Group by part of speech, meanings in {native_lang_name}

Respond ONLY with valid JSON, no markdown.'''

            response = requests.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 1.0
                },
                timeout=30
            )

            if response.ok:
                api_data = response.json()
                choices = api_data.get("choices")
                if choices and len(choices) > 0:
                    content = choices[0].get("message", {}).get("content", "").strip()

                    if content.startswith("```"):
                        lines = content.split("\n")
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].strip() == "```":
                            lines = lines[:-1]
                        content = "\n".join(lines)

                    trans_results = json.loads(content)
                    trans_lower = {k.lower(): v for k, v in trans_results.items()}

                    for word in words_need_translation:
                        trans_info = trans_results.get(word) or trans_lower.get(word.lower(), {})
                        translation = trans_info.get("translation", "")
                        native_defs = trans_info.get("nativeDefinitions", [])

                        # 添加翻译到缓存
                        add_translation(word, target_lang, native_lang, translation, native_defs)

                        # 从缓存获取完整信息
                        base_info = get_cached_word_base(word, target_lang)
                        if base_info:
                            api_results[word] = {
                                "word": word,
                                "phonetic": base_info.get("phonetic", ""),
                                "translation": translation,
                                "nativeDefinitions": native_defs,
                                "targetDefinitions": base_info.get("targetDefinitions", []),
                                "examples": base_info.get("examples", {}),
                                "synonyms": base_info.get("synonyms", []),
                                "antonyms": base_info.get("antonyms", [])
                            }

        # 合并所有结果
        all_results = {**cached_results, **api_results}
        return jsonify({"results": all_results})

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return jsonify({"error": "解析响应失败"}), 500
    except Exception as e:
        print(f"WordInfo details error: {e}")
        return jsonify({"error": str(e)}), 500


@deepseek_bp.route("/api/cache/stats", methods=["GET"])
def cache_stats():
    """获取缓存统计信息"""
    return jsonify(get_cache_stats())
