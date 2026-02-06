# 后端 API 详细文档

## 后端架构概览

```
server/
├── app.py           # Flask 主应用，WebSocket 服务
├── config.py        # 配置管理（环境变量）
├── db.py            # SQLite 数据库连接和初始化
├── middleware.py    # 认证中间件 @require_auth
├── auth.py          # 用户认证 API（注册/登录/忘记密码）
├── sync.py          # 数据同步 API（单词卡/布局）
├── settings.py      # 用户设置 API
├── deepseek.py      # DeepSeek AI 单词信息 API
├── youdao.py        # 有道词典翻译 API（多语言）
├── tts.py           # 有道 TTS 语音合成 API
├── cache.py         # 单词缓存系统（LRU 淘汰）
├── email_service.py # 邮件服务（密码重置）
└── utils.py         # 工具函数
```

---

## 1. 认证模块 (auth.py)

**文件路径**: `server/auth.py`

### API 端点

#### POST `/api/auth/register`

**功能**: 用户注册

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00"
  }
}
```

#### POST `/api/auth/login`

**功能**: 用户登录

**请求体**: 同注册

**响应**: 同注册

#### POST `/api/auth/logout`

**功能**: 用户登出

**请求头**: `Authorization: Bearer <token>`

**响应**: `{"success": true}`

#### GET `/api/auth/me`

**功能**: 获取当前用户信息

**请求头**: `Authorization: Bearer <token>`

#### POST `/api/auth/forgot-password`

**功能**: 发送密码重置验证码（5分钟过期，60秒冷却）

#### POST `/api/auth/reset-password`

**功能**: 重置密码

**请求体**:
```json
{
  "email": "user@example.com",
  "code": "123456",
  "password": "newpassword123"
}
```

### 核心实现

```python
# 密码哈希（bcrypt，12 轮）
password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(12))

# Token 生成（30 天有效期）
token = secrets.token_urlsafe(32)
expires_at = datetime.now() + timedelta(days=30)
```

---

## 2. 单词信息模块 (deepseek.py)

**文件路径**: `server/deepseek.py`

### API 端点

#### POST `/api/wordinfo/batch`

**功能**: 批量获取单词信息（简化版）

**请求体**:
```json
{
  "words": ["apple", "happy"],
  "targetLang": "en",
  "nativeLang": "zh"
}
```

**响应**:
```json
{
  "results": {
    "apple": {
      "word": "apple",
      "phonetic": "/ˈæp.əl/",
      "translation": "苹果",
      "nativeDefinitions": [
        {"pos": "n.", "meanings": ["苹果"]}
      ],
      "targetDefinitions": [
        {"pos": "n.", "meanings": ["a fruit that grows on trees"]}
      ],
      "examples": {
        "common": ["I eat an apple.", "She likes apples."],
        "fun": ["An apple a day keeps the doctor away."]
      },
      "synonyms": ["fruit", "pome"],
      "antonyms": []
    }
  }
}
```

#### POST `/api/wordinfo/details`

**功能**: 获取完整单词信息（包含更多例句和详细释义）

#### GET `/api/cache/stats`

**功能**: 获取缓存统计信息

### 缓存机制

**存储位置**: `cache/wordinfo/`

**文件结构**:
```
cache/wordinfo/
├── en.json    # 英语单词缓存
├── ja.json    # 日语单词缓存
├── ko.json    # 韩语单词缓存
└── zh.json    # 中文单词缓存
```

**缓存格式**:
```json
{
  "apple": {
    "zh": {
      "word": "apple",
      "phonetic": "/ˈæp.əl/",
      "translation": "苹果"
    },
    "en": {
      "word": "apple",
      "translation": "a fruit"
    }
  }
}
```

**LRU 淘汰策略**:
- 每个语言最多缓存 **5000 个单词**
- 超过限制时删除最旧的单词

---

## 3. 有道翻译模块 (youdao.py)

**文件路径**: `server/youdao.py`

### API 端点

#### GET `/api/youdao/translate`

**查询参数**:
- `word`: 要翻译的单词
- `from`: 源语言（en, ja, ko, fr, zh）
- `to`: 目标语言

**响应**:
```json
{
  "word": "apple",
  "translation": "苹果",
  "phonetic": "/ˈæp.əl/",
  "definitions": [
    {"pos": "n.", "meanings": ["苹果", "苹果树"]}
  ]
}
```

#### POST `/api/youdao/batch`

**功能**: 批量翻译

### 支持的语言对

| 源语言 | 目标语言 | 有道 API 类型 |
|--------|----------|---------------|
| en | zh | ec (英中) |
| zh | en | ce (中英) |
| ja | zh | jc (日中) |
| zh | ja | cj (中日) |
| ko | zh | kc (韩中) |
| zh | ko | ck (中韩) |

---

## 4. TTS 语音合成 (tts.py)

**文件路径**: `server/tts.py`

### API 端点

#### GET `/api/tts`

**查询参数**:
- `word`: 要朗读的文本
- `slow`: 是否慢速（0 或 1）
- `accent`: 口音（us 或 uk，仅英语）
- `lang`: 语言（en, ja, ko, fr, zh）
- `sentence`: 是否为句子（0 或 1）

**响应**: MP3 音频流（Content-Type: audio/mpeg）

### 语言支持

| 语言 | 代码 | 支持口音 |
|------|------|----------|
| 英语 | en | US, UK |
| 日语 | ja | - |
| 韩语 | ko | - |
| 中文 | zh | - |

### 文本类型判断

```python
def is_sentence(text):
    # 超过 3 个单词视为句子
    word_count = len(text.split())
    return word_count > 3
