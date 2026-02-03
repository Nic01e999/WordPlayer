"""
公开文件夹分享 API
提供文件夹公开、搜索、添加等功能
"""

from flask import Blueprint, request, jsonify, g
from db import get_db
from auth import require_auth
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

    # 向后兼容：如果已经是旧格式（有 folders 字段），直接返回
    if 'folders' in layout:
        return layout['folders']

    # 新格式（v3）：从 items 中提取 folder 类型
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
            folder_exists = any(f['name'] == folder_name for f in extract_folders_from_layout(layout))

            if not folder_exists:
                return jsonify({'error': '文件夹不存在'}), 404

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

                print(f"[公开文件夹] 用户 {user_id} 设置文件夹 '{folder_name}' 为公开 (ID: {public_folder_id}, 单词数: {word_count})")
                return jsonify({
                    'success': True,
                    'publicFolderId': public_folder_id,
                    'wordCount': word_count
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

            if user_layout_row:
                user_layout = json.loads(user_layout_row['layout'])
            else:
                user_layout = {'folders': []}

            # 检查是否已存在同名文件夹（允许同名，但提示用户）
            existing_folder = any(f['name'] == display_name for f in extract_folders_from_layout(user_layout))
            if existing_folder:
                return jsonify({'error': '已存在同名文件夹，请使用不同的显示名称'}), 400

            # 插入 user_public_folders 表
            cursor.execute("""
                INSERT INTO user_public_folders (user_id, public_folder_id, display_name)
                VALUES (?, ?, ?)
            """, (user_id, public_folder_id, display_name))

            # 更新用户的 layout
            new_folder = {
                'name': display_name,
                'cards': folder.get('cards', []),
                'isPublic': True,
                'publicFolderId': public_folder_id,
                'ownerEmail': owner_email
            }
            user_layout.setdefault('folders', []).append(new_folder)

            cursor.execute("""
                INSERT INTO user_layout (user_id, layout, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(user_id)
                DO UPDATE SET layout = ?, updated_at = datetime('now')
            """, (user_id, json.dumps(user_layout), json.dumps(user_layout)))

            print(f"[公开文件夹] 用户 {user_id} 添加公开文件夹 '{display_name}' (ID: {public_folder_id})")
            return jsonify({
                'success': True,
                'folder': new_folder
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

            if user_layout_row:
                user_layout = json.loads(user_layout_row['layout'])
            else:
                user_layout = {'folders': []}

            # 检查新文件夹名称是否冲突
            existing_folder = any(f['name'] == new_folder_name for f in extract_folders_from_layout(user_layout))
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

            # 创建新文件夹
            new_folder = {
                'name': new_folder_name,
                'cards': new_card_names
            }
            user_layout.setdefault('folders', []).append(new_folder)

            cursor.execute("""
                INSERT INTO user_layout (user_id, layout, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(user_id)
                DO UPDATE SET layout = ?, updated_at = datetime('now')
            """, (user_id, json.dumps(user_layout), json.dumps(user_layout)))

            print(f"[公开文件夹] 用户 {user_id} 创建文件夹副本 '{new_folder_name}' (来源 ID: {public_folder_id})")
            return jsonify({
                'success': True,
                'folder': new_folder
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

            layout = json.loads(row['layout'])

            # 查找并移除文件夹
            folder = next((f for f in extract_folders_from_layout(layout) if f['name'] == folder_name), None)
            if not folder:
                return jsonify({'error': '文件夹不存在'}), 404

            if not folder.get('isPublic'):
                return jsonify({'error': '这不是公开文件夹'}), 400

            # 从 layout 中移除
            layout['folders'] = [f for f in layout['folders'] if f['name'] != folder_name]

            # 更新 layout
            cursor.execute("""
                UPDATE user_layout
                SET layout = ?, updated_at = datetime('now')
                WHERE user_id = ?
            """, (json.dumps(layout), user_id))

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
