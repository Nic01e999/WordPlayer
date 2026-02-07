"""
数据同步 API 模块
提供单词卡和布局配置的云同步功能
"""

from datetime import datetime

from flask import Blueprint, request, jsonify, g

from middleware import require_auth
from settings import get_user_settings
from repositories import WordcardRepository, LayoutRepository, FolderRepository, PublicFolderRepository
from db import get_db

sync_bp = Blueprint('sync', __name__)


@sync_bp.route("/api/sync/pull", methods=["GET"])
@require_auth
def pull_data():
    """
    拉取云端数据（只返回单词文本，不返回翻译数据）
    请求头: Authorization: Bearer <token>
    响应: { wordcards: {...}, layout: {...}, cardColors: {id: color, ...} }
    """
    user_id = g.user['id']

    try:
        # 获取所有单词卡
        wordcards = WordcardRepository.get_all_by_user(user_id)

        # 获取布局配置
        layout = LayoutRepository.get_by_user(user_id)
        if layout is None:
            layout = []

        # 获取文件夹数据
        folders = FolderRepository.get_all_by_user(user_id)

        # 获取公开文件夹引用
        publicFolders = PublicFolderRepository.get_all_by_user(user_id)

        # 从 wordcards 中提取 cardColors（键是单词卡 ID）
        card_colors = {}
        for name, wl in wordcards.items():
            if 'color' in wl and wl['color'] and 'id' in wl:
                card_colors[wl['id']] = wl['color']  # 键是 ID

        # 获取用户设置
        settings = get_user_settings(user_id)

        print(f"[Sync] 用户 {user_id} 拉取数据成功")
        print(f"[Sync] wordcards: {len(wordcards)}, folders: {len(folders)}, publicFolders: {len(publicFolders)}, layout: {len(layout)}")

        return jsonify({
            'wordcards': wordcards,
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
    请求体: { wordcards: {...}, layout: {...}, cardColors: {id: color, ...} }
    响应: { success: true }
    """
    user_id = g.user['id']
    data = request.get_json() or {}

    wordcards = data.get('wordcards', {})
    layout = data.get('layout')
    card_colors = data.get('cardColors', {})
    folders = data.get('folders', {})

    print(f"[Sync] 用户 {user_id} 推送数据")
    print(f"[Sync] wordcards: {len(wordcards)}, folders: {len(folders)}")

    try:
        # 同步单词卡
        for name, wl in wordcards.items():
            created = wl.get('created', datetime.now().isoformat())
            color = wl.get('color')
            card_id = wl.get('id')  # 读取 ID
            WordcardRepository.save(user_id, name, wl.get('words', ''), color, created, card_id)

        # 【新增】同步 cardColors 到数据库（按 ID 更新）
        # 当用户只修改颜色时，前端会推送 cardColors: {id: colorId}
        if card_colors:
            print(f"[Sync] 同步 cardColors: {len(card_colors)} 个颜色")
            print(f"[服务器控制台] 同步 cardColors: {len(card_colors)} 个颜色")

            # 获取已通过 wordcards 更新的卡片 ID（避免重复更新）
            updated_card_ids = set()
            for name, wl in wordcards.items():
                if 'id' in wl:
                    updated_card_ids.add(wl['id'])

            for card_id_str, color_id in card_colors.items():
                card_id = int(card_id_str)  # 前端传来的可能是字符串

                # 如果已通过 wordcards 更新，跳过
                if card_id in updated_card_ids:
                    print(f"[Sync] 跳过已更新的卡片: ID={card_id}")
                    continue

                # 查询该卡片
                card = WordcardRepository.get_by_id(user_id, card_id)
                if card:
                    # 更新颜色（保留原有的 words、name、created）
                    WordcardRepository.save(
                        user_id=user_id,
                        name=card['name'],
                        words=card['words'],
                        color=color_id,
                        created=card.get('created'),
                        card_id=card_id
                    )
                    print(f"[Sync] 更新单词卡颜色: ID={card_id} -> {color_id}")
                    print(f"[服务器控制台] 更新单词卡颜色: ID={card_id} -> {color_id}")
                else:
                    print(f"[Sync] 警告: 单词卡 ID={card_id} 不存在，无法更新颜色")
                    print(f"[服务器控制台] 警告: 单词卡 ID={card_id} 不存在，无法更新颜色")

        # 同步文件夹
        folder_id_map = {}

        # 步骤1: 检测并处理重命名（通过 ID 匹配）
        db_folders = FolderRepository.get_all_by_user(user_id)
        client_folder_ids_to_data = {}  # {id: folder_data}
        for name, folder in folders.items():
            if 'id' in folder:
                client_folder_ids_to_data[folder['id']] = folder

        # 检测重命名：ID 相同但名称不同
        for db_name, db_folder in db_folders.items():
            db_id = db_folder['id']
            if db_id in client_folder_ids_to_data:
                client_folder = client_folder_ids_to_data[db_id]
                new_name = client_folder['name']
                if new_name != db_name:
                    # 重命名：直接 UPDATE 名称字段（保留 ID）
                    with get_db() as conn:
                        cursor = conn.cursor()
                        cursor.execute("""
                            UPDATE folders
                            SET name = ?, updated_at = ?
                            WHERE user_id = ? AND id = ?
                        """, (new_name, datetime.now().isoformat(), user_id, db_id))
                    print(f"[Sync] 检测到重命名: '{db_name}' -> '{new_name}' (ID={db_id})")
                    print(f"[服务器控制台] 检测到重命名: '{db_name}' -> '{new_name}' (ID={db_id})")

        # 步骤2: 保存所有文件夹（更新 cards、is_public 等其他字段）
        for name, folder in folders.items():
            cards = folder.get('cards', [])  # 已经是 ID 数组
            is_public = folder.get('is_public', False)
            description = folder.get('description', '')
            created = folder.get('created', datetime.now().isoformat())
            folder_id = FolderRepository.save(user_id, name, cards, is_public, description, created)
            folder_id_map[name] = folder_id
            print(f"[Sync] 保存文件夹: {name}, id: {folder_id}, cards: {cards}, is_public: {is_public}")

        # 步骤3: 清理真正孤立的文件夹（不在前端数据中，且 ID 不匹配）
        db_folders_after = FolderRepository.get_all_by_user(user_id)
        client_folder_ids = set(f.get('id') for f in folders.values() if f.get('id'))
        client_folder_names = set(folders.keys())

        for db_name, db_folder in db_folders_after.items():
            if db_name not in client_folder_names and db_folder['id'] not in client_folder_ids:
                FolderRepository.delete(user_id, db_name)
                print(f"[Sync] 已删除孤立文件夹: {db_name} (ID={db_folder['id']})")
                print(f"[服务器控制台] 已删除孤立文件夹: {db_name} (ID={db_folder['id']})")

        # 同步布局配置
        if layout is not None:
            # 前端应该通过 adapter 转换为数组格式 ['card_1', 'folder_2', ...]
            if isinstance(layout, list):
                # 正确的后端格式：['card_1', 'folder_2', ...]
                LayoutRepository.save(user_id, layout)
                print(f"[Sync] 保存布局: {len(layout)} 项")
            elif isinstance(layout, dict) and 'items' in layout:
                # 如果收到对象格式，说明前端 adapter 未正确调用
                print(f"[Sync] 错误: layout 是对象格式，前端应使用 adapter 转换")
                print(f"[Sync] 收到的 layout: {layout}")
                return jsonify({'error': 'Layout 格式错误，请更新客户端'}), 400
            else:
                print(f"[Sync] 错误: layout 格式未知: {type(layout)}")
                return jsonify({'error': 'Layout 格式错误'}), 400

        print(f"[Sync] 用户 {user_id} 推送数据成功")
        return jsonify({'success': True, 'folderIdMap': folder_id_map})
    except Exception as e:
        print(f"[Sync] 推送数据失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': '同步失败，请稍后重试'}), 500


@sync_bp.route("/api/sync/wordcard/by-id/<int:card_id>", methods=["DELETE"])
@require_auth
def delete_wordcard_by_id(card_id):
    """
    通过 ID 删除单词卡
    请求头: Authorization: Bearer <token>
    响应: { success: true } 或 { error: "..." }
    """
    user_id = g.user['id']

    # 验证卡片存在且属于当前用户
    card = WordcardRepository.get_by_id(user_id, card_id)
    if not card:
        print(f"[Sync] 删除失败: 单词卡不存在，ID={card_id}, 用户={user_id}")
        print(f"[服务器控制台] 删除失败: 单词卡不存在，ID={card_id}")
        return jsonify({'error': '单词卡不存在'}), 404

    # 删除
    WordcardRepository.delete_by_id(user_id, card_id)

    print(f"[Sync] 通过ID删除单词卡: ID={card_id}, 用户={user_id}")
    print(f"[服务器控制台] 通过ID删除单词卡: ID={card_id}")

    return jsonify({'success': True})


@sync_bp.route("/api/sync/wordcard", methods=["POST"])
@require_auth
def save_single_wordcard():
    """
    保存/更新单个单词卡
    支持通过 ID 定位（可重命名）或通过名称定位（向后兼容）
    请求头: Authorization: Bearer <token>
    请求体: { name: "...", words: "...", color: "...", id: <card_id> }
    响应: { success: true, id: <card_id> }
    """
    user_id = g.user['id']
    data = request.get_json() or {}

    name = data.get('name')
    if not name:
        return jsonify({'error': '单词卡名称不能为空'}), 400

    words = data.get('words', '')
    color = data.get('color')  # 读取颜色字段
    created = data.get('created', datetime.now().isoformat())
    card_id = data.get('id')  # 读取 ID（如果提供）

    # 保存并获取卡片 ID（传递 card_id 参数）
    result_id = WordcardRepository.save(user_id, name, words, color, created, card_id)

    print(f"[Sync] 保存单词卡: 名称={name}, ID={result_id}, 颜色={color}, 使用ID定位={bool(card_id)}")
    print(f"[服务器控制台] 保存单词卡: {name}, ID: {result_id}, 使用ID定位: {bool(card_id)}")

    # 返回卡片 ID
    return jsonify({'success': True, 'id': result_id})
