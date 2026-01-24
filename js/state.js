/**
 * 全局状态管理模块
 */

/**
 * 复读模式的状态对象
 * 为 null 表示复读模式未启动
 */
export let currentRepeaterState = null;

/**
 * 当前激活的模式
 * "repeater" | "dictation" | null
 */
export let currentActiveMode = null;

/**
 * 预加载缓存对象
 * 用于后台预加载翻译和音频
 */
export const preloadCache = {
    entries: [],            // 已缓存的单词条目列表 { word, definition }
    translations: {},       // { word: translation } - 如果有 definition 则直接使用
    wordInfo: {},           // { word: { translation, definitions, examples, synonyms, antonyms } } - DeepSeek 完整信息
    audioUrls: {},          // { `${text}:${accent}`: Blob URL } (正常速度) - 支持双口音
    slowAudioUrls: {},      // { `${text}:${accent}`: Blob URL } (慢速) - 支持双口音
    sentenceAudioUrls: {},  // { `${sentence}:${accent}`: Blob URL } - 例句音频缓存
    loading: false,         // 是否正在加载
    loadId: 0,              // 加载 ID，用于取消旧的加载
    abortController: null,  // AbortController 用于取消 fetch 请求
    // 分开计数
    translationLoaded: 0,   // 翻译已加载数
    translationTotal: 0,    // 翻译总数
    audioLoaded: 0,         // 音频已加载数（单词数，4个音频=1）
    audioTotal: 0,          // 音频总数（单词数）
    audioPartial: {}        // { text: count } 追踪每个单词已加载的音频数
};

/**
 * 从 localStorage 恢复 wordInfo 缓存
 */
export function loadCacheFromStorage() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('wordinfo:')) {
                const word = key.slice(9);
                const data = localStorage.getItem(key);
                if (data) {
                    preloadCache.wordInfo[word] = JSON.parse(data);
                    preloadCache.translations[word] = preloadCache.wordInfo[word].translation;
                }
            }
        }
    } catch (e) {
        console.warn('Failed to load cache from localStorage:', e);
    }
}

// 模块加载时自动恢复缓存
loadCacheFromStorage();

/**
 * 设置复读模式状态
 */
export function setRepeaterState(state) {
    currentRepeaterState = state;
}

/**
 * 设置当前激活模式
 */
export function setActiveMode(mode) {
    currentActiveMode = mode;
}

/**
 * 根据预加载状态更新模式按钮的可用性
 */
export function updateModeButtonsState() {
    const dictationBtn = document.getElementById("Dictation-bnt");
    const repeaterBtn = document.getElementById("Repeater-bnt");
    const hasEntries = preloadCache.entries.length > 0;

    if (dictationBtn) dictationBtn.disabled = !hasEntries;
    if (repeaterBtn) repeaterBtn.disabled = !hasEntries;
}
