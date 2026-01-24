/**
 * 预加载系统模块
 */

import { preloadCache } from './state.js';
import { $, loadWordsFromTextarea, debounce, adjustSidebarWidth, getAccent } from './utils.js';
import { API_BASE, getHttpErrorMessage, getFetchErrorMessage } from './api.js';

/**
 * 更新预加载进度显示
 */
export function updatePreloadProgress() {
    const indicator = $("preloadIndicator");
    if (!indicator) return;

    const wordCount = preloadCache.entries.length;

    if (preloadCache.loading) {
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
 */
export async function startPreload() {
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
        return;
    }

    // 取消旧的加载
    if (preloadCache.abortController) {
        preloadCache.abortController.abort();
    }
    preloadCache.abortController = new AbortController();
    const signal = preloadCache.abortController.signal;

    preloadCache.loadId++;
    const myId = preloadCache.loadId;

    // 重置缓存
    preloadCache.entries = entries.map(e => ({ ...e }));
    preloadCache.loading = true;
    preloadCache.loaded = 0;

    const definitionCount = entries.filter(e => e.definition).length;
    // 每个单词: 词典(1) + 正常音频(1) + 慢速音频(1) = 3
    // 自定义单词额外: 定义正常音频(1) + 定义慢速音频(1) = 2
    preloadCache.total = entries.length * 3 + definitionCount * 2;
    updatePreloadProgress();

    // 处理自定义单词（有 definition 的）
    entries.forEach(entry => {
        const { word, definition } = entry;
        if (definition) {
            preloadCache.translations[word] = definition;
            preloadCache.wordInfo[word] = {
                word,
                translation: definition,
                definitions: [],
                examples: [],
                synonyms: [],
                antonyms: []
            };
            preloadCache.loaded++;
            updatePreloadProgress();
        }
    });

    // 收集需要从 API 获取的单词（排除自定义和已缓存的）
    const wordsToFetch = entries
        .filter(e => !e.definition && !preloadCache.wordInfo[e.word])
        .map(e => e.word);

    // 已缓存的单词也计入进度（来自 localStorage 恢复的）
    entries.forEach(entry => {
        if (!entry.definition && preloadCache.wordInfo[entry.word] && !wordsToFetch.includes(entry.word)) {
            preloadCache.loaded++;
            updatePreloadProgress();
        }
    });

    // 批量获取单词信息（使用 DeepSeek）
    const wordInfoPromise = (async () => {
        if (wordsToFetch.length === 0) return;
        if (myId !== preloadCache.loadId) return;

        try {
            const res = await fetch(`${API_BASE}/api/wordinfo/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ words: wordsToFetch }),
                signal
            });

            if (myId !== preloadCache.loadId) return;

            if (!res.ok) {
                const errorMsg = getHttpErrorMessage(res.status);
                wordsToFetch.forEach(word => {
                    preloadCache.translations[word] = errorMsg;
                    preloadCache.wordInfo[word] = {
                        word,
                        translation: errorMsg,
                        definitions: [],
                        examples: [],
                        synonyms: [],
                        antonyms: []
                    };
                    preloadCache.loaded++;
                });
                updatePreloadProgress();
                return;
            }

            let data;
            try {
                data = await res.json();
            } catch {
                wordsToFetch.forEach(word => {
                    preloadCache.translations[word] = "加载失败: 响应格式错误";
                    preloadCache.loaded++;
                });
                updatePreloadProgress();
                return;
            }

            if (data.error) {
                const errorMsg = `错误: ${data.error}`;
                wordsToFetch.forEach(word => {
                    preloadCache.translations[word] = errorMsg;
                    preloadCache.wordInfo[word] = {
                        word,
                        translation: errorMsg,
                        definitions: [],
                        examples: [],
                        synonyms: [],
                        antonyms: []
                    };
                    preloadCache.loaded++;
                });
                updatePreloadProgress();
                return;
            }

            // 缓存结果到内存和 localStorage
            const results = data.results || {};
            wordsToFetch.forEach(word => {
                const info = results[word];
                if (info) {
                    preloadCache.wordInfo[word] = info;
                    preloadCache.translations[word] = info.translation || "无翻译";
                    // 持久化到 localStorage
                    try {
                        localStorage.setItem(`wordinfo:${word}`, JSON.stringify(info));
                    } catch (e) {
                        // localStorage 满了，忽略
                    }
                } else {
                    preloadCache.translations[word] = "无数据";
                    preloadCache.wordInfo[word] = {
                        word,
                        translation: "无数据",
                        definitions: [],
                        examples: [],
                        synonyms: [],
                        antonyms: []
                    };
                }
                preloadCache.loaded++;
            });
            updatePreloadProgress();
        } catch (e) {
            if (e.name === 'AbortError') return;
            const errorMsg = getFetchErrorMessage(e);
            wordsToFetch.forEach(word => {
                preloadCache.translations[word] = errorMsg;
                preloadCache.loaded++;
            });
            updatePreloadProgress();
        }
    })();

    // 收集所有需要预加载音频的文本
    const textsToPreload = new Set();
    entries.forEach(e => {
        textsToPreload.add(e.word);
        if (e.definition) textsToPreload.add(e.definition);
    });

    // 获取当前发音设置
    const accent = getAccent();

    // 并行加载所有音频（正常速度）
    const audioPromises = Array.from(textsToPreload).map(async (text) => {
        if (myId !== preloadCache.loadId) return;

        if (preloadCache.audioUrls[text]) {
            preloadCache.loaded++;
            updatePreloadProgress();
            return;
        }

        try {
            const url = `${API_BASE}/api/tts?word=${encodeURIComponent(text)}&slow=0&accent=${accent}`;
            const res = await fetch(url, { signal });
            const blob = await res.blob();

            if (myId !== preloadCache.loadId) return;

            preloadCache.audioUrls[text] = URL.createObjectURL(blob);
            preloadCache.loaded++;
            updatePreloadProgress();
        } catch (e) {
            if (e.name === 'AbortError') return;
            // 音频加载失败，不缓存
            preloadCache.loaded++;
            updatePreloadProgress();
        }
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
            const url = `${API_BASE}/api/tts?word=${encodeURIComponent(text)}&slow=1&accent=${accent}`;
            const res = await fetch(url, { signal });
            const blob = await res.blob();

            if (myId !== preloadCache.loadId) return;

            preloadCache.slowAudioUrls[text] = URL.createObjectURL(blob);
            preloadCache.loaded++;
            updatePreloadProgress();
        } catch (e) {
            if (e.name === 'AbortError') return;
            // 音频加载失败，不缓存
            preloadCache.loaded++;
            updatePreloadProgress();
        }
    });

    // 等待所有加载完成
    await Promise.all([wordInfoPromise, ...audioPromises, ...slowAudioPromises]);

    if (myId === preloadCache.loadId) {
        preloadCache.loading = false;
        updatePreloadProgress();
    }
}

// 防抖版本的预加载函数
export const debouncedPreload = debounce(startPreload, 500);

// 防抖版本的侧边栏宽度调整
const debouncedAdjustSidebar = debounce(adjustSidebarWidth, 300);

/**
 * 初始化预加载监听器
 */
export function initPreloadListeners() {
    const wordInput = $("wordInput");
    if (wordInput) {
        wordInput.addEventListener("input", debouncedPreload);
        wordInput.addEventListener("input", debouncedAdjustSidebar);
        wordInput.addEventListener("paste", () => setTimeout(adjustSidebarWidth, 0));
    }

    startPreload();
    adjustSidebarWidth();
}
