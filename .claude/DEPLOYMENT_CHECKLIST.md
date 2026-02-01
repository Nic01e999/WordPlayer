# 部署前检查清单

## 🔒 安全配置

### 必须配置的环境变量

```bash
# 生产环境标识
export FLASK_ENV=production
export FLASK_DEBUG=False  # 关闭 debug 模式

# DeepSeek API
export DEEPSEEK_API_KEY=your_api_key_here

# SMTP 邮件服务（用于密码重置）
export SMTP_HOST=smtp.example.com
export SMTP_PORT=465
export SMTP_USER=your_email@example.com
export SMTP_PASSWORD=your_password
export SMTP_SENDER=noreply@example.com
export SMTP_USE_SSL=true

# 安全密钥（生产环境必须更改）
export SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

# Token 过期时间（天）
export TOKEN_EXPIRE_DAYS=30

# 验证码配置
export CODE_EXPIRE_MINUTES=5
export CODE_RESEND_SECONDS=60

# 数据库路径（可选，默认为 data/databases/user_data.db）
export DATABASE_PATH=/path/to/production/user_data.db
```

## ✅ 已修复的问题

### 1. 安全问题
- ✅ **Debug 模式可配置**: 通过 `FLASK_DEBUG` 环境变量控制，默认关闭
- ✅ **WebSocket Token 安全**: 移除从 URL 参数获取 token，只从 auth 参数获取
- ✅ **生产环境 SMTP 检查**: 生产环境未配置 SMTP 时会返回错误

### 2. 性能优化
- ✅ **LRU 缓存优化**: 使用 `collections.deque` 替代 list，淘汰操作从 O(n) 优化到 O(1)
- ✅ **API 超时优化**: DeepSeek API 超时从 60s/30s 降低到 20s/15s
- ✅ **并发控制**: 音频预加载添加并发池，限制最多 6 个并发请求

### 3. 稳定性改进
- ✅ **音频播放超时保护**: 添加 30 秒超时，防止无限循环
- ✅ **localStorage 容量检查**: 捕获 QuotaExceededError，自动清理后重试
- ✅ **Blob URL 内存泄漏修复**: 避免重复创建 Blob URL
- ✅ **错误日志增强**: JSON 解析失败时记录原始响应内容

## 🚀 启动命令

### 开发环境
```bash
python3 run.py
```

### 生产环境
```bash
# 设置环境变量
export FLASK_ENV=production
export FLASK_DEBUG=False
export DEEPSEEK_API_KEY=your_key
# ... 其他环境变量

# 使用 gunicorn 启动（推荐）
pip install gunicorn eventlet
gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:5001 server.app:app

# 或使用内置服务器
python3 run.py
```

## 📋 部署后测试

### 1. 基础功能测试
- [ ] 访问首页 http://your-domain:5001
- [ ] 注册新用户
- [ ] 登录/登出
- [ ] 创建单词表
- [ ] 加载单词（测试翻译 API）
- [ ] 播放音频（测试 TTS API）
- [ ] 复读模式
- [ ] 听写模式

### 2. 安全测试
- [ ] 确认 debug 模式已关闭（访问不存在的路由不应显示调试信息）
- [ ] 测试 token 过期
- [ ] 测试密码重置流程
- [ ] 测试 WebSocket 连接（需要有效 token）

### 3. 性能测试
- [ ] 批量加载 50+ 单词
- [ ] 测试音频预加载速度
- [ ] 测试多设备同步

## ⚠️ 注意事项

1. **数据库备份**: 定期备份 `data/databases/user_data.db`
2. **日志监控**: 监控服务器日志，关注错误和异常
3. **API 配额**: 注意 DeepSeek API 的使用配额
4. **HTTPS**: 生产环境建议使用 HTTPS（可用 nginx 反向代理）
5. **防火墙**: 确保端口 5001 已开放（或使用反向代理）

## 🔧 故障排查

### 问题：无法连接 WebSocket
- 检查 `flask-socketio` 是否已安装: `pip install flask-socketio`
- 检查防火墙是否允许 WebSocket 连接

### 问题：翻译 API 失败
- 检查 `DEEPSEEK_API_KEY` 是否正确配置
- 检查 API 配额是否用尽
- 查看服务器日志获取详细错误信息

### 问题：邮件发送失败
- 检查 SMTP 配置是否正确
- 测试 SMTP 服务器连接
- 查看服务器日志获取详细错误信息

### 问题：localStorage 溢出
- 浏览器 localStorage 限制通常为 5-10MB
- 代码已添加自动清理机制
- 如仍有问题，建议用户清除浏览器缓存

## 📊 监控指标

建议监控以下指标：
- API 响应时间
- 错误率
- 数据库大小
- 内存使用
- CPU 使用
- 并发连接数

## 🔄 更新日志

### 2026-01-26 - 代码审查优化
- 修复安全漏洞（debug 模式、WebSocket token）
- 优化性能（LRU 缓存、API 超时、并发控制）
- 增强稳定性（超时保护、容量检查、内存泄漏修复）
- 改进错误处理和日志记录
