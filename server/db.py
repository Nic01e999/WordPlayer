"""
数据库模块
SQLite 连接和表初始化
"""

import sqlite3
import os
from contextlib import contextmanager

from config import Config

# 确保数据目录存在
os.makedirs(os.path.dirname(Config.DATABASE_PATH), exist_ok=True)


def get_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # 返回字典形式的结果
    conn.execute("PRAGMA foreign_keys = ON")  # 启用外键约束
    return conn


@contextmanager
def get_db():
    """上下文管理器：自动管理连接"""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """初始化数据库表"""
    with get_db() as conn:
        cursor = conn.cursor()

        # 用户表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login_at TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

        # 密码重置验证码表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reset_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                code TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_reset_codes_email ON reset_codes(email)")

        # 会话表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)")

        # 单词卡（简化版：只存储单词文本和颜色）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS wordcards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                words TEXT NOT NULL,
                color TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, name)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_wordcards_user_id ON wordcards(user_id)")

        # 文件夹表（新增）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                cards TEXT NOT NULL,
                is_public BOOLEAN DEFAULT FALSE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, name)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_folders_public ON folders(is_public) WHERE is_public = TRUE")

        # 布局配置表（简化版：只存储布局数组）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS layout (
                user_id INTEGER PRIMARY KEY,
                layout TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # 用户设置表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id INTEGER PRIMARY KEY,
                target_lang TEXT DEFAULT 'en',
                translation_lang TEXT DEFAULT 'zh',
                ui_lang TEXT DEFAULT 'zh',
                theme TEXT DEFAULT 'system',
                accent TEXT DEFAULT 'us',
                repeat_count INTEGER DEFAULT 1,
                retry_count INTEGER DEFAULT 1,
                interval_ms INTEGER DEFAULT 300,
                slow_mode BOOLEAN DEFAULT FALSE,
                shuffle_mode BOOLEAN DEFAULT FALSE,
                dictate_mode BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # 公开文件夹引用表（用户添加的公开文件夹）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS public_folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                folder_id INTEGER NOT NULL,
                owner_id INTEGER NOT NULL,
                owner_name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
                UNIQUE(user_id, folder_id),
                UNIQUE(user_id, display_name)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_public_folders_user ON public_folders(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_public_folders_folder ON public_folders(folder_id)")

        conn.commit()
        print("数据库初始化完成")
