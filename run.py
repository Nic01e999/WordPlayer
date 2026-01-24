#!/usr/bin/env python3
"""
启动后端服务
使用: python3 run.py
"""

import sys
import os

# 添加 server 目录到 Python 路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from app import main

if __name__ == "__main__":
    main()
