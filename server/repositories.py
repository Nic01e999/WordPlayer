"""
数据访问层（Repository Pattern）
封装所有数据库操作，提供统一的数据访问接口
"""

import json
from datetime import datetime
from typing import Optional, Dict, List, Any, Tuple
from db import get_db


class UserRepository:
    """用户数据访问"""

    @staticmethod
    def get_by_email(email: str) -> Optional[Dict[str, Any]]:
        """根据邮箱获取用户"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, email, password_hash, created_at, last_login_at FROM users WHERE email = ?",
                (email,)
            )
            return cursor.fetchone()

    @staticmethod
    def get_by_id(user_id: int) -> Optional[Dict[str, Any]]:
        """根据ID获取用户"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, email, created_at, last_login_at FROM users WHERE id = ?",
                (user_id,)
            )
            return cursor.fetchone()

    @staticmethod
    def create(email: str, password_hash: str) -> int:
        """创建新用户，返回用户ID"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (email, password_hash)
            )
            return cursor.lastrowid

    @staticmethod
    def update_last_login(user_id: int) -> None:
        """更新最后登录时间"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET last_login_at = ? WHERE id = ?",
                (datetime.now().isoformat(), user_id)
            )

    @staticmethod
    def update_password(email: str, password_hash: str) -> None:
        """更新用户密码"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET password_hash = ? WHERE email = ?",
                (password_hash, email)
            )

    @staticmethod
    def exists_by_email(email: str) -> bool:
        """检查邮箱是否已注册"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            return cursor.fetchone() is not None


class SessionRepository:
    """会话数据访问"""

    @staticmethod
    def create(user_id: int, token: str, expires_at: datetime) -> None:
        """创建会话"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
                (user_id, token, expires_at.isoformat())
            )

    @staticmethod
    def delete_by_token(token: str) -> None:
        """删除会话"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))

    @staticmethod
    def delete_by_user_id(user_id: int) -> None:
        """删除用户的所有会话"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))


class ResetCodeRepository:
    """密码重置验证码数据访问"""

    @staticmethod
    def has_recent_code(email: str, cooldown_time: datetime) -> bool:
        """检查是否在冷却时间内"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id FROM reset_codes
                WHERE email = ? AND created_at > ? AND used = FALSE
            """, (email, cooldown_time.isoformat()))
            return cursor.fetchone() is not None

    @staticmethod
    def create(email: str, code: str, expires_at: datetime) -> None:
        """创建验证码"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO reset_codes (email, code, expires_at) VALUES (?, ?, ?)",
                (email, code, expires_at.isoformat())
            )

    @staticmethod
    def get_valid_code(email: str, code: str) -> Optional[Dict[str, Any]]:
        """获取有效的验证码"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id FROM reset_codes
                WHERE email = ? AND code = ? AND used = FALSE AND expires_at > ?
                ORDER BY created_at DESC
                LIMIT 1
            """, (email, code, datetime.now().isoformat()))
            return cursor.fetchone()

    @staticmethod
    def mark_as_used(code_id: int) -> None:
        """标记验证码为已使用"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE reset_codes SET used = TRUE WHERE id = ?", (code_id,))


class WordlistRepository:
    """单词表数据访问"""

    @staticmethod
    def get_all_by_user(user_id: int) -> Dict[str, Dict[str, Any]]:
        """获取用户的所有单词表"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT name, words, created_at, updated_at
                FROM wordlists
                WHERE user_id = ?
            """, (user_id,))

            wordlists = {}
            for row in cursor.fetchall():
                wordlists[row['name']] = {
                    'name': row['name'],
                    'words': row['words'],
                    'created': row['created_at'],
                    'updated': row['updated_at']
                }
            return wordlists

    @staticmethod
    def get_by_name(user_id: int, name: str) -> Optional[Dict[str, Any]]:
        """获取单个单词表"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT name, words, created_at, updated_at
                FROM wordlists
                WHERE user_id = ? AND name = ?
            """, (user_id, name))

            row = cursor.fetchone()
            if not row:
                return None

            return {
                'name': row['name'],
                'words': row['words'],
                'created': row['created_at'],
                'updated': row['updated_at']
            }

    @staticmethod
    def save(user_id: int, name: str, words: str, created: str = None) -> None:
        """保存单词表（插入或更新）"""
        if created is None:
            created = datetime.now().isoformat()
        updated = datetime.now().isoformat()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO wordlists (user_id, name, words, translations, word_info, created_at, updated_at)
                VALUES (?, ?, ?, '{}', '{}', ?, ?)
                ON CONFLICT(user_id, name) DO UPDATE SET
                    words = excluded.words,
                    updated_at = excluded.updated_at
            """, (user_id, name, words, created, updated))

    @staticmethod
    def delete(user_id: int, name: str) -> None:
        """删除单词表"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM wordlists WHERE user_id = ? AND name = ?",
                (user_id, name)
            )


class LayoutRepository:
    """布局配置数据访问"""

    @staticmethod
    def get_by_user(user_id: int) -> Tuple[Optional[Dict], Dict]:
        """获取用户的布局配置，返回 (layout, card_colors)"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT layout, card_colors, updated_at
                FROM user_layout
                WHERE user_id = ?
            """, (user_id,))

            row = cursor.fetchone()
            if not row:
                return None, {}

            layout = json.loads(row['layout']) if row['layout'] else None
            card_colors = json.loads(row['card_colors']) if row['card_colors'] else {}
            return layout, card_colors

    @staticmethod
    def save(user_id: int, layout: Dict, card_colors: Dict) -> None:
        """保存布局配置"""
        layout_json = json.dumps(layout, ensure_ascii=False)
        card_colors_json = json.dumps(card_colors, ensure_ascii=False)

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO user_layout (user_id, layout, card_colors, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    layout = excluded.layout,
                    card_colors = excluded.card_colors,
                    updated_at = excluded.updated_at
            """, (user_id, layout_json, card_colors_json, datetime.now().isoformat()))


