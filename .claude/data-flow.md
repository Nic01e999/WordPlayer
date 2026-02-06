# 数据流和状态管理详细文档

## 概览

本文档详细描述项目中的数据流动、状态管理机制和关键业务流程。

---

## 1. 缓存层级架构

```
用户输入
    ↓
Level 1: 内存缓存 (preloadCache)
    ↓ 未命中
Level 2: localStorage (按语言分开)
    ↓ 未命中
Level 3: 服务端缓存 (cache/wordinfo/*.json)
    ↓ 未命中
Level 4: DeepSeek API / 有道 API
```

### Level 1: 内存缓存

**位置**: `js/state.js` - `preloadCache`

**数据结构**:
```javascript
{
  entries: [{word, definition}],
  translations: {word: translation},
  wordInfo: {word: {phonetic, translation, definitions, ...}},
  audioUrls: {`${text}:${accent}:${lang}`: Blob URL},
  slowAudioUrls: {},
  sentenceAudioUrls: {},
  loading: false,
  loadId: 0,
  abortController: null,
  translationLoaded: 0,
  translationTotal: 0,
  audioLoaded: 0,
  audioTotal: 0,
  audioPartial: {}
}
```

**特点**:
- 最快的访问速度
- 页面刷新后丢失
- 无大小限制

### Level 2: localStorage 缓存

**位置**: `js/storage/localCache.js`

**存储键名**: `wordinfo_${targetLang}_${nativeLang}`

**限制**: 每个语言最多 500 个单词

**优点**:
- 持久化存储
- 跨会话保留
- 快速访问

**缺点**:
- 5-10MB 大小限制
- 同步 API（可能阻塞）

### Level 3: 服务端缓存

**位置**: `server/cache.py` + `cache/wordinfo/*.json`

**限制**: 每个语言最多 5000 个单词

**LRU 淘汰策略**:
```python
def evict_old_entries(cache_data, max_entries=5000):
    if len(cache_data) > max_entries:
        # 按访问时间排序，删除最旧的
        sorted_items = sorted(cache_data.items(),
                            key=lambda x: x[1].get('last_accessed', 0))
        cache_data = dict(sorted_items[-max_entries:])
    return cache_data
```

### Level 4: 外部 API

**DeepSeek API**: 获取详细单词信息
**有道 API**: 翻译和 TTS

---

## 2. 预加载流程

### 完整流程图

```
用户输入单词
    ↓
debouncedPreload (500ms 防抖)
    ↓
解析单词列表
    ├─ 支持 "word:definition" 格式
    └─ 提取纯单词列表
    ↓
检查 localStorage 缓存
    ├─ 命中: 直接使用
    └─ 未命中: 记录需要请求的单词
    ↓
批量请求 DeepSeek API
    ├─ 每次最多 50 个单词
    ├─ 使用 AbortController 可取消
    └─ 更新进度条 (翻译进度)
    ↓
保存到 localStorage
    ↓
并行加载音频 (限制 6 个并发)
    ├─ 英语: 4 个变体 (US/UK × 正常/慢速)
    ├─ 其他: 2 个变体 (正常/慢速)
    ├─ 创建 Blob URL
    └─ 更新进度条 (音频进度)
    ↓
预加载完成
```

### 关键代码

**文件**: `js/preload.js`

```javascript
export async function startPreload(forceReload = false) {
  // 1. 增加 loadId，取消旧的加载
  const myLoadId = ++preloadCache.loadId;

  // 2. 取消旧的请求
  preloadCache.abortController?.abort();
  preloadCache.abortController = new AbortController();

  // 3. 解析单词
  const entries = parseWordInput(textarea.value);
  const words = entries.map(e => e.word);

  // 4. 检查 localStorage
  const cachedInfo = getLocalWordInfo(targetLang, nativeLang);
  const uncachedWords = words.filter(w => !cachedInfo[w]);

  // 5. 批量请求 API
  if (uncachedWords.length > 0) {
    const results = await fetchWordInfoBatch(uncachedWords);
    addWordInfoBatch(results, targetLang, nativeLang);
  }

  // 6. 检查是否被取消
  if (myLoadId !== preloadCache.loadId) return;

  // 7. 并行加载音频
  const audioTasks = generateAudioTasks(words);
  await promiseAllWithLimit(audioTasks, 6);

  // 8. 更新状态
  preloadCache.loading = false;
  updatePreloadProgress();
}
```

