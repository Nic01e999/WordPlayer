"""
单词缓存模块 - JSON 文件存储
查询过的单词存储在本地，避免重复调用 DeepSeek API
"""

import os
import json
import threading

# 缓存文件路径（与 server 目录同级，即 code/ 下）
CACHE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_FILE = os.path.join(CACHE_DIR, "word_cache.json")

# 内存缓存 + 线程锁
_cache = {}
_lock = threading.Lock()


def load_cache():
    """启动时加载缓存到内存"""
    global _cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                _cache = json.load(f)
            print(f"[Cache] 已加载 {len(_cache)} 个单词缓存")
        except Exception as e:
            print(f"[Cache] 加载失败: {e}")
            _cache = {}
    else:
        _cache = {}
        print("[Cache] 缓存文件不存在，将创建新缓存")


def save_cache():
    """保存缓存到文件"""
    with _lock:
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(_cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Cache] 保存失败: {e}")


def get_cached_words(words):
    """
    从缓存获取单词
    返回: (cached_results, missing_words)
    - cached_results: {word: info_dict, ...}
    - missing_words: [word1, word2, ...]
    """
    cached = {}
    missing = []

    with _lock:
        for word in words:
            key = word.lower()  # 统一小写作为 key
            if key in _cache:
                cached[word] = _cache[key]
            else:
                missing.append(word)

    return cached, missing


def update_cache(results):
    """
    更新缓存（批量添加）
    results: {word: info_dict, ...}
    """
    with _lock:
        for word, info in results.items():
            key = word.lower()
            _cache[key] = info

    # 异步保存到文件（避免阻塞请求）
    threading.Thread(target=save_cache, daemon=True).start()


def get_cache_stats():
    """获取缓存统计信息"""
    with _lock:
        return {
            "total_words": len(_cache),
            "cache_file": CACHE_FILE
        }
