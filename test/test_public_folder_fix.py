#!/usr/bin/env python3
"""
测试公开文件夹 API 修复
"""
import requests
import json

BASE_URL = "http://127.0.0.1:5001"

def test_set_public_folder():
    """测试设置公开文件夹（包含空格的文件夹名）"""
    print("\n=== 测试 1: 设置包含空格的文件夹为公开 ===")

    # 测试包含空格的文件夹名
    folder_name = "My Test Folder"

    response = requests.post(
        f"{BASE_URL}/api/public/folder/set",
        json={
            "folderName": folder_name,
            "isPublic": True
        }
    )

    print(f"状态码: {response.status_code}")
    print(f"响应: {response.text}")

    if response.status_code == 200:
        data = response.json()
        print(f"✓ 成功设置公开文件夹")
        print(f"  - 公开文件夹 ID: {data.get('publicFolderId')}")
        return data.get('publicFolderId')
    else:
        print(f"✗ 设置失败")
        try:
            error = response.json()
            print(f"  - 错误信息: {error.get('error')}")
        except:
            print(f"  - 无法解析错误响应")
        return None

def test_check_public_status(folder_name):
    """测试检查公开状态"""
    print(f"\n=== 测试 2: 检查文件夹 '{folder_name}' 的公开状态 ===")

    response = requests.post(
        f"{BASE_URL}/api/public/folder/check",
        json={"folderName": folder_name}
    )

    print(f"状态码: {response.status_code}")
    print(f"响应: {response.text}")

    if response.status_code == 200:
        data = response.json()
        print(f"✓ 成功检查状态")
        print(f"  - 是否公开: {data.get('isPublic')}")
        print(f"  - 公开文件夹 ID: {data.get('publicFolderId')}")
    else:
        print(f"✗ 检查失败")

def test_search_public_folders(keyword):
    """测试搜索公开文件夹"""
    print(f"\n=== 测试 3: 搜索公开文件夹 (关键词: '{keyword}') ===")

    response = requests.get(
        f"{BASE_URL}/api/public/folder/search",
        params={"keyword": keyword, "page": 1, "pageSize": 10}
    )

    print(f"状态码: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"✓ 搜索成功")
        print(f"  - 总数: {data.get('total')}")
        print(f"  - 结果数: {len(data.get('folders', []))}")
        for folder in data.get('folders', []):
            print(f"    * {folder.get('folder_name')} (单词数: {folder.get('word_count')})")
    else:
        print(f"✗ 搜索失败")
        print(f"响应: {response.text}")

def test_unset_public_folder(folder_name):
    """测试取消公开"""
    print(f"\n=== 测试 4: 取消文件夹 '{folder_name}' 的公开状态 ===")

    response = requests.post(
        f"{BASE_URL}/api/public/folder/set",
        json={
            "folderName": folder_name,
            "isPublic": False
        }
    )

    print(f"状态码: {response.status_code}")

    if response.status_code == 200:
        print(f"✓ 成功取消公开")
    else:
        print(f"✗ 取消失败")
        print(f"响应: {response.text}")

if __name__ == "__main__":
    print("开始测试公开文件夹 API 修复...")
    print("=" * 60)

    # 测试 1: 设置公开（包含空格的文件夹名）
    folder_name = "My Test Folder"
    public_folder_id = test_set_public_folder()

    # 测试 2: 检查公开状态
    test_check_public_status(folder_name)

    # 测试 3: 搜索公开文件夹
    test_search_public_folders("Test")

    # 测试 4: 取消公开
    test_unset_public_folder(folder_name)

    # 再次检查状态
    test_check_public_status(folder_name)

    print("\n" + "=" * 60)
    print("测试完成!")