### 防抖机制

```javascript
export const debouncedPreload = debounce(startPreload, 500);

// 用户输入时调用
wordInput.addEventListener('input', () => {
  debouncedPreload();
});
```

---

## 3. 播放流程（Repeater 模式）

### 状态机

```
[停止] ──startPlayLoop()──> [播放中]
   ↑                            │
   │                            │
   └────────stopPlay()──────────┘
                                │
                                ├──pausePlay()──> [暂停]
                                │                    │
                                │<───resumePlay()────┘
```

### 播放循环

**文件**: `js/repeater/playback.js`

```javascript
let playId = 0;

export function startPlayLoop() {
  incrementPlayId();  // playId++
  const myId = getPlayId();
  playCurrentWord(myId);
}

async function playCurrentWord(myId) {
  // 1. 检查是否被取消
  if (myId !== getPlayId()) return;

  const state = currentRepeaterState;
  const word = state.words[state.currentIndex];

  // 2. 播放音频
  await speakWord(word, state.settings.slow);

  // 3. 等待音频结束
  await waitSpeechEnd();

  // 4. 检查是否被取消
  if (myId !== getPlayId()) return;

  // 5. 更新重复计数
  state.currentRepeat++;

  // 6. 判断是否进入下一个单词
  if (state.currentRepeat >= state.settings.repeat) {
    state.currentRepeat = 0;
    state.currentIndex++;

    // 7. 判断是否结束
    if (state.currentIndex >= state.words.length) {
      if (state.settings.shuffle) {
        shuffleWords(state);
        state.currentIndex = 0;
      } else {
        stopPlay();
        return;
      }
    }

    // 8. 高亮当前单词
    highlightCurrent(state.currentIndex);
    scrollToIndex(state.currentIndex);
  }

  // 9. 延迟后继续播放
  setTimeout(() => {
    playCurrentWord(myId);
  }, state.settings.interval);
}
```

### playId 机制

**作用**: 防止异步竞态，取消旧的播放循环

**场景**:
- 用户切换到听写模式
- 用户点击停止按钮
- 用户加载新的单词卡

```javascript
// 切换模式时
export function stopPlay() {
  incrementPlayId();  // 使旧的 playId 失效
  stopAudio();
}
```

---

## 4. 听写流程（Dictation 模式）

### 状态机

```
[准备] ──startQuiz()──> [播放单词]
                            │
                            ↓
                        [等待输入]
                            │
                            ├──正确──> [下一个单词]
                            │              │
                            │              ↓
                            │          [播放单词]
                            │
                            └──错误──> [重试]
                                        │
                                        ├──未超过最大重试──> [播放单词]
                                        │
                                        └──超过最大重试──> [标记失败] ──> [下一个单词]
```

### 核心逻辑

**文件**: `js/dictation/quiz.js`

```javascript
export async function startQuiz(state) {
  state.currentIndex = 0;
  state.attempts = [];
  state.results = [];

  await playCurrentWord(state);
  showInputPopup(state);
}

async function playCurrentWord(state) {
  const text = state.speakTexts[state.currentIndex];
  await speakText(text, state.slow);
}

function checkAnswer(state, userInput) {
  const expected = state.expectTexts[state.currentIndex];
  const normalized = normalizeInput(userInput);

  // 记录尝试
  if (!state.attempts[state.currentIndex]) {
    state.attempts[state.currentIndex] = [];
  }
  state.attempts[state.currentIndex].push(userInput);

  // 判断正确性
  if (normalized === expected.toLowerCase()) {
    state.results[state.currentIndex] = true;
    showCorrectFeedback();
    moveToNext(state);
  } else {
    const retryCount = state.attempts[state.currentIndex].length;

    if (retryCount >= state.maxRetry) {
      state.results[state.currentIndex] = false;
      showFailedFeedback(expected);
      moveToNext(state);
    } else {
      showIncorrectFeedback();
      playCurrentWord(state);
    }
  }
}

function moveToNext(state) {
  state.currentIndex++;

  if (state.currentIndex >= state.words.length) {
    showResults(state);
  } else {
    playCurrentWord(state);
  }
}
```

