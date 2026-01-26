"""
英语听写工具 - 后端API服务
提供翻译和TTS接口供前端调用
"""

import os
import socket
import subprocess
from flask import Flask, send_file
from flask_cors import CORS

from deepseek import deepseek_bp
from tts import tts_bp
from cache import load_cache
from auth import auth_bp
from sync import sync_bp
from db import init_db


def _get_lan_ip():
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

# 获取项目根目录（server 的父目录）
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 静态文件安全配置
ALLOWED_DIRS = {'js', 'css', 'assets'}
ALLOWED_EXTENSIONS = {'.js', '.css', '.html', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'}

app = Flask(__name__)
CORS(app)

# 注册 API 蓝图
app.register_blueprint(deepseek_bp)
app.register_blueprint(tts_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(sync_bp)

# 启动时初始化
load_cache()
init_db()


@app.route("/")
def index():
    """提供主页"""
    return send_file(os.path.join(BASE_DIR, "index.html"))


@app.route("/<path:filename>")
def static_files(filename):
    """提供静态文件（js, css, assets），带安全限制"""
    # 规范化路径，防止目录遍历
    filename = os.path.normpath(filename)
    if filename.startswith('..') or filename.startswith('/'):
        return "Forbidden", 403

    # 检查是否在允许的目录中
    parts = filename.split(os.sep)
    if not parts or parts[0] not in ALLOWED_DIRS:
        return "Forbidden", 403

    # 检查文件扩展名
    _, ext = os.path.splitext(filename)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        return "Forbidden", 403

    file_path = os.path.join(BASE_DIR, filename)
    if os.path.isfile(file_path):
        return send_file(file_path)
    return "Not Found", 404


def main():
    lan_ip = _get_lan_ip()
    print("=" * 40)
    print("后端服务已启动!")
    print(f"  本机访问: http://127.0.0.1:5001")
    print(f"  局域网访问: http://{lan_ip}:5001")
    print("=" * 40)
    app.run(debug=True, host="0.0.0.0", port=5001)


if __name__ == "__main__":
    main()
