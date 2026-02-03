#!/bin/bash
# 使用 rsync 部署到服务器（推荐方案）

# 配置服务器信息
SERVER_USER="your_username"
SERVER_HOST="your_server_ip"
SERVER_PATH="/path/to/deploy"

echo "📦 准备部署到服务器..."
echo "服务器: $SERVER_USER@$SERVER_HOST:$SERVER_PATH"
echo ""

# 使用 rsync 同步文件
rsync -avz --progress \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.DS_Store' \
  --exclude='cache/' \
  --exclude='tts_cache/' \
  --exclude='*.log' \
  --exclude='logs/' \
  --exclude='venv/' \
  --exclude='env/' \
  --exclude='.vscode/' \
  --exclude='.idea/' \
  --exclude='tmp/' \
  --exclude='temp/' \
  ./ "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/"

echo ""
echo "✅ 文件同步完成！"
echo ""
echo "接下来在服务器上执行："
echo "1. cd $SERVER_PATH"
echo "2. python3 -m venv venv"
echo "3. source venv/bin/activate"
echo "4. pip3 install flask flask-cors requests"
echo "5. python3 run.py"
