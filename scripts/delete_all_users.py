#!/usr/bin/env python3
"""
删除所有用户账户信息脚本

功能：
- 删除数据库中所有用户及相关数据
- 保留表结构
- 重置自增 ID
- 输出删除统计信息

警告：此操作不可逆，请谨慎使用！

使用方法：
    python scripts/delete_all_users.py
"""

import sqlite3
import sys
import os

# 获取项目根目录
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 数据库路径
DATABASE_PATH = os.path.join(PROJECT_ROOT, 'data', 'databases', 'user_data.db')


def delete_all_users():
    """删除所有用户及相关数据"""

    db_path = DATABASE_PATH

    print(f"数据库路径: {db_path}")
    print("=" * 60)

    # 检查数据库文件是否存在
    if not os.path.exists(db_path):
        print(f"错误: 数据库文件不存在: {db_path}")
        return

    try:
        # 连接数据库
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 开启外键约束
        cursor.execute("PRAGMA foreign_keys = ON")

        # 定义需要清空的表（按顺序，考虑外键约束）
        tables = [
            'folders',              # 依赖 users 和 public_folders
            'public_folders',       # 依赖 users
            'sessions',             # 依赖 users
            'reset_codes',          # 独立表
            'user_settings',        # 依赖 users
            'layout',               # 依赖 users
            'wordcards',            # 依赖 users
            'users'                 # 最后删除
        ]

        # 统计删除前的记录数
        print("删除前的记录统计:")
        print("-" * 60)
        counts_before = {}
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            counts_before[table] = count
            print(f"  {table}: {count} 条记录")

        print("\n" + "=" * 60)
        print("开始删除数据...")
        print("=" * 60)

        # 开始事务
        conn.execute("BEGIN TRANSACTION")

        try:
            # 按顺序删除各表数据
            for table in tables:
                cursor.execute(f"DELETE FROM {table}")
                deleted = cursor.rowcount
                print(f"✓ 已删除 {table}: {deleted} 条记录")

            # 重置自增 ID
            cursor.execute("""
                DELETE FROM sqlite_sequence
                WHERE name IN ( 
                            'folders',             
                            'public_folders',     
                            'sessions',             
                            'reset_codes',        
                            'user_settings',       
                            'layout',               
                            'wordcards',          
                            'users'                
                           )""")
            print(f"✓ 已重置自增 ID")

            # 提交事务
            conn.commit()
            print("\n" + "=" * 60)
            print("✓ 所有数据删除成功！")

        except Exception as e:
            # 回滚事务
            conn.rollback()
            print(f"\n✗ 删除失败，已回滚: {e}")
            raise

        # 验证删除结果
        print("=" * 60)
        print("删除后的记录统计:")
        print("-" * 60)
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"  {table}: {count} 条记录")

        print("=" * 60)
        print("✓ 数据库清理完成！")
        print("=" * 60)

    except sqlite3.Error as e:
        print(f"\n✗ 数据库错误: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ 未知错误: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("  删除所有用户账户信息")
    print("=" * 60)
    print("\n⚠️  警告: 此操作将永久删除所有用户数据，且无法恢复！\n")

    delete_all_users()