### 听写模式

**listenA_writeB**: 听单词，写翻译
**listenB_writeA**: 听翻译，写单词

```javascript
if (dictateMode === 'listenA_writeB') {
  state.speakTexts = state.words;
  state.expectTexts = state.translations;
} else {
  state.speakTexts = state.translations;
  state.expectTexts = state.words;
}
```

---

## 5. 同步流程

### 登录流程

```
用户输入邮箱密码
    ↓
POST /api/auth/login
    ↓
保存 token 到 localStorage
    ↓
initWebSocket(serverUrl)
    ↓
socket.emit('connect', {auth: {token}})
    ↓
pullFromCloud()
    ├─ 拉取单词卡
    ├─ 拉取布局
    └─ 拉取设置
    ↓
应用到 UI
    ├─ renderWordcardCards()
    ├─ applyLayout()
    └─ applySettings()
```

### 推送流程

**触发时机**:
1. 保存单词卡
2. 修改布局（拖拽、颜色）
3. 修改设置

**流程**:
```
用户操作
    ↓
更新本地状态
    ↓
POST /api/sync/push 或 PUT /api/settings
    ↓
WebSocket 广播到其他设备
    ↓
其他设备接收事件
    ↓
更新 UI
```

### WebSocket 事件

**文件**: `js/sync/websocket.js`

```javascript
socket.on('settings:update', (data) => {
  applySettings(data.settings);
  showNotification('设置已同步');
});

socket.on('layout:update', (data) => {
  loadLayout();
  renderWordcardCards();
  showNotification('布局已同步');
});

socket.on('wordcard:update', (data) => {
  if (data.action === 'save') {
    saveWordcard(data.name, data.wordcard.words);
  } else if (data.action === 'delete') {
    deleteWordcard(data.name);
  }
  renderWordcardCards();
  showNotification('单词卡已同步');
});
```

---

## 6. 音频播放管理

### Blob URL 生命周期

```
fetch TTS API
    ↓
获取 MP3 二进制数据
    ↓
创建 Blob 对象
    ↓
BlobManager.create(blob, key)
    ├─ 创建 Blob URL
    ├─ 缓存到 Map
    └─ 检查是否超过限制
        ├─ 是: LRU 淘汰最旧的
        └─ 否: 直接缓存
    ↓
返回 Blob URL
    ↓
Audio 对象播放
    ↓
页面卸载或切换单词卡
    ↓
BlobManager.releaseAll()
    ↓
URL.revokeObjectURL(url)
```

### 音频播放策略

**文件**: `js/audio.js`

```javascript
export async function speakWord(word, slow = false) {
  // 1. 停止当前播放
  stopAudio();

  // 2. 检查缓存
  const cacheKey = `${word}:${accent}:${targetLang}`;
  const cache = slow ? preloadCache.slowAudioUrls : preloadCache.audioUrls;

  if (cache[cacheKey]) {
    // 3. 缓存命中，直接播放
    return playAudioUrl(cache[cacheKey]);
  }

  // 4. 缓存未命中，fetch API
  const url = getTtsUrl(word, slow, accent, targetLang);
  const response = await fetch(url);
  const blob = await response.blob();

  // 5. 创建 Blob URL
  const blobManager = slow ? slowAudioBlobManager : audioBlobManager;
  const blobUrl = blobManager.create(blob, cacheKey);

  // 6. 缓存并播放
  cache[cacheKey] = blobUrl;
  return playAudioUrl(blobUrl);
}

function playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    currentAudio = new Audio(url);
    currentAudio.onended = resolve;
    currentAudio.onerror = reject;
    currentAudio.play();
  });
}
```

---

## 7. 并发控制

### promiseAllWithLimit

