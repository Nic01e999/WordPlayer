"""
英语听写工具 - 后端API服务
提供翻译和TTS接口供前端调用
"""

import io
import socket
import os
import asyncio
import requests

# 设置 translators 区域（必须在导入前设置）
os.environ["translators_default_region"] = "CN"

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import edge_tts
import translators as ts

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

def abbreviate_pos(pos):
    """将完整词性名称转换为缩写"""
    mapping = {
        "noun": "n.",
        "verb": "v.",
        "adjective": "adj.",
        "adverb": "adv.",
        "pronoun": "pron.",
        "preposition": "prep.",
        "conjunction": "conj.",
        "interjection": "interj.",
        "exclamation": "excl."
    }
    return mapping.get(pos.lower(), pos + ".")


@app.route("/api/dictionary", methods=["GET"])
def dictionary():
    """
    获取单词词典信息（含词性）
    GET /api/dictionary?word=hello&provider=bing
    返回: {
        "word": "hello",
        "phonetic": "/həˈloʊ/",
        "definitions": [
            {"pos": "n.", "meanings": ["问候", "招呼"]},
            {"pos": "v.", "meanings": ["打招呼"]}
        ],
        "translation": "你好"
    }
    """
    word = request.args.get("word", "")
    provider = request.args.get("provider", "bing")

    if not word:
        return jsonify({"error": "缺少 word 参数"}), 400

    result = {
        "word": word,
        "phonetic": None,
        "definitions": [],
        "translation": None
    }

    # 尝试从 Free Dictionary API 获取词性数据
    try:
        dict_res = requests.get(
            f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}",
            timeout=5
        )
        if dict_res.ok:
            data = dict_res.json()
            if data and isinstance(data, list):
                entry = data[0]
                result["phonetic"] = entry.get("phonetic")

                seen_pos = {}
                for meaning in entry.get("meanings", []):
                    pos = meaning.get("partOfSpeech", "")
                    pos_abbr = abbreviate_pos(pos)

                    # 获取前2个释义
                    definitions = [d.get("definition", "")
                                   for d in meaning.get("definitions", [])[:2]]

                    if pos_abbr in seen_pos:
                        seen_pos[pos_abbr]["meanings"].extend(definitions)
                    else:
                        seen_pos[pos_abbr] = {
                            "pos": pos_abbr,
                            "meanings": definitions
                        }

                result["definitions"] = list(seen_pos.values())
    except Exception as e:
        print(f"Dictionary API error: {e}")

    # 获取中文翻译
    try:
        translation = ts.translate_text(
            word,
            translator=provider,
            to_language="zh",
            if_use_cn_host=True
        )
        result["translation"] = translation
    except Exception as e:
        print(f"Translation error: {e}")

    return jsonify(result)


@app.route("/api/translate", methods=["GET"])
def translate():
    """
    翻译单词
    GET /api/translate?word=hello&provider=bing
    返回: { "translation": "你好" }
    """
    word = request.args.get("word", "")
    provider = request.args.get("provider", "bing")  # bing / google / baidu / youdao

    if not word:
        return jsonify({"error": "缺少 word 参数"}), 400

    try:
        result = ts.translate_text(
            word,
            translator=provider,
            to_language="zh",
            if_use_cn_host=True  # 国内可用
        )
        return jsonify({"translation": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


async def generate_tts(text: str, slow: bool = False) -> bytes:
    """使用 Edge TTS 生成语音"""
    voice = "en-US-AriaNeural"
    rate = "-30%" if slow else "+0%"

    communicate = edge_tts.Communicate(text, voice, rate=rate)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data


@app.route("/api/tts", methods=["GET"])
def tts():
    """
    生成单词发音（使用 Edge TTS）
    GET /api/tts?word=hello&slow=0
    返回: MP3 音频文件
    """
    word = request.args.get("word", "")
    slow = request.args.get("slow", "0") == "1"

    if not word:
        return jsonify({"error": "缺少 word 参数"}), 400

    try:
        audio_data = asyncio.run(generate_tts(word, slow))
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
