"""
数据验证模块
提供邮箱、密码、单词、设置等验证功能
"""

import re
from constants import (
    LANG_PATTERNS,
    MAX_WORD_LENGTH,
    SUPPORTED_LANGS,
    SUPPORTED_THEMES,
    SUPPORTED_ACCENTS
)

# 邮箱格式验证正则
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


def validate_email(email: str) -> bool:
    """验证邮箱格式"""
    if not email or not isinstance(email, str):
        return False
    return bool(EMAIL_REGEX.match(email))


def validate_password(password: str, min_length: int = 6) -> bool:
    """验证密码长度"""
    if not password or not isinstance(password, str):
        return False
    return len(password) >= min_length


def validate_code(code: str, expected_length: int = 6) -> bool:
    """验证验证码格式"""
    if not code or not isinstance(code, str):
        return False
    return len(code) == expected_length and code.isdigit()


def validate_word(word: str, lang: str = 'en') -> bool:
    """
    验证单词/短语是否有效

    Args:
        word: 要验证的单词
        lang: 语言代码 (en, ja, ko, fr, zh)

    Returns:
        bool: 是否有效
    """
    if not word or not isinstance(word, str):
        return False

    if len(word) > MAX_WORD_LENGTH:
        return False

    pattern = LANG_PATTERNS.get(lang, LANG_PATTERNS['en'])
    if not re.match(pattern, word):
        return False

    return True


def validate_setting(key: str, value) -> bool:
    """
    验证设置值是否有效

    Args:
        key: 设置键名
        value: 设置值

    Returns:
        bool: 是否有效
    """
    if key in ('target_lang', 'translation_lang', 'ui_lang'):
        return value in SUPPORTED_LANGS
    elif key == 'theme':
        return value in SUPPORTED_THEMES
    elif key == 'accent':
        return value in SUPPORTED_ACCENTS
    elif key in ('repeat_count', 'retry_count'):
        return isinstance(value, int) and 1 <= value <= 10
    elif key == 'interval_ms':
        return isinstance(value, int) and 100 <= value <= 5000
    elif key in ('slow_mode', 'shuffle_mode', 'dictate_mode'):
        return isinstance(value, bool)

    return False


def validate_language(lang: str) -> bool:
    """验证语言代码是否支持"""
    return lang in SUPPORTED_LANGS


def validate_language_pair(from_lang: str, to_lang: str) -> tuple[bool, str]:
    """
    验证语言对是否有效

    Returns:
        (is_valid, error_message)
    """
    if from_lang not in SUPPORTED_LANGS:
        return False, f"不支持的源语言: {from_lang}"

    if to_lang not in SUPPORTED_LANGS:
        return False, f"不支持的目标语言: {to_lang}"

    if from_lang == to_lang:
        return False, "源语言和目标语言不能相同"

    return True, ""
