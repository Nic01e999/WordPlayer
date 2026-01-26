"""
单词缓存模块 - 按目标语言分文件存储 + LRU 淘汰

缓存结构:
cache/wordinfo/{targetLang}.json
例如: cache/wordinfo/en.json, cache/wordinfo/ja.json

每个单词的存储格式:
{
  "apple": {
    "phonetic": "/ˈæp.əl/",
    "targetDefinitions": [...],
    "examples": {...},
    "synonyms": [...],
    "antonyms": [...],
    "translations": {
      "zh": "苹果",
      "ja": "りんご"
    }
  }
}
"""

import os
import json
import threading
from typing import Dict, List, Tuple, Any, Optional

# 缓存目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(BASE_DIR, "cache", "wordinfo")

# LRU 配置
MAX_CACHE_SIZE = 5000  # 每个语言文件最多缓存 5000 个单词

# 内存缓存: { lang: { word: info, ... }, ... }
_caches: Dict[str, Dict[str, Any]] = {}
# LRU 访问顺序: { lang: [word1, word2, ...], ... }
_access_orders: Dict[str, List[str]] = {}
# 线程锁
_lock = threading.Lock()


def _get_cache_file(lang: str) -> str:
    """获取指定语言的缓存文件路径"""
    return os.path.join(CACHE_DIR, f"{lang}.json")


def _ensure_cache_dir():
    """确保缓存目录存在"""
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR, exist_ok=True)


def _load_lang_cache(lang: str) -> Dict[str, Any]:
    """加载指定语言的缓存到内存"""
    cache_file = _get_cache_file(lang)
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Cache] 加载 {lang}.json 失败: {e}")
    return {}


def _save_lang_cache(lang: str):
    """保存指定语言的缓存到文件"""
    _ensure_cache_dir()
    cache_file = _get_cache_file(lang)
    try:
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(_caches.get(lang, {}), f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Cache] 保存 {lang}.json 失败: {e}")


def _get_or_load_cache(lang: str) -> Dict[str, Any]:
    """获取缓存，如果未加载则从文件加载"""
    if lang not in _caches:
        _caches[lang] = _load_lang_cache(lang)
        _access_orders[lang] = list(_caches[lang].keys())
        print(f"[Cache] 已加载 {lang}.json ({len(_caches[lang])} 个单词)")
    return _caches[lang]


def get_cached_words(words: List[str], target_lang: str, native_lang: str) -> Tuple[Dict[str, Any], List[str]]:
    """
    从缓存获取单词（更新 LRU 访问顺序）

    返回: (cached_results, missing_words)
    - cached_results: { word: { phonetic, translation, ... }, ... }
    - missing_words: 缓存中没有的单词，或没有该母语翻译的单词
    """
    cached = {}
    missing = []

    with _lock:
        cache = _get_or_load_cache(target_lang)
        access_order = _access_orders.setdefault(target_lang, [])

        for word in words:
            key = word.lower()
            if key in cache:
                info = cache[key]
                translations = info.get("translations", {})

                # 检查是否有该母语的翻译
                if native_lang in translations:
                    # 构建返回结果
                    cached[word] = {
                        "word": word,
                        "phonetic": info.get("phonetic", ""),
                        "translation": translations[native_lang],
                        "nativeDefinitions": info.get("nativeDefinitions", {}).get(native_lang, []),
                        "targetDefinitions": info.get("targetDefinitions", []),
                        "examples": info.get("examples", {}),
                        "synonyms": info.get("synonyms", []),
                        "antonyms": info.get("antonyms", [])
                    }
                    # 更新 LRU 顺序
                    if key in access_order:
                        access_order.remove(key)
                    access_order.append(key)
                else:
                    # 有缓存但没有该母语翻译，需要补充翻译
                    missing.append(word)
            else:
                missing.append(word)

    return cached, missing


def get_cached_word_base(word: str, target_lang: str) -> Optional[Dict[str, Any]]:
    """
    获取单词的基础信息（不含特定母语翻译），用于补充翻译时检查
    """
    with _lock:
        cache = _get_or_load_cache(target_lang)
        key = word.lower()
        return cache.get(key)


