/**
 * 工具函数模块
 */

import { preloadCache } from './state.js';

/**
 * 简化版的 document.getElementById
 */
export const $ = id => document.getElementById(id);

/**
 * 内部状态：检测到的目标语言
 */
let detectedTargetLang = 'en';

/**
 * 各语言的字符验证正则（允许的字符）
 */
const LANG_PATTERNS = {
    en: /^[a-zA-Z\s\-']+$/,                                           // 英语
    ja: /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\s]+$/, // 日语（平假名、片假名、汉字）
    ko: /^[\uAC00-\uD7AF\u1100-\u11FF\s]+$/,                           // 韩语
    fr: /^[a-zA-Z\u00C0-\u00FF\s\-']+$/,                               // 法语（含重音字符）
    zh: /^[\u4e00-\u9fff\s]+$/                                         // 中文
};

/**
 * 各语言的无效字符正则（用于过滤）
 */
const LANG_INVALID_PATTERNS = {
    en: /[^a-zA-Z\s\-']/g,
    ja: /[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\s]/g,
    ko: /[^\uAC00-\uD7AF\u1100-\u11FF\s]/g,
    fr: /[^a-zA-Z\u00C0-\u00FF\s\-']/g,
    zh: /[^\u4e00-\u9fff\s]/g
};

/**
 * 语言检测正则（用于自动识别输入语言）
 * 优先级：韩语 > 日语 > 中文 > 法语 > 英语
 */
const DETECTION_PATTERNS = {
    ko: /[\uAC00-\uD7AF\u1100-\u11FF]/,  // 韩语字符
    ja: /[\u3040-\u309F\u30A0-\u30FF]/,  // 日语假名
    zh: /[\u4e00-\u9fff]/,               // 中文汉字
    fr: /[\u00C0-\u00FF]/                // 法语特殊字符
};

/**
 * 检测文本是否对指定语言有效
 * @param {string} text - 要检测的文本
 * @param {string} lang - 语言代码 (en, ja, ko, fr, zh)
 * @returns {boolean}
 */
export function isValidForLanguage(text, lang) {
    const pattern = LANG_PATTERNS[lang];
    if (!pattern) return true;
    return pattern.test(text);
}

/**
 * 过滤掉文本中对指定语言无效的字符
 * @param {string} text - 要过滤的文本
 * @param {string} lang - 语言代码
 * @returns {string}
 */
export function filterInvalidChars(text, lang) {
    const pattern = LANG_INVALID_PATTERNS[lang];
    if (!pattern) return text;
    return text.replace(pattern, '');
}

/**
 * 检测单个文本片段的语言
 * @param {string} text - 要检测的文本
 * @returns {string|null} 语言代码或 null
 */
export function detectLanguage(text) {
    const cleanText = text.replace(/[\s\d\-':,.!?;()\[\]{}"""'']/g, '');
    if (!cleanText) return null;

    if (DETECTION_PATTERNS.ko.test(cleanText)) return 'ko';
    if (DETECTION_PATTERNS.ja.test(cleanText)) return 'ja';
    if (DETECTION_PATTERNS.zh.test(cleanText)) return 'zh';
    if (DETECTION_PATTERNS.fr.test(cleanText)) return 'fr';
    return 'en';
}

/**
 * 从 textarea 内容检测语言（检测第一个有效单词）
 * @param {string} content - textarea 的完整内容
 * @returns {string|null} 语言代码或 null
 */
export function detectLanguageFromInput(content) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const colonIdx = trimmed.indexOf(':');
        const wordPart = colonIdx !== -1 ? trimmed.substring(0, colonIdx).trim() : trimmed;
        if (wordPart) {
            const detected = detectLanguage(wordPart);
            if (detected) return detected;
        }
    }
    return null;
}

/**
 * 设置目标语言（内部状态）
 * @param {string} lang - 语言代码
 */
export function setTargetLang(lang) {
    if (['en', 'ja', 'ko', 'fr', 'zh'].includes(lang)) {
        detectedTargetLang = lang;
    }
}

/**
 * 检测文本是否包含中文字符（向后兼容）
 */
export function containsChinese(text) {
    return /[\u4e00-\u9fff]/.test(text);
}

/**
 * 过滤掉文本中的中文字符（向后兼容）
 */
export function filterChinese(text) {
    return text.replace(/[\u4e00-\u9fff]/g, '');
}

/**
 * 获取用户选择的发音口音
 * @returns {'us' | 'uk'}
 */
export function getAccent() {
    const el = document.querySelector('input[name="accent"]:checked');
    return el ? el.value : 'us';
}

/**
 * 获取目标语言（学习的语言）
 * @returns {string} 语言代码 (en, ja, ko, fr, zh)
 */
export function getTargetLang() {
    return detectedTargetLang;
}

/**
 * 获取翻译语言（单词翻译显示的语言）
 * @returns {string} 语言代码 (en, ja, ko, fr, zh)
 */
export function getTranslationLang() {
    return $("translationLang")?.value || 'zh';
}

/**
 * 获取界面语言（UI语言包）
 * @returns {string} 语言代码 (en, ja, ko, fr, zh)
 */
export function getUiLang() {
    return $("uiLang")?.value || 'zh';
}

/**
 * 从设置面板读取用户配置
 */
export function getSettings() {
    return {
        repeat: parseInt($("repeat")?.value) || 1,
        retry: parseInt($("retry")?.value) || 1,
        interval: parseInt($("interval")?.value) || 300,
        slow: $("slow")?.checked ?? false,
        shuffle: $("shuffle")?.checked ?? false,
        dictateMode: $("dictateMode")?.checked ? "listenB_writeA" : "listenA_writeB",
        accent: getAccent(),
        targetLang: getTargetLang(),
        translationLang: getTranslationLang(),
        uiLang: getUiLang()
    };
}

/**
 * 从文本框读取单词列表
 * 支持 a:b 格式，其中 a 是单词，b 是定义
 */
export function loadWordsFromTextarea() {
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
 * 从单词条目数组中提取单词列表
 */
export function getWordsFromEntries(entries) {
    return entries.map(e => e.word);
}

/**
 * 打乱数组顺序（Fisher-Yates 洗牌算法）
 */
export function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * 切换视图显示
 * @param {'homeView' | 'repeaterView' | 'dictationView'} viewId
 */
export function showView(viewId) {
    document.querySelectorAll('.mode-view').forEach(v => v.classList.remove('active'));
    const view = $(viewId);
    if (view) view.classList.add('active');
}

/**
 * 向听写工作区追加 HTML 内容
 */
export function logToWorkplace(html) {
    $("dictationWorkplace").insertAdjacentHTML("beforeend", html);
}

/**
 * 防抖函数
 */
export function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 测量文字实际宽度（使用 Canvas API）
 */
export function measureTextWidth(text, font) {
    const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    ctx.font = font;
    return ctx.measureText(text).width;
}

/**
 * HTML 实体转义（防止 XSS）
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 根据最长行自动调整侧边栏宽度
 */
export function adjustSidebarWidth() {
    const wordInput = $("wordInput");
    const sidebar = document.querySelector(".settings-trigger .sidebar");
    if (!wordInput || !sidebar) return;

    const style = getComputedStyle(wordInput);
    const font = `${style.fontSize} ${style.fontFamily}`;

    const lines = wordInput.value.split(/\n/).filter(l => l.trim());
    const maxTextWidth = lines.reduce((max, l) => Math.max(max, measureTextWidth(l, font)), 0);

    const baseWidth = 240;
    const extraSpace = 85;
    const neededWidth = maxTextWidth + extraSpace;

    sidebar.style.minWidth = Math.max(baseWidth, neededWidth) + "px";
}

/**
 * 根据预加载状态更新模式按钮的可用性
 */
export function updateModeButtonsState() {
    const dictationBtn = document.getElementById("dictation-btn");
    const repeaterBtn = document.getElementById("repeater-btn");
    const hasEntries = preloadCache.entries.length > 0;

    if (dictationBtn) dictationBtn.disabled = !hasEntries;
    if (repeaterBtn) repeaterBtn.disabled = !hasEntries;
}

/**
 * 语言设置的 localStorage key
 */
const LANG_STORAGE_KEY = 'dictation-tool-languages';

/**
 * 保存语言设置到 localStorage
 */
export function saveLangSettings() {
    const settings = {
        targetLang: getTargetLang(),
        translationLang: getTranslationLang(),
        uiLang: getUiLang()
    };
    localStorage.setItem(LANG_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * 从 localStorage 加载语言设置
 */
export function loadLangSettings() {
    try {
        const stored = localStorage.getItem(LANG_STORAGE_KEY);
        if (stored) {
            const settings = JSON.parse(stored);
            if (settings.targetLang) {
                detectedTargetLang = settings.targetLang;
            }
            if (settings.translationLang && $("translationLang")) {
                $("translationLang").value = settings.translationLang;
            }
            if (settings.uiLang && $("uiLang")) {
                $("uiLang").value = settings.uiLang;
            }
            // 更新 Accent 选择器可见性
            updateAccentSelectorVisibility();
        }
    } catch (e) {
        console.warn('加载语言设置失败:', e);
    }
}

/**
 * 更新 Accent 选择器的可见性（仅 Target=en 时显示）
 */
export function updateAccentSelectorVisibility() {
    const accentSelector = $("accentSelector");
    if (accentSelector) {
        accentSelector.style.display = getTargetLang() === 'en' ? '' : 'none';
    }
}

/**
 * 支持的语言列表
 */
export const SUPPORTED_LANGS = ['en', 'ja', 'ko', 'fr', 'zh'];

/**
 * 语言名称映射
 */
export const LANG_NAMES = {
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    fr: 'Français',
    zh: '中文'
};

/**
 * 绑定设置控件到服务端同步
 *
 * @param {string} elementId - 元素 ID
 * @param {string} settingKey - 设置键名
 * @param {Object} options - 配置选项
 * @param {Function} [options.getValue] - 自定义获取值的函数，默认根据元素类型自动判断
 * @param {Function} [options.beforeSave] - 保存前的回调函数 (value) => void
 * @param {Function} [options.afterSave] - 保存后的回调函数 (value) => void
 * @param {Object} [options.stateObject] - 要同步更新的状态对象（如 currentRepeaterState.settings）
 * @param {string} [options.stateKey] - 状态对象中的键名（默认从 settingKey 转换）
 * @param {string} [options.eventType] - 监听的事件类型（默认 'change'）
 */
export function bindSettingControl(elementId, settingKey, options = {}) {
    const {
        getValue = null,
        beforeSave = null,
        afterSave = null,
        stateObject = null,
        stateKey = null,
        eventType = 'change'
    } = options;

    const element = $(elementId);
    if (!element) return;

    // 默认的获取值函数
    const defaultGetValue = (el) => {
        if (el.type === 'checkbox') {
            return el.checked;
        } else if (el.type === 'number') {
            return parseInt(el.value) || 0;
        } else if (el.type === 'radio') {
            return el.value;
        } else {
            return el.value;
        }
    };

    const getValueFn = getValue || defaultGetValue;

    element.addEventListener(eventType, async () => {
        const value = getValueFn(element);

        // 保存前回调
        if (beforeSave) {
            beforeSave(value);
        }

        // 更新状态对象
        if (stateObject) {
            // 将 snake_case 转换为 camelCase
            const key = stateKey || settingKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            stateObject[key] = value;
        }

        // 保存到服务端（需要从外部传入 saveSettingToServer）
        if (window.saveSettingToServer) {
            await window.saveSettingToServer(settingKey, value);
        }

        // 保存后回调
        if (afterSave) {
            afterSave(value);
        }
    });
}

/**
 * 批量绑定设置控件
 *
 * @param {Array} bindings - 绑定配置数组
 * @example
 * bindSettingControls([
 *   { elementId: 'shuffle', settingKey: 'shuffle_mode', stateObject: state.settings },
 *   { elementId: 'slow', settingKey: 'slow_mode', stateObject: state.settings }
 * ]);
 */
export function bindSettingControls(bindings) {
    bindings.forEach(binding => {
        const { elementId, settingKey, ...options } = binding;
        bindSettingControl(elementId, settingKey, options);
    });
}

/**
 * 检测输入文本中的所有单词是否属于同一种语言
 * @param {string} content - 输入文本
 * @returns {Object} { consistent: boolean, detectedLangs: string[] }
 */
export function checkLanguageConsistency(content) {
    const lines = content.split(/\r?\n/);
    const detectedLangs = new Set();

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const colonIdx = trimmed.indexOf(':');
        const wordPart = colonIdx !== -1 ? trimmed.substring(0, colonIdx).trim() : trimmed;

        if (wordPart) {
            const lang = detectLanguage(wordPart);
            if (lang) {
                detectedLangs.add(lang);
            }
        }
    }

    return {
        consistent: detectedLangs.size <= 1,
        detectedLangs: Array.from(detectedLangs)
    };
}

/**
 * 显示 Toast 提示消息
 * @param {string} message - 提示消息
 * @param {number} duration - 显示时长（毫秒），默认 3000
 */
export function showToast(message, duration = 3000) {
    // 移除已存在的 toast
    const existingToast = document.getElementById('toast');
    if (existingToast) {
        existingToast.remove();
    }

    // 创建 toast 元素
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // 触发显示动画
    setTimeout(() => toast.classList.add('show'), 10);

    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
