# 服务器部署指南

## 问题分析

项目总大小：2.36 GB（磁盘上 1.7 GB）
- **data 目录**：1.1 GB（词典和例句数据）
- **.git 目录**：457 MB（Git 历史记录）
- **代码文件**：约 10 MB

主要大文件：
- `data/resources/tatoeba/links.csv`: 421 MB
- `data/databases/en_dict.db`: 340 MB
- `data/resources/tatoeba/links.tar.bz2`: 139 MB
- `data/resources/tatoeba/sentences.tar.bz2`: 66 MB

## 推荐部署方案

### 方案一：rsync 直接同步（最简单，推荐）

**优点**：
- 简单快速，一条命令搞定
- 支持增量同步，后续更新很快
- 不需要清理 Git 历史

**步骤**：

1. 修改 `scripts/deploy_rsync.sh` 中的服务器信息：
```bash
SERVER_USER="your_username"
SERVER_HOST="your_server_ip"
SERVER_PATH="/path/to/deploy"
```

2. 执行部署：
```bash
chmod +x scripts/deploy_rsync.sh
./scripts/deploy_rsync.sh
```

3. 在服务器上安装依赖并运行：
```bash
ssh your_username@your_server_ip
cd /path/to/deploy
python3 -m venv venv
source venv/bin/activate
pip3 install flask flask-cors requests
python3 run.py
```

### 方案二：tar 压缩上传

**优点**：
- 适合网络不稳定的情况
- 可以先压缩再上传

**步骤**：

1. 修改 `scripts/deploy_tar.sh` 中的服务器信息

2. 执行部署：
```bash
chmod +x scripts/deploy_tar.sh
./scripts/deploy_tar.sh
```

### 方案三：清理 Git 历史后使用 Git 部署

**优点**：
- 适合长期维护
- 可以使用 GitHub/GitLab 等托管

**缺点**：
- 需要重写 Git 历史
- 需要强制推送

**步骤**：

1. 安装 git-filter-repo：
```bash
pip3 install git-filter-repo
```

2. 备份仓库：
```bash
cp -r .git .git.backup
```

3. 执行清理：
```bash
chmod +x scripts/clean_git_history.sh
./scripts/clean_git_history.sh
```

4. 推送到 GitHub：
```bash
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main --force
```

5. 在服务器上克隆：
```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
python3 -m venv venv
source venv/bin/activate
pip3 install flask flask-cors requests
python3 run.py
```

## 服务器内存优化建议

你的服务器内存：
- 总内存：1870 MB
- 可用：176 MB
- 可分配：1155 MB

**优化建议**：

1. **使用 Gunicorn 限制工作进程**：
```bash
pip3 install gunicorn
gunicorn -w 2 -b 0.0.0.0:5001 --timeout 120 run:app
```

2. **配置 swap 空间**（如果服务器支持）：
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

3. **监控内存使用**：
```bash
watch -n 1 free -h
```

## 数据文件说明

项目运行需要以下数据文件：
- `data/databases/*.db` - 词典数据库（会自动从 resources 生成）
- `data/resources/` - 原始词典资源

首次运行时，如果数据库不存在，程序会自动从 resources 目录生成。

## 注意事项

1. **.gitignore 已更新**：大文件已被排除，不会再提交到 Git
2. **数据完整性**：确保 `data/resources/` 目录完整上传
3. **端口配置**：默认端口 5001，确保服务器防火墙开放
4. **Python 版本**：需要 Python 3.8+

## 快速开始（推荐）

```bash
# 1. 修改 deploy_rsync.sh 配置
vim scripts/deploy_rsync.sh

# 2. 执行部署
chmod +x scripts/deploy_rsync.sh
./scripts/deploy_rsync.sh

# 3. SSH 到服务器
ssh your_username@your_server_ip

# 4. 安装依赖并运行
cd /path/to/deploy
python3 -m venv venv
source venv/bin/activate
pip3 install flask flask-cors requests
python3 run.py
```
