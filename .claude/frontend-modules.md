# 前端模块详细文档

## 模块依赖关系图

```
app.js (入口)
├── state.js (全局状态)
├── api.js (API 调用)
├── audio.js (音频播放)
├── theme.js (主题管理)
├── utils.js (工具函数)
├── preload.js (预加载系统)
│   ├── storage/localCache.js (localStorage 缓存)
│   └── storage/blobManager.js (Blob URL 管理)
├── i18n/index.js (国际化)
│   ├── zh.js, en.js, ja.js, ko.js, fr.js
├── auth/index.js (认证模块)
│   ├── state.js, api.js, login.js, sync.js
├── sync/
│   ├── settings.js (设置同步)
│   └── websocket.js (WebSocket 客户端)
├── wordcard/index.js (单词卡管理)
│   ├── storage.js, layout.js, render.js
│   ├── drag.js, folder.js, colorpicker.js
├── repeater/index.js (复读模式)
│   ├── state.js, keyboard.js, scroll.js
│   ├── slider.js, playback.js, render.js
└── dictation/index.js (听写模式)
    ├── quiz.js, drag.js
```

---

## 1. 核心状态管理 (state.js)

**文件路径**: `js/state.js`

### 导出的全局状态

```javascript
// 复读模式状态
export let currentRepeaterState = null;

// 当前激活的模式 ('repeater' | 'dictation' | null)
export let currentActiveMode = null;

// 正在加载的音频集合
export const loadingAudio = new Set();

// 预加载缓存（核心数据结构）
export const preloadCache = {
  entries: [],            // [{word, definition}]
  translations: {},       // {word: translation}
  wordInfo: {},          // {word: {phonetic, translation, definitions, ...}}
  audioUrls: {},         // {`${text}:${accent}:${lang}`: Blob URL}
  slowAudioUrls: {},     // 慢速音频
  sentenceAudioUrls: {}, // 例句音频
  loading: false,
  loadId: 0,             // 用于取消旧的加载
  abortController: null,
  translationLoaded: 0,
  translationTotal: 0,
  audioLoaded: 0,
  audioTotal: 0,
  audioPartial: {}       // {text: count} 追踪每个单词已加载的音频数
};

// 已加载的单词卡信息
export let loadedWordcard = {
  name: null,
  originalContent: null  // 用于检测是否修改
};
```

### 核心函数

```javascript
export function setCurrentRepeaterState(state)
export function setCurrentActiveMode(mode)
export function setLoadedWordcard(name, content)
```

---

## 2. 预加载系统 (preload.js)

**文件路径**: `js/preload.js`

### 核心流程

1. 解析 textarea 内容，提取单词和自定义定义
2. 检查 localStorage 缓存（按语言分开存储）
3. 批量请求 DeepSeek API 获取未缓存的单词信息
4. 并行加载音频（限制并发数为 6）
5. 更新进度条

### 关键函数

```javascript
// 开始预加载
export async function startPreload(forceReload = false)

// 防抖版本（500ms）
export const debouncedPreload = debounce(startPreload, 500)

// 更新进度条
export function updatePreloadProgress()

// 取消当前预加载
export function cancelPreload()
```

### 音频加载策略

- **英语**: 4 个变体（US 正常、US 慢速、UK 正常、UK 慢速）
- **其他语言**: 2 个变体（正常、慢速）
- **并发限制**: 6 个并发请求
- **取消机制**: 使用 `AbortController` 和 `loadId`

### 优化技术

```javascript
// 1. 使用 loadId 防止异步竞态
const myLoadId = ++preloadCache.loadId;
if (myLoadId !== preloadCache.loadId) return;

// 2. 使用 AbortController 取消旧请求
preloadCache.abortController?.abort();
preloadCache.abortController = new AbortController();

// 3. 限制并发数
await promiseAllWithLimit(audioTasks, 6);
```

---

## 3. 音频播放 (audio.js)

**文件路径**: `js/audio.js`

### 导出的状态和函数

```javascript
export let currentAudio = null;  // 当前播放的 Audio 对象

// 核心函数
export function stopAudio()
export function isAudioPlaying()
export async function speakWord(word, slow = false)
export async function speakText(text, slow = false)  // 返回 Promise
```

### 播放策略

```javascript
// 短文本（≤3 词）：使用有道 TTS API
if (wordCount <= 3) {
  const url = getTtsUrl(text, slow, accent, targetLang);
  // 检查缓存 → 播放
}

// 长句子（>3 词）：使用浏览器 Web Speech API
else {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getLangCode(targetLang);
  speechSynthesis.speak(utterance);
}
```

### 缓存查找顺序

1. 检查 `preloadCache.audioUrls` 或 `slowAudioUrls`
2. 未命中则 fetch TTS API
3. 创建 Blob URL 并缓存
4. 播放音频

---

## 4. Blob URL 管理 (storage/blobManager.js)

**文件路径**: `js/storage/blobManager.js`

### BlobManager 类

