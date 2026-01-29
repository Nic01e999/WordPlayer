/**
 * 预加载系统模块
 */

import { preloadCache, clearAudioCache } from './state.js';
import { audioBlobManager, slowAudioBlobManager } from './storage/blobManager.js';
import { t } from './i18n/index.js';
import { promiseAllWithLimit } from './utils/concurrency.js';
import {
    $,
    loadWordsFromTextarea,
    debounce,
    updateModeButtonsState,
    getTargetLang,
    getTranslationLang,
    isValidForLanguage,
    detectLanguageFromInput,
    setTargetLang,
    updateAccentSelectorVisibility,
    checkLanguageConsistency,
    showToast
} from './utils.js';
import { updateHighlight, clearHighlight } from './app.js';
import {
    getTtsUrl,
    getWordDetailsUrl
} from './api.js';
import {
    filterCachedWords,
    addWordInfoBatch,
    clearLocalWordInfo
} from './storage/localCache.js';

// 追踪上一次的 loading 状态
let wasLoading = false;

/**
 * 更新预加载进度显示（两个进度条）
 */
export function updatePreloadProgress() {
    const indicator = $("preloadIndicator");
    const transEl = $("translationProgress");
    const audioEl = $("audioProgress");
    const loadBtn = $("loadBtn");
    const container = loadBtn?.parentElement; // load-btn-container
    if (!indicator || !container) return;

    const isLoading = preloadCache.loading;
    const hasWords = preloadCache.entries.length > 0;

    // 控制 loadBtn 的 loading 状态
    if (loadBtn) {
        if (isLoading) {
            loadBtn.classList.add('loading');
            loadBtn.textContent = 'Loading...';
        } else {
            loadBtn.classList.remove('loading');
            loadBtn.textContent = t('load');
        }
    }

    // 控制容器状态类
    if (isLoading) {
        container.classList.add('loading');
        container.classList.remove('ready');
        indicator.style.display = "block";
        wasLoading = true;
    } else if (hasWords) {
        container.classList.remove('loading');
        container.classList.add('ready');
        indicator.style.display = "block";

        // 从 loading 变成 ready 时，更新 Repeater 显示
        if (wasLoading && window.Repeater?.renderContent) {
            window.Repeater.renderContent();
        }
        wasLoading = false;
    } else {
        container.classList.remove('loading', 'ready');
        indicator.style.display = "none";
        wasLoading = false;
    }

    // 更新进度文本
    if (transEl) {
        transEl.textContent = `${t('progressTranslation')}: ${preloadCache.translationLoaded}/${preloadCache.translationTotal}`;
    }
    if (audioEl) {
        audioEl.textContent = `${t('progressAudio')}: ${preloadCache.audioLoaded}/${preloadCache.audioTotal}`;
    }

    // 日志输出
    console.log(`[Preload] 状态更新: loading=${isLoading}, hasWords=${hasWords}, container类=${container.className}`);
}

/**
 * 开始预加载翻译和音频
 */
