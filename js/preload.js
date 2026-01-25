/**
 * 预加载系统模块
 */

import { preloadCache, clearAudioCache } from './state.js';
import { $, loadWordsFromTextarea, debounce, adjustSidebarWidth, updateModeButtonsState } from './utils.js';
import { API_BASE, getTtsUrl, getHttpErrorMessage, getFetchErrorMessage } from './api.js';

// 追踪上一次的 loading 状态
let wasLoading = false;

/**
 * 更新预加载进度显示（两个进度条）
 */
export function updatePreloadProgress() {
    const indicator = $("preloadIndicator");
    const transEl = $("translationProgress");
    const audioEl = $("audioProgress");
    if (!indicator) return;

    const isLoading = preloadCache.loading;
    const hasWords = preloadCache.entries.length > 0;

    if (isLoading || hasWords) {
        indicator.style.display = "block";

        // 翻译进度
        if (transEl) {
            transEl.textContent = `翻译: ${preloadCache.translationLoaded}/${preloadCache.translationTotal}`;
        }

        // 音频进度
        if (audioEl) {
            audioEl.textContent = `音频: ${preloadCache.audioLoaded}/${preloadCache.audioTotal}`;
        }

        if (isLoading) {
            wasLoading = true;
        } else {
            // 从 loading 变成 ready 时，更新 Repeater 显示
            if (wasLoading && window.Repeater?.renderContent) {
                window.Repeater.renderContent();
            }
            wasLoading = false;
        }
    } else {
        indicator.style.display = "none";
        wasLoading = false;
    }
}

/**
 * 开始预加载翻译和音频
 */
