"""
DeepSeek 单词信息 API
"""

import os
import json
import requests
from flask import Blueprint, request, jsonify

from utils import validate_word

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "sk-0824195cfddf48db92c8a6fa482f7304")

deepseek_bp = Blueprint('deepseek', __name__)


@deepseek_bp.route("/api/wordinfo/batch", methods=["POST"])
def wordinfo_batch():
    """
    批量获取单词信息
    POST /api/wordinfo/batch
    Body: { "words": ["apple", "happy", "run"] }
    返回: { "results": { "apple": {...}, "happy": {...}, "run": {...} } }
    """
    data = request.get_json()
    words = data.get("words", []) if data else []

    if not words:
        return jsonify({"error": "缺少 words 参数"}), 400

    if not DEEPSEEK_API_KEY:
        return jsonify({"error": "未配置 DEEPSEEK_API_KEY"}), 500

    # 过滤无效输入，限制单次最多 5 个
    words = [w for w in words if validate_word(w)][:5]

    if not words:
        return jsonify({"error": "无有效单词"}), 400

    try:
        words_list = ", ".join(f'"{w}"' for w in words)
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
            content = data["choices"][0]["message"]["content"]
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1]
                content = content.rsplit("```", 1)[0]

            raw_results = json.loads(content)

            # 创建大小写不敏感的查找表
            raw_lower = {k.lower(): v for k, v in raw_results.items()}

            # 标准化结果
            results = {}
            for word in words:
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

                results[word] = {
                    "word": word,
                    "translation": info.get("translation", ""),
                    "chineseDefinitions": info.get("chineseDefinitions", []),
                    "definitions": info.get("definitions", []),
                    "examples": examples,
                    "synonyms": info.get("synonyms", [])[:5],
                    "antonyms": info.get("antonyms", [])[:3]
                }

            return jsonify({"results": results})
        else:
            print(f"DeepSeek API error: {response.status_code} - {response.text}")
            return jsonify({"error": f"API 错误: {response.status_code}"}), 500

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return jsonify({"error": "解析响应失败"}), 500
    except Exception as e:
        print(f"WordInfo batch error: {e}")
        return jsonify({"error": str(e)}), 500