**文件**: `js/utils/concurrency.js`

**作用**: 限制并发数，避免同时发起过多请求

```javascript
export async function promiseAllWithLimit(tasks, limit) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);

    if (limit <= tasks.length) {
      const e = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}
```

**使用场景**:
```javascript
// 加载音频，限制 6 个并发
const audioTasks = words.map(word => () => loadAudio(word));
await promiseAllWithLimit(audioTasks, 6);
```

---

## 8. 状态持久化

### localStorage 存储

**单词卡**:
```javascript
localStorage['wordcard-${name}'] = JSON.stringify({
  name,
  content,
  created: timestamp
});
```

**布局**:
```javascript
localStorage['wordcard-layout'] = JSON.stringify([
  {type: 'card', name: 'list1'},
  {type: 'folder', name: 'folder1', items: ['list2']}
]);
```

**卡片颜色**:
```javascript
localStorage['wordcard-card-colors'] = JSON.stringify({
  'list1': 'pink',
  'list2': 'blue'
});
```

**设置**:
```javascript
localStorage['settings'] = JSON.stringify({
  targetLang: 'en',
  accent: 'us',
  repeat: 1,
  interval: 300
});
```

**认证 Token**:
```javascript
localStorage['auth-token'] = token;
```

### 云端存储

**数据库表**: `wordcards`, `user_layout`, `user_settings`

**同步策略**:
- 登录时拉取云端数据
- 操作时推送到云端
- WebSocket 实时同步多设备

---

## 9. 错误处理

### API 请求错误

```javascript
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
} catch (error) {
  console.error('API 请求失败:', error);
  showErrorNotification('网络错误，请稍后重试');
  return null;
}
```

### 音频加载错误

```javascript
currentAudio.onerror = () => {
  console.error('音频加载失败:', word);
  // 降级到浏览器 TTS
  useBrowserTTS(word);
};
```

### WebSocket 断线重连

```javascript
socket.on('disconnect', () => {
  console.log('WebSocket 断开连接');
  setTimeout(() => {
    socket.connect();
  }, 3000);
});
```

---

## 10. 性能优化总结

### 1. 缓存策略
- 四级缓存：内存 → localStorage → 服务端 → API
- LRU 淘汰策略
- Blob URL 管理

### 2. 并发控制
- 限制音频加载并发数为 6
- 批量 API 请求（最多 50 个/次）

### 3. 防抖节流
- 输入框 500ms 防抖
- 滚动事件节流

### 4. 异步取消
- AbortController 取消 fetch 请求
- playId 机制取消播放循环

### 5. 懒加载
- 只在需要时加载音频
- 按需请求单词信息

### 6. 代码分割
- ES Modules 按需加载
- 动态 import（如需要）

---

## 11. 关键数据结构

### preloadCache

```javascript
{
  entries: [{word: 'apple', definition: '苹果'}],
  translations: {'apple': '苹果'},
  wordInfo: {
    'apple': {
      phonetic: '/ˈæp.əl/',
      translation: '苹果',
      nativeDefinitions: [{pos: 'n.', meanings: ['苹果']}],
      targetDefinitions: [{pos: 'n.', meanings: ['a fruit']}],
      examples: {
        common: ['I eat an apple.'],
        fun: ['An apple a day...']
      },
      synonyms: ['fruit'],
      antonyms: []
    }
  },
  audioUrls: {
    'apple:us:en': 'blob:http://...',
    'apple:uk:en': 'blob:http://...'
  },
  slowAudioUrls: {...},
  sentenceAudioUrls: {...}
}
```

### RepeaterState

```javascript
{
  entries: [{word, definition}],
  words: ['apple', 'happy'],
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
  translations: ['苹果', '快乐']
}
```

### DictationState

```javascript
{
  entries: [{word, definition}],
  words: ['apple'],
  speakTexts: ['apple'],
  expectTexts: ['苹果'],
  dictateMode: 'listenA_writeB',
  currentIndex: 0,
  maxRetry: 3,
  attempts: [['aple', 'apple']],
  results: [true],
  slow: false,
  isPaused: false
}
```
