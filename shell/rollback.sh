#!/bin/bash

# 回滚脚本 - Repeat Speaker
# 用于快速回滚到上一个版本

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
    print_step 1 4 "检查 Git 仓库..."
    if [ ! -d ".git" ]; then
        print_error "当前目录不是 Git 仓库"
        exit 1
    fi
    print_success "Git 仓库检查通过"
}

# 显示可回滚的版本
show_versions() {
    print_step 2 4 "显示最近的版本..."
    echo ""
    print_info "最近 5 个提交："
    git log --oneline --decorate --color -5
    echo ""
}

# 回滚代码
rollback_code() {
    print_step 3 4 "回滚代码..."

    # 获取当前提交
    CURRENT_COMMIT=$(git rev-parse HEAD)

    # 获取上一个提交
    PREVIOUS_COMMIT=$(git rev-parse HEAD~1)

    if [ "$CURRENT_COMMIT" = "$PREVIOUS_COMMIT" ]; then
        print_warning "已经是最早的提交，无法回滚"
        exit 0
    fi

    echo ""
    print_warning "即将回滚到上一个版本："
    git log --oneline --decorate --color -1 "$PREVIOUS_COMMIT"
    echo ""

    read -p "确认回滚？(y/n): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "回滚已取消"
        exit 0
    fi

    # 执行回滚
    git reset --hard HEAD~1
    print_success "代码已回滚到上一个版本"
}

# 恢复数据库（可选）
restore_database() {
    echo ""
    read -p "是否需要恢复数据库备份？(y/n): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ ! -d "$BACKUP_DIR" ]; then
            print_warning "备份目录不存在，跳过数据库恢复"
            return
        fi

        # 列出可用的备份
        BACKUPS=($(ls -1t "$BACKUP_DIR"/dictation.db.backup.* 2>/dev/null))

        if [ ${#BACKUPS[@]} -eq 0 ]; then
            print_warning "未找到数据库备份文件"
            return
        fi

        echo ""
        print_info "可用的备份文件："
        for i in "${!BACKUPS[@]}"; do
            BACKUP_FILE="${BACKUPS[$i]}"
            BACKUP_NAME=$(basename "$BACKUP_FILE")
            BACKUP_TIME=$(echo "$BACKUP_NAME" | grep -oP '\d{8}_\d{6}')
            BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
            echo "  [$((i+1))] $BACKUP_TIME ($BACKUP_SIZE)"
        done
        echo ""

        read -p "选择要恢复的备份 (1-${#BACKUPS[@]}，0=取消): " -r
        echo ""

        if [[ $REPLY =~ ^[0-9]+$ ]] && [ "$REPLY" -ge 1 ] && [ "$REPLY" -le "${#BACKUPS[@]}" ]; then
            SELECTED_BACKUP="${BACKUPS[$((REPLY-1))]}"

            # 备份当前数据库
            if [ -f "data/dictation.db" ]; then
                CURRENT_BACKUP="$BACKUP_DIR/dictation.db.before_rollback.$(date +%Y%m%d_%H%M%S)"
                cp data/dictation.db "$CURRENT_BACKUP"
                print_info "当前数据库已备份到: $CURRENT_BACKUP"
            fi

            # 恢复备份
            cp "$SELECTED_BACKUP" data/dictation.db
            print_success "数据库已恢复: $(basename "$SELECTED_BACKUP")"
        else
            print_info "已取消数据库恢复"
        fi
    fi
}

# 重启服务
restart_service() {
    print_step 4 4 "重启服务..."

    # 检查服务是否存在
    if systemctl list-units --full -all | grep -q "$SERVICE_NAME.service"; then
        sudo systemctl restart "$SERVICE_NAME"
        sleep 2
        print_success "服务已重启"
    else
        print_warning "未找到 systemd 服务: $SERVICE_NAME"
        print_info "请手动重启应用"
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
    echo -e "${GREEN}✓ 回滚完成！${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    print_info "当前版本："
    git log --oneline --decorate --color -1
    echo ""
    print_info "访问地址: http://$(hostname -I | awk '{print $1}'):5001"
    echo ""
    print_warning "注意: 如果需要恢复到回滚前的版本，请运行:"
    echo "  git reset --hard origin/main"
    echo ""
}

# 主流程
main() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Repeat Speaker - 版本回滚脚本${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    check_git_repo
    show_versions
    rollback_code
    restore_database
    restart_service
    health_check
    show_completion
}

# 错误处理
trap 'print_error "回滚失败！请检查错误信息"; exit 1' ERR

# 执行主流程
main
