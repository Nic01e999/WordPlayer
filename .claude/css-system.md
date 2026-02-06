# CSS 样式系统详细文档

## CSS 架构概览

```
css/
├── main.css       # 入口（@import 所有模块）
├── colors.css     # CSS 变量（4 色 × 2 模式 = 8 套主题）
├── base.css       # 基础样式
├── components.css # 通用组件
├── home.css       # 主页（单词卡）
├── menu.css       # 顶部菜单栏
├── repeater.css   # 复读模式
├── dictation.css  # 听写模式
├── auth.css       # 登录弹窗
└── responsive.css # 响应式布局
```

---

## 设计风格：液态玻璃清新风

### 核心特征

1. **半透明玻璃效果**
   - `backdrop-filter: blur(20px)`
   - `background: rgba(255, 255, 255, 0.8)`

2. **流畅动画**
   - `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`
   - 平滑的悬停效果

3. **轻盈色彩**
   - 柔和的渐变背景
   - 高饱和度的强调色

4. **现代简约**
   - 圆角设计（8px-16px）
   - 柔和阴影
   - 留白充足

---

## 1. 主题系统 (colors.css)

**文件路径**: `css/colors.css`

### 实现方式

使用 CSS 变量 + `data-theme-*` 属性

```css
:root {
  --text-primary: #8b5a5a;
  --text-secondary: #a67c7c;
  --bg-page-start: #fff5f5;
  --bg-page-end: #ffe8e8;
  --accent-primary: #ffb6c1;
  --accent-secondary: #ffc0cb;
  /* ... 100+ 变量 */
}

[data-theme-color="green"][data-theme-mode="dark"] {
  --text-primary: #a8d5ba;
  --bg-page-start: #1a2f1a;
  /* ... 覆盖所有变量 */
}
```

### 8 套主题

| 主题 | 颜色 | 模式 | 特点 |
|------|------|------|------|
| Pink Light | 粉色 | 浅色 | 默认主题，温暖柔和 |
| Pink Dark | 粉色 | 深色 | 深色背景，粉色强调 |
| Green Light | 绿色 | 浅色 | 清新自然 |
| Green Dark | 绿色 | 深色 | 深绿背景 |
| Blue Light | 蓝色 | 浅色 | 冷静专业 |
| Blue Dark | 蓝色 | 深色 | 深蓝背景 |
| Purple Light | 紫色 | 浅色 | 优雅神秘 |
| Purple Dark | 紫色 | 深色 | 深紫背景 |

### 切换方式

```javascript
document.documentElement.dataset.themeColor = 'green';
document.documentElement.dataset.themeMode = 'dark';
```

### 核心变量分类

#### 文本颜色
```css
--text-primary: 主要文本
--text-secondary: 次要文本
--text-tertiary: 三级文本
--text-inverse: 反色文本（深色背景上的浅色文字）
```

#### 背景颜色
```css
--bg-page-start: 页面渐变起始色
--bg-page-end: 页面渐变结束色
--bg-card: 卡片背景
--bg-card-hover: 卡片悬停背景
--bg-input: 输入框背景
--bg-modal: 弹窗背景
```

#### 强调色
```css
--accent-primary: 主强调色
--accent-secondary: 次强调色
--accent-hover: 悬停强调色
```

#### 边框和阴影
```css
--border-color: 边框颜色
--shadow-sm: 小阴影
--shadow-md: 中阴影
--shadow-lg: 大阴影
```

---

## 2. 基础样式 (base.css)

**文件路径**: `css/base.css`

### 全局重置

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
               'PingFang SC', 'Hiragino Sans GB', sans-serif;
  background: linear-gradient(135deg,
              var(--bg-page-start),
              var(--bg-page-end));
  color: var(--text-primary);
  min-height: 100vh;
}
```

### 滚动条样式

```css
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-card);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--accent-primary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--accent-hover);
}
```

---

## 3. 通用组件 (components.css)

**文件路径**: `css/components.css`

### 按钮样式

```css
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: var(--accent-primary);
  color: var(--text-inverse);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn:hover {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn:active {
  transform: translateY(0);
}
```

### 玻璃卡片

```css
.glass-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: var(--shadow-lg);
  padding: 20px;
}
```

### 输入框

```css
.input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  transition: all 0.3s;
}

.input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.1);
}
```

### 状态颜色

```css
.status-success {
  color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
}

.status-error {
  color: #f44336;
  background: rgba(244, 67, 54, 0.1);
}

.status-warning {
  color: #ff9800;
  background: rgba(255, 152, 0, 0.1);
}

