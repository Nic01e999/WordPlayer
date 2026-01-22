"""
英语听写工具 - 后端API服务
提供翻译和TTS接口供前端调用
"""

import io
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from gtts import gTTS
from deep_translator import GoogleTranslator

app = Flask(__name__)
CORS(app)  # 允许跨域请求

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


if __name__ == "__main__":
    print("后端服务启动: http://localhost:5001")
    print("API:")
    print("  - GET /api/translate?word=hello")
    print("  - GET /api/tts?word=hello&slow=0")
    app.run(debug=True, port=5001)
