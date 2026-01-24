"""
英语听写工具 - 后端API服务
提供翻译和TTS接口供前端调用
"""

import io
import socket
import os
import requests
import json

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "sk-0824195cfddf48db92c8a6fa482f7304")

app = Flask(__name__, static_folder=os.path.dirname(os.path.abspath(__file__)))
CORS(app)  # 允许跨域请求


def get_lan_ip():
    """获取局域网 WiFi IP 地址（macOS 从 en0 接口读取）"""
    import subprocess
    try:
        result = subprocess.run(
            ["ipconfig", "getifaddr", "en0"],
            capture_output=True, text=True, timeout=3
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except Exception:
        pass
    # 备用方案
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        
        s.close()
        return ip
    except Exception:
        return "未知"


@app.route("/")
def index():
    """提供主页"""
    return send_file(os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html"))

@app.route("/api/wordinfo/batch", methods=["POST"])
def wordinfo_batch():
    """
    批量获取单词信息（更省 token）
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

    # 限制单次最多 20 个单词
    words = words[:20]

    try:
        words_list = ", ".join(f'"{w}"' for w in words)
        prompt = f'''For these English words: [{words_list}]

Provide information for EACH word in this JSON format:
{{
  "word1": {{
    "translation": "Chinese translation",
    "definitions": [{{"pos": "n./v./adj.", "meanings": ["meaning1", "meaning2"]}}],
    "examples": ["sentence1", "sentence2"],
    "synonyms": ["syn1", "syn2"],
    "antonyms": ["ant1", "ant2"]
  }},
  "word2": {{ ... }}
}}

Rules for each word:
- translation: Most common Chinese translation (简体中文)
- definitions: Group by part of speech, max 2 meanings per POS
- examples: 2 natural sentences
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
                "temperature": 0.3
            },
            timeout=60  # 批量请求需要更长超时
        )

        if response.ok:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1]
                content = content.rsplit("```", 1)[0]

            raw_results = json.loads(content)

            # 标准化结果
            results = {}
            for word in words:
                info = raw_results.get(word, {})
                results[word] = {
                    "word": word,
                    "translation": info.get("translation", ""),
                    "definitions": info.get("definitions", []),
                    "examples": info.get("examples", [])[:2],
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


@app.route("/api/wordinfo", methods=["GET"])
def wordinfo():
    """
    使用 DeepSeek 获取单词完整信息（单个单词，保留兼容性）
    GET /api/wordinfo?word=happy
    """
    word = request.args.get("word", "")

    if not word:
        return jsonify({"error": "缺少 word 参数"}), 400

    if not DEEPSEEK_API_KEY:
        return jsonify({"error": "未配置 DEEPSEEK_API_KEY"}), 500

    try:
        prompt = f'''For the English word "{word}", provide comprehensive information in JSON format:
{{
  "translation": "Chinese translation (简体中文)",
  "definitions": [
    {{"pos": "part of speech abbreviation (n./v./adj./adv.)", "meanings": ["English definition 1", "English definition 2"]}}
  ],
  "examples": ["example sentence 1", "example sentence 2"],
  "synonyms": ["synonym1", "synonym2", "synonym3"],
  "antonyms": ["antonym1", "antonym2"]
}}

Rules:
- translation: Provide the most common Chinese translation
- definitions: Group by part of speech, max 2 meanings per POS
- examples: 2 natural example sentences
- synonyms: Up to 5 similar words
- antonyms: Up to 3 opposite words (empty array if none)

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
                "temperature": 0.3
            },
            timeout=20
        )

        if response.ok:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1]
                content = content.rsplit("```", 1)[0]

            result = json.loads(content)
            return jsonify({
                "word": word,
                "translation": result.get("translation", ""),
                "definitions": result.get("definitions", []),
                "examples": result.get("examples", [])[:2],
                "synonyms": result.get("synonyms", [])[:5],
                "antonyms": result.get("antonyms", [])[:3]
            })
        else:
            print(f"DeepSeek API error: {response.status_code} - {response.text}")
            return jsonify({"error": f"API 错误: {response.status_code}"}), 500

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return jsonify({"error": "解析响应失败"}), 500
    except Exception as e:
        print(f"WordInfo error: {e}")
        return jsonify({"error": str(e)}), 500


def get_youdao_tts(text: str, slow: bool = False, accent: str = "us") -> bytes:
    """使用有道 TTS 获取语音"""
    # type=1 美式发音, type=2 英式发音
    voice_type = 2 if accent == "uk" else 1
    url = f"https://dict.youdao.com/dictvoice?audio={requests.utils.quote(text)}&type={voice_type}"

    response = requests.get(url, timeout=10)
    if response.ok:
        return response.content
    raise Exception(f"有道 TTS 请求失败: {response.status_code}")


@app.route("/api/tts", methods=["GET"])
def tts():
    """
    生成单词发音（使用有道 TTS）
    GET /api/tts?word=hello&slow=0&accent=us
    返回: MP3 音频文件
    """
    word = request.args.get("word", "")
    slow = request.args.get("slow", "0") == "1"
    accent = request.args.get("accent", "us")  # us 或 uk

    if not word:
        return jsonify({"error": "缺少 word 参数"}), 400

    try:
        audio_data = get_youdao_tts(word, slow, accent)
        return send_file(
            io.BytesIO(audio_data),
            mimetype="audio/mpeg"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/<path:filename>")
def static_files(filename):
    """提供静态文件（js, css）"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, filename)
    if os.path.isfile(file_path):
        return send_file(file_path)
    return "Not Found", 404


if __name__ == "__main__":
    lan_ip = get_lan_ip()
    print("=" * 40)
    print("后端服务已启动!")
    print(f"  本机访问: http://127.0.0.1:5001")
    print(f"  局域网访问: http://{lan_ip}:5001")
    print("=" * 40)
    app.run(debug=True, host="0.0.0.0", port=5001)