.status-info {
  color: #2196f3;
  background: rgba(33, 150, 243, 0.1);
}
```

---

## 4. 主页样式 (home.css)

**文件路径**: `css/home.css`

### 单词卡

```css
.wordcard-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
}

.wordcard-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-primary);
}

.wordcard-card.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}
```

### 文件夹样式

```css
.folder {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 24px;
  border: 2px dashed var(--border-color);
}

.folder.drag-over {
  border-color: var(--accent-primary);
  background: var(--accent-primary-light);
}

.folder-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
```

### 拖拽指示器

```css
.drop-indicator {
  position: absolute;
  height: 4px;
  background: var(--accent-primary);
  border-radius: 2px;
  transition: all 0.2s;
  pointer-events: none;
}
```

### 颜色选择器

```css
.color-picker {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: var(--bg-modal);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  border: 3px solid transparent;
  transition: all 0.2s;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: var(--text-primary);
  transform: scale(1.15);
}
```

---

## 5. 菜单栏样式 (menu.css)

**文件路径**: `css/menu.css`

### 顶部菜单

```css
.menu-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 24px;
  z-index: 1000;
}

.menu-logo {
  font-size: 24px;
  font-weight: 700;
  color: var(--accent-primary);
  background: linear-gradient(135deg,
              var(--accent-primary),
              var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### 侧边栏

```css
.sidebar {
  position: fixed;
  top: 60px;
  left: 0;
  width: 280px;
  height: calc(100vh - 60px);
  background: var(--bg-card);
  border-right: 1px solid var(--border-color);
  padding: 24px;
  overflow-y: auto;
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar.open {
  transform: translateX(0);
}
```

### 设置面板

```css
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-input);
  border-radius: 8px;
}

.setting-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.setting-value {
  font-weight: 600;
  color: var(--text-primary);
}
```

---

## 6. 复读模式样式 (repeater.css)

**文件路径**: `css/repeater.css`

### Apple 风格滑块

```css
.slider-container {
  position: relative;
  width: 100%;
  height: 60px;
  padding: 20px 0;
}

.slider-track {
  position: absolute;
  width: 100%;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  top: 50%;
  transform: translateY(-50%);
}

.slider-fill {
  position: absolute;
  height: 4px;
  background: linear-gradient(90deg,
              var(--accent-primary),
              var(--accent-secondary));
  border-radius: 2px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slider-thumb {
  position: absolute;
  width: 24px;
  height: 24px;
  background: white;
  border: 3px solid var(--accent-primary);
  border-radius: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: all 0.2s;
}

.slider-thumb:hover {
  transform: translate(-50%, -50%) scale(1.2);
  box-shadow: var(--shadow-lg);
}

.slider-thumb:active {
  transform: translate(-50%, -50%) scale(1.1);
}
```

### 单词显示区

```css
.word-display {
  text-align: center;
  padding: 40px;
  background: var(--bg-card);
  border-radius: 16px;
  margin: 20px 0;
}

.word-text {
  font-size: 48px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 16px;
  animation: fadeIn 0.5s;
}

.word-phonetic {
  font-size: 20px;
  color: var(--text-secondary);
  font-style: italic;
  margin-bottom: 12px;
}

.word-translation {
  font-size: 24px;
  color: var(--accent-primary);
  font-weight: 600;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 信息视图切换

```css
.info-tabs {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin: 20px 0;
}

.info-tab {
  padding: 8px 16px;
  border-radius: 20px;
  background: var(--bg-input);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.info-tab.active {
  background: var(--accent-primary);
  color: white;
  border-color: var(--accent-primary);
}

.info-tab:hover:not(.active) {
  background: var(--bg-card-hover);
}
```

### 控制按钮

```css
.controls {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin: 24px 0;
}

.control-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent-primary);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  box-shadow: var(--shadow-md);
}

.control-btn:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-lg);
}

.control-btn.play {
  width: 72px;
  height: 72px;
  background: linear-gradient(135deg,
              var(--accent-primary),
              var(--accent-secondary));
}
```

---

## 7. 听写模式样式 (dictation.css)

**文件路径**: `css/dictation.css`

### 听写弹窗

```css
.dictation-popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-modal);
  backdrop-filter: blur(30px);
  border-radius: 20px;
  padding: 32px;
  box-shadow: var(--shadow-lg);
  min-width: 400px;
  z-index: 2000;
  animation: popupIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes popupIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.dictation-popup.dragging {
  cursor: move;
}
```

### 输入框

```css
.dictation-input {
  width: 100%;
  padding: 16px;
  font-size: 18px;
  border: 3px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-input);
  color: var(--text-primary);
  text-align: center;
  transition: all 0.3s;
}

