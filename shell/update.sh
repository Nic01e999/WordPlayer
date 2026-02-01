#!/bin/bash

# 部署更新脚本 - Repeat Speaker
# 用于快速更新服务器上的应用

set -e  # 遇到错误立即退出

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
SERVICE_NAME="repeat-speaker"
BACKUP_DIR="data/backups"
MAX_BACKUPS=10

# 打印带颜色的消息
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_step() {
    echo -e "\n${BLUE}[$1/$2] $3${NC}"
}

# 检查是否在 Git 仓库中
check_git_repo() {
    print_step 1 6 "检查 Git 仓库..."
    if [ ! -d ".git" ]; then
        print_error "当前目录不是 Git 仓库"
        exit 1
    fi
    print_success "Git 仓库检查通过"
}

# 检查本地修改
check_local_changes() {
    print_step 2 6 "检查本地修改..."
    if [ -n "$(git status --porcelain | grep -v '^??')" ]; then
        print_warning "检测到本地修改："
        git status --short
        echo ""
        read -p "是否继续更新？这将保留本地修改 (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "更新已取消"
            exit 0
        fi
    else
        print_success "没有本地修改"
    fi
}

# 备份数据库
backup_database() {
    print_step 3 6 "备份数据库..."

    # 创建备份目录
    mkdir -p "$BACKUP_DIR"

    # 备份数据库
    if [ -f "data/databases/user_data.db" ]; then
        BACKUP_FILE="$BACKUP_DIR/user_data.db.backup.$(date +%Y%m%d_%H%M%S)"
        cp data/databases/user_data.db "$BACKUP_FILE"
        print_success "数据库已备份到: $BACKUP_FILE"

        # 清理旧备份（保留最近 N 个）
        BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/user_data.db.backup.* 2>/dev/null | wc -l)
        if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
            print_info "清理旧备份（保留最近 $MAX_BACKUPS 个）..."
            ls -1t "$BACKUP_DIR"/user_data.db.backup.* | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f
        fi
    else
        print_warning "未找到数据库文件，跳过备份"
    fi
}

# 拉取最新代码
pull_latest_code() {
    print_step 4 6 "拉取最新代码..."

    # 保存当前提交
    OLD_COMMIT=$(git rev-parse HEAD)

    # 拉取代码
    git pull origin main

    # 获取新提交
    NEW_COMMIT=$(git rev-parse HEAD)

    if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
        print_info "已是最新版本，无需更新"
    else
        print_success "代码已更新"
        print_info "更新日志："
        git log --oneline --decorate --color "$OLD_COMMIT..$NEW_COMMIT"
    fi
}

# 检查并更新依赖
check_dependencies() {
    print_step 5 6 "检查 Python 依赖..."

    if [ -f "requirements.txt" ]; then
        print_info "更新 Python 依赖..."
        pip3 install -r requirements.txt --quiet
        print_success "依赖检查完成"
    else
        print_warning "未找到 requirements.txt，跳过依赖检查"
    fi
}

# 重启服务
restart_service() {
    print_step 6 6 "重启服务..."

    # 检查服务是否存在
    if systemctl list-units --full -all | grep -q "$SERVICE_NAME.service"; then
        sudo systemctl restart "$SERVICE_NAME"
        sleep 2
        print_success "服务已重启"
    else
        print_warning "未找到 systemd 服务: $SERVICE_NAME"
        print_info "如果是首次部署，请运行: bash deploy.sh"
        exit 1
    fi
}

# 健康检查
health_check() {
    echo ""
    print_info "执行健康检查..."

    # 检查服务状态
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_success "服务状态: 运行中"
    else
        print_error "服务状态: 未运行"
        print_info "查看日志: journalctl -u $SERVICE_NAME -n 50"
        exit 1
    fi

    # 检查端口监听
    sleep 1
    if netstat -tlnp 2>/dev/null | grep -q ":5001"; then
        print_success "端口监听: 5001 端口正常"
    else
        print_warning "端口监听: 5001 端口未监听"
    fi

    # HTTP 健康检查
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5001 | grep -q "200"; then
        print_success "HTTP 检查: 服务响应正常"
    else
        print_warning "HTTP 检查: 服务可能未完全启动"
    fi
}

# 显示完成信息
show_completion() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✓ 更新完成！${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    print_info "访问地址: http://$(hostname -I | awk '{print $1}'):5001"
    echo ""
    print_info "常用命令："
    echo "  查看服务状态: systemctl status $SERVICE_NAME"
    echo "  查看实时日志: journalctl -u $SERVICE_NAME -f"
    echo "  查看最近日志: journalctl -u $SERVICE_NAME -n 50"
    echo "  重启服务:     systemctl restart $SERVICE_NAME"
    echo "  回滚版本:     bash rollback.sh"
    echo ""
}

# 主流程
main() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Repeat Speaker - 更新部署脚本${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    check_git_repo
    check_local_changes
    backup_database
    pull_latest_code
    check_dependencies
    restart_service
    health_check
    show_completion
}

# 错误处理
trap 'print_error "更新失败！请检查错误信息"; exit 1' ERR

# 执行主流程
main
