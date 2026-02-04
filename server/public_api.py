"""
公开文件夹分享 API
提供文件夹公开、搜索、添加等功能
"""

from flask import Blueprint, request, jsonify, g
from db import get_db
from auth import require_auth
from repositories import LayoutRepository
import json
import traceback
from datetime import datetime

public_api_bp = Blueprint('public_api', __name__, url_prefix='/api/public')


def extract_folders_from_layout(layout):
    """
    从前端 layout 格式中提取 folders 列表

    前端格式 (v3):
    {
        "version": 3,
        "items": [
            { "type": "card", "name": "card1" },
            { "type": "folder", "name": "folder1", "items": ["card2", "card3"] }
        ]
    }

    返回格式:
    [
        { "name": "folder1", "cards": ["card2", "card3"] }
    ]
    """
    if not layout:
        return []

    # 优先检查 v3 格式（version: 3 且有 items）
    if layout.get('version') == 3 and 'items' in layout:
        items = layout.get('items', [])
        folders = []
        for item in items:
            if item.get('type') == 'folder':
                folder = {
                    'name': item['name'],
                    'cards': item.get('items', [])  # 前端用 items，转为 cards
                }
                # 保留其他字段（如 isPublic, publicFolderId, ownerEmail 等）
                for key in ['isPublic', 'publicFolderId', 'ownerEmail']:
                    if key in item:
                        folder[key] = item[key]
                folders.append(folder)
        return folders

    # 向后兼容：旧格式（只有 folders 字段）
    if 'folders' in layout:
        return layout['folders']

    return []


def ensure_layout_v3(layout):
    """
    确保 layout 是 v3 格式

    输入可能是：
    1. None 或空 → 返回空的 v3 格式
    2. 旧格式 { folders: [...] } → 转换为 v3
    3. v3 格式 { version: 3, items: [...] } → 原样返回
    """
    if not layout:
        print("[Layout] 创建空的 v3 格式 layout")
        return {'version': 3, 'items': []}

    # 已经是 v3 格式
    if layout.get('version') == 3 and 'items' in layout:
        return layout

    # 旧格式：{ folders: [...] }
    if 'folders' in layout:
        print(f"[Layout] 检测到旧格式 layout，正在迁移到 v3...")
        items = []

        # 将旧格式的 folders 转换为 v3 的 items
        for folder in layout['folders']:
            folder_item = {
                'type': 'folder',
                'name': folder['name'],
                'items': folder.get('cards', [])  # 旧格式用 cards，v3 用 items
            }

            # 保留公开文件夹的特殊字段
            for key in ['isPublic', 'publicFolderId', 'ownerEmail']:
                if key in folder:
                    folder_item[key] = folder[key]

            items.append(folder_item)

        # 如果旧格式还有 cards（直接在顶层），也转换过来
        if 'cards' in layout:
            for card_name in layout['cards']:
                items.append({
                    'type': 'card',
                    'name': card_name
                })

        print(f"[Layout] 迁移完成，items 数量: {len(items)}")
        return {'version': 3, 'items': items}

    # 其他未知格式，返回空的 v3
    print("[Layout] 未知格式，返回空的 v3 layout")
    return {'version': 3, 'items': []}


def add_folder_to_layout_v3(layout, folder_data):
    """
    添加文件夹到 v3 格式的 layout

    folder_data 格式：
    {
        'name': '文件夹名',
        'items': ['card1', 'card2'],  # v3 格式用 items
        'isPublic': True,             # 可选
        'publicFolderId': 123,        # 可选
        'ownerEmail': 'user@example.com'  # 可选
    }
    """
    # 确保 layout 是 v3 格式
    layout = ensure_layout_v3(layout)

    # 创建文件夹项
    folder_item = {
        'type': 'folder',
        'name': folder_data['name'],
        'items': folder_data.get('items', [])
    }

    # 保留公开文件夹的特殊字段
    for key in ['isPublic', 'publicFolderId', 'ownerEmail']:
        if key in folder_data:
            folder_item[key] = folder_data[key]

    # 添加到 items 数组
    layout['items'].append(folder_item)

    return layout