export async function startPreload(forceReload = false) {
    const entries = loadWordsFromTextarea();
    if (!entries.length) {
        preloadCache.loading = false;
        preloadCache.entries = [];
        preloadCache.translationLoaded = 0;
        preloadCache.translationTotal = 0;
        preloadCache.audioLoaded = 0;
        preloadCache.audioTotal = 0;
        updatePreloadProgress();
        updateModeButtonsState();
        return;
    }

    // 检查单词列表是否改变
    const entriesChanged = entries.length !== preloadCache.entries.length ||
        entries.some((e, i) =>
            e.word !== preloadCache.entries[i]?.word ||
            e.definition !== preloadCache.entries[i]?.definition
        );

    if (!entriesChanged && !preloadCache.loading && !forceReload) {
        return;
    }

    // 强制重新加载：清除当前单词的缓存
    if (forceReload) {
        clearAudioCache(); // 释放 Blob URL 内存
        entries.forEach(({ word, definition }) => {
            if (!definition) {
                delete preloadCache.wordInfo[word];
                delete preloadCache.translations[word];
                localStorage.removeItem(`wordinfo:${word}`);
            }
        });
    }

    // 如果单词列表改变，也清理旧的音频缓存
    if (entriesChanged) {
        clearAudioCache();
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
    updateModeButtonsState();
    preloadCache.translationLoaded = 0;
    preloadCache.audioLoaded = 0;
    preloadCache.audioPartial = {};

    // 验证单词/短语是否有效（只允许英文字母、空格、连字符、撇号）
    const isValidWord = (w) => /^[a-zA-Z\s\-']+$/.test(w) && w.length <= 100;

    // 统计翻译进度（总数 = 所有单词，已加载 = 已缓存 + 自定义）
    let translationTotal = entries.length;
    let translationLoaded = 0;
    entries.forEach(entry => {
        const { word, definition } = entry;
        if (definition) {
            // 自定义单词，直接使用 definition
            preloadCache.translations[word] = definition;
            preloadCache.wordInfo[word] = {
                word,
                translation: definition,
                definitions: [],
                examples: [],
                synonyms: [],
                antonyms: []
            };
            translationLoaded++;
        } else if (!preloadCache.wordInfo[word] && !isValidWord(word)) {
            // 无效输入
            preloadCache.translations[word] = "⚠️ 请输入英文";
            preloadCache.wordInfo[word] = {
                word,
                translation: "⚠️ 请输入英文",
                definitions: [],
                examples: [],
                synonyms: [],
                antonyms: []
            };
            translationLoaded++;
        } else if (preloadCache.wordInfo[word]) {
            // 已缓存
            translationLoaded++;
        }
        // 需要从 API 获取的不计入 translationLoaded
    });
    preloadCache.translationTotal = translationTotal;
    preloadCache.translationLoaded = translationLoaded;

    // 收集所有需要预加载音频的文本，并统计已缓存的
    const textsToPreload = new Set();
    entries.forEach(e => {
        textsToPreload.add(e.word);
        if (e.definition) textsToPreload.add(e.definition);
    });
    preloadCache.audioTotal = textsToPreload.size;

    // 统计已缓存的音频（4个变体都缓存了才算）
    let audioLoaded = 0;
    const accentsCheck = ['us', 'uk'];
    const speedsCheck = [false, true];
    for (const text of textsToPreload) {
        let cachedCount = 0;
        for (const accent of accentsCheck) {
            for (const slow of speedsCheck) {
                const cacheKey = `${text}:${accent}`;
                const cacheObj = slow ? preloadCache.slowAudioUrls : preloadCache.audioUrls;
                if (cacheObj[cacheKey]) cachedCount++;
            }
        }
        if (cachedCount === 4) audioLoaded++;
    }
    preloadCache.audioLoaded = audioLoaded;

    updatePreloadProgress();

    // 收集需要从 API 获取的单词
    const wordsToFetch = entries
        .filter(e => !e.definition && !preloadCache.wordInfo[e.word] && isValidWord(e.word))
        .map(e => e.word);

    // 批量获取单词信息（使用 DeepSeek）- 分批处理，每批 5 个
    const BATCH_SIZE = 5;
    const wordInfoPromise = (async () => {
        if (wordsToFetch.length === 0) return;
        if (myId !== preloadCache.loadId) return;

        // 分批处理
        for (let i = 0; i < wordsToFetch.length; i += BATCH_SIZE) {
            if (myId !== preloadCache.loadId) return;

            const batch = wordsToFetch.slice(i, i + BATCH_SIZE);

            try {
                const res = await fetch(`${API_BASE}/api/wordinfo/batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ words: batch }),
                    signal
                });

                if (myId !== preloadCache.loadId) return;

                if (!res.ok) {
                    const errorMsg = getHttpErrorMessage(res.status);
                    batch.forEach(word => {
                        preloadCache.translations[word] = errorMsg;
                        preloadCache.wordInfo[word] = {
                            word,
                            translation: errorMsg,
                            definitions: [],
                            examples: [],
                            synonyms: [],
                            antonyms: []
                        };
                        preloadCache.translationLoaded++;
                    });
                    updatePreloadProgress();
                    continue;
                }

                let data;
                try {
                    data = await res.json();
                } catch {
                    batch.forEach(word => {
                        preloadCache.translations[word] = "加载失败: 响应格式错误";
                        preloadCache.wordInfo[word] = {
                            word,
                            translation: "加载失败",
                            definitions: [],
                            examples: [],
                            synonyms: [],
                            antonyms: []
                        };
                        preloadCache.translationLoaded++;
                    });
                    updatePreloadProgress();
                    continue;
                }

                if (data.error) {
                    const errorMsg = `错误: ${data.error}`;
                    batch.forEach(word => {
                        preloadCache.translations[word] = errorMsg;
                        preloadCache.wordInfo[word] = {
                            word,
                            translation: errorMsg,
                            definitions: [],
                            examples: [],
                            synonyms: [],
                            antonyms: []
                        };
                        preloadCache.translationLoaded++;
                    });
                    updatePreloadProgress();
                    continue;
                }

                // 缓存结果到内存和 localStorage
                const results = data.results || {};
                batch.forEach(word => {
                    const info = results[word];
                    if (info) {
                        preloadCache.wordInfo[word] = info;
                        preloadCache.translations[word] = info.translation || "无翻译";
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
                    preloadCache.translationLoaded++;
                });
                updatePreloadProgress();
            } catch (e) {
                if (e.name === 'AbortError') return;
                const errorMsg = getFetchErrorMessage(e);
                batch.forEach(word => {
                    preloadCache.translations[word] = errorMsg;
                    preloadCache.wordInfo[word] = {
                        word,
                        translation: errorMsg,
                        definitions: [],
                        examples: [],
                        synonyms: [],
                        antonyms: []
                    };
                    preloadCache.translationLoaded++;
                });
                updatePreloadProgress();
            }
        }
    })();

    // 带超时的 fetch 包装函数
    const fetchWithTimeout = (url, options, timeout = 15000) => {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
    };

    // 加载单个音频的函数，返回 { cached: boolean } 表示是否为缓存命中
    const loadSingleAudio = async (text, accent, slow) => {
        const cacheKey = `${text}:${accent}`;
        const cacheObj = slow ? preloadCache.slowAudioUrls : preloadCache.audioUrls;

        if (cacheObj[cacheKey]) {
            return { cached: true };  // 已缓存
        }

        try {
            const url = getTtsUrl(text, slow, accent);
            const res = await fetchWithTimeout(url, { signal }, 15000);
            const blob = await res.blob();

            if (myId === preloadCache.loadId) {
                cacheObj[cacheKey] = URL.createObjectURL(blob);
            }
            return { cached: false };
        } catch (e) {
            return { cached: false };
        }
    };

    // 并行加载所有音频（两种口音 × 两种速度 = 4个）
    const accents = ['us', 'uk'];
    const speeds = [false, true];  // normal, slow

    // 初始化每个文本的计数器（考虑已缓存的）
    textsToPreload.forEach(text => {
        let cachedCount = 0;
        for (const accent of accents) {
            for (const slow of speeds) {
                const cacheKey = `${text}:${accent}`;
                const cacheObj = slow ? preloadCache.slowAudioUrls : preloadCache.audioUrls;
                if (cacheObj[cacheKey]) cachedCount++;
            }
        }
        preloadCache.audioPartial[text] = cachedCount;
    });

    const audioPromises = [];
    for (const text of textsToPreload) {
        for (const accent of accents) {
            for (const slow of speeds) {
                audioPromises.push(
                    loadSingleAudio(text, accent, slow).then((result) => {
                        if (myId !== preloadCache.loadId) return;
                        if (result.cached) return;  // 已缓存的不重复计数

                        preloadCache.audioPartial[text]++;
                        // 4个音频全部加载完才计入进度
                        if (preloadCache.audioPartial[text] === 4) {
                            preloadCache.audioLoaded++;
                            updatePreloadProgress();
                        }
                    })
                );
            }
        }
    }

    // 等待所有加载完成
    await Promise.all([wordInfoPromise, ...audioPromises]);

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
    const loadBtn = $("loadBtn");

    // Load 按钮点击触发预加载（手动控制，省 token）
    // Shift+Click 强制重新加载（清除缓存后重新获取）
    if (loadBtn) {
        loadBtn.addEventListener("click", (e) => {
            const forceReload = e.shiftKey;
            if (forceReload) {
                loadBtn.textContent = "Reloading...";
                setTimeout(() => { loadBtn.textContent = "Load"; }, 1500);
            }
            startPreload(forceReload);
        });
    }

    // 侧边栏宽度自动调整（不涉及 API 调用）
    if (wordInput) {
        wordInput.addEventListener("input", debouncedAdjustSidebar);
        wordInput.addEventListener("paste", () => setTimeout(adjustSidebarWidth, 0));
    }

    adjustSidebarWidth();
    updateModeButtonsState();
}
