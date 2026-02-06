# 项目架构概览

## 后端架构 (server/)

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

**主要 API 端点**:
- `/api/auth/*` - 用户认证（注册、登录、登出、忘记密码）
- `/api/wordinfo/batch` - 批量获取单词信息（翻译、释义、例句、同义词）
- `/api/youdao/*` - 有道翻译 API
- `/api/tts` - 文本转语音
- `/api/sync/*` - 数据同步（单词卡、布局、设置）
- `/api/settings` - 用户设置管理

详细文档请参考：[backend-api.md](backend-api.md)

---

## 前端架构 (ES Modules)

```
js/
├── app.js        # 入口文件，暴露到 window
├── api.js        # API 调用封装
├── audio.js      # 音频播放管理
├── state.js      # 全局状态（currentRepeaterState, preloadCache）
├── preload.js    # 后台预加载系统
├── utils.js      # DOM 辅助函数、设置管理
├── theme.js      # 主题切换
│
├── storage/
│   ├── localCache.js   # localStorage 缓存管理
│   ├── blobManager.js  # Blob URL 生命周期管理
│   └── index.js
│
├── i18n/
│   ├── index.js        # 国际化系统
│   ├── zh.js, en.js, ja.js, ko.js, fr.js
│
├── auth/
│   ├── index.js        # 认证模块入口
│   ├── state.js        # 认证状态
│   ├── api.js          # 认证 API 调用
│   ├── login.js        # 登录 UI
│   └── sync.js         # 数据同步
│
├── sync/
│   ├── settings.js     # 设置同步
│   └── websocket.js    # WebSocket 客户端
│
├── wordcard/
│   ├── index.js        # 单词卡管理入口
│   ├── storage.js      # localStorage 操作
│   ├── layout.js       # 布局持久化
│   ├── render.js       # 卡片渲染
│   ├── drag.js         # 拖拽功能
│   ├── folder.js       # 文件夹操作
│   └── colorpicker.js  # 颜色选择器
│
├── repeater/
│   ├── index.js        # 复读模式入口（Repeater 类）
│   ├── state.js        # 静态属性
│   ├── keyboard.js     # 键盘导航
│   ├── slider.js       # Apple 风格滑块
│   ├── scroll.js       # 滚动控制
│   ├── playback.js     # 播放逻辑
│   └── render.js       # UI 渲染
│
└── dictation/
    ├── index.js        # 听写模式入口（Dictation 类）
    ├── quiz.js         # 测验逻辑
    └── drag.js         # 弹窗拖拽
```

**关键设计模式**:
- **延迟绑定**: 解决循环依赖（`setRenderDeps`, `setDragDeps` 等）
- **playId 计数器**: 取消异步操作（模式切换时）
- **Re-export 文件**: 向后兼容性

详细文档请参考：[frontend-modules.md](frontend-modules.md)

---

## CSS 架构

```
css/
├── main.css       # 入口（导入顺序：colors→base→components→home→menu→repeater→dictation→responsive）
├── colors.css     # CSS 变量（主题颜色）
├── base.css       # 基础样式
├── components.css # 共享组件（按钮、状态颜色）
├── home.css       # 主页视图（单词卡、文件夹、拖拽）
├── menu.css       # 顶部菜单和侧边栏
├── repeater.css   # 复读模式
├── dictation.css  # 听写模式
├── auth.css       # 登录弹窗
└── responsive.css # 移动端断点
```

**设计风格**: 液态玻璃清新风
- 半透明玻璃效果 + 背景模糊
- 流畅的动画和过渡
- 轻盈明快的色彩搭配
- 现代简约的界面元素
- 柔和阴影和圆角

**主题系统**: 8 套主题（Pink/Green/Blue/Purple × Light/Dark）

详细文档请参考：[css-system.md](css-system.md)

---

## 数据流架构

### 四级缓存系统

```
Level 1: 内存缓存 (preloadCache)
    ↓ 未命中
Level 2: localStorage (按语言分开，最多 500 个/语言)
    ↓ 未命中
Level 3: 服务端缓存 (cache/wordinfo/*.json，最多 5000 个/语言)
    ↓ 未命中
Level 4: DeepSeek API / 有道 API
```

### 预加载流程

```
用户输入单词
    ↓
debouncedPreload (500ms 防抖)
    ↓
解析单词列表（支持 word:definition 格式）
    ↓
检查 localStorage 缓存
    ↓
批量请求 DeepSeek API（未缓存的单词）
    ↓
并行加载音频（限制 6 个并发）
    ├─ 英语: 4 个变体（US/UK × 正常/慢速）
    └─ 其他: 2 个变体（正常/慢速）
    ↓
更新进度条
```

### 播放流程（Repeater 模式）

使用 **playId 机制**防止异步竞态：
- 每次开始播放时 `playId++`
- 播放函数检查 `myId === getPlayId()`
- 切换模式时增加 playId，自动取消旧的播放循环

### 同步流程

- **登录时**: 拉取云端数据（单词卡、布局、设置）
- **操作时**: 推送到云端
- **WebSocket**: 实时同步多设备

详细文档请参考：[data-flow.md](data-flow.md)

---

## 关键技术亮点

### 1. 循环依赖解决
使用延迟绑定（Lazy Binding）解决 `repeater` 和 `dictation` 模块的循环依赖。

### 2. 异步竞态控制
- **playId 机制**: 取消旧的播放循环
- **AbortController**: 取消 fetch 请求
- **loadId**: 取消预加载任务

### 3. 并发控制
`promiseAllWithLimit(tasks, 6)` 限制音频加载并发数。

### 4. 多语言支持
- 支持 5 种语言（en, ja, ko, fr, zh）
- 自动语言检测
- 输入过滤（过滤无效字符）

### 5. 性能优化
- 四级缓存架构
- LRU 淘汰策略
- 防抖节流
- Blob URL 管理
- 懒加载

---

## 单词输入格式

Textarea 支持 `word:definition` 格式：

```
apple:苹果
happy:快乐的
```

如果不提供定义，会自动调用翻译 API。

---

## Plan Mode 规则

当用户在 Plan mode 报告 bug 时，计划的结尾必须包含：
1. **Bug Summary** - 用你自己的话重述 bug
2. **Fix Approach** - 解释你计划如何修改
