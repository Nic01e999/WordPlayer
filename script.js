/**
 * =====================================================
 * 英语听写/复读工具 - JavaScript 主程序
 * =====================================================
 *
 * 这个程序有两个模式：
 * 1. Repeater（复读模式）：自动播放单词发音，可滚动选择
 * 2. Dictation（听写模式）：听发音写单词，记录对错
 *
 * 主要技术：
 * - 后端 TTS API：用于文字转语音
 * - Fetch API：用于调用翻译和 TTS 接口
 * - DOM 操作：动态生成和修改页面内容
 * - 事件监听：处理用户交互（点击、滚动等）
 */

// =====================================================
// 全局状态
// =====================================================

/**
 * 复读模式的状态对象
 * 为 null 表示复读模式未启动
 */
let currentRepeaterState = null;

/**
 * 当前激活的模式
 * "repeater" | "dictation" | null
 */
let currentActiveMode = null;

/**
 * 预加载缓存对象
 * 用于后台预加载翻译和音频
 */
const preloadCache = {
    entries: [],            // 已缓存的单词条目列表 { word, definition }
    translations: {},       // { word: translation } - 如果有 definition 则直接使用
    audioUrls: {},          // { text: Blob URL } (正常速度) - 支持单词和定义
    slowAudioUrls: {},      // { text: Blob URL } (慢速) - 支持单词和定义
    loading: false,         // 是否正在加载
    loadId: 0,              // 加载 ID，用于取消旧的加载
    loaded: 0,              // 已加载数量
    total: 0                // 总数量
};

// =====================================================
// 工具函数（Utils）
// =====================================================

/**
 * 简化版的 document.getElementById
 * 用法：$("myId") 等同于 document.getElementById("myId")
 *
 * @param {string} id - 元素的 ID
 * @returns {HTMLElement|null} - 找到的元素，或 null
 */
const $ = id => document.getElementById(id);

/**
 * 从设置面板读取用户配置
 *
 * @returns {Object} 包含所有设置的对象
 *   - repeat: 每个单词重复几次
 *   - retry: 听写模式最多尝试几次
 *   - slow: 是否慢速播放
 *   - shuffle: 是否打乱顺序
 */
function getSettings() {
    return {
        repeat: parseInt($("repeat").value) || 1,  // parseInt 将字符串转为整数
        retry: parseInt($("retry").value) || 1,
        interval: parseInt($("interval").value) || 300,  // 单词间隔（毫秒）
        slow: $("slow").checked,      // checkbox 用 .checked 获取布尔值
        shuffle: $("shuffle").checked,
        dictateMode: $("dictateMode")?.checked ? "listenB_writeA" : "listenA_writeB"  // 选中=听定义写单词
    };
}

/**
 * 从文本框读取单词列表
 * 支持 a:b 格式，其中 a 是单词，b 是定义
 *
 * @returns {Array<{word: string, definition: string|null}>} 单词条目数组
 *
 * 处理过程：
 * 1. 获取文本框内容
 * 2. 按行分割
 * 3. 解析每行，支持 a:b 格式
 * 4. 过滤空行
 */
function loadWordsFromTextarea() {
    return $("wordInput").value
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line)
        .map(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                return {
                    word: line.substring(0, colonIndex).trim(),
                    definition: line.substring(colonIndex + 1).trim() || null
                };
            }
            return { word: line, definition: null };
        });
}

/**
 * 从单词条目数组中提取单词列表（向后兼容）
 * @param {Array<{word: string, definition: string|null}>} entries
 * @returns {string[]}
 */
function getWordsFromEntries(entries) {
    return entries.map(e => e.word);
}

/**
 * 打乱数组顺序（Fisher-Yates 洗牌算法）
 *
 * @param {Array} arr - 要打乱的数组
 * @returns {Array} 打乱后的新数组（不修改原数组）
 *
 * 算法原理：
 * 从最后一个元素开始，随机选一个前面的元素与之交换
 * 然后处理倒数第二个，以此类推
 */
