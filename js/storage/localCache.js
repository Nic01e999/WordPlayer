/**
 * 本地缓存模块
 * 在 localStorage 中缓存当前单词列表的 word info
 *
 * 存储格式（按语言分开存储）：
 * localStorage['wordinfo_en_zh'] = { "apple": { phonetic, translation, ... }, ... }
 * localStorage['wordinfo_ja_zh'] = { "りんご": { ... }, ... }
 */

const WORDINFO_KEY_PREFIX = 'wordinfo';

// 最大缓存单词数（防止 localStorage 溢出）
const MAX_WORDS = 500;

/**
 * 获取当前语言的缓存键
 * @param {string} targetLang - 目标语言（默认 'en'）
 * @param {string} nativeLang - 母语（默认 'zh'）
 * @returns {string} 缓存键
 */
function getCacheKey(targetLang = 'en', nativeLang = 'zh') {
    return `${WORDINFO_KEY_PREFIX}_${targetLang}_${nativeLang}`;
}

/**
 * 获取所有缓存的 word info
 * @param {string} targetLang - 目标语言
 * @param {string} nativeLang - 母语
 * @returns {object} word info 对象
 */
export function getLocalWordInfo(targetLang = 'en', nativeLang = 'zh') {
    try {
        const key = getCacheKey(targetLang, nativeLang);
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error('[LocalCache] Failed to get word info:', e);
        return {};
    }
}

/**
 * 设置整个 word info 缓存
 * @param {object} wordInfo - { word: info, ... }
 * @param {string} targetLang - 目标语言
 * @param {string} nativeLang - 母语
 */
export function setLocalWordInfo(wordInfo, targetLang = 'en', nativeLang = 'zh') {
    try {
        // 限制缓存大小
        const keys = Object.keys(wordInfo);
        if (keys.length > MAX_WORDS) {
            const trimmed = {};
            keys.slice(-MAX_WORDS).forEach(k => {
                trimmed[k] = wordInfo[k];
            });
            wordInfo = trimmed;
        }

        const key = getCacheKey(targetLang, nativeLang);
        localStorage.setItem(key, JSON.stringify(wordInfo));
    } catch (e) {
        console.error('[LocalCache] Failed to set word info:', e);
        // 如果存储失败（可能是配额满了），尝试清空后重试
        if (e.name === 'QuotaExceededError') {
            clearLocalWordInfo(targetLang, nativeLang);
            try {
                const key = getCacheKey(targetLang, nativeLang);
                localStorage.setItem(key, JSON.stringify(wordInfo));
            } catch (e2) {
                console.error('[LocalCache] Still failed after clear:', e2);
            }
        }
    }
}

/**
 * 获取单个单词的 word info
 * @param {string} word - 单词
 * @param {string} targetLang - 目标语言
 * @param {string} nativeLang - 母语
 * @returns {object|null} word info 或 null
 */
export function getWordInfo(word, targetLang = 'en', nativeLang = 'zh') {
    const cache = getLocalWordInfo(targetLang, nativeLang);
    return cache[word.toLowerCase()] || null;
}

/**
 * 检查是否有某个单词的缓存
 * @param {string} word - 单词
 * @param {string} targetLang - 目标语言
 * @param {string} nativeLang - 母语
 * @returns {boolean}
 */
export function hasWordInfo(word, targetLang = 'en', nativeLang = 'zh') {
    const cache = getLocalWordInfo(targetLang, nativeLang);
    return word.toLowerCase() in cache;
}

/**
 * 添加单词的 word info 到缓存
 * @param {string} word - 单词
 * @param {object} info - word info 对象
 * @param {string} targetLang - 目标语言
 * @param {string} nativeLang - 母语
 */
export function addWordInfo(word, info, targetLang = 'en', nativeLang = 'zh') {
    const cache = getLocalWordInfo(targetLang, nativeLang);
    cache[word.toLowerCase()] = info;
    setLocalWordInfo(cache, targetLang, nativeLang);
}

/**
 * 批量添加 word info
 * @param {object} results - { word: info, ... }
 * @param {string} targetLang - 目标语言
 * @param {string} nativeLang - 母语
 */
export function addWordInfoBatch(results, targetLang = 'en', nativeLang = 'zh') {
    const cache = getLocalWordInfo(targetLang, nativeLang);
    for (const [word, info] of Object.entries(results)) {
        cache[word.toLowerCase()] = info;
    }
    setLocalWordInfo(cache, targetLang, nativeLang);
}

/**
 * 清空 word info 缓存
 * @param {string} targetLang - 目标语言（可选，不指定则清空所有）
 * @param {string} nativeLang - 母语（可选）
 */
export function clearLocalWordInfo(targetLang = null, nativeLang = null) {
    if (targetLang && nativeLang) {
        // 清空指定语言的缓存
        const key = getCacheKey(targetLang, nativeLang);
        localStorage.removeItem(key);
    } else {
        // 清空所有 wordinfo 缓存
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(WORDINFO_KEY_PREFIX + '_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
}

/**
 * 获取缓存统计
 * @param {string} targetLang - 目标语言
 * @param {string} nativeLang - 母语
 * @returns {{count: number, size: number}}
 */
export function getCacheStats(targetLang = 'en', nativeLang = 'zh') {
    try {
        const key = getCacheKey(targetLang, nativeLang);
        const data = localStorage.getItem(key) || '{}';
        const cache = JSON.parse(data);
        return {
            count: Object.keys(cache).length,
            size: new Blob([data]).size
        };
    } catch (e) {
        return { count: 0, size: 0 };
    }
}

/**
 * 从缓存中筛选出已有的和缺失的单词
 * @param {string[]} words - 单词列表
 * @param {string} targetLang - 目标语言
 * @param {string} nativeLang - 母语
 * @returns {{ cached: object, missing: string[] }}
 */
export function filterCachedWords(words, targetLang = 'en', nativeLang = 'zh') {
    const cache = getLocalWordInfo(targetLang, nativeLang);
    const cached = {};
    const missing = [];

    for (const word of words) {
        const key = word.toLowerCase();
        if (cache[key]) {
            cached[word] = cache[key];
        } else {
            missing.push(word);
        }
    }

    return { cached, missing };
}
