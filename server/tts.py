"""
有道 TTS 语音合成 API
"""

import io
import requests
from flask import Blueprint, request, jsonify, send_file

tts_bp = Blueprint('tts', __name__)


def get_youdao_tts(text: str, slow: bool = False, accent: str = "us") -> bytes:
    """使用有道 TTS 获取语音"""
    # type=1 美式发音, type=2 英式发音
    voice_type = 2 if accent == "uk" else 1
    url = f"https://dict.youdao.com/dictvoice?audio={requests.utils.quote(text)}&type={voice_type}"

    try:
        response = requests.get(url, timeout=10)
        if response.ok:
            return response.content
        raise Exception(f"有道 TTS 请求失败: {response.status_code}")
    except requests.exceptions.RequestException as e:
        raise Exception(f"有道 TTS 网络错误: {str(e)}")


def get_youdao_sentence_tts(text: str) -> bytes:
    """使用有道翻译 TTS 获取句子语音（fanyivoice API）"""
    url = f"https://tts.youdao.com/fanyivoice?word={requests.utils.quote(text)}&le=en&keyfrom=speaker-target"

    try:
        response = requests.get(url, timeout=15)
        if response.ok:
            return response.content
        raise Exception(f"有道句子 TTS 请求失败: {response.status_code}")
    except requests.exceptions.RequestException as e:
        raise Exception(f"有道句子 TTS 网络错误: {str(e)}")


@tts_bp.route("/api/tts", methods=["GET"])
def tts():
    """
    生成单词/句子发音（使用有道 TTS）
    GET /api/tts?word=hello&slow=0&accent=us
    GET /api/tts?word=This is a sentence&sentence=1
    返回: MP3 音频文件
    """
    word = request.args.get("word", "")
    slow = request.args.get("slow", "0") == "1"
    accent = request.args.get("accent", "us")  # us 或 uk
    is_sentence = request.args.get("sentence", "0") == "1"

    if not word:
        return jsonify({"error": "缺少 word 参数"}), 400

    try:
        # 句子使用 fanyivoice API，单词使用 dictvoice API
        if is_sentence or len(word.split()) > 3:
            audio_data = get_youdao_sentence_tts(word)
        else:
            audio_data = get_youdao_tts(word, slow, accent)
        return send_file(
            io.BytesIO(audio_data),
            mimetype="audio/mpeg"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
