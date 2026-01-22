#!/bin/bash

# 切换到脚本所在目录
cd "$(dirname "$0")"

echo "正在启动服务器..."

# 先清理可能残留的旧进程（端口 5001）
OLD_PID=$(lsof -ti:5001 2>/dev/null)
if [ -n "$OLD_PID" ]; then
    echo "发现旧进程 (PID: $OLD_PID)，正在关闭..."
    kill $OLD_PID 2>/dev/null
    sleep 1
fi

# 启动 Python 服务器
python3 server.py &
SERVER_PID=$!

# 等待服务器启动
sleep 2

# 打开浏览器
open "$(pwd)/a.html"

echo "服务器已启动 (PID: $SERVER_PID)"
echo "按 Ctrl+C 停止服务器"

# 等待服务器进程
wait $SERVER_PID
