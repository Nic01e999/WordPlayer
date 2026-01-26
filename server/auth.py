"""
认证 API 模块
提供注册、登录、登出、忘记密码等功能
"""

import re
import secrets
import random
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, g
import bcrypt

from config import Config
from db import get_db
from middleware import require_auth
from email_service import send_reset_code

auth_bp = Blueprint('auth', __name__)

# 邮箱格式验证
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


def _validate_email(email: str) -> bool:
    """验证邮箱格式"""
    return bool(EMAIL_REGEX.match(email))


def _generate_token() -> str:
    """生成安全的随机 token"""
    return secrets.token_urlsafe(32)


def _generate_code() -> str:
    """生成6位数字验证码"""
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])


def _hash_password(password: str) -> str:
    """哈希密码"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(Config.BCRYPT_ROUNDS)).decode('utf-8')


def _verify_password(password: str, password_hash: str) -> bool:
    """验证密码"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def _create_session(conn, user_id: int) -> str:
    """创建会话，返回 token"""
    token = _generate_token()
    expires_at = datetime.now() + timedelta(days=Config.TOKEN_EXPIRE_DAYS)

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (?, ?, ?)
    """, (user_id, token, expires_at.isoformat()))

    return token


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    """
    注册新用户
    请求: { "email": "...", "password": "..." }
    响应: { "success": true, "token": "...", "user": {...} }
    """
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    # 验证邮箱格式
    if not _validate_email(email):
        return jsonify({'error': '邮箱格式不正确'}), 400

    # 验证密码长度
    if len(password) < Config.PASSWORD_MIN_LENGTH:
        return jsonify({'error': f'密码至少需要 {Config.PASSWORD_MIN_LENGTH} 位'}), 400

    with get_db() as conn:
        cursor = conn.cursor()

        # 检查邮箱是否已注册
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            return jsonify({'error': '该邮箱已注册'}), 400

        # 创建用户
        password_hash = _hash_password(password)
        cursor.execute("""
            INSERT INTO users (email, password_hash)
            VALUES (?, ?)
        """, (email, password_hash))
        user_id = cursor.lastrowid

        # 创建会话
        token = _create_session(conn, user_id)

        return jsonify({
            'success': True,
            'token': token,
            'user': {
                'id': user_id,
                'email': email
            }
        })


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    """
    用户登录
    请求: { "email": "...", "password": "..." }
    响应: { "success": true, "token": "...", "user": {...} }
    """
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': '请输入邮箱和密码'}), 400

    with get_db() as conn:
        cursor = conn.cursor()

        # 查找用户
        cursor.execute("SELECT id, email, password_hash FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        if not user:
            return jsonify({'error': '邮箱或密码错误'}), 401

        # 验证密码
        if not _verify_password(password, user['password_hash']):
            return jsonify({'error': '邮箱或密码错误'}), 401

        # 更新最后登录时间
        cursor.execute(
            "UPDATE users SET last_login_at = ? WHERE id = ?",
            (datetime.now().isoformat(), user['id'])
        )

        # 创建会话
        token = _create_session(conn, user['id'])

        return jsonify({
            'success': True,
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email']
            }
        })


@auth_bp.route("/api/auth/logout", methods=["POST"])
@require_auth
def logout():
    """
    登出
    请求头: Authorization: Bearer <token>
    响应: { "success": true }
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE token = ?", (g.token,))

    return jsonify({'success': True})


@auth_bp.route("/api/auth/me", methods=["GET"])
@require_auth
def get_current_user():
    """
    获取当前登录用户信息
    请求头: Authorization: Bearer <token>
    响应: { "user": {...} }
    """
    return jsonify({
        'user': g.user
    })


@auth_bp.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    """
    发送密码重置验证码
    请求: { "email": "..." }
    响应: { "success": true }
    """
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()

    if not _validate_email(email):
        return jsonify({'error': '邮箱格式不正确'}), 400

    with get_db() as conn:
        cursor = conn.cursor()

        # 检查用户是否存在
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if not cursor.fetchone():
            # 为了安全，即使用户不存在也返回成功
            return jsonify({'success': True})

        # 检查是否在冷却时间内
        cooldown_time = datetime.now() - timedelta(seconds=Config.CODE_RESEND_SECONDS)
        cursor.execute("""
            SELECT id FROM reset_codes
            WHERE email = ? AND created_at > ? AND used = FALSE
        """, (email, cooldown_time.isoformat()))

        if cursor.fetchone():
            return jsonify({'error': f'请 {Config.CODE_RESEND_SECONDS} 秒后再试'}), 429

        # 生成验证码
        code = _generate_code()
        expires_at = datetime.now() + timedelta(minutes=Config.CODE_EXPIRE_MINUTES)

        cursor.execute("""
            INSERT INTO reset_codes (email, code, expires_at)
            VALUES (?, ?, ?)
        """, (email, code, expires_at.isoformat()))

        # 发送邮件
        if not send_reset_code(email, code):
            return jsonify({'error': '发送验证码失败，请稍后重试'}), 500

        return jsonify({'success': True})


@auth_bp.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    """
    使用验证码重置密码
    请求: { "email": "...", "code": "...", "password": "..." }
    响应: { "success": true, "token": "...", "user": {...} }
    """
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip()
    password = data.get('password', '')

    if not _validate_email(email):
        return jsonify({'error': '邮箱格式不正确'}), 400

    if not code or len(code) != 6:
        return jsonify({'error': '验证码格式不正确'}), 400

    if len(password) < Config.PASSWORD_MIN_LENGTH:
        return jsonify({'error': f'密码至少需要 {Config.PASSWORD_MIN_LENGTH} 位'}), 400

    with get_db() as conn:
        cursor = conn.cursor()

        # 查找有效的验证码
        cursor.execute("""
            SELECT id FROM reset_codes
            WHERE email = ? AND code = ? AND used = FALSE AND expires_at > ?
            ORDER BY created_at DESC
            LIMIT 1
        """, (email, code, datetime.now().isoformat()))

        reset_code = cursor.fetchone()
        if not reset_code:
            return jsonify({'error': '验证码无效或已过期'}), 400

        # 标记验证码为已使用
        cursor.execute("UPDATE reset_codes SET used = TRUE WHERE id = ?", (reset_code['id'],))

        # 更新密码
        password_hash = _hash_password(password)
        cursor.execute("UPDATE users SET password_hash = ? WHERE email = ?", (password_hash, email))

        # 获取用户信息
        cursor.execute("SELECT id, email FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        # 删除该用户的所有会话（强制重新登录）
        cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user['id'],))

        # 创建新会话
        token = _create_session(conn, user['id'])

        return jsonify({
            'success': True,
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email']
            }
        })
