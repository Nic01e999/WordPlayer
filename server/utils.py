"""
工具函数模块
"""

import re
import socket
import subprocess


def validate_word(word):
    """验证单词/短语是否有效"""
    if not word or not isinstance(word, str):
        return False
    if len(word) > 100:
        return False
    # 允许：英文字母、空格、连字符、撇号（如 don't）
    if not re.match(r"^[a-zA-Z\s\-']+$", word):
        return False
    return True


def get_lan_ip():
    """获取局域网 WiFi IP 地址（macOS 从 en0 接口读取）"""
    try:
        result = subprocess.run(
            ["ipconfig", "getifaddr", "en0"],
            capture_output=True, text=True, timeout=3
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except Exception:
        pass
    # 备用方案
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "未知"
