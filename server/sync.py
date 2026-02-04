"""
数据同步 API 模块
提供单词表和布局配置的云同步功能
"""

from datetime import datetime

from flask import Blueprint, request, jsonify, g

from middleware import require_auth
from settings import get_user_settings
from repositories import WordlistRepository, LayoutRepository, FolderRepository, PublicFolderRepository

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

    try:
        # 获取所有单词表
        wordlists = WordlistRepository.get_all_by_user(user_id)

        # 获取布局配置
        layout = LayoutRepository.get_by_user(user_id)
        if layout is None:
            layout = []

        # 获取文件夹数据
        folders = FolderRepository.get_all_by_user(user_id)

        # 获取公开文件夹引用
        publicFolders = PublicFolderRepository.get_all_by_user(user_id)

        # 从 wordlists 中提取 cardColors
        card_colors = {}
        for name, wl in wordlists.items():
            if 'color' in wl and wl['color']:
                card_colors[name] = wl['color']

        # 获取用户设置
        settings = get_user_settings(user_id)

        print(f"[Sync] 用户 {user_id} 拉取数据成功")
        print(f"[Sync] wordlists: {len(wordlists)}, folders: {len(folders)}, publicFolders: {len(publicFolders)}, layout: {len(layout)}")

        return jsonify({
            'wordlists': wordlists,
            'folders': folders,
            'publicFolders': publicFolders,
            'layout': layout,
            'cardColors': card_colors,
            'settings': settings
        })
    except Exception as e:
        print(f"[Sync] 拉取数据失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': '同步失败，请稍后重试'}), 500


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
    folders = data.get('folders', {})

    print(f"[Sync] 用户 {user_id} 推送数据")
    print(f"[Sync] wordlists: {len(wordlists)}, folders: {len(folders)}")

    try:
        # 同步单词表
        for name, wl in wordlists.items():
            created = wl.get('created', datetime.now().isoformat())
            color = wl.get('color')
            WordlistRepository.save(user_id, name, wl.get('words', ''), color, created)

        # 同步文件夹（前端格式直接使用），并收集 ID 映射
        folder_id_map = {}
        for name, folder in folders.items():
            cards = folder.get('cards', [])  # 已经是 ID 数组
            is_public = folder.get('is_public', False)
            description = folder.get('description', '')
            created = folder.get('created', datetime.now().isoformat())
            folder_id = FolderRepository.save(user_id, name, cards, is_public, description, created)
            folder_id_map[name] = folder_id
            print(f"[Sync] 保存文件夹: {name}, id: {folder_id}, cards: {cards}, is_public: {is_public}")

        # 同步布局配置
        if layout is not None:
            # 前端发送的是对象格式 { version: 3, items: [...] }
            # 但后端需要的是字符串数组格式 ['card_1', 'folder_2', ...]
            # 需要使用 adapter 转换，但前端暂时没有启用
            # 临时方案：如果是对象格式，提取 items 并转换
            if isinstance(layout, dict) and 'items' in layout:
                # 前端格式：{ version: 3, items: [{ type: 'card', name: 'xxx' }, ...] }
                # 需要转换为后端格式：['card_1', 'folder_2', ...]
                # 但这需要知道 name -> id 的映射，暂时跳过
                print(f"[Sync] 警告: layout 是对象格式，暂时不保存（等待前端启用 adapter）")
            elif isinstance(layout, list):
                # 后端格式：['card_1', 'folder_2', ...]
                LayoutRepository.save(user_id, layout)
                print(f"[Sync] 保存布局: {len(layout)} 项")

        print(f"[Sync] 用户 {user_id} 推送数据成功")
        return jsonify({'success': True, 'folderIdMap': folder_id_map})
    except Exception as e:
        print(f"[Sync] 推送数据失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': '同步失败，请稍后重试'}), 500


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
