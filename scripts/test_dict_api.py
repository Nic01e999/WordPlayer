#!/usr/bin/env python3
"""
测试词典 API
"""

import requests
import json

BASE_URL = "http://127.0.0.1:5001"


def test_chinese_batch():
    """测试中文词典批量查询"""
    print("\n" + "=" * 60)
    print("测试 1: 中文词典批量查询")
    print("=" * 60)

    url = f"{BASE_URL}/api/dict/batch"
    data = {
        "words": ["你好", "学习", "电脑", "快乐", "中国"],
        "targetLang": "zh",
        "nativeLang": "en"
    }

    response = requests.post(url, json=data)
    print(f"状态码: {response.status_code}")

    if response.status_code == 200:
        results = response.json()["results"]
        print(f"找到 {len(results)} 个词条\n")

        for word, info in results.items():
            print(f"词语: {word}")
            print(f"  繁体: {info.get('traditional', '')}")
            print(f"  拼音: {info.get('pinyin', '')}")
            print(f"  释义: {info.get('translation', '')}")
            print(f"  来源: {info.get('meta', {}).get('source', '')}")
            print()
    else:
        print(f"错误: {response.text}")


def test_english_batch():
    """测试英文词典批量查询（使用有道 API）"""
    print("\n" + "=" * 60)
    print("测试 2: 英文词典批量查询（有道 API）")
    print("=" * 60)

    url = f"{BASE_URL}/api/dict/batch"
    data = {
        "words": ["apple", "happy", "computer"],
        "targetLang": "en",
        "nativeLang": "zh"
    }

    response = requests.post(url, json=data)
    print(f"状态码: {response.status_code}")

    if response.status_code == 200:
        results = response.json()["results"]
        print(f"找到 {len(results)} 个词条\n")

        for word, info in results.items():
            print(f"单词: {word}")
            print(f"  音标: {info.get('phonetic', {})}")
            print(f"  释义: {info.get('translation', '')}")
            print()
    else:
        print(f"错误: {response.text}")


def test_mixed_batch():
    """测试混合查询（中英文混合）"""
    print("\n" + "=" * 60)
    print("测试 3: 混合查询（中英文混合）")
    print("=" * 60)

    url = f"{BASE_URL}/api/dict/batch"
    data = {
        "words": ["你好", "apple", "学习", "happy"],
        "targetLang": "en",
        "nativeLang": "zh"
    }

    response = requests.post(url, json=data)
    print(f"状态码: {response.status_code}")

    if response.status_code == 200:
        results = response.json()["results"]
        print(f"找到 {len(results)} 个词条\n")

        for word, info in results.items():
            is_chinese = any('\u4e00' <= c <= '\u9fff' for c in word)
            print(f"{'中文' if is_chinese else '英文'}: {word}")
            if is_chinese:
                print(f"  拼音: {info.get('pinyin', '')}")
            else:
                print(f"  音标: {info.get('phonetic', {})}")
            print(f"  释义: {info.get('translation', '')}")
            print()
    else:
        print(f"错误: {response.text}")


def test_search():
    """测试模糊搜索"""
    print("\n" + "=" * 60)
    print("测试 4: 模糊搜索")
    print("=" * 60)

    url = f"{BASE_URL}/api/dict/search"
    params = {"q": "学", "limit": 10}

    response = requests.get(url, params=params)
    print(f"状态码: {response.status_code}")

    if response.status_code == 200:
        results = response.json()["results"]
        print(f"搜索 '学' 找到 {len(results)} 个结果:")
        print(results)
    else:
        print(f"错误: {response.text}")


def test_stats():
    """测试统计信息"""
    print("\n" + "=" * 60)
    print("测试 5: 词典统计信息")
    print("=" * 60)

    url = f"{BASE_URL}/api/dict/stats"
    response = requests.get(url)
    print(f"状态码: {response.status_code}")

    if response.status_code == 200:
        stats = response.json()
        print(json.dumps(stats, indent=2, ensure_ascii=False))
    else:
        print(f"错误: {response.text}")


def main():
    print("=" * 60)
    print("词典 API 测试")
    print("=" * 60)

    try:
        test_chinese_batch()
        test_english_batch()
        test_mixed_batch()
        test_search()
        test_stats()

        print("\n" + "=" * 60)
        print("✓ 所有测试完成")
        print("=" * 60)

    except requests.exceptions.ConnectionError:
        print("\n✗ 无法连接到服务器，请确保服务器正在运行")
        print("  启动命令: python3 run.py")
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")


if __name__ == '__main__':
    main()
