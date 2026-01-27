"""
应用常量配置
整合所有语言、主题、API配置等常量
"""

# ============================================================================
# 语言配置
# ============================================================================

# 支持的语言
SUPPORTED_LANGS = {'en', 'ja', 'ko', 'fr', 'zh'}

# 语言名称映射（用于 prompt）
LANG_NAMES = {
    'en': 'English',
    'ja': 'Japanese',
    'ko': 'Korean',
    'fr': 'French',
    'zh': 'Chinese'
}

# 各语言的字符验证正则
LANG_PATTERNS = {
    'en': r"^[a-zA-Z\s\-']+$",                                    # 英语
    'ja': r"^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\s]+$",  # 日语
    'ko': r"^[\uAC00-\uD7AF\u1100-\u11FF\s]+$",                   # 韩语
    'fr': r"^[a-zA-Z\u00C0-\u00FF\s\-']+$",                       # 法语
    'zh': r"^[\u4e00-\u9fff\s]+$"                                  # 中文
}

# 各语言的发音格式描述
LANG_PHONETIC_FORMAT = {
    'en': 'IPA phonetic transcription (e.g. /ˈæp.əl/ for "apple")',
    'zh': 'Pinyin with tone marks (e.g. "píng guǒ" for "苹果")',
    'ja': 'Hiragana reading (e.g. "りんご" for "林檎")',
    'ko': 'Romanization (e.g. "sagwa" for "사과")',
    'fr': 'IPA phonetic transcription (e.g. /pɔm/ for "pomme")'
}

# ============================================================================
# 有道 API 配置
# ============================================================================

# 有道词典字段映射 (source_lang, target_lang) -> dict_field
DICT_FIELDS = {
    # X -> 中文
    ('en', 'zh'): 'ec',   # 英中
    ('ja', 'zh'): 'jc',   # 日中
    ('ko', 'zh'): 'kc',   # 韩中
    ('fr', 'zh'): 'fc',   # 法中
    # 中文 -> X
    ('zh', 'en'): 'ce',   # 中英
    ('zh', 'ja'): 'cj',   # 中日
    ('zh', 'ko'): 'ck',   # 中韩
    ('zh', 'fr'): 'cf',   # 中法
    # 英语 -> 其他
    ('en', 'ja'): 'ej',   # 英日
    ('en', 'ko'): 'ek',   # 英韩
    ('en', 'fr'): 'ef',   # 英法
    # 其他 -> 英语
    ('ja', 'en'): 'je',   # 日英
    ('ko', 'en'): 'ke',   # 韩英
    ('fr', 'en'): 'fe',   # 法英
}

# 有道API语言代码映射（用于翻译API）
YOUDAO_LANG_CODES = {
    'en': 'eng',
    'ja': 'jap',
    'ko': 'ko',
    'fr': 'fr',
    'zh': 'zh-CHS'
}

# 有道 dictvoice API 的语言代码映射（用于TTS）
DICTVOICE_LANG_CODES = {
    'en': None,   # 英语不需要 le 参数，使用 type 参数区分口音
    'ja': 'jap',
    'ko': 'ko',
    'fr': 'fr',
    'zh': 'zh'
}

# ============================================================================
# 用户设置配置
# ============================================================================

# 支持的主题
SUPPORTED_THEMES = {'system', 'light', 'dark'}

# 支持的口音
SUPPORTED_ACCENTS = {'us', 'uk'}

# 默认设置值
DEFAULT_SETTINGS = {
    'target_lang': 'en',
    'translation_lang': 'zh',
    'ui_lang': 'zh',
    'theme': 'system',
    'accent': 'us',
    'repeat_count': 1,
    'retry_count': 1,
    'interval_ms': 300,
    'slow_mode': False,
    'shuffle_mode': False,
    'dictate_mode': False
}

# 允许的设置键
ALLOWED_SETTING_KEYS = set(DEFAULT_SETTINGS.keys())

# ============================================================================
# API 配置
# ============================================================================

# 单词验证限制
MAX_WORD_LENGTH = 100

# 批量请求限制
MAX_BATCH_SIZE = 5

# API 超时配置（秒）
API_TIMEOUT_DEFAULT = 10
API_TIMEOUT_DEEPSEEK = 30
API_TIMEOUT_TRANSLATION = 50
API_TIMEOUT_TTS = 15
