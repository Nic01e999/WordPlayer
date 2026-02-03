#!/bin/bash
# Git 历史清理脚本 - 移除大文件
# 警告：这会重写 Git 历史，请先备份！

echo "⚠️  警告：此操作会重写 Git 历史！"
echo "建议先备份：cp -r .git .git.backup"
read -p "是否继续？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "已取消"
    exit 1
fi

echo "开始清理 Git 历史中的大文件..."

# 需要移除的文件列表
FILES_TO_REMOVE=(
    "data/resources/tatoeba/links.csv"
    "data/resources/tatoeba/links.tar.bz2"
    "data/resources/tatoeba/sentences.csv"
    "data/resources/tatoeba/sentences.tar.bz2"
    "data/resources/ecdict/ecdict.csv"
    "data/resources/cedict/cedict_ts.u8"
)

# 使用 git filter-repo 清理（推荐）
if command -v git-filter-repo &> /dev/null; then
    echo "使用 git-filter-repo 清理..."
    for file in "${FILES_TO_REMOVE[@]}"; do
        echo "移除: $file"
        git filter-repo --path "$file" --invert-paths --force
    done
else
    echo "❌ 未找到 git-filter-repo"
    echo "请安装: pip3 install git-filter-repo"
    echo ""
    echo "或使用 BFG Repo-Cleaner："
    echo "1. 下载 bfg.jar"
    echo "2. 运行: java -jar bfg.jar --delete-files '{links.csv,sentences.csv,ecdict.csv,cedict_ts.u8}' ."
    exit 1
fi

echo "✅ 清理完成！"
echo ""
echo "接下来的步骤："
echo "1. 检查仓库: git log --all --oneline"
echo "2. 强制推送到远程: git push origin --force --all"
echo "3. 清理本地引用: git reflog expire --expire=now --all && git gc --prune=now --aggressive"