function shuffleArray(arr) {
    const a = [...arr];  // [...arr] 创建数组的浅拷贝，不修改原数组
    for (let i = a.length - 1; i > 0; i--) {
        // Math.random() 返回 0-1 之间的随机数
        // Math.floor() 向下取整
        const j = Math.floor(Math.random() * (i + 1));
        // 解构赋值交换两个元素
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * 清空工作区
 */
function clearWorkplace() {
    $("workplace").innerHTML = "";
}

/**
 * 向工作区追加 HTML 内容
 *
 * @param {string} html - 要追加的 HTML 字符串
 *
 * insertAdjacentHTML 的位置参数：
 * - "beforebegin": 元素前面
 * - "afterbegin": 元素内部最前面
 * - "beforeend": 元素内部最后面（我们用这个）
 * - "afterend": 元素后面
 */
function logToWorkplace(html) {
    $("workplace").insertAdjacentHTML("beforeend", html);
}

// 后端API地址
const API_BASE = "/";

// 当前播放的音频对象（用于停止播放）
let currentAudio = null;

/**
 * 调用后端翻译 API 获取单词的中文翻译
 *
 * @param {string} word - 要翻译的英文单词
 * @returns {Promise<string>} 翻译结果
 */
async function translateWord(word) {
    // 先检查缓存
    if (preloadCache.translations[word]) {
        return preloadCache.translations[word];
    }

    try {
        const url = `${API_BASE}/api/translate?word=${encodeURIComponent(word)}`;
        const res = await fetch(url);
        const data = await res.json();
        const translation = data.translation || "翻译失败";
        // 存入缓存
        preloadCache.translations[word] = translation;
        return translation;
    } catch {
        return "翻译失败";
    }
}

/**
 * 停止当前播放的音频
 */
function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
}

/**
 * 检查音频是否正在播放
 */
function isAudioPlaying() {
    return currentAudio && !currentAudio.paused && !currentAudio.ended;
}

/**
 * 使用后端 TTS API 朗读单词
 */
function speakWord(word, slow = false) {
    stopAudio();

    // 先检查缓存的 Blob URL
    const cache = slow ? preloadCache.slowAudioUrls : preloadCache.audioUrls;
    const cachedUrl = cache[word];

    const url = cachedUrl || `${API_BASE}/api/tts?word=${encodeURIComponent(word)}&slow=${slow ? 1 : 0}`;
    currentAudio = new Audio(url);
    currentAudio.onerror = () => console.warn("音频加载失败，请检查后端服务是否运行");
    currentAudio.play().catch(() => {});
}

/**
 * 更新播放/暂停按钮状态
 */
function updatePlayPauseBtn(btn, isPaused) {
    if (!btn) return;
    btn.className = isPaused ? "btn-play" : "btn-pause";
    btn.textContent = isPaused ? "▶" : "⏸";
}

/**
 * 暂停另一个模式
 */
function pauseOtherMode(isRepeater) {
    stopAudio();
    if (isRepeater && Dictation.state) {
        Dictation.state.isPaused = true;
        Dictation.closePopup();
    } else if (!isRepeater && currentRepeaterState) {
        Repeater.playId++;
        currentRepeaterState.isPaused = true;
    }
}

// =====================================================
// 预加载系统（Preload System）
// =====================================================

/**
 * 防抖函数
 * 延迟执行，如果在延迟期间再次调用，重置计时器
 */
function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 更新预加载进度显示
 */
function updatePreloadProgress() {
    const indicator = $("preloadIndicator");
    if (!indicator) return;

    const wordCount = preloadCache.entries.length;

    if (preloadCache.loading) {
        // 显示加载进度（内部用 loaded/total，但显示为单词数）
        const progress = Math.floor(preloadCache.loaded / 3);
        indicator.textContent = `Loading: ${progress}/${wordCount}`;
        indicator.style.display = "block";
    } else if (wordCount > 0) {
        indicator.textContent = `Ready: ${wordCount} words`;
        indicator.style.display = "block";
    } else {
        indicator.style.display = "none";
    }
}

/**
 * 开始预加载翻译和音频
 * 并行加载所有内容
 * 支持 a:b 格式，如果有 definition 则跳过翻译 API
 */
async function startPreload() {
    const entries = loadWordsFromTextarea();
    if (!entries.length) {
        preloadCache.loading = false;
        preloadCache.loaded = 0;
        preloadCache.total = 0;
        updatePreloadProgress();
        return;
    }

    // 检查单词列表是否改变
    const entriesChanged = entries.length !== preloadCache.entries.length ||
        entries.some((e, i) =>
            e.word !== preloadCache.entries[i]?.word ||
            e.definition !== preloadCache.entries[i]?.definition
        );

    if (!entriesChanged && !preloadCache.loading) {
        // 单词未改变，且已加载完成，无需重新加载
        return;
    }

    // 增加加载 ID，取消旧的加载
    preloadCache.loadId++;
    const myId = preloadCache.loadId;

    // 重置缓存
    preloadCache.entries = entries.map(e => ({ ...e }));
    preloadCache.loading = true;
    preloadCache.loaded = 0;

    // 计算需要加载的项目数：
    // - 每个条目：翻译 + 单词音频(正常) + 单词音频(慢速)
    // - 如果有 definition：额外加载 definition 音频(正常) + definition 音频(慢速)
    const definitionCount = entries.filter(e => e.definition).length;
    preloadCache.total = entries.length * 3 + definitionCount * 2;
    updatePreloadProgress();

    // 并行加载所有翻译（如果有 definition 则直接使用）
    const translationPromises = entries.map(async (entry) => {
        if (myId !== preloadCache.loadId) return;

        const { word, definition } = entry;

        // 如果有 definition，直接使用它作为翻译
        if (definition) {
            preloadCache.translations[word] = definition;
            preloadCache.loaded++;
            updatePreloadProgress();
            return;
        }

        // 如果已有缓存，跳过
        if (preloadCache.translations[word]) {
            preloadCache.loaded++;
            updatePreloadProgress();
            return;
        }

        try {
            const url = `${API_BASE}/api/translate?word=${encodeURIComponent(word)}`;
            const res = await fetch(url);
            const data = await res.json();

            if (myId !== preloadCache.loadId) return;

            preloadCache.translations[word] = data.translation || "翻译失败";
        } catch {
            preloadCache.translations[word] = "翻译失败";
        }

        preloadCache.loaded++;
        updatePreloadProgress();
    });

    // 收集所有需要预加载音频的文本（单词 + definitions）
    const textsToPreload = new Set();
    entries.forEach(e => {
        textsToPreload.add(e.word);
        if (e.definition) textsToPreload.add(e.definition);
    });

    // 并行加载所有音频（正常速度）
    const audioPromises = Array.from(textsToPreload).map(async (text) => {
        if (myId !== preloadCache.loadId) return;

        if (preloadCache.audioUrls[text]) {
            preloadCache.loaded++;
            updatePreloadProgress();
            return;
        }

        try {
            const url = `${API_BASE}/api/tts?word=${encodeURIComponent(text)}&slow=0`;
            const res = await fetch(url);
            const blob = await res.blob();

            if (myId !== preloadCache.loadId) return;

            preloadCache.audioUrls[text] = URL.createObjectURL(blob);
        } catch {
            // 音频加载失败，不缓存
        }

        preloadCache.loaded++;
        updatePreloadProgress();
    });

    // 并行加载所有音频（慢速）
    const slowAudioPromises = Array.from(textsToPreload).map(async (text) => {
        if (myId !== preloadCache.loadId) return;

        if (preloadCache.slowAudioUrls[text]) {
            preloadCache.loaded++;
            updatePreloadProgress();
            return;
        }

        try {
            const url = `${API_BASE}/api/tts?word=${encodeURIComponent(text)}&slow=1`;
            const res = await fetch(url);
            const blob = await res.blob();

            if (myId !== preloadCache.loadId) return;

            preloadCache.slowAudioUrls[text] = URL.createObjectURL(blob);
        } catch {
            // 音频加载失败，不缓存
        }

        preloadCache.loaded++;
        updatePreloadProgress();
    });

    // 等待所有加载完成
    await Promise.all([...translationPromises, ...audioPromises, ...slowAudioPromises]);

    if (myId === preloadCache.loadId) {
        preloadCache.loading = false;
        updatePreloadProgress();
    }
}

// 防抖版本的预加载函数（500ms 延迟）
const debouncedPreload = debounce(startPreload, 500);

/**
 * 测量文字实际宽度（使用 Canvas API）
 */
function measureTextWidth(text, font) {
    const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    ctx.font = font;
    return ctx.measureText(text).width;
}

/**
 * 根据最长行自动调整侧边栏宽度
 * - 不换行、不滚动，靠加宽 sidebar 容纳内容
 */
function adjustSidebarWidth() {
    const wordInput = $("wordInput");
    const sidebar = document.querySelector(".settings-trigger .sidebar");
    if (!wordInput || !sidebar) return;

    // 获取 textarea 的字体
    const style = getComputedStyle(wordInput);
    const font = `${style.fontSize} ${style.fontFamily}`;

    // 按行分割，保留原始内容（含空格），过滤纯空行
    const lines = wordInput.value.split(/\n/).filter(l => l.trim());
    const maxTextWidth = lines.reduce((max, l) => Math.max(max, measureTextWidth(l, font)), 0);

    // 计算所需宽度：文字宽度 + textarea padding(36) + border(2) + sidebar padding(40) + border(2) + margin
    const baseWidth = 240;
    const extraSpace = 85;
    const neededWidth = maxTextWidth + extraSpace;

    sidebar.style.minWidth = Math.max(baseWidth, neededWidth) + "px";
}

// 防抖版本（300ms）
const debouncedAdjustSidebar = debounce(adjustSidebarWidth, 300);

/**
 * 初始化预加载监听器
 * 在页面加载完成后调用
 */
function initPreloadListeners() {
    // 监听单词输入变化
    const wordInput = $("wordInput");
    if (wordInput) {
        wordInput.addEventListener("input", debouncedPreload);
        wordInput.addEventListener("input", debouncedAdjustSidebar);
        // 粘贴后延迟调整（等待内容插入完成）
        wordInput.addEventListener("paste", () => setTimeout(adjustSidebarWidth, 0));
    }

    // 页面加载后立即开始预加载
    startPreload();
    // 初始调整侧边栏宽度
    adjustSidebarWidth();
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", initPreloadListeners);

// =====================================================
// 复读模式（Repeater Mode）
// =====================================================

/**
 * 复读模式类
 *
 * 使用 static（静态）方法和属性，因为：
 * 1. 全局只需要一个复读器实例
 * 2. 不需要用 new 创建对象，直接 Repeater.方法名() 调用
 */
class Repeater {
    // -------------------- 静态属性 --------------------

    /** 每个单词项的高度（像素），用于计算滚动位置 */
    static ITEM_HEIGHT = 60;

    /** 滚动结束检测的定时器 ID */
    static scrollTimeout = null;

    /**
     * 播放周期 ID
     * 每次开始新的播放循环时 +1
     * 用于取消旧的播放（如果 ID 不匹配，说明已被取消）
     */
    static playId = 0;

    // -------------------- 启动和初始化 --------------------

    /**
     * 启动复读模式
     * async 函数可以使用 await 等待异步操作
     */
    static async startRepeater() {
        // 暂停听写模式，每次进入复读模式都重新开始
        pauseOtherMode(true);
        this.playId++;
        const myId = this.playId;  // 保存当前 ID，用于检测是否被取消
        currentRepeaterState = null;
        currentActiveMode = "repeater";
        document.body.classList.remove('dictation-mode');
        document.body.classList.add('repeater-mode');

        // 清空工作区
        clearWorkplace();

        // 读取单词条目列表
        const entries = loadWordsFromTextarea();
        if (!entries.length) {
            logToWorkplace("<p>⚠️ No words provided.</p>");
            return;
        }

        // 读取设置
        const settings = getSettings();

        // 根据设置决定是否打乱顺序
        const list = settings.shuffle ? shuffleArray(entries) : [...entries];

        // 提取单词列表
        const words = list.map(e => e.word);

        // 检查是否所有翻译都已缓存（有 definition 的已在预加载时存入缓存）
        const allCached = words.every(w => preloadCache.translations[w]);

        // 初始化状态对象
        currentRepeaterState = {
            entries: list,         // 单词条目列表 { word, definition }
            words,                 // 单词列表（向后兼容）
            currentIndex: 0,       // 当前播放的单词索引
            currentRepeat: 0,      // 当前单词已播放次数
            settings,              // 用户设置
            isPaused: false,       // 是否暂停
            translations: []       // 翻译列表（稍后填充）
        };

        if (allCached) {
            // 所有翻译已缓存，直接使用
            currentRepeaterState.translations = words.map(w => preloadCache.translations[w]);
        } else {
            // 显示加载提示
            logToWorkplace(`<h3>📖 Repeater Mode</h3><p>Loading translations...</p>`);

            // 并行获取所有翻译（如果有 definition 则直接使用）
            const translationPromises = list.map(entry => {
                if (entry.definition) {
                    return Promise.resolve(entry.definition);
                }
                return translateWord(entry.word);
            });
            const translations = await Promise.all(translationPromises);

            // 检查是否被取消
            if (myId !== this.playId) return;

            currentRepeaterState.translations = translations;
        }

        // 翻译完成后，渲染界面并开始播放
        clearWorkplace();
        this.renderUI();
        this.startPlayLoop();
    }

    /**
     * 渲染复读模式的界面
     *
     * 模板字符串（反引号 ``）可以：
     * 1. 包含换行
     * 2. 用 ${表达式} 插入变量
     */
    static renderUI() {
        $("workplace").innerHTML = `
            <!-- 主容器：包含滚动列表和中心指示器 -->
            <div id="repeaterContainer" class="repeater-container">
                <!-- 中心指示器：显示当前选中的单词位置 -->
                <div id="centerPointer" class="center-pointer">
                    <div class="pointer-arrow"></div>
                </div>

                <!-- 滚动区域 -->
                <div id="repeaterScroll" class="repeater-scroll">
                    <!-- 上方占位，让第一个单词可以滚动到中心 -->
                    <div style="height:170px"></div>

                    <!-- 单词列表容器 -->
                    <div id="repeaterContent"></div>

                    <!-- 下方占位，让最后一个单词可以滚动到中心 -->
                    <div style="height:170px"></div>
                </div>
            </div>

            <!-- 暂停/播放按钮 -->
            <div style="margin:15px 0;text-align:center">
                <button onclick="Repeater.playPause()" id="playPauseBtn" class="btn-pause">⏸</button>
            </div>

            <!-- 当前单词信息显示区 -->
            <div id="currentWordInfo" class="word-info"></div>
        `;

        // 渲染单词列表内容
        this.renderContent();

        // 设置滚动监听
        this.setupScrollListener();
    }

    /**
     * 渲染单词列表内容
     */
    static renderContent() {
        const content = $("repeaterContent");
        if (!content || !currentRepeaterState) return;

        // 使用 map 将单词数组转换为 HTML 字符串数组，再用 join 连接
        content.innerHTML = currentRepeaterState.words.map((word, i) => `
            <div id="word-${i}" class="word-item ${i === currentRepeaterState.currentIndex ? 'active' : ''}">
                <strong>${i + 1}. ${word}</strong>
                <span class="translation">${currentRepeaterState.translations[i] || "..."}</span>
            </div>
        `).join('');

        // 更新底部信息区
        this.updateInfo();
    }

    /**
     * 更新底部的当前单词信息
     */
    static updateInfo() {
        const info = $("currentWordInfo");
        if (!info || !currentRepeaterState) return;

        // 解构赋值：从对象中提取多个属性
        const { words, translations, currentIndex, currentRepeat, settings } = currentRepeaterState;

        info.innerHTML = `
            <div class="current-word">${words[currentIndex]}</div>
            <div class="current-translation">${translations[currentIndex]}</div>
            <div class="play-count">Play ${currentRepeat + 1}/${settings.repeat}</div>
        `;
    }

    // -------------------- 滚动处理 --------------------

    /**
     * 设置滚动相关的事件监听
     *
     * 核心逻辑：
     * 1. 用户开始触摸/点击时，停止当前播放
     * 2. 用户结束操作后，等待滚动稳定，然后对齐到最近的单词并继续播放
     */
    static setupScrollListener() {
        const scroll = $("repeaterScroll");
        if (!scroll) return;

        // 标记用户是否正在触摸/拖动
        let userTouching = false;

        /**
         * 用户开始触摸/点击时的处理
         */
        const onStart = () => {
            userTouching = true;

            // 清除之前的定时器
            clearTimeout(this.scrollTimeout);

            // 取消当前播放
            // playId++ 使得旧的播放循环检测到 ID 不匹配而停止
            this.playId++;
            stopAudio();  // 立即停止语音
        };

        /**
         * 用户结束触摸/点击时的处理
         */
        const onEnd = () => {
            if (!userTouching) return;
            userTouching = false;

            // 清除之前的定时器，设置新的
            clearTimeout(this.scrollTimeout);

            // 200ms 后处理滚动结束
            // 这个延迟让滚动有时间稳定下来
            this.scrollTimeout = setTimeout(() => this.onUserScrollEnd(), 200);
        };

        /**
         * 鼠标滚轮事件的处理
         * 滚轮没有明确的"开始"和"结束"，每次滚动都重置定时器
         */
        const onWheel = () => {
            clearTimeout(this.scrollTimeout);
            this.playId++;
            stopAudio();
            this.scrollTimeout = setTimeout(() => this.onUserScrollEnd(), 200);
        };

        // 添加事件监听
        // { passive: true } 告诉浏览器这个监听器不会调用 preventDefault()，可以提升滚动性能
        scroll.addEventListener("touchstart", onStart, { passive: true });
        scroll.addEventListener("mousedown", onStart);
        scroll.addEventListener("touchend", onEnd);
        scroll.addEventListener("mouseup", onEnd);
        scroll.addEventListener("mouseleave", onEnd);  // 鼠标离开也算结束
        scroll.addEventListener("wheel", onWheel, { passive: true });

        // 初始滚动到第一个单词
        this.scrollToIndex(0, false);
    }


    /**
     * 用户滚动结束后的处理
     * 1. 计算最近的单词索引
     * 2. 对齐到该单词
     * 3. 继续播放
     */
    static onUserScrollEnd() {
        if (!currentRepeaterState) return;

        const scroll = $("repeaterScroll");
        if (!scroll) return;

        // 根据滚动位置计算最近的单词索引
        // Math.round 四舍五入到最近的整数
        const newIndex = Math.round(scroll.scrollTop / this.ITEM_HEIGHT);

        // 确保索引在有效范围内
        // Math.max 取较大值，Math.min 取较小值
        const idx = Math.max(0, Math.min(newIndex, currentRepeaterState.words.length - 1));

        // 更新状态
        currentRepeaterState.currentIndex = idx;
        currentRepeaterState.currentRepeat = 0;  // 重置播放次数

        // 更新界面
        this.highlightCurrent();
        this.updateInfo();

        // 滚动对齐到单词位置
        this.scrollToIndex(idx);

        // 如果没有暂停，继续播放
        if (!currentRepeaterState.isPaused) {
            // 延迟一下再开始，等待滚动动画完成
            setTimeout(() => this.startPlayLoop(), 400);
        }
    }

    /**
     * 滚动到指定索引的单词
     *
     * @param {number} index - 单词索引
     * @param {boolean} smooth - 是否平滑滚动
     */
    static scrollToIndex(index, smooth = true) {
        const scroll = $("repeaterScroll");
        if (!scroll) return;

        // 计算目标滚动位置
        const target = index * this.ITEM_HEIGHT;

        // scrollTo 滚动到指定位置
        // behavior: 'smooth' 平滑滚动，'instant' 立即跳转
        scroll.scrollTo({
            top: target,
            behavior: smooth ? 'smooth' : 'instant'
        });
    }

    /**
     * 高亮当前单词
     * 通过添加/移除 'active' CSS 类来实现
     */
    static highlightCurrent() {
        if (!currentRepeaterState) return;

        // querySelectorAll 返回所有匹配的元素
        // forEach 遍历每个元素
        document.querySelectorAll("#repeaterContent .word-item").forEach((div, i) => {
            // classList.toggle(类名, 条件)
            // 条件为 true 时添加类，false 时移除类
            div.classList.toggle('active', i === currentRepeaterState.currentIndex);
        });
    }

    // -------------------- 播放控制 --------------------

    /**
     * 开始一个新的播放循环
     * 每次调用都会 playId++，使旧的循环失效
     */
    static startPlayLoop() {
        this.playId++;
        this.playCurrentWord(this.playId);
    }

    /**
     * 播放当前单词
     *
     * @param {number} myId - 这次播放的 ID
     *
     * 如果 myId 与当前 playId 不匹配，说明这个播放已被取消
     */
    static playCurrentWord(myId) {
        // 检查状态
        if (!currentRepeaterState || currentRepeaterState.isPaused) return;
        if (myId !== this.playId) return;  // ID 不匹配，已被取消

        // 播放语音
        speakWord(
            currentRepeaterState.words[currentRepeaterState.currentIndex],
            currentRepeaterState.settings.slow
        );

        // 更新界面
        this.updateInfo();

        // 等待语音结束
        this.waitSpeechEnd(myId);
    }

    /**
     * 等待语音播放结束，然后进行下一步
     *
     * @param {number} myId - 播放 ID，用于检查是否被取消
     *
     * setInterval 每隔一段时间执行一次回调
     * 这里每 100ms 检查一次语音是否结束
     */
    static waitSpeechEnd(myId) {
        const check = setInterval(() => {
            // 检查是否被取消
            if (myId !== this.playId) {
                clearInterval(check);  // 停止定时器
                return;
            }

            // isAudioPlaying() 为 false 表示语音已结束
            if (!isAudioPlaying()) {
                clearInterval(check);  // 停止定时器

                // 再次检查状态
                if (!currentRepeaterState || currentRepeaterState.isPaused) return;

                // 增加播放次数
                currentRepeaterState.currentRepeat++;
                this.updateInfo();

                // 检查是否需要切换到下一个单词
                if (currentRepeaterState.currentRepeat >= currentRepeaterState.settings.repeat) {
                    // 重置播放次数
                    currentRepeaterState.currentRepeat = 0;

                    // 移动到下一个单词
                    currentRepeaterState.currentIndex++;

                    // 如果到达末尾，回到开头（循环播放）
                    if (currentRepeaterState.currentIndex >= currentRepeaterState.words.length) {
                        currentRepeaterState.currentIndex = 0;
                    }

                    // 更新界面
                    this.highlightCurrent();
                    this.scrollToIndex(currentRepeaterState.currentIndex);
                }

                // 延迟后播放下一个（使用设置中的间隔）
                const interval = currentRepeaterState.settings.interval;
                setTimeout(() => this.playCurrentWord(myId), interval);
            }
        }, 100);  // 每 100ms 检查一次
    }

    /**
     * 暂停/继续播放
     */
    static playPause() {
        if (!currentRepeaterState) return;

        currentRepeaterState.isPaused = !currentRepeaterState.isPaused;
        updatePlayPauseBtn($("playPauseBtn"), currentRepeaterState.isPaused);

        if (currentRepeaterState.isPaused) {
            this.playId++;
            stopAudio();
        } else {
            this.startPlayLoop();
        }
    }

    /**
     * 切换到复读模式
     * 如果当前就在复读模式 -> 重新开始
     * 如果从听写模式切换 -> 暂停听写，尝试恢复复读
     */
    static switchToRepeater() {
        // 如果当前就在复读模式，直接重新开始
        if (currentActiveMode === "repeater") {
            this.startRepeater();
            return;
        }

        // 从听写模式切换过来，暂停听写模式
        if (Dictation.state) {
            Dictation.state.isPaused = true;
            Dictation.closePopup();
            stopAudio();
        }

        // 检查是否有可恢复的复读状态
        if (currentRepeaterState) {
            // 检查单词列表是否改变（使用 Set 比较，忽略顺序，因为可能有 shuffle）
            const currentEntries = loadWordsFromTextarea();
            const currentWords = currentEntries.map(e => e.word);
            const stateWords = currentRepeaterState.words;
            const currentSet = new Set(currentWords);
            const stateSet = new Set(stateWords);
            const wordsChanged = currentWords.length !== stateWords.length ||
                currentWords.some(w => !stateSet.has(w)) ||
                stateWords.some(w => !currentSet.has(w));

            if (!wordsChanged) {
                // 单词未改变，恢复播放
                this.resumeRepeater();
                return;
            }
        }

        // 需要重新启动
        this.startRepeater();
    }

    /**
     * 恢复复读模式（不重新加载翻译）
     */
    static resumeRepeater() {
        if (!currentRepeaterState) return;

        currentActiveMode = "repeater";
        document.body.classList.remove('dictation-mode');
        document.body.classList.add('repeater-mode');

        // 清空工作区并重新渲染 UI
        clearWorkplace();
        this.renderUI();

        // 滚动到当前单词位置
        this.scrollToIndex(currentRepeaterState.currentIndex);

        // 恢复播放
        currentRepeaterState.isPaused = false;
        updatePlayPauseBtn($("playPauseBtn"), false);
        this.startPlayLoop();
    }
}

// =====================================================
// 听写模式（Dictation Mode）
// =====================================================

/**
 * 听写模式类
 */
class Dictation {
    /** 听写状态对象 */
    static state = null;

    // -------------------- 启动和初始化 --------------------

    /**
     * 启动听写模式
     * 支持两种模式：
     * - listenA_writeB: 播放单词(a)，输入定义(b)
     * - listenB_writeA: 播放定义(b)，输入单词(a)
     */
    static async startDictation() {
        // 暂停复读模式，每次进入听写模式都重新开始
        pauseOtherMode(false);
        this.closePopup();
        this.state = null;
        currentActiveMode = "dictation";
        document.body.classList.remove('repeater-mode');
        document.body.classList.add('dictation-mode');

        clearWorkplace();

        const entries = loadWordsFromTextarea();
        if (!entries.length) {
            logToWorkplace("<p>⚠️ No words provided.</p>");
            return;
        }

        const settings = getSettings();
        const list = settings.shuffle ? shuffleArray(entries) : [...entries];

        // 提取单词列表（向后兼容）
        const words = list.map(e => e.word);

        // 根据模式计算每个条目的"播放内容"和"期望输入"
        // 对于没有 definition 的普通单词，无论什么模式都是播放单词、输入单词
        const dictateMode = settings.dictateMode;
        const speakTexts = [];   // 要播放的内容
        const expectTexts = [];  // 期望用户输入的内容

        list.forEach(entry => {
            if (entry.definition) {
                // 有 definition 的条目，根据模式决定
                if (dictateMode === "listenA_writeB") {
                    speakTexts.push(entry.word);        // 播放单词
                    expectTexts.push(entry.definition); // 期望输入定义
                } else {
                    speakTexts.push(entry.definition);  // 播放定义
                    expectTexts.push(entry.word);       // 期望输入单词
                }
            } else {
                // 没有 definition 的普通单词
                speakTexts.push(entry.word);
                expectTexts.push(entry.word);
            }
        });

        // 初始化状态
        this.state = {
            entries: list,                  // 单词条目列表 { word, definition }
            words,                          // 单词列表（向后兼容）
            speakTexts,                     // 每个条目要播放的内容
            expectTexts,                    // 每个条目期望输入的内容
            dictateMode,                    // 听写模式
            currentIndex: 0,                // 当前单词索引
            maxRetry: settings.retry,       // 最大尝试次数
            attempts: list.map(() => []),   // 每个单词的尝试记录
            results: list.map(() => null),  // 每个单词的最终结果
            slow: settings.slow,            // 是否慢速
            isPaused: false                 // 是否暂停
        };

        // 渲染初始界面
        this.renderDictationUI();

        // 显示第一个单词的弹窗
        this.showPopup();
    }

    /**
     * 渲染听写模式的基础界面
     */
    static renderDictationUI() {
        logToWorkplace(`<div id="dictationWorkplace"></div>`);
    }

    // -------------------- 弹窗相关 --------------------

    /**
     * 显示听写弹窗
     */
    static showPopup() {
        const s = this.state;

        // 如果状态无效或已完成所有单词，显示结果
        if (!s || s.currentIndex >= s.entries.length) {
            this.showResults();
            return;
        }

        const i = s.currentIndex;
        const retries = s.attempts[i].length;

        // 确定提示文字：告诉用户需要写什么
        const entry = s.entries[i];
        let writeHint;
        if (entry.definition) {
            // 有 definition 的条目
            writeHint = s.dictateMode === "listenB_writeA" ? "Write: Word" : "Write: Definition";
        } else {
            // 普通单词
            writeHint = "Write: Word";
        }

        // 创建弹窗
        const popup = document.createElement("div");
        popup.id = "dictationPopup";
        popup.className = "popup";
        popup.innerHTML = `
            <div class="popup-drag-handle" title="拖拽移动"></div>
            <h3>Word #${i + 1}</h3>
            <p id="retryInfo">Attempts: ${retries}/${s.maxRetry} &nbsp;&nbsp;  ${writeHint}</p>

            <!-- 播放发音按钮 -->
            <button onclick="Dictation.play()" class="btn-sound">🎧</button>
            <br><br>

            <!-- 暂停/播放按钮 -->
            <button onclick="Dictation.playPause()" id="dictationPlayPauseBtn" class="${s.isPaused ? 'btn-play' : 'btn-pause'}">${s.isPaused ? '▶' : '⏸'}</button>

            <!-- 输入框 -->
            <input type="text" id="dictationInput" placeholder="Type the word" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ${s.isPaused ? 'disabled' : ''}>
            <br><br>

        `;

        // 将弹窗添加到页面
        document.body.append(popup);

        // 初始化拖拽功能
        this.initDrag(popup);

        // 如果没有暂停，500ms 后自动播放发音
        if (!s.isPaused) {
            setTimeout(() => this.play(), 500);
        }

        // 监听回车键提交
        $("dictationInput").addEventListener("keypress", e => {
            if (e.key === "Enter" && !this.state?.isPaused) this.submit();
        });

        // 自动聚焦输入框
        if (!s.isPaused) {
            $("dictationInput").focus();
        }
    }

    /**
     * 关闭弹窗
     * ?. 是可选链操作符，如果元素不存在不会报错
     */
    static closePopup() {
        $("dictationPopup")?.remove();
    }

    /**
     * 初始化弹窗拖拽功能
     * @param {HTMLElement} popup - 弹窗元素
     */
    static initDrag(popup) {
        const handle = popup.querySelector('.popup-drag-handle');
        if (!handle) return;

        let isDragging = false;
        let startX, startY;
        let initialX, initialY;

        // 获取初始位置（居中时的位置）
        const rect = popup.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        // 移除 CSS transform 居中，改用绝对定位
        popup.style.left = initialX + 'px';
        popup.style.top = initialY + 'px';
        popup.style.transform = 'rotate(-1deg)'; // 保留倾斜效果

        // 鼠标按下开始拖拽
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = popup.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;

            popup.classList.add('dragging');
            e.preventDefault();
        });

        // 鼠标移动
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            popup.style.left = (initialX + deltaX) + 'px';
            popup.style.top = (initialY + deltaY) + 'px';
        });

        // 鼠标松开结束拖拽
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
            }
        });

        // 触摸支持（移动端）
        handle.addEventListener('touchstart', (e) => {
            isDragging = true;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;

            const rect = popup.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;

            popup.classList.add('dragging');
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            popup.style.left = (initialX + deltaX) + 'px';
            popup.style.top = (initialY + deltaY) + 'px';
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
            }
        });
    }

    // -------------------- 核心操作 --------------------

    /**
     * 播放当前条目的发音
     * 根据模式播放 speakTexts 中的内容
     */
    static play() {
        if (this.state) {
            const textToSpeak = this.state.speakTexts[this.state.currentIndex];
            speakWord(textToSpeak, this.state.slow);
        }
    }

    /**
     * 提交答案
     * 根据模式检验 expectTexts 中的内容
     */
    static submit() {
        const s = this.state;
        if (!s) return;

        const input = $("dictationInput");
        const answer = input.value.trim();  // 保留用户原始输入，不改大小写
        const correct = s.expectTexts[s.currentIndex];  // 使用期望输入的内容
        const i = s.currentIndex;

        // 记录这次尝试（比较时忽略大小写，但保存原始输入）
        s.attempts[i].push({
            answer,                      // 用户输入（保留原始大小写）
            isCorrect: answer.toLowerCase() === correct.toLowerCase() // 比较时忽略大小写
        });

        if (answer.toLowerCase() === correct.toLowerCase()) {
            // 回答正确
            s.results[i] = { status: "correct", retries: s.attempts[i].length };
            this.updateWorkplace();
            this.closePopup();
            s.currentIndex++;
            // 500ms 后显示下一个单词
            setTimeout(() => this.showPopup(), 500);
        } else {
            // 回答错误
            this.updateWorkplace();

            if (s.attempts[i].length >= s.maxRetry) {
                // 已用完所有尝试次数
                s.results[i] = { status: "failed", retries: s.attempts[i].length };
                this.updateWorkplace();
                this.closePopup();
                s.currentIndex++;
                setTimeout(() => this.showPopup(), 500);
            } else {
                // 还有尝试机会
                $("retryInfo").textContent = `Attempts: ${s.attempts[i].length}/${s.maxRetry}`;
                input.value = "";
                input.focus();
            }
        }
    }

    /**
     * 更新听写记录显示
     */
    static updateWorkplace() {
        const s = this.state;
        const wp = $("dictationWorkplace");
        if (!wp || !s) return;

        // 生成每个单词的尝试记录 HTML
        wp.innerHTML = s.attempts.map((attempts, i) => {
            // 如果这个单词还没有尝试，跳过
            if (!attempts.length) return '';

            const result = s.results[i];

            // 生成每次尝试的 HTML
            const rows = attempts.map((a, j) => {
                const isLast = j === attempts.length - 1;  // 是否是最后一次尝试
                let symbol, cls;

                // 根据结果设置图标和样式
                if (a.isCorrect) {
                    symbol = "✔️";
                    cls = "correct";
                } else if (isLast && result?.status === "failed") {
                    // 最后一次尝试且最终失败
                    symbol = "❌";
                    cls = "failed";
                } else {
                    // 错误但还有机会
                    symbol = "⚠️";
                    cls = "warning";
                }

                // 如果失败，显示正确答案（播放内容 - 期望输入）
                const extra = (isLast && result?.status === "failed")
                    ? `<br><span class="correct">(${s.speakTexts[i]} - ${s.expectTexts[i]})</span>`
                    : '';

                return `<div class="${cls}">${a.answer} ${symbol}(${j + 1})${extra}</div>`;
            }).join('');

            // 返回这个单词的完整记录
            return `<div class="result-item">
                <span class="result-index">${i + 1}.</span>
                <div class="result-attempts">${rows}</div>
            </div>`;
        }).join('');

        // 滚动到最新记录（.main 是滚动容器）
        setTimeout(() => {
            const main = document.querySelector(".main");
            if (main) {
                main.scrollTop = main.scrollHeight;
            }
        }, 50);
    }

    /**
     * 显示最终结果
     */
    static showResults() {
        const s = this.state;
        this.closePopup();

        // 统计结果
        let correct = 0;   // 一次正确
        let warning = 0;   // 多次正确
        let failed = 0;    // 最终失败

        s.results.forEach((r, i) => {
            if (r?.status === "correct" && s.attempts[i].length === 1) {
                correct++;
            } else if (r?.status === "correct") {
                warning++;
            } else if (r?.status === "failed") {
                failed++;
            }
        });

        // 计算得分：一次正确得一分，多次正确得半分
        const score = ((correct + warning * 0.5) / s.entries.length * 100).toFixed(1);

        // 显示结果
        logToWorkplace(`
            <div class="results-box">
                <h3>📊 Dictation Complete!</h3>
                <p><strong>Score: ${score}</strong></p>
                <p>✅ First try correct: ${correct}</p>
                <p>⚠️ Multiple tries: ${warning}</p>
                <p>❌ Failed: ${failed}</p>
            </div>
        `);

        // 清除状态
        this.state = null;
    }

    // -------------------- 控制操作 --------------------

    /**
     * 暂停/播放切换
     */
    static playPause() {
        if (!this.state) return;

        this.state.isPaused = !this.state.isPaused;
        updatePlayPauseBtn($("dictationPlayPauseBtn"), this.state.isPaused);

        const input = $("dictationInput");
        if (this.state.isPaused) {
            stopAudio();
            if (input) input.disabled = true;
        } else {
            if (input) {
                input.disabled = false;
                input.focus();
            }
            this.play();
        }
    }

    /**
     * 切换到听写模式
     * 如果当前就在听写模式 -> 重新开始
     * 如果从复读模式切换 -> 暂停复读，尝试恢复听写
     */
    static switchToDictation() {
        // 如果当前就在听写模式，直接重新开始
        if (currentActiveMode === "dictation") {
            this.startDictation();
            return;
        }

        // 从复读模式切换过来，暂停复读模式
        if (currentRepeaterState) {
            currentRepeaterState.isPaused = true;
            Repeater.playId++;
            stopAudio();
        }

        // 检查是否有可恢复的听写状态
        if (this.state) {
            // 检查单词列表是否改变（使用 Set 比较，忽略顺序，因为可能有 shuffle）
            const currentEntries = loadWordsFromTextarea();
            const currentWords = currentEntries.map(e => e.word);
            const stateWords = this.state.words;
            const currentSet = new Set(currentWords);
            const stateSet = new Set(stateWords);
            const wordsChanged = currentWords.length !== stateWords.length ||
                currentWords.some(w => !stateSet.has(w)) ||
                stateWords.some(w => !currentSet.has(w));

            if (!wordsChanged) {
                // 单词未改变，恢复听写
                this.resumeDictation();
                return;
            }
        }

        // 需要重新启动
        this.startDictation();
    }

    /**
     * 恢复听写模式
     */
    static resumeDictation() {
        if (!this.state) return;

        currentActiveMode = "dictation";
        document.body.classList.remove('repeater-mode');
        document.body.classList.add('dictation-mode');

        // 清空工作区并重新渲染 UI
        clearWorkplace();
        this.renderDictationUI();

        // 恢复之前的答题记录
        this.updateWorkplace();

        // 恢复状态
        this.state.isPaused = false;

        // 如果还没完成，显示当前单词的弹窗
        if (this.state.currentIndex < this.state.entries.length) {
            this.showPopup();
        } else {
            // 已完成，显示结果
            this.showResults();
        }
    }
}
