"""
英语听写工具 - 后端API服务
提供翻译和TTS接口供前端调用
"""

import io
import socket
import os
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from gtts import gTTS
from deep_translator import GoogleTranslator

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

# 翻译器实例
translator = GoogleTranslator(source="en", target="zh-CN")


@app.route("/api/translate", methods=["GET"])
def translate():
    """
    翻译单词
    GET /api/translate?word=hello
    返回: { "translation": "你好" }
    """
    word = request.args.get("word", "")
    if not word:
        return jsonify({"error": "缺少 word 参数"}), 400

    try:
        result = translator.translate(word)
        return jsonify({"translation": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tts", methods=["GET"])
def tts():
    """
    生成单词发音
    GET /api/tts?word=hello&slow=0
    返回: MP3 音频文件
    """
    word = request.args.get("word", "")
    slow = request.args.get("slow", "0") == "1"

    if not word:
        return jsonify({"error": "缺少 word 参数"}), 400

    try:
        # 生成语音到内存
        audio = io.BytesIO()
        tts = gTTS(text=word, lang="en", slow=slow)
        tts.write_to_fp(audio)
        audio.seek(0)

        return send_file(audio, mimetype="audio/mpeg")
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
