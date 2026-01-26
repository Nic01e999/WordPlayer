"""
配置管理模块
从环境变量读取配置，支持默认值
"""

import os

class Config:
    # 数据库配置
    DATABASE_PATH = os.environ.get('DATABASE_PATH',
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'dictation.db'))

    # SMTP 配置（忘记密码功能需要）
    SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.qq.com')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 465))
    SMTP_USER = os.environ.get('SMTP_USER', '')
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
    SMTP_SENDER = os.environ.get('SMTP_SENDER', '') or os.environ.get('SMTP_USER', '')
    SMTP_USE_SSL = os.environ.get('SMTP_USE_SSL', 'true').lower() == 'true'

    # 安全配置
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

    # Token 配置
    TOKEN_EXPIRE_DAYS = int(os.environ.get('TOKEN_EXPIRE_DAYS', 30))

    # 验证码配置
    CODE_EXPIRE_MINUTES = int(os.environ.get('CODE_EXPIRE_MINUTES', 5))
    CODE_RESEND_SECONDS = int(os.environ.get('CODE_RESEND_SECONDS', 60))

    # 密码配置
    PASSWORD_MIN_LENGTH = 6
    BCRYPT_ROUNDS = 12