```javascript
class BlobManager {
  constructor(maxUrls = 200)

  // 创建并缓存 Blob URL
  create(blob, key)

  // 获取缓存的 URL
  get(key)

  // 释放单个 URL
  release(key)

  // 释放所有 URL
  releaseAll()

  // LRU 淘汰最旧的 URL
  evictOldest()
}
```

### 三个实例

```javascript
export const audioBlobManager = new BlobManager(200);
export const slowAudioBlobManager = new BlobManager(200);
export const sentenceAudioBlobManager = new BlobManager(100);
```

### 作用

防止 Blob URL 内存泄漏，自动管理生命周期，使用 LRU 策略淘汰旧的 URL。

---

## 5. localStorage 缓存 (storage/localCache.js)

**文件路径**: `js/storage/localCache.js`

### 存储格式

```javascript
// localStorage 键名格式
localStorage['wordinfo_en_zh'] = {
  "apple": {
    phonetic: "/ˈæp.əl/",
    translation: "苹果",
    // ...
  }
}
```

### 核心函数

```javascript
// 获取缓存
export function getLocalWordInfo(targetLang, nativeLang)

// 设置缓存
export function setLocalWordInfo(wordInfo, targetLang, nativeLang)

// 批量添加
export function addWordInfoBatch(results, targetLang, nativeLang)

// 过滤已缓存的单词
export function filterCachedWords(words, targetLang, nativeLang)

// 清除缓存
export function clearLocalWordInfo(targetLang, nativeLang)
```

### 限制

每个语言最多缓存 **500 个单词**，防止 localStorage 溢出。

---

## 6. 复读模式 (repeater/)

**文件路径**: `js/repeater/index.js`

### 状态结构

```javascript
{
  entries: [{word, definition}],
  words: ["apple", "happy"],
  currentIndex: 0,
  currentRepeat: 0,
  settings: {
    repeat: 1,
    interval: 300,
    slow: false,
    shuffle: false,
    accent: 'us'
  },
  isPaused: false,
  translations: ["苹果", "快乐"]
}
```

### 子模块

#### playback.js - 播放控制

```javascript
// playId 机制防止异步冲突
let playId = 0;
export function incrementPlayId() { playId++; }
export function getPlayId() { return playId; }

// 核心播放函数
async function playCurrentWord(myId) {
  if (myId !== getPlayId()) return;  // 取消旧的播放
  // 播放逻辑...
}

export function startPlayLoop()
export function pausePlay()
export function resumePlay()
export function stopPlay()
```

#### render.js - UI 渲染

```javascript
// 4 个信息视图
export function renderRepeaterInfo(state, mode) {
  switch(mode) {
    case 0: // 音标 + 词性标签 + 母语翻译
    case 1: // 目标语言词性释义
    case 2: // 例句（common + fun）
    case 3: // 同义词 + 反义词
  }
}

// Apple 风格滑块
export function renderSlider(state)
```

#### slider.js - 滑块交互

```javascript
// 支持键盘/鼠标/触摸操作
export function initSlider()
export function updateSliderPosition(index)
export function getSliderValue()  // 返回 0-3
```

#### scroll.js - 滚动控制

```javascript
// 点击跳转、自动居中
export function scrollToIndex(index)
export function highlightCurrent(index)
```

#### keyboard.js - 键盘快捷键

```javascript
// Space: 暂停/继续
// ←/→: 上一个/下一个单词
// ↑/↓: 切换信息视图
export function initKeyboard()
```

---

## 7. 听写模式 (dictation/)

**文件路径**: `js/dictation/index.js`

### 状态结构

```javascript
{
  entries: [{word, definition}],
  words: ["apple"],
  speakTexts: ["apple"],      // 播放的文本
  expectTexts: ["apple"],     // 期望输入的文本
  dictateMode: "listenA_writeB",  // 或 "listenB_writeA"
  currentIndex: 0,
  maxRetry: 3,
  attempts: [["aple", "apple"]],  // 每个单词的尝试记录
  results: [true],            // 每个单词的最终结果
  slow: false,
  isPaused: false
}
```

### 核心逻辑 (quiz.js)

```javascript
// 开始听写
export async function startQuiz(state)

// 播放当前单词
async function playCurrentWord(state)

// 检查答案
function checkAnswer(state, userInput)

// 显示成绩单（纸张效果 + 印章）
function showResults(state)
```

### 弹窗拖拽 (drag.js)

```javascript
// 支持鼠标和触摸拖拽
export function makeDraggable(element)
```

---

## 8. 单词卡管理 (wordcard/)

**文件路径**: `js/wordcard/index.js`

### 功能模块

#### storage.js - 存储操作

```javascript
export function saveWordcard(name, content)
export function loadWordcard(name)
export function deleteWordcard(name)
export function getAllWordcards()
export function renameWordcard(oldName, newName)
```

#### layout.js - 布局持久化

```javascript
// 布局数据结构
[
  {type: 'card', name: 'list1'},
  {type: 'folder', name: 'folder1', items: ['list2', 'list3']}
]

export function saveLayout(layout)
export function loadLayout()
export function getCardColor(name)
export function setCardColor(name, color)
```

#### render.js - 卡片渲染

```javascript
export function renderWordcardCards()
export function createCardElement(item)
export function createFolderElement(item)
```

