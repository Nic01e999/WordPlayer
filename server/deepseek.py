"""
DeepSeek 单词信息 API
"""

import os
import re
import json
import requests
from flask import Blueprint, request, jsonify

from cache import get_cached_words, update_cache, get_cache_stats


def _validate_word(word):
    """验证单词/短语是否有效"""
    if not word or not isinstance(word, str):
        return False
    if len(word) > 100:
        return False
    # 允许：英文字母、空格、连字符、撇号（如 don't）
    if not re.match(r"^[a-zA-Z\s\-']+$", word):
        return False
    return True

# DeepSeek API 配置 (必须设置环境变量)
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")

deepseek_bp = Blueprint('deepseek', __name__)


@deepseek_bp.route("/api/wordinfo/batch", methods=["POST"])
def wordinfo_batch():
    """
    批量获取单词信息（带缓存）
    POST /api/wordinfo/batch
    Body: { "words": ["apple", "happy", "run"] }
    返回: { "results": { "apple": {...}, "happy": {...}, "run": {...} } }
    """
    data = request.get_json()
    words = data.get("words", []) if data else []

    if not words:
        return jsonify({"error": "缺少 words 参数"}), 400

    # 过滤无效输入，限制单次最多 5 个
    words = [w for w in words if _validate_word(w)][:5]

    if not words:
        return jsonify({"error": "无有效单词"}), 400

    # 检查缓存
    cached_results, missing_words = get_cached_words(words)

    # 如果全部命中缓存，直接返回
    if not missing_words:
        print(f"[Cache] 全部命中: {words}")
        return jsonify({"results": cached_results})

    print(f"[Cache] 命中: {list(cached_results.keys()) or '无'}, 需查询: {missing_words}")

    # 检查 API 配置
    if not DEEPSEEK_API_KEY:
        return jsonify({"error": "未配置 DEEPSEEK_API_KEY"}), 500

    try:
        # 只查询未缓存的单词
        words_list = ", ".join(f'"{w}"' for w in missing_words)
        prompt = f'''For these English words: [{words_list}]

Provide information for EACH word in this JSON format:
{{
  "word1": {{
    "translation": "Chinese translation",
    "chineseDefinitions": [{{"pos": "n.", "meanings": ["中文意思1", "中文意思2"]}}],
    "definitions": [{{"pos": "n.", "meanings": ["English meaning1", "English meaning2"]}}],
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
- translation: Most common Chinese translation (简体中文)
- chineseDefinitions: Group by part of speech, each POS with Chinese meanings (简体中文)
- definitions: Group by part of speech, each POS with English meanings
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
            data = response.json()

            # 验证 API 响应结构
            choices = data.get("choices")
            if not choices or len(choices) == 0:
                print(f"DeepSeek API 返回异常结构: {data}")
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
                    "chineseDefinitions": info.get("chineseDefinitions", []),
                    "definitions": info.get("definitions", []),
                    "examples": examples,
                    "synonyms": info.get("synonyms", [])[:5],
                    "antonyms": info.get("antonyms", [])[:3]
                }

            # 更新缓存
            update_cache(api_results)

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


@deepseek_bp.route("/api/cache/stats", methods=["GET"])
def cache_stats():
    """获取缓存统计信息"""
    return jsonify(get_cache_stats())
