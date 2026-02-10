## 颜色变量完整使用文档

# 本文档详细列出每个颜色变量在项目中的所有引用位置
- 更新日期：2026-01-27


# 【文字颜色组 (text-)】
 --text-primary: 主要文字颜色
   引用：base.css (h1, h2), menu.css (#home-btn:hover), dictation.css (.word-display)

 --text-secondary: 次要文字颜色
   引用：components.css (.settings-label), home.css (.word-count)

 --text-muted: 淡化文字颜色
   引用：components.css (.hint), auth.css (.auth-dialog-subtitle)

 --text-dark: 深色文字
   引用：dictation.css (.answer-input), repeater.css (.word-text)

 --text-active: 激活状态文字
   引用：repeater.css (.current-word)

 --text-label: 标签文字
   引用：menu.css (.settings-label), components.css (input, select)

 --text-button: 按钮文字
   引用：components.css (.btn-pause)

 --text-menu-btn: 菜单按钮文字
   引用：menu.css (#menu button)

 --text-accent: 强调文字
   引用：menu.css (.settings h3), dictation.css (.word-en)

 --text-stat: 统计文字
   引用：dictation.css (.stat-item)

 --text-count: 计数文字
   引用：repeater.css (.play-count)

 --text-placeholder: 占位符文字
   引用：components.css (textarea::placeholder)

# 【背景颜色组 (bg-)】
 --bg-page-start/mid/end: 页面渐变背景
   引用：base.css (body)

 --bg-container: 容器背景
   引用：repeater.css (.repeater-container)

 --bg-menu-start/end: 菜单栏渐变背景
   引用：menu.css (.menu-bar)

 --bg-input: 输入框背景
   引用：menu.css (input, select)

 --bg-paper-start/mid/end: 纸张渐变背景
   引用：dictation.css (.results-box)

 --bg-popup-start/end: 弹窗渐变背景
   引用：dictation.css (.dictation-popup)

 --bg-scroll-mid: 滚动区域背景
   引用：dictation.css (.scroll-container)

# 【强调色组 (accent-)】
 --accent-primary: 主强调色
   引用：components.css (焦点边框), menu.css (按钮边框)

 --accent-secondary: 次强调色
   引用：components.css (渐变背景), menu.css (按钮背景)

 --accent-brown: 棕色强调
   引用：menu.css (.settings h3), dictation.css (.word-en)

 --accent-line: 装订线颜色
   引用：dictation.css (.results-box::before)

 --glow-theme: 发光粉色
   引用：dictation.css (.results-box h3 border)

# 【状态颜色组 (status-)】
 --status-success: 成功/正确答案
   引用：dictation.css (.result-attempts .correct span)

 --status-correct: 正确（批改红）
   引用：dictation.css (.correct)

 --status-error: 错误
   引用：dictation.css (.failed), auth.css (.auth-error)

 --status-warning: 警告
   引用：dictation.css (.warning)

 --status-score: 分数显示
   引用：dictation.css (.score-display)

 --status-translate-error: 翻译错误
   引用：dictation.css (.translation-error)

# 【按钮颜色组 (btn-)】
 --btn-play-start/end: 播放按钮渐变
   引用：components.css (.btn-play)

 --btn-play-hover-start/end: 播放按钮悬停渐变
   引用：components.css (.btn-play:hover)

 --btn-play-text: 播放按钮文字
   引用：components.css (.btn-play)

 --btn-pause-start/end: 暂停按钮渐变
   引用：components.css (.btn-pause, .btn-sound)

 --btn-hover-start/end: 悬停渐变
   引用：components.css (.btn-sound:hover, .btn-pause:hover)

# 【阴影组 (shadow-)】
 --shadow-soft: 柔和阴影
   引用：通用阴影

 --shadow-themelight/medium/strong: 粉色阴影（轻/中/强）
   引用：menu.css (.menu-bar), components.css (.repeater-container)

 --shadow-brown/brown-medium: 棕色阴影
   引用：components.css (容器内阴影)

 --shadow-menu-btn/menu-btn-hover: 菜单按钮阴影
   引用：menu.css (#menu button)

# 【边框组 (border-)】
 --border-themelight/medium/strong: 粉色边框（轻/中/强）
   引用：components.css (.repeater-container), menu.css (input)

 --border-menu: 菜单边框
   引用：menu.css (.menu-bar)

 --border-paper/paper-medium: 纸张边框
   引用：dictation.css (.results-box)

 --border-white/white-strong: 白色边框
   引用：components.css (内发光)

 --border-stamp: 印章边框
   引用：dictation.css (.results-box::after)

# 【背景透明色组】
 --bg-themedot: 圆点图案
   引用：base.css (body::before)

 --bg-themeoverlay/overlay-light: 粉色遮罩
   引用：dictation.css (.scroll-container)

 --bg-themesubtle: 粉色微背景
   引用：repeater.css (.current-word)

 --bg-slider-track: 滑块轨道
   引用：components.css (.apple-slider-track)

 --bg-paper-line/line-medium: 纸张横线
   引用：dictation.css (.results-box)

 --bg-stamp: 印章背景
   引用：dictation.css (.results-box::after)

# 【白色系组 (white-)】
 --white-pure: 纯白
   引用：基础白色

 --white-soft/medium/strong: 透明白（30%/50%/80%）
   引用：各种半透明背景

 --white-button/button-soft: 按钮白色
   引用：menu.css (#menu button)

 --white-button-hover/hover-soft: 按钮悬停白色
   引用：menu.css (#menu button:hover)

# 【折角颜色组 (fold-)】
 --bg-fold-light/dark: 折角浅色/深色
   引用：dictation.css (纸张折角)

 --shadow-fold: 折角阴影
   引用：dictation.css (纸张折角投影)

# 【功能性颜色组 (func-)】
 --border-play: 播放按钮边框
   引用：components.css (.btn-play)

 --shadow-play-hover: 播放按钮悬停阴影
   引用：components.css (.btn-play:hover)

 --border-pause: 暂停按钮边框
   引用：components.css (.btn-pause)

 --bg-warning-light: 警告背景
   引用：components.css (.input-warning)

 --bg-error-light/medium: 错误背景（轻/中）
   引用：home.css (.wordcard-delete:hover), auth.css (.auth-error)

 --bg-overlay-dark: 深色遮罩
   引用：home.css (.folder-open-overlay)

 --shadow-large: 大阴影
   引用：home.css (.drag-clone, .folder-open-view)

 --border-drop-indicator: 放置指示器边框
   引用：home.css (.drop-indicator)

 --bg-folder-preview: 文件夹预览背景
   引用：home.css (.wordcard-folder-preview-item)

 --border-folder-preview: 文件夹预览边框
   引用：home.css (.wordcard-folder-preview-item)

# 【玻璃态效果组 (glass-)】
 --glass-bg-light-start/end: 玻璃弹窗背景渐变
   引用：components.css (.glass-dialog), home.css (.folder-open-view)

 --glass-overlay-bg: 玻璃遮罩背景
   引用：components.css (.glass-overlay)

# 【输入框组 (input-)】
 --input-bg-light: 输入框背景（浅色主题）
   引用：auth.css (.auth-input), components.css (.glass-dialog-input)

 --input-shadow-outer: 输入框外阴影
   引用：auth.css, components.css (输入框阴影)

 --input-shadow-inner: 输入框内阴影
   引用：auth.css, components.css (输入框内阴影)

# 【按钮组 (button-)】
 --button-secondary-bg: 次要按钮背景
   引用：auth.css (.auth-btn-secondary), components.css (.glass-dialog-btn)

 --button-secondary-hover: 次要按钮悬停
   引用：auth.css, components.css (次要按钮悬停)

# 【卡片组 (card-)】
 --card-user-bg: 用户信息卡片背景
   引用：auth.css (.user-info)

 --card-user-hover: 用户信息卡片悬停
   引用：auth.css (.user-info:hover)

# 【图标组 (icon-)】
 --icon-border-light/medium/strong: 图标边框（轻/中/强）
   引用：home.css (.wordcard-icon, .wordcard-icon:hover)

 --icon-highlight-start/end: 图标高光渐变
   引用：home.css (.wordcard-icon::before)

 --icon-shadow-light/medium-light/medium/strong: 图标阴影
   引用：home.css (.wordcard-icon, .wordcard-icon:hover)

 --icon-inner-shadow-top/bottom: 图标内阴影
   引用：home.css (.wordcard-icon)

 --icon-text-shadow: 图标文字阴影
   引用：home.css (.wordcard-icon-count)

 --icon-mini-shadow: 迷你图标阴影
   引用：home.css (.wordcard-folder-mini)

# 【文件夹组 (folder-)】
 --folder-icon-bg: 文件夹图标背景
   引用：home.css (.wordcard-folder-icon)

 --folder-icon-border: 文件夹图标边框
   引用：home.css (.wordcard-folder-icon)

 --folder-empty-bg: 文件夹空状态背景
   引用：home.css (.wordcard-folder-mini.empty)

 --folder-overlay: 文件夹展开遮罩
   引用：home.css (.folder-open-overlay)

 --folder-view-bg-start/end: 文件夹展开视图背景渐变
   引用：home.css (.folder-open-view)

 --folder-title-bg: 文件夹标题背景
   引用：home.css (.folder-open-title)

 --folder-title-input-bg: 文件夹标题输入框背景
   引用：home.css (.folder-open-title-input)

 --folder-title-shadow: 文件夹标题阴影
   引用：home.css (.folder-open-title)

 --folder-title-input-shadow: 文件夹标题输入框阴影
   引用：home.css (.folder-open-title-input)

# 【拖拽组 (drag-)】
 --drag-shadow-primary: 拖拽克隆主阴影
   引用：home.css (.drag-clone)

 --drag-shadow-secondary: 拖拽克隆次要阴影
   引用：home.css (.drag-clone)

 --drag-folder-bg: 拖拽文件夹实色背景
   引用：home.css (.drag-clone.wordcard-folder)

# 【删除按钮组 (delete-)】
 --delete-btn-bg: 删除按钮背景
   引用：home.css (.wordcard-delete)

 --delete-btn-shadow: 删除按钮阴影
   引用：home.css (.wordcard-delete)

# 【下拉菜单组 (dropdown-)】
 --dropdown-bg-start/end: 下拉菜单背景渐变
   引用：auth.css (.user-dropdown)

 --dropdown-item-hover: 下拉菜单项悬停
   引用：auth.css (.user-dropdown-item:hover)

# 【Toast 提示组 (toast-)】
 --toast-error-bg: Toast 错误背景
   引用：components.css (.toast)

 --toast-shadow: Toast 阴影
   引用：components.css (.toast)

# 【颜色选择器组 (picker-)】
 --picker-marker-shadow: 选择器标记阴影
   引用：home.css (.color-picker-selected-marker)

 --picker-original-shadow: 选择器原色标记阴影
   引用：home.css (.color-picker-original-marker)

# 【加载指示器组 (loading-)】
 --loading-border: 加载动画边框
   引用：home.css (.btn-load.loading::after)

 --loading-text: 预加载指示器文字
   引用：menu.css (#preloadIndicator)

 --loading-popup-bg-start/end: 预加载弹窗背景渐变
   引用：home.css (.preload-indicator-popup)

# 【分段控制组 (segmented-)】
 --segmented-bg: 分段控制背景
   引用：menu.css (.segmented-control)

# 【对话框文字组 (dialog-text-)】
 --dialog-text-title: 对话框标题文字
   引用：auth.css (.auth-dialog-title), components.css (.glass-dialog-title)

 --dialog-text-message: 对话框消息文字
   引用：components.css (.glass-dialog-message)

# 【分隔线组 (divider-)】
 --divider-line: 分隔线颜色
   引用：auth.css (.auth-divider-line)

# 【深色主题特有变量】
 --dark-folder-border-bottom: 深色主题文件夹头部边框
   引用：home.css ([data-theme-mode="dark"] .folder-open-header)

 --dark-folder-close-bg: 深色主题文件夹关闭按钮
   引用：home.css ([data-theme-mode="dark"] .folder-open-close)

 --dark-folder-close-hover: 深色主题文件夹关闭按钮悬停
   引用：home.css ([data-theme-mode="dark"] .folder-open-close:hover)

 --dark-button-load-start/end: 深色主题 Load 按钮背景渐变
   引用：home.css ([data-theme-mode="dark"] .btn-load)

 --dark-button-load-hover-start/end: 深色主题 Load 按钮悬停渐变
   引用：home.css ([data-theme-mode="dark"] .btn-load:hover)

 --dark-button-load-border: 深色主题 Load 按钮边框
   引用：home.css ([data-theme-mode="dark"] .btn-load)

 --dark-button-load-text: 深色主题 Load 按钮文字
   引用：home.css ([data-theme-mode="dark"] .btn-load)

 --dark-button-load-text-hover: 深色主题 Load 按钮文字悬停
   引用：home.css ([data-theme-mode="dark"] .btn-load:hover)

 --dark-button-load-shadow: 深色主题 Load 按钮悬停阴影
   引用：home.css ([data-theme-mode="dark"] .btn-load:hover)

 --dark-loading-text: 深色主题预加载文字
   引用：home.css ([data-theme-mode="dark"] .preload-indicator-popup)

# === 变量命名规则 ===

 1. 前缀分类：
    - text-: 文字颜色
    - bg-: 背景颜色
    - accent-: 强调色
    - status-: 状态颜色
    - btn-: 按钮颜色
    - shadow-: 阴影
    - border-: 边框
    - white-: 白色系
    - fold-: 折角
    - glass-: 玻璃态效果
    - input-: 输入框
    - button-: 按钮（通用）
    - card-: 卡片
    - icon-: 图标
    - folder-: 文件夹
    - drag-: 拖拽
    - delete-: 删除
    - dropdown-: 下拉菜单
    - toast-: Toast 提示
    - picker-: 颜色选择器
    - loading-: 加载指示器
    - segmented-: 分段控制
    - dialog-: 对话框
    - invalid-: 无效文本
    - divider-: 分隔线
    - dark-: 深色主题特有

 2. 后缀说明：
    - -start/-end: 渐变起点/终点
    - -light/-medium/-strong: 强度（轻/中/强）
    - -hover: 悬停状态
    - -active: 激活状态
    - -primary/-secondary: 主要/次要

 3. 主题适配：
    - 所有变量在 8 个主题中都有定义
    - 深色主题的某些变量逻辑相反（如 white- 系列）
    - 不同主题的颜色值根据主题色调调整

# === 使用建议 ===

 1. 新增 UI 元素时，优先使用现有变量
 2. 如需新增变量，请在所有 8 个主题中定义
 3. 变量名保持英文，注释使用中文
 4. 更新变量后，记得更新本文档
 5. 避免在 CSS 文件中使用硬编码颜色值

 