export async function startPreload(forceReload = false) {
    console.log('[startPreload] called, loadId:', preloadCache.loadId, 'loading:', preloadCache.loading);
    console.trace('[startPreload] call stack');

    // 获取输入内容并执行统一检测
    const wordInput = $("wordInput");
    const inputText = wordInput ? wordInput.value.trim() : '';

    if (inputText) {
        // 1. 自动检测语言并切换目标语言选择器
        const detected = detectLanguageFromInput(inputText);
        if (detected) {
            setTargetLang(detected);
            updateAccentSelectorVisibility();
        }

        const targetLang = getTargetLang();

        // 2. 检测语言一致性
        const { consistent, detectedLangs } = checkLanguageConsistency(inputText);
        if (!consistent && detectedLangs.length > 1) {
            showToast(t('mixedLanguageWarning'));
            return; // 阻止加载
        }

        // 3. 检测无效字符并高亮显示
        const hasInvalid = updateHighlight(targetLang);

        if (hasInvalid) {
            return; // 阻止加载
        }
    }

    // 清除高亮（如果没有无效字符）
    clearHighlight();

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
        clearLocalWordInfo(); // 清空 localStorage 缓存
        entries.forEach(({ word, definition }) => {
            if (!definition) {
                delete preloadCache.wordInfo[word];
                delete preloadCache.translations[word];
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

    // 获取当前语言设置
    const targetLang = getTargetLang();
    const translationLang = getTranslationLang();

    // 验证单词/短语是否有效（根据目标语言）
    const isValidWord = (w) => w.length <= 100 && isValidForLanguage(w, targetLang);

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
            const langName = targetLang === 'en' ? t('langEnglish') : t('langWord');
            const invalidMsg = t('errorInvalidInput', { lang: langName });
            preloadCache.translations[word] = invalidMsg;
            preloadCache.wordInfo[word] = {
                word,
                translation: invalidMsg,
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

    // 统计已缓存的音频（所有变体都缓存了才算）
    // 英语: 4个变体，其他语言: 2个变体
    let audioLoaded = 0;
    const accentsCheck = targetLang === 'en' ? ['us', 'uk'] : ['us'];
    const speedsCheck = [false, true];
    const expectedVariants = accentsCheck.length * speedsCheck.length;
    for (const text of textsToPreload) {
        let cachedCount = 0;
        for (const accent of accentsCheck) {
            for (const slow of speedsCheck) {
                const cacheKey = `${text}:${accent}:${targetLang}`;
                const cacheObj = slow ? preloadCache.slowAudioUrls : preloadCache.audioUrls;
                if (cacheObj[cacheKey]) cachedCount++;
            }
        }
        if (cachedCount === expectedVariants) audioLoaded++;
    }
    preloadCache.audioLoaded = audioLoaded;

    updatePreloadProgress();

    // 收集需要获取的单词（排除自定义和已在内存缓存的）
    const wordsNeedInfo = entries
        .filter(e => !e.definition && !preloadCache.wordInfo[e.word] && isValidWord(e.word))
        .map(e => e.word);

    // 先检查 localStorage 缓存（传递语言参数）
    const { cached: localCached, missing: wordsToFetch } = filterCachedWords(wordsNeedInfo, targetLang, translationLang);

    // 将 localStorage 缓存的单词应用到内存
    for (const [word, info] of Object.entries(localCached)) {
        preloadCache.wordInfo[word] = info;
        preloadCache.translations[word] = info.translation || t('noTranslation');
        preloadCache.translationLoaded++;
    }
    if (Object.keys(localCached).length > 0) {
        updatePreloadProgress();
    }

    // 从 DeepSeek 获取完整单词信息（音标、翻译、释义、例句等）
    const BATCH_SIZE = 5;

    const wordInfoPromise = (async () => {
        if (wordsToFetch.length === 0) return;
        if (myId !== preloadCache.loadId) return;

        // 分批处理
        for (let i = 0; i < wordsToFetch.length; i += BATCH_SIZE) {
            if (myId !== preloadCache.loadId) return;

            const batch = wordsToFetch.slice(i, i + BATCH_SIZE);
            console.log('[DeepSeek] 开始请求批次:', batch, 'targetLang:', targetLang, 'translationLang:', translationLang);

            // 请求 DeepSeek 获取完整单词信息
            let deepseekData = null;
            try {
                const detailsRes = await fetch(getWordDetailsUrl(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        words: batch,
                        targetLang: targetLang,
                        nativeLang: translationLang
                    }),
                    signal
                });
                if (detailsRes.ok) {
                    deepseekData = await detailsRes.json();
                }
            } catch (e) {
                console.log('[DeepSeek] 请求失败:', e.message);
            }

            if (myId !== preloadCache.loadId) return;

            // 处理结果
            const deepseekResults = deepseekData?.results || {};
            const newWordInfos = {}; // 用于批量保存到 localStorage
            const invalidWords = []; // 收集验证失败的单词

            batch.forEach(word => {
                const info = deepseekResults[word] || {};

                // 检查是否为有道验证失败的单词
                if (info.error === 'word_not_found') {
                    const errorMsg = t('errorWordNotFoundInYoudao');
                    const wordInfo = {
                        word,
                        phonetic: '',
                        translation: errorMsg,
                        nativeDefinitions: [],
                        targetDefinitions: [],
                        examples: { common: [], fun: [] },
                        synonyms: [],
                        antonyms: []
                    };
                    preloadCache.wordInfo[word] = wordInfo;
                    preloadCache.translations[word] = errorMsg;
                    invalidWords.push(word);
                    console.log(`[有道验证] 单词 "${word}" 验证失败`);
                    console.warn(`[有道验证] 单词 "${word}" 验证失败`);
                } else {
                    // 构建完整的单词信息（全部来自 DeepSeek）
                    const wordInfo = {
                        word,
                        phonetic: info.phonetic || '',
                        translation: info.translation || t('noTranslation'),
                        nativeDefinitions: info.nativeDefinitions || [],
                        targetDefinitions: info.targetDefinitions || [],
                        examples: info.examples || { common: [], fun: [] },
                        synonyms: info.synonyms || [],
                        antonyms: info.antonyms || []
                    };

                    preloadCache.wordInfo[word] = wordInfo;
                    preloadCache.translations[word] = wordInfo.translation;
                    newWordInfos[word] = wordInfo; // 收集用于保存
                }

                preloadCache.translationLoaded++;
            });

            // 显示验证失败的提示
            if (invalidWords.length > 0) {
                const message = `${invalidWords.length} 个单词验证失败: ${invalidWords.join(', ')}`;
                showToast(message, 'error');
                console.log(`[验证] ${message}`);
                console.warn(`[验证] ${message}`);
            }

            // 批量保存到 localStorage（传递语言参数）
            if (Object.keys(newWordInfos).length > 0) {
                addWordInfoBatch(newWordInfos, targetLang, translationLang);
            }
            updatePreloadProgress();
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

    // 加载单个音频的函数，返回 { cached, success } 表示状态
    const loadSingleAudio = async (text, accent, slow, lang) => {
        const cacheKey = `${text}:${accent}:${lang}`;
        const cacheObj = slow ? preloadCache.slowAudioUrls : preloadCache.audioUrls;
        const blobManager = slow ? slowAudioBlobManager : audioBlobManager;

        if (cacheObj[cacheKey]) {
            return { cached: true, success: true };  // 已缓存
        }

        try {
            const url = getTtsUrl(text, slow, accent, lang);
            const res = await fetchWithTimeout(url, { signal }, 15000);
            if (!res.ok) {
                console.warn(t('errorTts', { status: res.status }) + ` for ${text}`);
                return { cached: false, success: false };
            }
            const blob = await res.blob();

            if (myId === preloadCache.loadId) {
                // 使用 BlobManager 创建并管理 URL
                cacheObj[cacheKey] = blobManager.create(blob, cacheKey);
            }
            return { cached: false, success: true };
        } catch (e) {
            console.warn(t('errorTtsLoad', { error: e.message }) + ` for ${text}`);
            return { cached: false, success: false };
        }
    };

    // 并行加载所有音频（限制并发数为 6，避免浏览器连接数耗尽）
    // 英语: 两种口音 × 两种速度 = 4个
    // 其他语言: 一种口音 × 两种速度 = 2个
    const accents = targetLang === 'en' ? ['us', 'uk'] : ['us'];  // 非英语只用一种
    const speeds = [false, true];  // normal, slow
    const audioVariants = accents.length * speeds.length;  // 每个文本的音频数量

    // 初始化每个文本的计数器（考虑已缓存的）
    textsToPreload.forEach(text => {
        let cachedCount = 0;
        for (const accent of accents) {
            for (const slow of speeds) {
                const cacheKey = `${text}:${accent}:${targetLang}`;
                const cacheObj = slow ? preloadCache.slowAudioUrls : preloadCache.audioUrls;
                if (cacheObj[cacheKey]) cachedCount++;
            }
        }
        preloadCache.audioPartial[text] = cachedCount;
    });

    const audioTasks = [];
    for (const text of textsToPreload) {
        for (const accent of accents) {
            for (const slow of speeds) {
                audioTasks.push(() =>
                    loadSingleAudio(text, accent, slow, targetLang).then((result) => {
                        if (myId !== preloadCache.loadId) return;
                        if (result.cached) return;  // 已缓存的不重复计数
                        if (!result.success) return;  // 加载失败的不计数

                        preloadCache.audioPartial[text]++;
                        // 所有音频变体全部加载完才计入进度
                        if (preloadCache.audioPartial[text] === audioVariants) {
                            preloadCache.audioLoaded++;
                            updatePreloadProgress();
                        }
                    })
                );
            }
        }
    }

    // 等待所有加载完成（使用并发控制，最多同时 6 个请求）
    await Promise.all([wordInfoPromise, promiseAllWithLimit(audioTasks, 6)]);

    if (myId === preloadCache.loadId) {
        preloadCache.loading = false;
        updatePreloadProgress();
    }
}

// 防抖版本的预加载函数
export const debouncedPreload = debounce(startPreload, 500);

// 防抖版本的侧边栏宽度调整

/**
 * 初始化预加载监听器
 */
export function initPreloadListeners() {
    const wordInput = $("wordInput");
    const loadBtn = $("loadBtn");
    const container = loadBtn?.parentElement;

    // Load 按钮点击触发预加载（手动控制，省 token）
    // Shift+Click 强制重新加载（清除缓存后重新获取）
    if (loadBtn) {
        loadBtn.addEventListener("click", (e) => {
            const forceReload = e.shiftKey;
            if (forceReload) {
                loadBtn.textContent = t('reloading');
                setTimeout(() => { loadBtn.textContent = t('load'); }, 1500);
            }
            startPreload(forceReload);
        });
    }

    // 延迟隐藏逻辑：鼠标移开后 1 秒隐藏
    let hideTimer = null;
    if (container) {
        container.addEventListener('mouseleave', () => {
            if (container.classList.contains('ready')) {
                hideTimer = setTimeout(() => {
                    const indicator = $("preloadIndicator");
                    if (indicator && !preloadCache.loading) {
                        indicator.style.opacity = '0';
                    }
                }, 300);
            }
        });

        container.addEventListener('mouseenter', () => {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            const indicator = $("preloadIndicator");
            if (indicator && container.classList.contains('ready')) {
                indicator.style.opacity = '1';
            }
        });
    }

    // 实时监测已移除，仅在页面加载时调整一次
    updateModeButtonsState();
}
