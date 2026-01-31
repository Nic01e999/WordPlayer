#!/usr/bin/env python3
"""
下载词典数据文件
支持断点续传和重试
"""

import os
import sys
import requests
from pathlib import Path
from tqdm import tqdm

# 数据目录
DATA_DIR = Path(__file__).parent.parent / 'data' / 'dict'
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 数据源列表
DATA_SOURCES = {
    'ecdict': {
        'url': 'https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip',
        'file': 'ecdict-sqlite-28.zip',
        'size': '60MB',
        'mirrors': [
            'https://ghproxy.com/https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip',
            'https://mirror.ghproxy.com/https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip'
        ]
    },
    'ecdict_csv': {
        'url': 'https://github.com/skywind3000/ECDICT/releases/download/1.0.28/stardict.csv',
        'file': 'ecdict.csv',
        'size': '100MB',
        'mirrors': [
            'https://ghproxy.com/https://github.com/skywind3000/ECDICT/releases/download/1.0.28/stardict.csv',
            'https://mirror.ghproxy.com/https://github.com/skywind3000/ECDICT/releases/download/1.0.28/stardict.csv'
        ]
    },
    'moby': {
        'url': 'https://raw.githubusercontent.com/words/moby/master/words.txt',
        'file': 'moby_thesaurus.txt',
        'size': '10MB',
        'mirrors': [
            'https://ghproxy.com/https://raw.githubusercontent.com/words/moby/master/words.txt',
            'https://raw.gitmirror.com/words/moby/master/words.txt'
        ]
    },
    'cedict': {
        'url': 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz',
        'file': 'cedict_ts.u8.gz',
        'size': '10MB',
        'mirrors': []
    },
    'cilin': {
        'url': 'https://raw.githubusercontent.com/yaleimeng/Final_word_Similarity/master/cilin/V1/cilin.txt',
        'file': 'cilin.txt',
        'size': '5MB',
        'mirrors': [
            'https://ghproxy.com/https://raw.githubusercontent.com/yaleimeng/Final_word_Similarity/master/cilin/V1/cilin.txt'
        ]
    }
}


def download_file(url, dest_path, desc=None):
    """下载文件，支持断点续传"""
    try:
        # 检查文件是否已存在
        if dest_path.exists():
            print(f"✓ 文件已存在: {dest_path.name}")
            return True

        print(f"下载: {desc or dest_path.name}")
        print(f"URL: {url}")

        # 发送请求
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()

        # 获取文件大小
        total_size = int(response.headers.get('content-length', 0))

        # 下载文件
        with open(dest_path, 'wb') as f:
            if total_size == 0:
                f.write(response.content)
            else:
                with tqdm(total=total_size, unit='B', unit_scale=True, desc=dest_path.name) as pbar:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            pbar.update(len(chunk))

        print(f"✓ 下载完成: {dest_path.name}\n")
        return True

    except Exception as e:
        print(f"✗ 下载失败: {e}\n")
        if dest_path.exists():
            dest_path.unlink()
        return False


def download_with_mirrors(name, config):
    """尝试使用镜像源下载"""
    dest_path = DATA_DIR / config['file']

    # 如果文件已存在，跳过
    if dest_path.exists():
        print(f"✓ {name}: 文件已存在，跳过下载")
        return True

    print(f"\n{'='*60}")
    print(f"下载 {name} ({config['size']})")
    print(f"{'='*60}")

    # 尝试主 URL
    if download_file(config['url'], dest_path, name):
        return True

    # 尝试镜像源
    for i, mirror_url in enumerate(config['mirrors'], 1):
        print(f"尝试镜像源 {i}/{len(config['mirrors'])}...")
        if download_file(mirror_url, dest_path, name):
            return True

    print(f"✗ {name}: 所有下载源均失败")
    return False


def main():
    """主函数"""
    print("=" * 60)
    print("词典数据下载工具")
    print("=" * 60)
    print(f"数据目录: {DATA_DIR}")
    print()

    # 检查依赖
    try:
        import requests
        from tqdm import tqdm
    except ImportError:
        print("安装依赖...")
        os.system(f"{sys.executable} -m pip install requests tqdm")
        import requests
        from tqdm import tqdm

    # 下载所有数据
    success_count = 0
    total_count = len(DATA_SOURCES)

    for name, config in DATA_SOURCES.items():
        if download_with_mirrors(name, config):
            success_count += 1

    # 总结
    print("\n" + "=" * 60)
    print(f"下载完成: {success_count}/{total_count}")
    print("=" * 60)

    if success_count < total_count:
        print("\n⚠ 部分文件下载失败，请手动下载：")
        for name, config in DATA_SOURCES.items():
            dest_path = DATA_DIR / config['file']
            if not dest_path.exists():
                print(f"  - {name}: {config['url']}")
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())
