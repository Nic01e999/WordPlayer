"""
数据同步 API 模块
提供单词表和布局配置的云同步功能
"""

from datetime import datetime

from flask import Blueprint, request, jsonify, g

from middleware import require_auth
from settings import get_user_settings
from repositories import WordlistRepository, LayoutRepository

sync_bp = Blueprint('sync', __name__)


@sync_bp.route("/api/sync/pull", methods=["GET"])
@require_auth
def pull_data():
    """
    拉取云端数据（只返回单词文本，不返回翻译数据）
    请求头: Authorization: Bearer <token>
    响应: { wordlists: {...}, layout: {...}, cardColors: {...} }
    """
    user_id = g.user['id']

    # 获取所有单词表
    wordlists = WordlistRepository.get_all_by_user(user_id)

    # 获取布局配置
    layout, card_colors = LayoutRepository.get_by_user(user_id)

    # 获取用户设置
    settings = get_user_settings(user_id)

    return jsonify({
        'wordlists': wordlists,
        'layout': layout,
        'cardColors': card_colors,
        'settings': settings
    })


@sync_bp.route("/api/sync/push", methods=["POST"])
@require_auth
def push_data():
    """
    推送本地数据到云端（只存储单词文本）
    请求头: Authorization: Bearer <token>
    请求体: { wordlists: {...}, layout: {...}, cardColors: {...} }
    响应: { success: true }
    """
    user_id = g.user['id']
    data = request.get_json() or {}

    wordlists = data.get('wordlists', {})
    layout = data.get('layout')
    card_colors = data.get('cardColors', {})

    # 同步单词表
    for name, wl in wordlists.items():
        created = wl.get('created', datetime.now().isoformat())
        WordlistRepository.save(user_id, name, wl.get('words', ''), created)

    # 同步布局配置
    if layout is not None:
        LayoutRepository.save(user_id, layout, card_colors)

    return jsonify({'success': True})


@sync_bp.route("/api/sync/wordlist/<name>", methods=["GET"])
@require_auth
def get_wordlist(name):
    """
    获取单个单词表
    请求头: Authorization: Bearer <token>
    响应: { name, words, created, updated } 或 { error: "..." }
    """
    user_id = g.user['id']

    wordlist = WordlistRepository.get_by_name(user_id, name)
    if not wordlist:
        return jsonify({'error': '单词表不存在'}), 404

    return jsonify(wordlist)


@sync_bp.route("/api/sync/wordlist/<name>", methods=["DELETE"])
@require_auth
def delete_wordlist(name):
    """
    删除云端单词表
    请求头: Authorization: Bearer <token>
    响应: { success: true }
    """
    user_id = g.user['id']
    WordlistRepository.delete(user_id, name)
    return jsonify({'success': True})


@sync_bp.route("/api/sync/wordlist", methods=["POST"])
@require_auth
def save_single_wordlist():
    """
    保存单个单词表（只存储单词文本，不存储翻译数据）
    请求头: Authorization: Bearer <token>
    请求体: { name: "...", words: "..." }
    响应: { success: true }
    """
    user_id = g.user['id']
    data = request.get_json() or {}

    name = data.get('name')
    if not name:
        return jsonify({'error': '单词表名称不能为空'}), 400

    words = data.get('words', '')
    created = data.get('created', datetime.now().isoformat())

    WordlistRepository.save(user_id, name, words, created)

    return jsonify({'success': True})
