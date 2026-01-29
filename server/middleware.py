"""
认证中间件模块
提供 @require_auth 装饰器
"""

from functools import wraps
from datetime import datetime

from flask import request, jsonify, g

from db import get_db


def require_auth(f):
    """
    认证装饰器
    验证请求头中的 Authorization: Bearer <token>
    验证成功后将用户信息存入 g.user
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith('Bearer '):
            print(f"[Auth] 认证失败: 缺少 Authorization 头或格式错误")
            return jsonify({'error': '未登录'}), 401

        token = auth_header[7:]  # 去掉 'Bearer ' 前缀
        print(f"[Auth] 验证 token: {token[:10]}...")

        with get_db() as conn:
            cursor = conn.cursor()

            # 查询有效的会话
            cursor.execute("""
                SELECT s.user_id, s.expires_at, u.email
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ?
            """, (token,))
            session = cursor.fetchone()

            if not session:
                print(f"[Auth] 认证失败: token 在数据库中不存在")
                return jsonify({'error': '无效的登录状态'}), 401

            # 检查是否过期
            expires_at = datetime.fromisoformat(session['expires_at'])
            if datetime.now() > expires_at:
                print(f"[Auth] 认证失败: token 已过期 (过期时间: {expires_at})")
                # 删除过期的会话
                cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
                return jsonify({'error': '登录已过期，请重新登录'}), 401

            # 存储用户信息到 g 对象
            g.user = {
                'id': session['user_id'],
                'email': session['email']
            }
            g.token = token
            print(f"[Auth] 认证成功: 用户 {session['email']}")

        return f(*args, **kwargs)

    return decorated
