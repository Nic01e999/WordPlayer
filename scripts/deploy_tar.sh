#!/bin/bash
# 使用 tar 压缩并部署到服务器

# 配置服务器信息
SERVER_USER="your_username"
SERVER_HOST="your_server_ip"
SERVER_PATH="/path/to/deploy"

echo "📦 正在打包项目..."

# 创建压缩包（排除不必要的文件）
tar -czf project.tar.gz \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.DS_Store' \
  --exclude='cache' \
  --exclude='tts_cache' \
  --exclude='*.log' \
  --exclude='logs' \
  --exclude='venv' \
  --exclude='env' \
  --exclude='.vscode' \
  --exclude='.idea' \
  --exclude='tmp' \
  --exclude='temp' \
  .

echo "✅ 打包完成: project.tar.gz"
du -h project.tar.gz

echo ""
echo "📤 上传到服务器..."
scp project.tar.gz "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/"

echo ""
echo "📂 在服务器上解压..."
ssh "$SERVER_USER@$SERVER_HOST" << 'EOF'
cd $SERVER_PATH
tar -xzf project.tar.gz
rm project.tar.gz
echo "✅ 解压完成！"
EOF

# 清理本地压缩包
rm project.tar.gz

echo ""
echo "✅ 部署完成！"
echo ""
echo "接下来在服务器上执行："
echo "1. cd $SERVER_PATH"
echo "2. python3 -m venv venv"
echo "3. source venv/bin/activate"
echo "4. pip3 install flask flask-cors requests"
echo "5. python3 run.py"