def update_cache(results: Dict[str, Any], target_lang: str, native_lang: str):
    """
    更新缓存（合并新数据 + LRU 淘汰）

    results: { word: { phonetic, translation, nativeDefinitions, targetDefinitions, examples, synonyms, antonyms }, ... }
    """
    with _lock:
        cache = _get_or_load_cache(target_lang)
        access_order = _access_orders.setdefault(target_lang, [])

        for word, info in results.items():
            key = word.lower()

            # 如果已存在，合并数据
            if key in cache:
                existing = cache[key]
                # 更新翻译
                if "translations" not in existing:
                    existing["translations"] = {}
                existing["translations"][native_lang] = info.get("translation", "")

                # 更新母语释义
                if "nativeDefinitions" not in existing:
                    existing["nativeDefinitions"] = {}
                if info.get("nativeDefinitions"):
                    existing["nativeDefinitions"][native_lang] = info["nativeDefinitions"]

                # 更新其他字段（如果有新数据）
                if info.get("phonetic"):
                    existing["phonetic"] = info["phonetic"]
                if info.get("targetDefinitions"):
                    existing["targetDefinitions"] = info["targetDefinitions"]
                if info.get("examples"):
                    existing["examples"] = info["examples"]
                if info.get("synonyms"):
                    existing["synonyms"] = info["synonyms"]
                if info.get("antonyms"):
                    existing["antonyms"] = info["antonyms"]
            else:
                # 新单词，创建缓存条目
                cache[key] = {
                    "phonetic": info.get("phonetic", ""),
                    "targetDefinitions": info.get("targetDefinitions", []),
                    "examples": info.get("examples", {}),
                    "synonyms": info.get("synonyms", []),
                    "antonyms": info.get("antonyms", []),
                    "translations": {
                        native_lang: info.get("translation", "")
                    },
                    "nativeDefinitions": {
                        native_lang: info.get("nativeDefinitions", [])
                    }
                }

            # 更新 LRU 顺序
            if key in access_order:
                access_order.remove(key)
            access_order.append(key)

        # LRU 淘汰
        while len(cache) > MAX_CACHE_SIZE:
            oldest = access_order.pop(0)
            if oldest in cache:
                del cache[oldest]

    # 异步保存到文件
    threading.Thread(target=_save_lang_cache, args=(target_lang,), daemon=True).start()


def add_translation(word: str, target_lang: str, native_lang: str, translation: str, native_definitions: List[Any] = None):
    """
    为已缓存的单词添加新的母语翻译
    """
    with _lock:
        cache = _get_or_load_cache(target_lang)
        key = word.lower()

        if key in cache:
            if "translations" not in cache[key]:
                cache[key]["translations"] = {}
            cache[key]["translations"][native_lang] = translation

            if native_definitions:
                if "nativeDefinitions" not in cache[key]:
                    cache[key]["nativeDefinitions"] = {}
                cache[key]["nativeDefinitions"][native_lang] = native_definitions

    # 异步保存
    threading.Thread(target=_save_lang_cache, args=(target_lang,), daemon=True).start()


def get_cache_stats() -> Dict[str, Any]:
    """获取缓存统计信息"""
    stats = {
        "cache_dir": CACHE_DIR,
        "languages": {}
    }

    # 列出所有缓存文件
    if os.path.exists(CACHE_DIR):
        for filename in os.listdir(CACHE_DIR):
            if filename.endswith(".json"):
                lang = filename[:-5]  # 去掉 .json
                cache_file = os.path.join(CACHE_DIR, filename)
                try:
                    with open(cache_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        stats["languages"][lang] = {
                            "word_count": len(data),
                            "file_size": os.path.getsize(cache_file)
                        }
                except:
                    pass

    return stats


def clear_cache(target_lang: str = None):
    """
    清除缓存
    - 如果指定 target_lang，只清除该语言的缓存
    - 否则清除所有缓存
    """
    with _lock:
        if target_lang:
            if target_lang in _caches:
                del _caches[target_lang]
            if target_lang in _access_orders:
                del _access_orders[target_lang]
            cache_file = _get_cache_file(target_lang)
            if os.path.exists(cache_file):
                os.remove(cache_file)
        else:
            _caches.clear()
            _access_orders.clear()
            if os.path.exists(CACHE_DIR):
                for filename in os.listdir(CACHE_DIR):
                    if filename.endswith(".json"):
                        os.remove(os.path.join(CACHE_DIR, filename))
