"""
数据同步 API 模块
提供单词表和布局配置的云同步功能
"""

import json
from datetime import datetime

from flask import Blueprint, request, jsonify, g

from db import get_db
from middleware import require_auth

sync_bp = Blueprint('sync', __name__)


@sync_bp.route("/api/sync/pull", methods=["GET"])
@require_auth
def pull_data():
    """
    拉取云端数据
    请求头: Authorization: Bearer <token>
    响应: { wordlists: {...}, layout: {...}, cardColors: {...} }
    """
    user_id = g.user['id']

    with get_db() as conn:
        cursor = conn.cursor()

        # 获取所有单词表
        cursor.execute("""
            SELECT name, words, translations, word_info, created_at, updated_at
            FROM wordlists
            WHERE user_id = ?
        """, (user_id,))

        wordlists = {}
        for row in cursor.fetchall():
            wordlists[row['name']] = {
                'name': row['name'],
                'words': row['words'],
                'translations': json.loads(row['translations']) if row['translations'] else {},
                'wordInfo': json.loads(row['word_info']) if row['word_info'] else {},
                'created': row['created_at'],
                'updated': row['updated_at']
            }

        # 获取布局配置
        cursor.execute("""
            SELECT layout, card_colors, updated_at
            FROM user_layout
            WHERE user_id = ?
        """, (user_id,))

        layout_row = cursor.fetchone()
        layout = json.loads(layout_row['layout']) if layout_row else None
        card_colors = json.loads(layout_row['card_colors']) if layout_row and layout_row['card_colors'] else {}

        return jsonify({
            'wordlists': wordlists,
            'layout': layout,
            'cardColors': card_colors
        })


@sync_bp.route("/api/sync/push", methods=["POST"])
@require_auth
def push_data():
    """
    推送本地数据到云端
    请求头: Authorization: Bearer <token>
    请求体: { wordlists: {...}, layout: {...}, cardColors: {...} }
    响应: { success: true }
    """
    user_id = g.user['id']
    data = request.get_json() or {}

    wordlists = data.get('wordlists', {})
    layout = data.get('layout')
    card_colors = data.get('cardColors', {})

    with get_db() as conn:
        cursor = conn.cursor()

        # 同步单词表
        for name, wl in wordlists.items():
            translations_json = json.dumps(wl.get('translations', {}), ensure_ascii=False)
            word_info_json = json.dumps(wl.get('wordInfo', {}), ensure_ascii=False)
            created = wl.get('created', datetime.now().isoformat())
            updated = wl.get('updated', datetime.now().isoformat())

            # 使用 UPSERT（INSERT OR REPLACE）
            cursor.execute("""
                INSERT INTO wordlists (user_id, name, words, translations, word_info, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, name) DO UPDATE SET
                    words = excluded.words,
                    translations = excluded.translations,
                    word_info = excluded.word_info,
                    updated_at = excluded.updated_at
            """, (user_id, name, wl.get('words', ''), translations_json, word_info_json, created, updated))

        # 同步布局配置
        if layout is not None:
            layout_json = json.dumps(layout, ensure_ascii=False)
            card_colors_json = json.dumps(card_colors, ensure_ascii=False)

            cursor.execute("""
                INSERT INTO user_layout (user_id, layout, card_colors, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    layout = excluded.layout,
                    card_colors = excluded.card_colors,
                    updated_at = excluded.updated_at
            """, (user_id, layout_json, card_colors_json, datetime.now().isoformat()))

        return jsonify({'success': True})


@sync_bp.route("/api/sync/wordlist/<name>", methods=["DELETE"])
@require_auth
def delete_wordlist(name):
    """
    删除云端单词表
    请求头: Authorization: Bearer <token>
    响应: { success: true }
    """
    user_id = g.user['id']

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM wordlists WHERE user_id = ? AND name = ?", (user_id, name))

    return jsonify({'success': True})


@sync_bp.route("/api/sync/wordlist", methods=["POST"])
@require_auth
def save_single_wordlist():
    """
    保存单个单词表
    请求头: Authorization: Bearer <token>
    请求体: { name: "...", words: "...", translations: {...}, wordInfo: {...} }
    响应: { success: true }
    """
    user_id = g.user['id']
    data = request.get_json() or {}

    name = data.get('name')
    if not name:
        return jsonify({'error': '单词表名称不能为空'}), 400

    words = data.get('words', '')
    translations = data.get('translations', {})
    word_info = data.get('wordInfo', {})
    created = data.get('created', datetime.now().isoformat())
    updated = data.get('updated', datetime.now().isoformat())

    translations_json = json.dumps(translations, ensure_ascii=False)
    word_info_json = json.dumps(word_info, ensure_ascii=False)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO wordlists (user_id, name, words, translations, word_info, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, name) DO UPDATE SET
                words = excluded.words,
                translations = excluded.translations,
                word_info = excluded.word_info,
                updated_at = excluded.updated_at
        """, (user_id, name, words, translations_json, word_info_json, created, updated))

    return jsonify({'success': True})
