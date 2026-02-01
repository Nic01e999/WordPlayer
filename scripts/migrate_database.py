#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库迁移脚本
功能：
1. 备份现有数据库
2. 重命名主数据库 dictation.db -> user_data.db
3. 迁移用户自定义词典表到 user_data.db
4. 优化例句表（删除冗余字段）
5. 繁简转换（将繁体例句转换为简体）
6. 重建 FTS5 全文搜索索引
"""

import os
import sys
import sqlite3
import shutil
from datetime import datetime
import opencc

# 添加项目根目录到 Python 路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# 数据库路径
DB_DIR = os.path.join(project_root, 'data', 'databases')
BACKUP_DIR = os.path.join(project_root, 'data', 'backups')

DICTATION_DB = os.path.join(DB_DIR, 'dictation.db')
USER_DATA_DB = os.path.join(DB_DIR, 'user_data.db')
USER_DICT_DB = os.path.join(DB_DIR, 'user_dict.db')
SENTENCE_PAIRS_DB = os.path.join(DB_DIR, 'sentence_pairs.db')

# 繁体字列表（用于检测）
TRADITIONAL_CHARS = [
    '們', '這', '點', '結', '時', '說', '東', '農', '個', '來',
    '會', '過', '還', '對', '開', '關', '學', '國', '為', '無',
    '與', '業', '產', '從', '經', '現', '發', '動', '進', '運',
    '電', '體', '應', '種', '條', '處', '見', '將', '題', '長',
    '門', '間', '聽', '頭', '實', '際', '認', '識', '議', '記',
    '變', '風', '飛', '務', '廣', '術', '極', '備', '區', '員',
    '師', '環', '際', '響', '確', '較', '義', '導', '復', '標',
    '層', '據', '導', '線', '練', '選', '細', '團', '適', '帶',
    '錄', '擇', '繼', '觀', '歡', '買', '約', '級', '統', '維',
    '總', '領', '較', '價', '嚴', '龍', '損', '齊', '難', '願'
]


def print_step(step_num, total_steps, message):
    """打印步骤信息"""
    print(f"\n[{step_num}/{total_steps}] {message}")


def print_success(message):
    """打印成功信息"""
    print(f"  ✓ {message}")


def print_info(message):
    """打印提示信息"""
    print(f"  ℹ {message}")


def print_error(message):
    """打印错误信息"""
    print(f"  ✗ {message}")


def backup_databases():
    """备份现有数据库"""
    print_step(1, 6, "备份现有数据库...")

    # 创建备份目录
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(BACKUP_DIR, f'migration_backup_{timestamp}')
    os.makedirs(backup_path, exist_ok=True)

    # 备份数据库文件
    databases = [
        ('dictation.db', DICTATION_DB),
        ('user_dict.db', USER_DICT_DB),
        ('sentence_pairs.db', SENTENCE_PAIRS_DB)
    ]

    for db_name, db_path in databases:
        if os.path.exists(db_path):
            backup_file = os.path.join(backup_path, db_name)
            shutil.copy2(db_path, backup_file)
            print_success(f"已备份: {backup_file}")
        else:
            print_info(f"文件不存在，跳过: {db_name}")

    return backup_path


def rename_main_database():
    """重命名主数据库"""
    print_step(2, 6, "重命名主数据库...")

    if not os.path.exists(DICTATION_DB):
        print_error(f"主数据库不存在: {DICTATION_DB}")
        return False

    # 复制数据库文件
    shutil.copy2(DICTATION_DB, USER_DATA_DB)
    print_success(f"dictation.db → user_data.db")

    return True


def migrate_user_definitions():
    """迁移用户自定义词典表"""
    print_step(3, 6, "迁移用户自定义词典表...")

    # 连接到 user_data.db
    conn = sqlite3.connect(USER_DATA_DB)
    cursor = conn.cursor()

    try:
        # 创建 user_definitions 表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_definitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                word TEXT NOT NULL,
                definition TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, word)
            )
        """)

        # 创建索引
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_definitions_user_id
            ON user_definitions(user_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_definitions_word
            ON user_definitions(word)
        """)

        conn.commit()
        print_success("已创建 user_definitions 表")

        # 检查 user_dict.db 是否存在数据
        if os.path.exists(USER_DICT_DB):
            user_dict_conn = sqlite3.connect(USER_DICT_DB)
            user_dict_cursor = user_dict_conn.cursor()

            try:
                user_dict_cursor.execute("SELECT COUNT(*) FROM user_definitions")
                count = user_dict_cursor.fetchone()[0]

                if count > 0:
                    # 迁移数据
                    user_dict_cursor.execute("SELECT * FROM user_definitions")
                    rows = user_dict_cursor.fetchall()

                    cursor.executemany("""
                        INSERT INTO user_definitions
                        (id, user_id, word, definition, notes, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, rows)

                    conn.commit()
                    print_success(f"已迁移 {count} 条用户自定义词典数据")
                else:
                    print_info("user_dict.db 中无数据，跳过数据迁移")
            except sqlite3.Error as e:
                print_info(f"user_dict.db 表不存在或为空: {e}")
            finally:
                user_dict_conn.close()
        else:
            print_info("user_dict.db 不存在，跳过数据迁移")

        return True

    except sqlite3.Error as e:
        print_error(f"迁移失败: {e}")
        return False
    finally:
        conn.close()


def optimize_sentence_table():
    """优化例句表（删除冗余字段）"""
    print_step(4, 6, "优化例句表...")

    conn = sqlite3.connect(SENTENCE_PAIRS_DB)
    cursor = conn.cursor()

    try:
        # 获取原始数据库大小
        original_size = os.path.getsize(SENTENCE_PAIRS_DB)

        # 检查是否存在冗余字段
        cursor.execute("PRAGMA table_info(sentence_pairs)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'en_words' not in columns and 'zh_words' not in columns:
            print_info("例句表已经是优化后的结构，跳过")
            return True

        # 创建新表（不包含 en_words 和 zh_words）
        cursor.execute("""
            CREATE TABLE sentence_pairs_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                en_sentence TEXT NOT NULL,
                zh_sentence TEXT NOT NULL,
                source TEXT DEFAULT 'tatoeba'
            )
        """)

        # 复制数据
        cursor.execute("""
            INSERT INTO sentence_pairs_new (id, en_sentence, zh_sentence, source)
            SELECT id, en_sentence, zh_sentence, source
            FROM sentence_pairs
        """)

        # 删除旧表
        cursor.execute("DROP TABLE sentence_pairs")

        # 重命名新表
        cursor.execute("ALTER TABLE sentence_pairs_new RENAME TO sentence_pairs")

        # 创建索引
        cursor.execute("""
            CREATE INDEX idx_sentence_pairs_en ON sentence_pairs(en_sentence)
        """)
        cursor.execute("""
            CREATE INDEX idx_sentence_pairs_zh ON sentence_pairs(zh_sentence)
        """)

        conn.commit()

        # 压缩数据库
        cursor.execute("VACUUM")

        # 获取优化后的数据库大小
        new_size = os.path.getsize(SENTENCE_PAIRS_DB)
        saved_mb = (original_size - new_size) / (1024 * 1024)

        print_success("已删除 en_words 和 zh_words 字段")
        print_info(f"节省空间: {saved_mb:.1f} MB")

        return True

    except sqlite3.Error as e:
        print_error(f"优化失败: {e}")
        return False
    finally:
        conn.close()


def convert_traditional_to_simplified():
    """繁简转换"""
    print_step(5, 6, "繁简转换...")

    # 初始化 OpenCC 转换器
    converter = opencc.OpenCC('t2s')  # 繁体转简体

    conn = sqlite3.connect(SENTENCE_PAIRS_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # 统计包含繁体字的例句数量
        traditional_pattern = '|'.join([f'%{char}%' for char in TRADITIONAL_CHARS[:20]])  # 使用前20个常见繁体字

        total_converted = 0
        examples = []

        # 遍历所有例句
        cursor.execute("SELECT id, zh_sentence FROM sentence_pairs")
        rows = cursor.fetchall()

        for row in rows:
            zh_sentence = row['zh_sentence']

            # 检查是否包含繁体字
            has_traditional = any(char in zh_sentence for char in TRADITIONAL_CHARS)

            if has_traditional:
                # 转换为简体
                simplified = converter.convert(zh_sentence)

                # 只有在转换后有变化时才更新
                if simplified != zh_sentence:
                    cursor.execute(
                        "UPDATE sentence_pairs SET zh_sentence = ? WHERE id = ?",
                        (simplified, row['id'])
                    )
                    total_converted += 1

                    # 保存前3个转换示例
                    if len(examples) < 3:
                        examples.append((zh_sentence, simplified))

        conn.commit()

        print_success(f"已转换 {total_converted} 条繁体例句为简体")

        if examples:
            print_info("转换示例:")
            for original, simplified in examples:
                print(f"    - \"{original}\" → \"{simplified}\"")

        return True

    except Exception as e:
        print_error(f"繁简转换失败: {e}")
        return False
    finally:
        conn.close()


def rebuild_fts_index():
    """重建 FTS5 全文搜索索引"""
    print_step(6, 6, "重建 FTS5 索引...")

    conn = sqlite3.connect(SENTENCE_PAIRS_DB)
    cursor = conn.cursor()

    try:
        # 删除旧的 FTS5 索引
        cursor.execute("DROP TABLE IF EXISTS sentence_pairs_fts")

        # 创建新的 FTS5 索引
        cursor.execute("""
            CREATE VIRTUAL TABLE sentence_pairs_fts USING fts5(
                en_sentence,
                zh_sentence,
                content='sentence_pairs',
                content_rowid='id'
            )
        """)

        # 填充 FTS5 索引
        cursor.execute("""
            INSERT INTO sentence_pairs_fts(rowid, en_sentence, zh_sentence)
            SELECT id, en_sentence, zh_sentence FROM sentence_pairs
        """)

        # 创建触发器以保持 FTS5 索引同步
        cursor.execute("""
            CREATE TRIGGER sentence_pairs_ai AFTER INSERT ON sentence_pairs BEGIN
                INSERT INTO sentence_pairs_fts(rowid, en_sentence, zh_sentence)
                VALUES (new.id, new.en_sentence, new.zh_sentence);
            END
        """)

        cursor.execute("""
            CREATE TRIGGER sentence_pairs_ad AFTER DELETE ON sentence_pairs BEGIN
                DELETE FROM sentence_pairs_fts WHERE rowid = old.id;
            END
        """)

        cursor.execute("""
            CREATE TRIGGER sentence_pairs_au AFTER UPDATE ON sentence_pairs BEGIN
                DELETE FROM sentence_pairs_fts WHERE rowid = old.id;
                INSERT INTO sentence_pairs_fts(rowid, en_sentence, zh_sentence)
                VALUES (new.id, new.en_sentence, new.zh_sentence);
            END
        """)

        conn.commit()

        print_success("已重建全文搜索索引")
        print_success("已创建同步触发器")

        return True

    except sqlite3.Error as e:
        print_error(f"重建索引失败: {e}")
        return False
    finally:
        conn.close()


def main():
    """主函数"""
    print("=" * 60)
    print("数据库迁移脚本")
    print("=" * 60)

    # 检查数据库文件是否存在
    if not os.path.exists(DICTATION_DB):
        print_error(f"主数据库不存在: {DICTATION_DB}")
        return 1

    if not os.path.exists(SENTENCE_PAIRS_DB):
        print_error(f"例句数据库不存在: {SENTENCE_PAIRS_DB}")
        return 1

    # 执行迁移步骤
    try:
        # 1. 备份数据库
        backup_path = backup_databases()
        print_info(f"备份目录: {backup_path}")

        # 2. 重命名主数据库
        if not rename_main_database():
            return 1

        # 3. 迁移用户自定义词典表
        if not migrate_user_definitions():
            return 1

        # 4. 优化例句表
        if not optimize_sentence_table():
            return 1

        # 5. 繁简转换
        if not convert_traditional_to_simplified():
            return 1

        # 6. 重建 FTS5 索引
        if not rebuild_fts_index():
            return 1

        print("\n" + "=" * 60)
        print("✅ 数据库迁移完成！")
        print("=" * 60)
        print_info(f"备份位置: {backup_path}")
        print_info("请运行应用测试所有功能")

        return 0

    except Exception as e:
        print_error(f"迁移过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
