"""
用户设置 API
"""

from flask import Blueprint, request, jsonify, g
from db import get_db
from middleware import require_auth
from constants import DEFAULT_SETTINGS, ALLOWED_SETTING_KEYS
from validators import validate_setting

settings_bp = Blueprint('settings', __name__)


def get_user_settings(user_id):
    """获取用户设置，如果不存在则创建默认设置"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()

        if row:
            return {
                'target_lang': row['target_lang'],
                'translation_lang': row['translation_lang'],
                'ui_lang': row['ui_lang'],
                'theme': row['theme'],
                'accent': row['accent'],
                'repeat_count': row['repeat_count'],
                'retry_count': row['retry_count'],
                'interval_ms': row['interval_ms'],
                'slow_mode': bool(row['slow_mode']),
                'shuffle_mode': bool(row['shuffle_mode'])
            }
        else:
            # 创建默认设置
            cursor.execute("""
                INSERT INTO user_settings (user_id, target_lang, translation_lang, ui_lang, theme, accent,
                    repeat_count, retry_count, interval_ms, slow_mode, shuffle_mode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user_id,
                DEFAULT_SETTINGS['target_lang'],
                DEFAULT_SETTINGS['translation_lang'],
                DEFAULT_SETTINGS['ui_lang'],
                DEFAULT_SETTINGS['theme'],
                DEFAULT_SETTINGS['accent'],
                DEFAULT_SETTINGS['repeat_count'],
                DEFAULT_SETTINGS['retry_count'],
                DEFAULT_SETTINGS['interval_ms'],
                DEFAULT_SETTINGS['slow_mode'],
                DEFAULT_SETTINGS['shuffle_mode']
            ))
            conn.commit()
            return DEFAULT_SETTINGS.copy()


@settings_bp.route('/api/settings', methods=['GET'])
@require_auth
def get_settings():
    """获取用户设置"""
    user_id = g.user['id']
    settings = get_user_settings(user_id)
    return jsonify({'settings': settings})


@settings_bp.route('/api/settings', methods=['PUT'])
@require_auth
def update_settings():
    """
    更新用户设置
    支持两种格式：
    1. 单个设置：{ "key": "target_lang", "value": "ja" }
    2. 多个设置：{ "settings": { "target_lang": "ja", "translation_lang": "en" } }
    """
    user_id = g.user['id']
    data = request.get_json()

    if not data:
        return jsonify({'error': '缺少请求体'}), 400

    updates = {}

    # 格式1：单个设置
    if 'key' in data and 'value' in data:
        key = data['key']
        value = data['value']

        if key not in ALLOWED_SETTING_KEYS:
            return jsonify({'error': f'不支持的设置项: {key}'}), 400

        if not validate_setting(key, value):
            return jsonify({'error': f'无效的设置值: {key}={value}'}), 400

        updates[key] = value

    # 格式2：多个设置
    elif 'settings' in data:
        for key, value in data['settings'].items():
            if key not in ALLOWED_SETTING_KEYS:
                continue  # 忽略不支持的设置项

            if validate_setting(key, value):
                updates[key] = value

    if not updates:
        return jsonify({'error': '没有有效的设置更新'}), 400

    # 更新数据库
    with get_db() as conn:
        cursor = conn.cursor()

        # 确保记录存在
        cursor.execute("SELECT user_id FROM user_settings WHERE user_id = ?", (user_id,))
        if not cursor.fetchone():
            # 创建记录
            get_user_settings(user_id)

        # 构建 UPDATE 语句
        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        values = list(updates.values()) + [user_id]

        cursor.execute(f"""
            UPDATE user_settings
            SET {set_clause}, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        """, values)

        conn.commit()

    # 返回更新后的设置
    settings = get_user_settings(user_id)
    return jsonify({'success': True, 'settings': settings})


@settings_bp.route('/api/settings/reset', methods=['POST'])
@require_auth
def reset_settings():
    """重置为默认设置"""
    user_id = g.user['id']

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_settings WHERE user_id = ?", (user_id,))
        conn.commit()

    # 创建默认设置
    settings = get_user_settings(user_id)
    return jsonify({'success': True, 'settings': settings})
