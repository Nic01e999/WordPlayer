"""
英语听写工具 - 后端API服务
提供翻译和TTS接口供前端调用
"""

import os
from flask import Flask, send_file
from flask_cors import CORS

from utils import get_lan_ip
from deepseek import deepseek_bp
from tts import tts_bp

# 获取项目根目录（server 的父目录）
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__, static_folder=BASE_DIR)
CORS(app)

# 注册 API 蓝图
app.register_blueprint(deepseek_bp)
app.register_blueprint(tts_bp)


@app.route("/")
def index():
    """提供主页"""
    return send_file(os.path.join(BASE_DIR, "index.html"))


@app.route("/<path:filename>")
def static_files(filename):
    """提供静态文件（js, css）"""
    file_path = os.path.join(BASE_DIR, filename)
    if os.path.isfile(file_path):
        return send_file(file_path)
    return "Not Found", 404


def main():
    lan_ip = get_lan_ip()
    print("=" * 40)
    print("后端服务已启动!")
    print(f"  本机访问: http://127.0.0.1:5001")
    print(f"  局域网访问: http://{lan_ip}:5001")
    print("=" * 40)
    app.run(debug=True, host="0.0.0.0", port=5001)


if __name__ == "__main__":
    main()
