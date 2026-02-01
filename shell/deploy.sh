#!/bin/bash
# 一键部署脚本 - 在阿里云 Linux 服务器上执行
# 使用方法: bash deploy.sh

set -e

echo "=========================================="
echo "  英语听写工具 - 一键部署脚本"
echo "=========================================="

# 安装依赖
echo "[1/5] 安装系统依赖..."
yum install -y python3 python3-pip

# 安装 Python 依赖
echo "[2/5] 安装 Python 依赖..."
pip3 install flask flask-cors requests

# 创建 systemd 服务
echo "[3/5] 创建系统服务..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cat > /etc/systemd/system/repeat-speaker.service << EOF
[Unit]
Description=Repeat Speaker English Learning Tool
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/python3 run.py
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
echo "[4/5] 启动服务..."
systemctl daemon-reload
systemctl enable repeat-speaker
systemctl restart repeat-speaker

# 配置防火墙
echo "[5/5] 配置防火墙..."
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=5001/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
fi

# 获取服务器 IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo ""
echo "  访问地址: http://${SERVER_IP}:5001"
echo ""
echo "  常用命令:"
echo "    查看状态: systemctl status repeat-speaker"
echo "    查看日志: journalctl -u repeat-speaker -f"
echo "    重启服务: systemctl restart repeat-speaker"
echo ""
echo "  重要: 请在阿里云控制台的安全组中开放 5001 端口!"
echo "=========================================="