@public_api_bp.route('/folder/set', methods=['POST'])
@require_auth
def set_folder_public():
    """设置文件夹公开状态"""
    user_id = g.user['id']
    try:
        data = request.get_json()
        folder_name = data.get('folderName')
        is_public = data.get('isPublic', True)
        description = data.get('description', '')

        if not folder_name:
            return jsonify({'error': '文件夹名称不能为空'}), 400

        with get_db() as conn:
            cursor = conn.cursor()

            # 验证文件夹是否存在于用户的 layout 中
            cursor.execute("""
                SELECT layout FROM user_layout WHERE user_id = ?
            """, (user_id,))
            row = cursor.fetchone()

            if not row:
                return jsonify({'error': '未找到用户布局'}), 404

            layout = json.loads(row['layout'])

            # 调试日志：显示当前 layout
            print(f"[公开文件夹] 调试 - 用户 {user_id} 的 layout: {json.dumps(layout, ensure_ascii=False)}")
            print(f"[公开文件夹] 调试 - 查找文件夹名称: '{folder_name}'")

            folders = extract_folders_from_layout(layout)
            print(f"[公开文件夹] 调试 - 提取到的文件夹列表: {[f['name'] for f in folders]}")

            folder_exists = any(f['name'] == folder_name for f in folders)

            if not folder_exists:
                print(f"[公开文件夹] 错误: 文件夹 '{folder_name}' 不存在于用户 {user_id} 的布局中")
                print(f"[公开文件夹] 当前可用的文件夹: {[f['name'] for f in folders]}")
                return jsonify({'error': f'文件夹"{folder_name}"不存在，请刷新页面后重试'}), 404

            if is_public:
                # 计算文件夹内的总单词数
                word_count = 0
                folder = next((f for f in extract_folders_from_layout(layout) if f['name'] == folder_name), None)
                if folder:
                    for card_name in folder.get('cards', []):
                        cursor.execute("""
                            SELECT words FROM wordlists
                            WHERE user_id = ? AND name = ?
                        """, (user_id, card_name))
                        card_row = cursor.fetchone()
                        if card_row and card_row['words']:
                            # 计算单词数（按行分割，过滤空行）
                            words = [w.strip() for w in card_row['words'].split('\n') if w.strip()]
                            word_count += len(words)

                # 插入或更新 public_folders 表
                cursor.execute("""
                    INSERT INTO public_folders (user_id, folder_name, description, word_count, updated_at)
                    VALUES (?, ?, ?, ?, datetime('now'))
                    ON CONFLICT(user_id, folder_name)
                    DO UPDATE SET description = ?, word_count = ?, updated_at = datetime('now')
                """, (user_id, folder_name, description, word_count, description, word_count))

                cursor.execute("""
                    SELECT id FROM public_folders
                    WHERE user_id = ? AND folder_name = ?
                """, (user_id, folder_name))
                row = cursor.fetchone()
                if not row:
                    print(f"[公开文件夹] 错误: 创建公开文件夹后无法查询到记录 - user_id={user_id}, folder_name={folder_name}")
                    return jsonify({'error': '创建公开文件夹失败'}), 500
                public_folder_id = row['id']

                # 更新用户 layout，标记文件夹为公开（发布者不添加 ownerEmail）
                layout, card_colors = LayoutRepository.get_by_user(user_id)
                if not layout:
                    layout = {'version': 3, 'folders': [], 'cards': []}

                # 递归查找并标记文件夹
                def mark_folder_as_public(items, target_folder_name, pub_folder_id):
                    """递归查找并标记文件夹为公开"""
                    if not items:
                        return False
                    for item in items:
                        if item.get('type') == 'folder' and item.get('name') == target_folder_name:
                            item['isPublic'] = True
                            item['publicFolderId'] = pub_folder_id
                            # 注意：发布者不添加 ownerEmail 字段，这样前端可以区分发布者和添加者
                            print(f"[公开文件夹] 标记文件夹为公开: {target_folder_name} (ID: {pub_folder_id})")
                            return True
                        # 递归处理嵌套文件夹
                        if item.get('type') == 'folder' and 'children' in item:
                            if mark_folder_as_public(item['children'], target_folder_name, pub_folder_id):
                                return True
                    return False

                # 在 v3 layout 中标记文件夹
                marked = False
                if layout.get('version') == 3:
                    marked = (
                        mark_folder_as_public(layout.get('folders', []), folder_name, public_folder_id) or
                        mark_folder_as_public(layout.get('cards', []), folder_name, public_folder_id)
                    )

                if marked:
                    # 保存更新后的 layout
                    LayoutRepository.save(user_id, layout, card_colors)
                    print(f"[公开文件夹] 已更新用户 {user_id} 的 layout，标记文件夹 '{folder_name}' 为公开")
                else:
                    print(f"[公开文件夹] 警告: 在 layout 中未找到文件夹 '{folder_name}'")

                print(f"[公开文件夹] 用户 {user_id} 设置文件夹 '{folder_name}' 为公开 (ID: {public_folder_id}, 单词数: {word_count})")
                return jsonify({
                    'success': True,
                    'publicFolderId': public_folder_id,
                    'wordCount': word_count,
                    'layout': layout  # 返回更新后的 layout
                })
            else:
                # 取消公开
                cursor.execute("""
                    DELETE FROM public_folders
                    WHERE user_id = ? AND folder_name = ?
                """, (user_id, folder_name))

                print(f"[公开文件夹] 用户 {user_id} 取消文件夹 '{folder_name}' 的公开")
                return jsonify({'success': True})

    except Exception as e:
        print(f"[公开文件夹] 设置公开状态失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/search', methods=['GET'])
@require_auth
def search_public_folders():
    """搜索公开文件夹"""
    user_id = g.user['id']
    try:
        query = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', 20))

        if not query:
            return jsonify({'results': []})

        with get_db() as conn:
            cursor = conn.cursor()

            # 搜索文件夹名称和作者邮箱
            search_pattern = f"%{query}%"
            exact_pattern = query
            prefix_pattern = f"{query}%"

            cursor.execute("""
                SELECT
                    pf.id,
                    pf.folder_name,
                    pf.description,
                    pf.word_count,
                    pf.created_at,
                    pf.updated_at,
                    u.email as owner_email,
                    CASE
                        WHEN pf.folder_name = ? THEN 1
                        WHEN pf.folder_name LIKE ? THEN 2
                        WHEN u.email = ? THEN 3
                        WHEN u.email LIKE ? THEN 4
                        ELSE 5
                    END as relevance
                FROM public_folders pf
                JOIN users u ON pf.user_id = u.id
                WHERE pf.folder_name LIKE ? OR u.email LIKE ?
                ORDER BY relevance, pf.word_count DESC
                LIMIT ?
            """, (exact_pattern, prefix_pattern, exact_pattern, prefix_pattern,
                  search_pattern, search_pattern, limit))

            results = []
            for row in cursor.fetchall():
                results.append({
                    'id': row['id'],
                    'folderName': row['folder_name'],
                    'ownerEmail': row['owner_email'],
                    'wordCount': row['word_count'],
                    'description': row['description'] or '',
                    'createdAt': row['created_at'],
                    'updatedAt': row['updated_at']
                })

            print(f"[公开文件夹] 搜索 '{query}' 返回 {len(results)} 个结果")
            return jsonify({'results': results})

    except Exception as e:
        print(f"[公开文件夹] 搜索失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/<int:folder_id>', methods=['GET'])
@require_auth
def get_public_folder(folder_id):
    """获取公开文件夹详情"""
    user_id = g.user['id']
    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # 查询公开文件夹信息
            cursor.execute("""
                SELECT pf.*, u.email as owner_email
                FROM public_folders pf
                JOIN users u ON pf.user_id = u.id
                WHERE pf.id = ?
            """, (folder_id,))

            row = cursor.fetchone()
            if not row:
                return jsonify({'error': '公开文件夹不存在'}), 404

            owner_id = row['user_id']
            folder_name = row['folder_name']

            # 获取发布者的 layout
            cursor.execute("""
                SELECT layout FROM user_layout WHERE user_id = ?
            """, (owner_id,))
            layout_row = cursor.fetchone()

            if not layout_row:
                return jsonify({'error': '发布者布局不存在'}), 404

            layout = json.loads(layout_row['layout'])
            folder = next((f for f in extract_folders_from_layout(layout) if f['name'] == folder_name), None)

            if not folder:
                return jsonify({'error': '文件夹不存在于发布者布局中'}), 404

            # 获取文件夹内的所有卡片
            cards = []
            for card_name in folder.get('cards', []):
                cursor.execute("""
                    SELECT name, words FROM wordlists
                    WHERE user_id = ? AND name = ?
                """, (owner_id, card_name))
                card_row = cursor.fetchone()
                if card_row:
                    words = card_row['words'] or ''
                    word_list = [w.strip() for w in words.split('\n') if w.strip()]
                    cards.append({
                        'name': card_name,
                        'words': words,
                        'wordCount': len(word_list)
                    })

            result = {
                'id': row['id'],
                'folderName': row['folder_name'],
                'ownerEmail': row['owner_email'],
                'wordCount': row['word_count'],
                'description': row['description'] or '',
                'cards': cards
            }

            print(f"[公开文件夹] 获取文件夹详情 ID: {folder_id}")
            return jsonify(result)

    except Exception as e:
        print(f"[公开文件夹] 获取详情失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/<int:folder_id>/content', methods=['GET'])
@require_auth
def get_public_folder_content(folder_id):
    """获取公开文件夹的实时内容（包括翻译和词语信息）"""
    user_id = g.user['id']
    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # 查询公开文件夹信息
            cursor.execute("""
                SELECT pf.*, u.email as owner_email
                FROM public_folders pf
                JOIN users u ON pf.user_id = u.id
                WHERE pf.id = ?
            """, (folder_id,))

            row = cursor.fetchone()
            if not row:
                return jsonify({'error': '公开文件夹不存在'}), 404

            owner_id = row['user_id']
            folder_name = row['folder_name']

            # 获取发布者的 layout
            cursor.execute("""
                SELECT layout FROM user_layout WHERE user_id = ?
            """, (owner_id,))
            layout_row = cursor.fetchone()

            if not layout_row:
                return jsonify({'error': '发布者布局不存在'}), 404

            layout = json.loads(layout_row['layout'])
            folder = next((f for f in extract_folders_from_layout(layout) if f['name'] == folder_name), None)

            if not folder:
                return jsonify({'error': '文件夹不存在于发布者布局中'}), 404

            # 获取文件夹内的所有卡片（包括完整数据）
            cards = []
            for card_name in folder.get('cards', []):
                cursor.execute("""
                    SELECT name, words, translations, word_info
                    FROM wordlists
                    WHERE user_id = ? AND name = ?
                """, (owner_id, card_name))
                card_row = cursor.fetchone()
                if card_row:
                    cards.append({
                        'name': card_name,
                        'words': card_row['words'] or '',
                        'translations': card_row['translations'] or '{}',
                        'wordInfo': card_row['word_info'] or '{}'
                    })

            result = {
                'cards': cards,
                'folderName': row['folder_name'],
                'ownerEmail': row['owner_email']
            }

            print(f"[公开文件夹] 获取文件夹实时内容 ID: {folder_id}")
            return jsonify(result)

    except Exception as e:
        print(f"[公开文件夹] 获取实时内容失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/add', methods=['POST'])
@require_auth
def add_public_folder():
    """添加公开文件夹到用户主页"""
    user_id = g.user['id']
    try:
        data = request.get_json()
        public_folder_id = data.get('publicFolderId')
        display_name = data.get('displayName')

        if not public_folder_id or not display_name:
            return jsonify({'error': '参数不完整'}), 400

        with get_db() as conn:
            cursor = conn.cursor()

            # 查询公开文件夹信息
            cursor.execute("""
                SELECT pf.*, u.email as owner_email
                FROM public_folders pf
                JOIN users u ON pf.user_id = u.id
                WHERE pf.id = ?
            """, (public_folder_id,))

            row = cursor.fetchone()
            if not row:
                return jsonify({'error': '公开文件夹不存在'}), 404

            owner_id = row['user_id']
            folder_name = row['folder_name']
            owner_email = row['owner_email']

            # 获取发布者的 layout 以获取卡片列表
            cursor.execute("""
                SELECT layout FROM user_layout WHERE user_id = ?
            """, (owner_id,))
            layout_row = cursor.fetchone()

            if not layout_row:
                return jsonify({'error': '发布者布局不存在'}), 404

            layout = json.loads(layout_row['layout'])
            folder = next((f for f in extract_folders_from_layout(layout) if f['name'] == folder_name), None)

            if not folder:
                return jsonify({'error': '文件夹不存在于发布者布局中'}), 404

            # 获取用户的 layout
            cursor.execute("""
                SELECT layout FROM user_layout WHERE user_id = ?
            """, (user_id,))
            user_layout_row = cursor.fetchone()

            # 确保使用 v3 格式
            if user_layout_row:
                user_layout = ensure_layout_v3(json.loads(user_layout_row['layout']))
            else:
                user_layout = ensure_layout_v3(None)

            # 检查是否已存在同名文件夹（在 v3 格式中检查）
            existing_folder = any(
                item.get('type') == 'folder' and item.get('name') == display_name
                for item in user_layout['items']
            )
            if existing_folder:
                return jsonify({'error': '已存在同名文件夹，请使用不同的显示名称'}), 400

            # 插入 user_public_folders 表
            cursor.execute("""
                INSERT INTO user_public_folders (user_id, public_folder_id, display_name)
                VALUES (?, ?, ?)
            """, (user_id, public_folder_id, display_name))

            # 更新用户的 layout（使用 v3 格式）
            new_folder_data = {
                'name': display_name,
                'items': folder.get('cards', []),  # 注意：这里从旧格式的 cards 转换为 v3 的 items
                'isPublic': True,
                'publicFolderId': public_folder_id,
                'ownerEmail': owner_email
            }
            user_layout = add_folder_to_layout_v3(user_layout, new_folder_data)

            # 保存到数据库
            cursor.execute("""
                INSERT INTO user_layout (user_id, layout, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(user_id)
                DO UPDATE SET layout = ?, updated_at = datetime('now')
            """, (user_id, json.dumps(user_layout), json.dumps(user_layout)))

            # 获取更新后的完整 layout 和 card_colors
            layout, card_colors = LayoutRepository.get_by_user(user_id)

            print(f"[公开文件夹] 用户 {user_id} 添加公开文件夹 '{display_name}' (ID: {public_folder_id})")
            return jsonify({
                'success': True,
                'folder': {
                    'type': 'folder',
                    'name': display_name,
                    'items': folder.get('cards', []),
                    'isPublic': True,
                    'publicFolderId': public_folder_id,
                    'ownerEmail': owner_email
                },
                'layout': layout,  # 返回完整 layout
                'cardColors': card_colors  # 返回颜色配置
            })

    except Exception as e:
        print(f"[公开文件夹] 添加失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/copy', methods=['POST'])
@require_auth
def copy_public_folder():
    """创建公开文件夹的副本"""
    user_id = g.user['id']
    try:
        data = request.get_json()
        public_folder_id = data.get('publicFolderId')
        new_folder_name = data.get('newFolderName')

        if not public_folder_id or not new_folder_name:
            return jsonify({'error': '参数不完整'}), 400

        with get_db() as conn:
            cursor = conn.cursor()

            # 查询公开文件夹信息
            cursor.execute("""
                SELECT pf.*, u.email as owner_email
                FROM public_folders pf
                JOIN users u ON pf.user_id = u.id
                WHERE pf.id = ?
            """, (public_folder_id,))

            row = cursor.fetchone()
            if not row:
                return jsonify({'error': '公开文件夹不存在'}), 404

            owner_id = row['user_id']
            folder_name = row['folder_name']

            # 获取发布者的 layout
            cursor.execute("""
                SELECT layout FROM user_layout WHERE user_id = ?
            """, (owner_id,))
            layout_row = cursor.fetchone()

            if not layout_row:
                return jsonify({'error': '发布者布局不存在'}), 404

            layout = json.loads(layout_row['layout'])
            folder = next((f for f in extract_folders_from_layout(layout) if f['name'] == folder_name), None)

            if not folder:
                return jsonify({'error': '文件夹不存在于发布者布局中'}), 404

            # 获取用户的 layout
            cursor.execute("""
                SELECT layout FROM user_layout WHERE user_id = ?
            """, (user_id,))
            user_layout_row = cursor.fetchone()

            # 确保使用 v3 格式
            if user_layout_row:
                user_layout = ensure_layout_v3(json.loads(user_layout_row['layout']))
            else:
                user_layout = ensure_layout_v3(None)

            # 检查新文件夹名称是否冲突
            existing_folder = any(
                item.get('type') == 'folder' and item.get('name') == new_folder_name
                for item in user_layout['items']
            )
            if existing_folder:
                return jsonify({'error': '已存在同名文件夹'}), 400

            # 复制所有卡片
            new_card_names = []
            for card_name in folder.get('cards', []):
                # 获取原始卡片数据
                cursor.execute("""
                    SELECT words, translations, word_info
                    FROM wordlists
                    WHERE user_id = ? AND name = ?
                """, (owner_id, card_name))
                card_row = cursor.fetchone()

                if card_row:
                    # 生成新的卡片名称（避免冲突）
                    new_card_name = f"{card_name}_copy"
                    counter = 1
                    while True:
                        cursor.execute("""
                            SELECT COUNT(*) as count FROM wordlists
                            WHERE user_id = ? AND name = ?
                        """, (user_id, new_card_name))
                        row = cursor.fetchone()
                        if row and row['count'] == 0:
                            break
                        new_card_name = f"{card_name}_copy_{counter}"
                        counter += 1

                    # 插入新卡片
                    cursor.execute("""
                        INSERT INTO wordlists (user_id, name, words, translations, word_info)
                        VALUES (?, ?, ?, ?, ?)
                    """, (user_id, new_card_name, card_row['words'],
                          card_row['translations'], card_row['word_info']))

                    new_card_names.append(new_card_name)

            # 创建新文件夹（使用 v3 格式）
            new_folder_data = {
                'name': new_folder_name,
                'items': new_card_names  # v3 格式用 items
            }
            user_layout = add_folder_to_layout_v3(user_layout, new_folder_data)

            # 保存到数据库
            cursor.execute("""
                INSERT INTO user_layout (user_id, layout, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(user_id)
                DO UPDATE SET layout = ?, updated_at = datetime('now')
            """, (user_id, json.dumps(user_layout), json.dumps(user_layout)))

            print(f"[公开文件夹] 用户 {user_id} 创建文件夹副本 '{new_folder_name}' (来源 ID: {public_folder_id})")
            return jsonify({
                'success': True,
                'folder': {
                    'type': 'folder',
                    'name': new_folder_name,
                    'items': new_card_names
                }
            })

    except Exception as e:
        print(f"[公开文件夹] 创建副本失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/remove', methods=['DELETE'])
@require_auth
def remove_public_folder():
    """从用户主页移除公开文件夹"""
    user_id = g.user['id']
    try:
        data = request.get_json()
        folder_name = data.get('folderName')

        if not folder_name:
            return jsonify({'error': '文件夹名称不能为空'}), 400

        with get_db() as conn:
            cursor = conn.cursor()

            # 获取用户的 layout
            cursor.execute("""
                SELECT layout FROM user_layout WHERE user_id = ?
            """, (user_id,))
            row = cursor.fetchone()

            if not row:
                return jsonify({'error': '未找到用户布局'}), 404

            # 确保使用 v3 格式
            user_layout = ensure_layout_v3(json.loads(row['layout']))

            # 查找并移除文件夹（在 v3 格式中）
            folder = None
            for item in user_layout['items']:
                if item.get('type') == 'folder' and item.get('name') == folder_name:
                    folder = item
                    break

            if not folder:
                return jsonify({'error': '文件夹不存在'}), 404

            if not folder.get('isPublic'):
                return jsonify({'error': '这不是公开文件夹'}), 400

            # 从 layout 中移除（v3 格式）
            user_layout['items'] = [
                item for item in user_layout['items']
                if not (item.get('type') == 'folder' and item.get('name') == folder_name)
            ]

            # 更新 layout
            cursor.execute("""
                UPDATE user_layout
                SET layout = ?, updated_at = datetime('now')
                WHERE user_id = ?
            """, (json.dumps(user_layout), user_id))

            # 从 user_public_folders 表中删除
            cursor.execute("""
                DELETE FROM user_public_folders
                WHERE user_id = ? AND display_name = ?
            """, (user_id, folder_name))

            print(f"[公开文件夹] 用户 {user_id} 移除公开文件夹 '{folder_name}'")
            return jsonify({'success': True})

    except Exception as e:
        print(f"[公开文件夹] 移除失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/check', methods=['POST'])
@require_auth
def check_folder_public_status():
    """检查文件夹是否已公开"""
    user_id = g.user['id']
    """检查文件夹是否已公开"""
    try:
        data = request.get_json()
        folder_name = data.get('folderName')

        if not folder_name:
            return jsonify({'error': '文件夹名称不能为空'}), 400

        with get_db() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id, word_count FROM public_folders
                WHERE user_id = ? AND folder_name = ?
            """, (user_id, folder_name))

            row = cursor.fetchone()
            if row:
                return jsonify({
                    'isPublic': True,
                    'publicFolderId': row['id'],
                    'wordCount': row['word_count']
                })
            else:
                return jsonify({'isPublic': False})

    except Exception as e:
        print(f"[公开文件夹] 检查状态失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/rename', methods=['POST'])
@require_auth
def rename_public_folder():
    """
    重命名添加的公开文件夹（只修改 display_name）
    请求体: { publicFolderId: int, newDisplayName: string }
    响应: { success: true, layout: {...} }
    """
    user_id = g.user['id']
    data = request.get_json() or {}

    public_folder_id = data.get('publicFolderId')
    new_display_name = data.get('newDisplayName', '').strip()

    if not public_folder_id or not new_display_name:
        return jsonify({'error': '参数不完整'}), 400

    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # 1. 检查用户是否添加了该公开文件夹
            cursor.execute("""
                SELECT id, display_name FROM user_public_folders
                WHERE user_id = ? AND public_folder_id = ?
            """, (user_id, public_folder_id))

            record = cursor.fetchone()
            if not record:
                return jsonify({'error': '未找到该公开文件夹'}), 404

            old_display_name = record['display_name']

            # 2. 检查新名称是否与其他文件夹冲突
            cursor.execute("""
                SELECT id FROM user_public_folders
                WHERE user_id = ? AND display_name = ? AND id != ?
            """, (user_id, new_display_name, record['id']))

            if cursor.fetchone():
                return jsonify({'error': '文件夹名称已存在'}), 400

            # 3. 更新 user_public_folders 表
            cursor.execute("""
                UPDATE user_public_folders
                SET display_name = ?
                WHERE id = ?
            """, (new_display_name, record['id']))

            # 4. 更新用户 layout
            layout, card_colors = LayoutRepository.get_by_user(user_id)
            if not layout:
                return jsonify({'error': 'Layout 不存在'}), 500

            # 递归查找并重命名文件夹
            def rename_folder_in_layout(items, old_name, new_name, pub_folder_id):
                """递归查找并重命名文件夹"""
                if not items:
                    return False
                for item in items:
                    if (item.get('type') == 'folder' and
                        item.get('name') == old_name and
                        item.get('publicFolderId') == pub_folder_id):
                        item['name'] = new_name
                        return True
                    if item.get('type') == 'folder' and 'children' in item:
                        if rename_folder_in_layout(item['children'], old_name, new_name, pub_folder_id):
                            return True
                return False

            renamed = False
            if layout.get('version') == 3:
                renamed = (
                    rename_folder_in_layout(layout.get('folders', []), old_display_name, new_display_name, public_folder_id) or
                    rename_folder_in_layout(layout.get('cards', []), old_display_name, new_display_name, public_folder_id)
                )

            if not renamed:
                return jsonify({'error': '在 layout 中未找到该文件夹'}), 500

            # 5. 保存更新后的 layout
            LayoutRepository.save(user_id, layout, card_colors)

            print(f"[公开文件夹] 用户 {user_id} 重命名公开文件夹: {old_display_name} -> {new_display_name}")

            return jsonify({
                'success': True,
                'layout': layout
            })

    except Exception as e:
        print(f"[公开文件夹] 重命名失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': '重命名失败'}), 500
