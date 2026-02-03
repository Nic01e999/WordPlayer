"""
英语听写工具 - 后端API服务
提供翻译和TTS接口供前端调用
支持 WebSocket 实时同步
"""

import os
import socket
import subprocess
from flask import Flask, send_file, request
from flask_cors import CORS

# 尝试导入 flask-socketio（可选依赖）
try:
    from flask_socketio import SocketIO, emit, join_room, leave_room
    HAS_SOCKETIO = True
except ImportError:
    HAS_SOCKETIO = False
    print("[Warning] flask-socketio 未安装，WebSocket 功能不可用")
    print("         安装方法: pip install flask-socketio")

from tts import tts_bp
from auth import auth_bp
from sync import sync_bp
from settings import settings_bp
from db import init_db, get_db
from dict_api import dict_api_bp
from public_api import public_api_bp


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
ALLOWED_EXTENSIONS = {'.js', '.css', '.html', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.ico'}

app = Flask(__name__)

# 初始化 SocketIO（如果可用）- 必须在 CORS 之前初始化
socketio = None
if HAS_SOCKETIO:
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# 配置 CORS，显式支持所有方法（包括 OPTIONS 预检请求）
CORS(app,
     origins="*",
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=False)

# 注册 API 蓝图
app.register_blueprint(tts_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(sync_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(dict_api_bp)  # 数据库架构词典 API
app.register_blueprint(public_api_bp)  # 公开文件夹分享 API

# 启动时初始化数据库
init_db()

# ===================== WebSocket 事件处理 =====================
if HAS_SOCKETIO:
    # 存储已连接的用户 { sid: user_id }
    connected_users = {}

    def verify_token(token):
        """验证 token 并返回用户信息"""
        if not token:
            return None
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.id, u.email FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ? AND s.expires_at > datetime('now')
            """, (token,))
            row = cursor.fetchone()
            if row:
                return {'id': row['id'], 'email': row['email']}
        return None

    @socketio.on('connect')
    def handle_connect(auth):
        """处理 WebSocket 连接"""
        try:
            # 只从 auth 参数获取 token，避免 token 泄露到 URL 日志
            token = auth.get('token') if auth else None
            user = verify_token(token)

            if not user:
                print(f"[WS] 连接被拒绝: token 验证失败 (sid: {request.sid})")
                # 使用 disconnect 而不是返回 False，避免 WSGI 错误
                from flask_socketio import disconnect
                disconnect()
                return  # 直接返回，不返回 False

            user_id = user['id']
            connected_users[request.sid] = user_id

            # 加入用户专属房间（用于多设备同步）
            join_room(f"user_{user_id}")
            print(f"[WS] 用户 {user['email']} 已连接 (sid: {request.sid})")
            return True
        except Exception as e:
            print(f"[WS] 连接处理异常: {e}")
            return False

    @socketio.on('disconnect')
    def handle_disconnect():
        """处理 WebSocket 断开"""
        user_id = connected_users.pop(request.sid, None)
        if user_id:
            leave_room(f"user_{user_id}")
            print(f"[WS] 用户 {user_id} 已断开 (sid: {request.sid})")

    @socketio.on('settings:update')
    def handle_settings_update(data):
        """处理设置更新并广播给其他设备"""
        user_id = connected_users.get(request.sid)
        if not user_id:
            return

        # 广播给同一用户的其他设备（排除发送者）
        emit('settings:update', data, room=f"user_{user_id}", include_self=False)

    @socketio.on('layout:update')
    def handle_layout_update(data):
        """处理布局更新并广播给其他设备"""
        user_id = connected_users.get(request.sid)
        if not user_id:
            return

        emit('layout:update', data, room=f"user_{user_id}", include_self=False)

    @socketio.on('wordlist:update')
    def handle_wordlist_update(data):
        """处理单词表更新并广播给其他设备"""
        user_id = connected_users.get(request.sid)
        if not user_id:
            return

        emit('wordlist:update', data, room=f"user_{user_id}", include_self=False)


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
    # 从环境变量读取 debug 模式（生产环境应设置为 False）
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'

    print("=" * 40)
    print("后端服务已启动!")
    print(f"  本机访问: http://127.0.0.1:5001")
    print(f"  局域网访问: http://{lan_ip}:5001")
    if HAS_SOCKETIO:
        print("  WebSocket: 已启用")
    else:
        print("  WebSocket: 未启用 (需安装 flask-socketio)")
    print(f"  Debug 模式: {'开启' if debug_mode else '关闭'}")
    print("=" * 40)

    if HAS_SOCKETIO and socketio:
        socketio.run(app, debug=debug_mode, host="0.0.0.0", port=5001, allow_unsafe_werkzeug=True)
    else:
        app.run(debug=debug_mode, host="0.0.0.0", port=5001)


if __name__ == "__main__":
    main()
