"""
用户设置 API
"""

from flask import Blueprint, request, jsonify, g
from middleware import require_auth
from constants import DEFAULT_SETTINGS, ALLOWED_SETTING_KEYS
from validators import validate_setting
from repositories import SettingsRepository

settings_bp = Blueprint('settings', __name__)


def get_user_settings(user_id):
    """获取用户设置，如果不存在则创建默认设置"""
    try:
        settings = SettingsRepository.get_by_user(user_id)

        if settings:
            return settings
        else:
            # 创建默认设置
            print(f"[Settings] 为用户 {user_id} 创建默认设置")
            SettingsRepository.create_default(user_id, DEFAULT_SETTINGS)
            return DEFAULT_SETTINGS.copy()
    except Exception as e:
        print(f"[Settings] 获取用户设置失败: {e}")
        import traceback
        traceback.print_exc()
        # 返回默认设置，不中断流程
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

    # 确保记录存在
    if not SettingsRepository.exists(user_id):
        get_user_settings(user_id)

    # 更新数据库
    SettingsRepository.update(user_id, updates)

    # 返回更新后的设置
    settings = get_user_settings(user_id)
    return jsonify({'success': True, 'settings': settings})


@settings_bp.route('/api/settings/reset', methods=['POST'])
@require_auth
def reset_settings():
    """重置为默认设置"""
    user_id = g.user['id']

    SettingsRepository.delete(user_id)

    # 创建默认设置
    settings = get_user_settings(user_id)
    return jsonify({'success': True, 'settings': settings})
