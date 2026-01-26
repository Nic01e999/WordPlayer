"""
安全模块
提供密码哈希、token生成、验证码生成等安全功能
"""

import secrets
import random
import bcrypt
from datetime import datetime, timedelta


def hash_password(password: str, rounds: int = 12) -> str:
    """
    哈希密码

    Args:
        password: 明文密码
        rounds: bcrypt rounds (默认12)

    Returns:
        str: 哈希后的密码
    """
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds)).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """
    验证密码

    Args:
        password: 明文密码
        password_hash: 哈希后的密码

    Returns:
        bool: 密码是否匹配
    """
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    except Exception:
        return False


def generate_token(length: int = 32) -> str:
    """
    生成安全的随机 token

    Args:
        length: token 长度（字节数）

    Returns:
        str: URL-safe 的 token 字符串
    """
    return secrets.token_urlsafe(length)


def generate_code(length: int = 6) -> str:
    """
    生成数字验证码

    Args:
        length: 验证码长度（默认6位）

    Returns:
        str: 数字验证码
    """
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


def generate_session_token() -> str:
    """生成会话 token（32字节）"""
    return generate_token(32)


def generate_reset_code() -> str:
    """生成密码重置验证码（6位数字）"""
    return generate_code(6)


def calculate_expiry(days: int = 0, hours: int = 0, minutes: int = 0) -> datetime:
    """
    计算过期时间

    Args:
        days: 天数
        hours: 小时数
        minutes: 分钟数

    Returns:
        datetime: 过期时间
    """
    return datetime.now() + timedelta(days=days, hours=hours, minutes=minutes)