#### drag.js - 拖拽排序

```javascript
// 支持卡片拖拽到文件夹
export function initDragAndDrop()
export function handleDragStart(e)
export function handleDrop(e)
```

#### folder.js - 文件夹操作

```javascript
export function createFolder(name)
export function deleteFolder(name)
export function addToFolder(folderName, cardName)
export function removeFromFolder(folderName, cardName)
```

#### colorpicker.js - 颜色选择器

```javascript
// 8 种颜色 + 原色
const COLORS = ['pink', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];

export function showColorPicker(cardName, currentColor)
```

---

## 9. 认证模块 (auth/)

**文件路径**: `js/auth/index.js`

### 状态

```javascript
export let currentUser = null;
export let authToken = null;
export let syncStatus = 'idle';  // 'idle' | 'syncing' | 'synced' | 'error'
```

### 核心流程

```javascript
// 1. 登录
export async function login(email, password)
// 保存 token 到 localStorage
// 初始化 WebSocket
// 拉取云端数据

// 2. 注册
export async function register(email, password)

// 3. 登出
export async function logout()
// 清除 token
// 断开 WebSocket

// 4. 忘记密码
export async function forgotPassword(email)
export async function resetPassword(email, code, newPassword)
```

### 同步模块 (sync.js)

```javascript
// 拉取云端数据
export async function pullFromCloud()

// 推送单词卡
export async function saveWordcardToCloud(name, content)

// 推送布局
export async function syncLayoutToCloud()

// 推送设置
export async function saveSettingToServer(key, value)
```

### WebSocket (websocket.js)

```javascript
export function initWebSocket(serverUrl)
export function disconnectWebSocket()

// 监听事件
socket.on('settings:update', (data) => {
  applySettings(data.settings);
});

socket.on('layout:update', (data) => {
  renderWordcardCards();
});

socket.on('wordcard:update', (data) => {
  renderWordcardCards();
});
```

---

## 10. 国际化 (i18n/)

**文件路径**: `js/i18n/index.js`

### 支持语言

- 中文 (zh)
- 英文 (en)
- 日文 (ja)
- 韩文 (ko)

### 使用方式

```javascript
import { t, setLanguage } from './i18n/index.js';

// 简单翻译
t('load')  // "加载"

// 带参数
t('errorHttp', {status: 404})  // "HTTP 错误: 404"

// 切换语言
setLanguage('en')
```

### HTML 自动更新

```html
<!-- 文本内容 -->
<button data-i18n="load">Load</button>

<!-- 属性值 -->
<input data-i18n="wordInputPlaceholder" data-i18n-attr="placeholder">
```

### 自动更新机制

```javascript
export function updatePageLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const attr = el.dataset.i18nAttr;

    if (attr) {
      el.setAttribute(attr, t(key));
    } else {
      el.textContent = t(key);
    }
  });
}
```

---

## 11. 工具函数 (utils.js)

**文件路径**: `js/utils.js`

### 核心函数

```javascript
// 防抖
export function debounce(func, wait)

// 节流
export function throttle(func, wait)

// DOM 操作
export function $(selector)
export function $$(selector)
export function createElement(tag, className, textContent)

// 设置管理
export function getSetting(key, defaultValue)
export function setSetting(key, value)
export function getAllSettings()

// 语言检测
export function detectLanguageFromInput(text)
export function filterInvalidChars(text, lang)

// 并发控制
export async function promiseAllWithLimit(tasks, limit)
```

---

## 12. 循环依赖解决方案

### 问题

`repeater/index.js` 和 `dictation/index.js` 互相引用，导致循环依赖。

### 解决方案：延迟绑定

```javascript
// repeater/index.js
let Dictation = null;
export function setDictationRef(ref) {
  Dictation = ref;
}

// dictation/index.js
let Repeater = null;
export function setRepeaterRef(ref) {
  Repeater = ref;
}

// app.js
import { Repeater, setDictationRef } from './repeater/index.js';
import { Dictation, setRepeaterRef } from './dictation/index.js';
setDictationRef(Dictation);
setRepeaterRef(Repeater);
```

---

## 13. 异步竞态控制

### playId 机制

```javascript
let playId = 0;

export function incrementPlayId() {
  playId++;
}

export function getPlayId() {
  return playId;
}

async function playCurrentWord(myId) {
  if (myId !== getPlayId()) return;  // 取消旧的播放
  // 播放逻辑...
  setTimeout(() => playCurrentWord(myId), interval);
}
```

### AbortController

```javascript
preloadCache.abortController = new AbortController();
const signal = preloadCache.abortController.signal;

fetch(url, { signal })  // 可被 abort() 取消
```

---

## 14. 性能优化技术

1. **防抖**: 输入框 500ms 防抖，避免频繁 API 调用
2. **并发限制**: 音频加载限制 6 个并发
3. **LRU 淘汰**:
   - localStorage: 500 个单词/语言
   - Blob URL: 200 个/管理器
4. **懒加载**: 只在需要时加载音频
5. **AbortController**: 取消无用的请求
6. **缓存层级**: 内存 → localStorage → 服务端 → API
