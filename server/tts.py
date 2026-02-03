"""
有道 TTS 语音合成 API - 支持多语言
支持语言: en(英语), ja(日语), ko(韩语), zh(中文)
"""

import io
import os
import time
import hashlib
import requests
from pathlib import Path
from typing import Optional
from flask import Blueprint, request, jsonify, send_file
from constants import DICTVOICE_LANG_CODES, API_TIMEOUT_TTS

tts_bp = Blueprint('tts', __name__)

# 缓存目录和过期时间
CACHE_DIR = Path(__file__).parent.parent / 'cache' / 'audio'
CACHE_EXPIRY = 3600  # 1小时


def _get_cache_path(text: str, accent: str, lang: str) -> Path:
    """生成缓存文件路径"""
    # 使用 MD5 避免文件名过长或包含特殊字符
    cache_key = f"{text}:{accent}:{lang}"
    hash_key = hashlib.md5(cache_key.encode()).hexdigest()
    return CACHE_DIR / f"{hash_key}.mp3"


def _get_cached_audio(cache_path: Path) -> Optional[bytes]:
    """获取缓存的音频，如果过期则返回 None"""
    if not cache_path.exists():
        return None

    # 检查是否过期
    file_age = time.time() - cache_path.stat().st_mtime
    if file_age > CACHE_EXPIRY:
        cache_path.unlink()  # 删除过期文件
        return None

    return cache_path.read_bytes()


def _save_cached_audio(cache_path: Path, audio_data: bytes):
    """保存音频到缓存"""
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(audio_data)


def _make_tts_request(url: str, timeout: int = API_TIMEOUT_TTS, error_prefix: str = "有道 TTS") -> bytes:
    """
    统一的 TTS 请求处理函数

    Args:
        url: 请求 URL
        timeout: 超时时间（秒）
        error_prefix: 错误消息前缀

    Returns:
        音频数据（bytes）

    Raises:
        Exception: 请求失败时抛出异常
    """
    try:
        response = requests.get(url, timeout=timeout)
        if response.ok:
            return response.content
        raise Exception(f"{error_prefix}请求失败: {response.status_code}")
    except requests.exceptions.RequestException as e:
        raise Exception(f"{error_prefix}网络错误: {str(e)}")


def get_youdao_tts(text: str, accent: str = "us") -> bytes:
    """使用有道 TTS 获取英语语音（支持 US/UK 口音）"""
    # type=1 美式发音, type=2 英式发音
    voice_type = 2 if accent == "uk" else 1
    url = f"https://dict.youdao.com/dictvoice?audio={requests.utils.quote(text)}&type={voice_type}"
    return _make_tts_request(url, timeout=API_TIMEOUT_TTS, error_prefix="有道 TTS")


def get_youdao_multilang_tts(text: str, lang: str) -> bytes:
    """使用有道 dictvoice API 获取多语言语音"""
    le_code = DICTVOICE_LANG_CODES.get(lang)
    if le_code:
        url = f"https://dict.youdao.com/dictvoice?audio={requests.utils.quote(text)}&le={le_code}"
    else:
        # 默认英语
        url = f"https://dict.youdao.com/dictvoice?audio={requests.utils.quote(text)}&type=1"
    return _make_tts_request(url, timeout=API_TIMEOUT_TTS, error_prefix="有道多语言 TTS")


def get_youdao_sentence_tts(text: str, lang: str = "en") -> bytes:
    """使用有道 dictvoice API 获取句子语音"""
    le_code = DICTVOICE_LANG_CODES.get(lang)
    if le_code:
        url = f"https://dict.youdao.com/dictvoice?audio={requests.utils.quote(text)}&le={le_code}"
    else:
        # 英语句子
        url = f"https://dict.youdao.com/dictvoice?audio={requests.utils.quote(text)}&type=1"
    return _make_tts_request(url, timeout=API_TIMEOUT_TTS, error_prefix="有道句子 TTS")


@tts_bp.route("/api/tts", methods=["GET"])
def tts():
    """
    生成单词/句子发音（使用有道 TTS，支持多语言）
    GET /api/tts?word=hello&accent=us&lang=en
    GET /api/tts?word=幸せ&lang=ja
    GET /api/tts?word=This is a sentence&sentence=1&lang=en
    返回: MP3 音频文件
    """
    word = request.args.get("word", "")
    accent = request.args.get("accent", "us")  # us 或 uk (仅英语有效)
    lang = request.args.get("lang", "en")  # 语言: en, ja, ko, fr, zh
    is_sentence = request.args.get("sentence", "0") == "1"

    if not word:
        return jsonify({"error": "缺少 word 参数"}), 400

    # 验证语言
    if lang not in DICTVOICE_LANG_CODES:
        return jsonify({"error": f"不支持的语言: {lang}"}), 400

    # 验证 accent 和 lang 的兼容性
    if accent != 'us' and lang != 'en':
        # 非英语语言不支持非 US 口音，自动重置
        accent = 'us'

    # 检查缓存
    cache_path = _get_cache_path(word, accent, lang)
    cached_audio = _get_cached_audio(cache_path)
    if cached_audio:
        print(f"[TTS Cache] 命中缓存: {word} ({lang}, {accent})")
        return send_file(
            io.BytesIO(cached_audio),
            mimetype="audio/mpeg"
        )

    try:
        # 句子使用 fanyivoice API
        if is_sentence or len(word.split()) > 3:
            audio_data = get_youdao_sentence_tts(word, lang)
        # 英语单词使用 dictvoice API（支持 US/UK 口音）
        elif lang == 'en':
            audio_data = get_youdao_tts(word, accent)
        # 其他语言使用 fanyivoice API
        else:
            audio_data = get_youdao_multilang_tts(word, lang)

        # 保存到缓存
        _save_cached_audio(cache_path, audio_data)
        print(f"[TTS Cache] 保存缓存: {word} ({lang}, {accent})")

        return send_file(
            io.BytesIO(audio_data),
            mimetype="audio/mpeg"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