.dictation-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 4px rgba(var(--accent-primary-rgb), 0.2);
}

.dictation-input.correct {
  border-color: #4caf50;
  animation: shake 0.5s;
}

.dictation-input.incorrect {
  border-color: #f44336;
  animation: shake 0.5s;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}
```

### 成绩单（纸张效果）

```css
.result-paper {
  background: linear-gradient(to bottom,
              #fefefe 0%,
              #f8f8f8 100%);
  border-radius: 8px;
  padding: 40px;
  box-shadow:
    0 2px 4px rgba(0,0,0,0.1),
    0 8px 16px rgba(0,0,0,0.1);
  position: relative;
  max-width: 600px;
  margin: 40px auto;
}

/* 左侧装订线 */
.result-paper::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: repeating-linear-gradient(
    to bottom,
    #e0e0e0 0px,
    #e0e0e0 10px,
    transparent 10px,
    transparent 20px
  );
}

/* 右上角折角 */
.result-paper::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 40px 40px 0;
  border-color: transparent #f0f0f0 transparent transparent;
}

.result-stamp {
  position: absolute;
  top: 20px;
  right: 60px;
  width: 100px;
  height: 100px;
  border: 4px solid;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  transform: rotate(-15deg);
  opacity: 0.8;
}

.result-stamp.excellent {
  border-color: #4caf50;
  color: #4caf50;
}

.result-stamp.good {
  border-color: #2196f3;
  color: #2196f3;
}

.result-stamp.pass {
  border-color: #ff9800;
  color: #ff9800;
}

.result-stamp.fail {
  border-color: #f44336;
  color: #f44336;
}
```

---

## 8. 认证样式 (auth.css)

**文件路径**: `css/auth.css`

### 登录弹窗

```css
.auth-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  animation: fadeIn 0.3s;
}

.auth-container {
  background: var(--bg-modal);
  border-radius: 24px;
  padding: 48px;
  max-width: 450px;
  width: 90%;
  box-shadow: var(--shadow-lg);
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 表单样式

```css
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.form-input {
  padding: 14px 16px;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-input);
  font-size: 16px;
  transition: all 0.3s;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.1);
}

.submit-btn {
  padding: 14px;
  background: linear-gradient(135deg,
              var(--accent-primary),
              var(--accent-secondary));
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

---

## 9. 响应式布局 (responsive.css)

**文件路径**: `css/responsive.css`

### 断点定义

```css
/* 平板 */
@media (max-width: 768px) {
  .menu-bar {
    padding: 0 16px;
  }

  .sidebar {
    width: 100%;
  }

  .wordcard-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }

  .word-text {
    font-size: 36px;
  }

  .dictation-popup {
    min-width: 90%;
  }
}

/* 手机 */
@media (max-width: 480px) {
  .menu-bar {
    height: 50px;
  }

  .word-text {
    font-size: 28px;
  }

  .word-phonetic {
    font-size: 16px;
  }

  .word-translation {
    font-size: 18px;
  }

  .control-btn {
    width: 48px;
    height: 48px;
  }

  .control-btn.play {
    width: 60px;
    height: 60px;
  }

  .result-paper {
    padding: 24px;
  }

  .auth-container {
    padding: 32px 24px;
  }
}
```

---

## 10. 动画效果

### 淡入动画

```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

### 滑入动画

```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

### 弹跳动画

```css
@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
```

### 脉冲动画

```css
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

---

## 11. 性能优化

### 使用 GPU 加速

```css
.animated-element {
  transform: translateZ(0);
  will-change: transform;
}
```

### 避免重排

```css
/* 使用 transform 而不是 top/left */
.moving-element {
  transform: translate(100px, 100px);
  /* 而不是 top: 100px; left: 100px; */
}
```

### 懒加载背景图

```css
.lazy-bg {
  background-image: none;
}

.lazy-bg.loaded {
  background-image: url('image.jpg');
}
```

---

## 12. 浏览器兼容性

### 前缀处理

```css
.glass-effect {
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
}

.gradient-text {
  background: linear-gradient(135deg, #ff6b6b, #4ecdc4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### 降级方案

```css
/* 不支持 backdrop-filter 的降级 */
@supports not (backdrop-filter: blur(20px)) {
  .glass-card {
    background: rgba(255, 255, 255, 0.95);
  }
}
```