```

---

## 5. 数据同步模块 (sync.py)

**文件路径**: `server/sync.py`

### API 端点

#### GET `/api/sync/pull`

**功能**: 拉取云端数据

**请求头**: `Authorization: Bearer <token>`

**响应**:
```json
{
  "wordcards": [
    {
      "name": "IELTS Vocabulary",
      "words": ["abandon", "ability"],
      "created_at": "2024-01-01T00:00:00",
      "updated_at": "2024-01-02T00:00:00"
    }
  ],
  "layout": [
    {"type": "card", "name": "IELTS Vocabulary"},
    {"type": "folder", "name": "My Folder", "items": ["list1"]}
  ],
  "cardColors": {
    "IELTS Vocabulary": "pink"
  },
  "settings": {
    "target_lang": "en",
    "translation_lang": "zh"
  }
}
```

#### POST `/api/sync/push`

**功能**: 推送本地数据到云端

#### GET `/api/sync/wordcard/<name>`

**功能**: 获取单个单词卡

#### POST `/api/sync/wordcard`

**功能**: 保存单词卡

#### DELETE `/api/sync/wordcard/<name>`

**功能**: 删除单词卡

### 数据存储

**注意**: 只存储单词文本，不存储翻译数据。翻译由客户端缓存管理。

---

## 6. 用户设置模块 (settings.py)

**文件路径**: `server/settings.py`

### API 端点

#### GET `/api/settings`

**响应**:
```json
{
  "settings": {
    "target_lang": "en",
    "translation_lang": "zh",
    "ui_lang": "zh",
    "theme": "system",
    "accent": "us",
    "repeat_count": 1,
    "retry_count": 1,
    "interval_ms": 300,
    "slow_mode": false,
    "shuffle_mode": false
  }
}
```

#### PUT `/api/settings`

**请求体** (单个设置):
```json
{
  "key": "target_lang",
  "value": "ja"
}
```

**请求体** (批量设置):
```json
{
  "settings": {
    "target_lang": "ja",
    "accent": "us"
  }
}
```

#### POST `/api/settings/reset`

**功能**: 重置为默认设置

### 默认设置

```python
DEFAULT_SETTINGS = {
    'target_lang': 'en',
    'translation_lang': 'zh',
    'ui_lang': 'zh',
    'theme': 'system',
    'accent': 'us',
    'repeat_count': 1,
    'retry_count': 1,
    'interval_ms': 300,
    'slow_mode': False,
    'shuffle_mode': False
}
```

---

## 7. WebSocket 实时同步

**文件路径**: `server/app.py`

### 实现

使用 **Flask-SocketIO**（可选依赖）

### 连接认证

```python
@socketio.on('connect')
def handle_connect(auth):
    token = auth.get('token')
    user = verify_token(token)
    if not user:
        return False
    join_room(f'user_{user.id}')
    return True
```

### 事件

#### `settings:update`

**触发时机**: 用户修改设置

**数据**: `{"settings": {...}}`

**广播**: 发送到 `user_{user_id}` 房间的所有客户端

#### `layout:update`

**触发时机**: 用户修改布局

#### `wordcard:update`

**触发时机**: 用户保存/删除单词卡

### 房间机制

每个用户加入 `user_{user_id}` 房间，实现多设备同步。

---

## 8. 数据库设计

**文件路径**: `server/db.py`

### 表结构

#### users - 用户表

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);
```

#### sessions - 会话表

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### wordcards - 单词卡

```sql
CREATE TABLE wordcards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  words TEXT NOT NULL,  -- JSON 数组
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, name)
);
```

#### user_settings - 用户设置

```sql
CREATE TABLE user_settings (
  user_id INTEGER PRIMARY KEY,
  target_lang TEXT DEFAULT 'en',
  translation_lang TEXT DEFAULT 'zh',
  ui_lang TEXT DEFAULT 'zh',
  accent TEXT DEFAULT 'us',
  repeat_count INTEGER DEFAULT 1,
  interval_ms INTEGER DEFAULT 300,
  slow_mode BOOLEAN DEFAULT 0,
  shuffle_mode BOOLEAN DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 9. 中间件 (middleware.py)

**文件路径**: `server/middleware.py`

### @require_auth 装饰器

```python
def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized'}), 401

        token = auth_header.split(' ')[1]
        user = verify_token(token)
        if not user:
            return jsonify({'error': 'Invalid token'}), 401

        request.current_user = user
        return f(*args, **kwargs)
    return decorated_function
```

---

## 10. 性能优化

### 缓存策略

1. **单词信息缓存**: 5000 个单词/语言，LRU 淘汰
2. **TTS 音频**: 客户端缓存（Blob URL）
3. **数据库索引**: email, token, user_id

### 安全措施

1. **密码**: bcrypt 哈希（12 轮）
2. **Token**: 32 字节随机字符串
3. **验证码**: 5 分钟过期 + 60 秒冷却
4. **CORS**: 配置允许的源
5. **SQL 注入**: 使用参数化查询