class SettingsRepository:
    """用户设置数据访问"""

    @staticmethod
    def get_by_user(user_id: int) -> Optional[Dict[str, Any]]:
        """获取用户设置"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()

            if not row:
                return None

            return {
                'target_lang': row['target_lang'],
                'translation_lang': row['translation_lang'],
                'ui_lang': row['ui_lang'],
                'theme': row['theme'],
                'accent': row['accent'],
                'repeat_count': row['repeat_count'],
                'retry_count': row['retry_count'],
                'interval_ms': row['interval_ms'],
                'slow_mode': bool(row['slow_mode']),
                'shuffle_mode': bool(row['shuffle_mode']),
                'dictate_mode': bool(row['dictate_mode'])
            }

    @staticmethod
    def create_default(user_id: int, defaults: Dict[str, Any]) -> None:
        """创建默认设置"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO user_settings (user_id, target_lang, translation_lang, ui_lang, theme, accent,
                    repeat_count, retry_count, interval_ms, slow_mode, shuffle_mode, dictate_mode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user_id,
                defaults['target_lang'],
                defaults['translation_lang'],
                defaults['ui_lang'],
                defaults['theme'],
                defaults['accent'],
                defaults['repeat_count'],
                defaults['retry_count'],
                defaults['interval_ms'],
                defaults['slow_mode'],
                defaults['shuffle_mode'],
                defaults['dictate_mode']
            ))

    @staticmethod
    def update(user_id: int, updates: Dict[str, Any]) -> None:
        """更新用户设置"""
        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        values = list(updates.values()) + [user_id]

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                UPDATE user_settings
                SET {set_clause}, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            """, values)

    @staticmethod
    def delete(user_id: int) -> None:
        """删除用户设置"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_settings WHERE user_id = ?", (user_id,))

    @staticmethod
    def exists(user_id: int) -> bool:
        """检查用户设置是否存在"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT user_id FROM user_settings WHERE user_id = ?", (user_id,))
            return cursor.fetchone() is not None
