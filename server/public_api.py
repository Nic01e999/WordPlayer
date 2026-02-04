"""
公开文件夹分享 API
提供文件夹公开、搜索、添加等功能
"""

from flask import Blueprint, request, jsonify, g
from db import get_db
from middleware import require_auth
from repositories import FolderRepository, PublicFolderRepository, WordlistRepository, LayoutRepository, UserRepository
import json
import traceback
from datetime import datetime

public_api_bp = Blueprint('public_api', __name__, url_prefix='/api/public')


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

        # 获取文件夹
        folder = FolderRepository.get_by_name(user_id, folder_name)
        if not folder:
            return jsonify({'error': f'文件夹"{folder_name}"不存在'}), 404

        # 更新文件夹的公开状态
        folder_id = FolderRepository.save(
            user_id=user_id,
            name=folder_name,
            cards=folder['cards'],
            is_public=is_public,
            description=description if is_public else None,
            created=folder['created']
        )

        # 获取更新后的 layout
        layout = LayoutRepository.get_by_user(user_id) or []

        if is_public:
            # 计算单词数
            word_count = 0
            for card_id in folder['cards']:
                card = WordlistRepository.get_by_id(user_id, card_id)
                if card and card['words']:
                    words = [w.strip() for w in card['words'].split('\n') if w.strip()]
                    word_count += len(words)

            print(f"[公开文件夹] 用户 {user_id} 设置文件夹 '{folder_name}' 为公开 (ID: {folder_id}, 单词数: {word_count})")
            return jsonify({
                'success': True,
                'folderId': folder_id,
                'wordCount': word_count,
                'layout': layout
            })
        else:
            print(f"[公开文件夹] 用户 {user_id} 取消文件夹 '{folder_name}' 的公开")
            return jsonify({
                'success': True,
                'layout': layout
            })

    except Exception as e:
        print(f"[公开文件夹] 设置公开状态失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/search', methods=['GET'])
def search_public_folders():
    """搜索公开文件夹（未登录用户也可访问）"""
    try:
        query = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', 50))

        if not query:
            return jsonify({'results': []})

        # 搜索公开文件夹
        results = FolderRepository.search_public(query, limit)

        # 计算单词数
        formatted_results = []
        for folder in results:
            word_count = 0
            for card_id in folder['cards']:
                card = WordlistRepository.get_by_id(folder['user_id'], card_id)
                if card and card['words']:
                    words = [w.strip() for w in card['words'].split('\n') if w.strip()]
                    word_count += len(words)

            formatted_results.append({
                'id': folder['id'],
                'folderName': folder['name'],
                'ownerEmail': folder['owner_email'],
                'wordCount': word_count,
                'description': folder['description'] or '',
                'createdAt': folder['created']
            })

        print(f"[公开文件夹] 搜索 '{query}' 返回 {len(formatted_results)} 个结果")
        return jsonify({'results': formatted_results})

    except Exception as e:
        print(f"[公开文件夹] 搜索失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/<int:folder_id>', methods=['GET'])
def get_public_folder(folder_id):
    """获取公开文件夹详情（未登录用户也可访问）"""
    try:
        # 获取文件夹
        folder = FolderRepository.get_by_id(folder_id)
        if not folder or not folder['is_public']:
            return jsonify({'error': '公开文件夹不存在'}), 404

        # 获取创建者邮箱
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT email FROM users WHERE id = ?", (folder['user_id'],))
            user_row = cursor.fetchone()
            owner_email = user_row['email'] if user_row else 'Unknown'

        # 获取文件夹内的所有卡片
        cards = []
        word_count = 0
        for card_id in folder['cards']:
            card = WordlistRepository.get_by_id(folder['user_id'], card_id)
            if card:
                words = card['words'] or ''
                word_list = [w.strip() for w in words.split('\n') if w.strip()]
                word_count += len(word_list)
                cards.append({
                    'id': card['id'],
                    'name': card['name'],
                    'words': words,
                    'wordCount': len(word_list)
                })

        result = {
            'id': folder['id'],
            'folderName': folder['name'],
            'ownerEmail': owner_email,
            'wordCount': word_count,
            'description': folder['description'] or '',
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
    """获取公开文件夹的实时内容"""
    user_id = g.user['id']
    try:
        # 获取文件夹
        folder = FolderRepository.get_by_id(folder_id)
        if not folder or not folder['is_public']:
            return jsonify({'error': '公开文件夹不存在'}), 404

        # 获取创建者邮箱
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT email FROM users WHERE id = ?", (folder['user_id'],))
            user_row = cursor.fetchone()
            owner_email = user_row['email'] if user_row else 'Unknown'

        # 获取文件夹内的所有卡片
        cards = []
        for card_id in folder['cards']:
            card = WordlistRepository.get_by_id(folder['user_id'], card_id)
            if card:
                cards.append({
                    'id': card['id'],
                    'name': card['name'],
                    'words': card['words'] or ''
                })

        result = {
            'cards': cards,
            'folderName': folder['name'],
            'ownerEmail': owner_email
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
        folder_id = data.get('folderId')
        display_name = data.get('displayName')

        if not folder_id or not display_name:
            return jsonify({'error': '参数不完整'}), 400

        # 获取公开文件夹
        folder = FolderRepository.get_by_id(folder_id)
        if not folder or not folder['is_public']:
            return jsonify({'error': '公开文件夹不存在'}), 404

        # 获取创建者信息
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT email FROM users WHERE id = ?", (folder['user_id'],))
            user_row = cursor.fetchone()
            owner_email = user_row['email'] if user_row else 'Unknown'

        # 检查是否已存在同名
        existing = PublicFolderRepository.get_by_display_name(user_id, display_name)
        if existing:
            return jsonify({'error': '已存在同名文件夹，请使用不同的显示名称'}), 400

        # 添加到 public_folders 表
        ref_id = PublicFolderRepository.add(
            user_id=user_id,
            folder_id=folder_id,
            owner_id=folder['user_id'],
            owner_name=owner_email,
            display_name=display_name
        )

        # 更新用户的 layout
        layout = LayoutRepository.get_by_user(user_id) or []
        layout.append(f"public_{ref_id}")
        LayoutRepository.save(user_id, layout)

        print(f"[公开文件夹] 用户 {user_id} 添加公开文件夹 '{display_name}' (folder_id: {folder_id}, ref_id: {ref_id})")
        return jsonify({
            'success': True,
            'refId': ref_id,
            'layout': layout
        })

    except Exception as e:
        print(f"[公开文件夹] 添加失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/remove', methods=['DELETE'])
@require_auth
def remove_public_folder():
    """从用户主页移除公开文件夹"""
    user_id = g.user['id']
    try:
        data = request.get_json()
        display_name = data.get('displayName')

        if not display_name:
            return jsonify({'error': '文件夹名称不能为空'}), 400

        # 获取引用
        ref = PublicFolderRepository.get_by_display_name(user_id, display_name)
        if not ref:
            return jsonify({'error': '公开文件夹引用不存在'}), 404

        # 删除引用
        PublicFolderRepository.delete(user_id, display_name)

        # 更新 layout
        layout = LayoutRepository.get_by_user(user_id) or []
        layout = [item for item in layout if item != f"public_{ref['id']}"]
        LayoutRepository.save(user_id, layout)

        print(f"[公开文件夹] 用户 {user_id} 移除公开文件夹 '{display_name}'")
        return jsonify({'success': True, 'layout': layout})

    except Exception as e:
        print(f"[公开文件夹] 移除失败: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@public_api_bp.route('/folder/check', methods=['POST'])
@require_auth
def check_folder_public_status():
    """检查文件夹是否已公开"""
    user_id = g.user['id']
    try:
        data = request.get_json()
        folder_name = data.get('folderName')

        if not folder_name:
            return jsonify({'error': '文件夹名称不能为空'}), 400

        folder = FolderRepository.get_by_name(user_id, folder_name)
        if folder and folder['is_public']:
            # 计算单词数
            word_count = 0
            for card_id in folder['cards']:
                card = WordlistRepository.get_by_id(user_id, card_id)
                if card and card['words']:
                    words = [w.strip() for w in card['words'].split('\n') if w.strip()]
                    word_count += len(words)

            return jsonify({
                'isPublic': True,
                'folderId': folder['id'],
                'wordCount': word_count
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
    请求体: { displayName: string, newDisplayName: string }
    响应: { success: true, layout: [...] }
    """
    user_id = g.user['id']
    data = request.get_json() or {}

    old_display_name = data.get('displayName', '').strip()
    new_display_name = data.get('newDisplayName', '').strip()

    if not old_display_name or not new_display_name:
        return jsonify({'error': '参数不完整'}), 400

    try:
        # 检查旧名称是否存在
        ref = PublicFolderRepository.get_by_display_name(user_id, old_display_name)
        if not ref:
            return jsonify({'error': '未找到该公开文件夹'}), 404

        # 检查新名称是否冲突
        existing = PublicFolderRepository.get_by_display_name(user_id, new_display_name)
        if existing:
            return jsonify({'error': '文件夹名称已存在'}), 400

        # 更新 display_name
        PublicFolderRepository.update_display_name(user_id, old_display_name, new_display_name)

        # 获取更新后的 layout
        layout = LayoutRepository.get_by_user(user_id) or []

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
