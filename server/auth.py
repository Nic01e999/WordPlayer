"""
认证 API 模块
提供注册、登录、登出、忘记密码等功能
"""

from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, g

from config import Config
from middleware import require_auth
from email_service import send_reset_code
from utils import build_auth_response
from validators import validate_email, validate_password, validate_code
from security import hash_password, verify_password, generate_session_token, generate_reset_code, calculate_expiry
from repositories import UserRepository, SessionRepository, ResetCodeRepository

auth_bp = Blueprint('auth', __name__)


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
    if not validate_email(email):
        return jsonify({'error': '邮箱格式不正确'}), 400

    # 验证密码长度
    if not validate_password(password, Config.PASSWORD_MIN_LENGTH):
        return jsonify({'error': f'密码至少需要 {Config.PASSWORD_MIN_LENGTH} 位'}), 400

    # 检查邮箱是否已注册
    if UserRepository.exists_by_email(email):
        return jsonify({'error': '该邮箱已注册'}), 400

    # 创建用户
    password_hash = hash_password(password)
    user_id = UserRepository.create(email, password_hash)

    # 创建会话
    token = generate_session_token()
    expires_at = calculate_expiry(days=Config.TOKEN_EXPIRE_DAYS)
    SessionRepository.create(user_id, token, expires_at)

    return jsonify(build_auth_response({'id': user_id, 'email': email}, token))


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

    # 查找用户
    user = UserRepository.get_by_email(email)
    if not user:
        # 返回特殊错误码，前端引导用户注册
        return jsonify({'error': '该邮箱未注册，请先注册', 'code': 'USER_NOT_FOUND'}), 404

    # 验证密码
    if not verify_password(password, user['password_hash']):
        return jsonify({'error': '密码错误'}), 401

    # 更新最后登录时间
    UserRepository.update_last_login(user['id'])

    # 创建会话
    token = generate_session_token()
    expires_at = calculate_expiry(days=Config.TOKEN_EXPIRE_DAYS)
    SessionRepository.create(user['id'], token, expires_at)

    return jsonify(build_auth_response(user, token))


@auth_bp.route("/api/auth/logout", methods=["POST"])
@require_auth
def logout():
    """
    登出
    请求头: Authorization: Bearer <token>
    响应: { "success": true }
    """
    SessionRepository.delete_by_token(g.token)
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

    if not validate_email(email):
        return jsonify({'error': '邮箱格式不正确'}), 400

    # 注意：为了支持注册流程，无论用户是否存在都发送验证码
    # 这样新用户可以通过验证码注册，老用户可以重置密码

    # 检查是否在冷却时间内
    cooldown_time = datetime.now() - timedelta(seconds=Config.CODE_RESEND_SECONDS)
    if ResetCodeRepository.has_recent_code(email, cooldown_time):
        return jsonify({'error': f'请 {Config.CODE_RESEND_SECONDS} 秒后再试'}), 429

    # 生成验证码
    code = generate_reset_code()
    expires_at = calculate_expiry(minutes=Config.CODE_EXPIRE_MINUTES)
    ResetCodeRepository.create(email, code, expires_at)

    # 发送邮件
    if not send_reset_code(email, code):
        return jsonify({'error': '发送验证码失败，请稍后重试'}), 500

    return jsonify({'success': True})


@auth_bp.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    """
    使用验证码重置密码或创建新账户
    请求: { "email": "...", "code": "...", "password": "..." }
    响应: { "success": true, "token": "...", "user": {...} }
    """
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip()
    password = data.get('password', '')

    if not validate_email(email):
        return jsonify({'error': '邮箱格式不正确'}), 400

    if not validate_code(code, 6):
        return jsonify({'error': '验证码格式不正确'}), 400

    if not validate_password(password, Config.PASSWORD_MIN_LENGTH):
        return jsonify({'error': f'密码至少需要 {Config.PASSWORD_MIN_LENGTH} 位'}), 400

    # 查找有效的验证码
    reset_code = ResetCodeRepository.get_valid_code(email, code)
    if not reset_code:
        return jsonify({'error': '验证码无效或已过期'}), 400

    # 标记验证码为已使用
    ResetCodeRepository.mark_as_used(reset_code['id'])

    # 检查用户是否存在
    user = UserRepository.get_by_email(email)
    password_hash = hash_password(password)

    if not user:
        # 用户不存在，创建新用户（注册）
        user_id = UserRepository.create(email, password_hash)
        user = {'id': user_id, 'email': email}
    else:
        # 用户存在，更新密码（重置密码）
        UserRepository.update_password(email, password_hash)
        # 删除该用户的所有会话（强制重新登录）
        SessionRepository.delete_by_user_id(user['id'])

    # 创建新会话
    token = generate_session_token()
    expires_at = calculate_expiry(days=Config.TOKEN_EXPIRE_DAYS)
    SessionRepository.create(user['id'], token, expires_at)

    return jsonify(build_auth_response(user, token))
