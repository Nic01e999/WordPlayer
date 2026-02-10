/**
 * 预加载系统模块
 */

import { preloadCache, clearPreloadCache } from './state.js';
import { audioBlobManager } from './storage/blobManager.js';
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
    showToast,
    getAccent
} from './utils.js';
import {
    getTtsUrl,
    getDictBatchUrl
} from './api.js';

// 追踪上一次的 loading 状态
let wasLoading = false;

/**
 * 更新预加载进度显示（四个进度条：翻译、音频、例句、词根）
 */
export function updatePreloadProgress() {
    const indicator = $("preloadIndicator");
    const transEl = $("translationProgress");
    const audioEl = $("audioProgress");
    const examplesEl = $("examplesProgress");
    const lemmaEl = $("lemmaProgress");
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
    if (examplesEl && preloadCache.examplesTotal > 0) {
        examplesEl.textContent = `${t('progressExamples')}: ${preloadCache.examplesLoaded}/${preloadCache.examplesTotal}`;
        examplesEl.style.display = 'block';
    } else if (examplesEl) {
        examplesEl.style.display = 'none';
    }
    if (lemmaEl && preloadCache.lemmaTotal > 0) {
        lemmaEl.textContent = `${t('progressLemma')}: ${preloadCache.lemmaLoaded}/${preloadCache.lemmaTotal}`;
        lemmaEl.style.display = 'block';
    } else if (lemmaEl) {
        lemmaEl.style.display = 'none';
    }

    // 日志输出
    console.log(`[Preload] 状态更新: loading=${isLoading}, hasWords=${hasWords}, container类=${container.className}`);
}

/**
 * 开始预加载翻译和音频
 */
export async function startPreload(forceReload = false) {
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
    }

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

    // 获取当前语言设置
    const targetLang = getTargetLang();
    const translationLang = getTranslationLang();

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
        clearPreloadCache(); // 释放 Blob URL 内存和所有缓存
        // localStorage 缓存已移除，直接清空内存缓存
        entries.forEach(({ word, definition }) => {
            if (!definition) {
                delete preloadCache.wordInfo[word];
                delete preloadCache.translations[word];
            }
        });
    }

    // 如果单词列表改变，也清理旧的缓存
    if (entriesChanged) {
        clearPreloadCache();
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
                examples: []
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
                examples: []
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
    // 只预加载单词(A)的音频，不预加载自定义释义(B)的音频
    const textsToPreload = new Set();
    entries.forEach(e => {
        textsToPreload.add(e.word);
    });
    preloadCache.audioTotal = textsToPreload.size;

    // 统计已缓存的音频（只检查正常速度和当前口音）
    let audioLoaded = 0;
    const currentAccent = getAccent(); // 获取当前选择的口音
    const accentsCheck = targetLang === 'en' ? [currentAccent] : ['us']; // 只检查当前口音
    for (const text of textsToPreload) {
        let cachedCount = 0;
        for (const accent of accentsCheck) {
            const cacheKey = `${text}:${accent}:${targetLang}`;
            if (preloadCache.audioUrls[cacheKey]) cachedCount++;
        }
        if (cachedCount === accentsCheck.length) audioLoaded++;
    }
    preloadCache.audioLoaded = audioLoaded;

    updatePreloadProgress();

    // 收集需要获取的单词（排除自定义和已在内存缓存的）
    const wordsNeedInfo = entries
        .filter(e => !e.definition && !preloadCache.wordInfo[e.word] && isValidWord(e.word))
        .map(e => e.word);

    // localStorage 缓存已移除，直接从后端 API 获取所有需要的单词
    const wordsToFetch = wordsNeedInfo;

    // 从 DeepSeek 获取完整单词信息（音标、翻译、释义、例句等）
    const BATCH_SIZE = 5;

    const wordInfoPromise = (async () => {
        if (wordsToFetch.length === 0) return;
        if (myId !== preloadCache.loadId) return;

        // 分批处理
        for (let i = 0; i < wordsToFetch.length; i += BATCH_SIZE) {
            if (myId !== preloadCache.loadId) return;

            const batch = wordsToFetch.slice(i, i + BATCH_SIZE);
            console.log('[请求] 开始请求批次:', batch, 'targetLang:', targetLang, 'translationLang:', translationLang);

            // 请求 DeepSeek 获取完整单词信息
            let deepseekData = null;
            try {
                const detailsRes = await fetch(getDictBatchUrl(), {
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
                console.log('[请求] 请求失败:', e.message);
            }

            if (myId !== preloadCache.loadId) return;

            // 处理结果
            const deepseekResults = deepseekData?.results || {};
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
                        examples: {}
                    };
                    preloadCache.wordInfo[word] = wordInfo;
                    preloadCache.translations[word] = errorMsg;
                    invalidWords.push(word);
                    console.log(`[有道验证] 单词 "${word}" 验证失败`);
                    console.warn(`[有道验证] 单词 "${word}" 验证失败`);
                } else {
                    // 构建完整的单词信息（全部来自后端 API）
                    const wordInfo = {
                        word,
                        phonetic: info.phonetic || '',
                        pinyin: info.pinyin || '',
                        translation: info.translation || t('noTranslation'),
                        nativeDefinitions: Array.isArray(info.nativeDefinitions) ? info.nativeDefinitions : [],
                        targetDefinitions: info.targetDefinitions || [],
                        examples: info.examples || { common: [], fun: [] },
                        wordForms: info.wordForms || {},
                        lemma: info.lemma || '',
                        lemma_frequency: info.lemma_frequency || 0
                    };

                    preloadCache.wordInfo[word] = wordInfo;
                    preloadCache.translations[word] = wordInfo.translation;
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

            // localStorage 缓存已移除，不再保存到本地
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
    const loadSingleAudio = async (text, accent, lang) => {
        const cacheKey = `${text}:${accent}:${lang}`;
        const cacheObj = preloadCache.audioUrls; // 只使用正常速度缓存
        const blobManager = audioBlobManager; // 只使用正常速度 BlobManager

        if (cacheObj[cacheKey]) {
            return { cached: true, success: true };  // 已缓存
        }

        try {
            const url = getTtsUrl(text, accent, lang);
            const res = await fetchWithTimeout(url, { signal }, 15000);
            if (!res.ok) {
                console.error(`[TTS Error] 预加载请求失败: ${res.status}`, {
                    word: text,
                    lang,
                    accent,
                    url: url.substring(0, 100)
                });
                if (res.status === 500) {
                    console.error('[TTS Error] 可能的原因：accent 和 lang 参数不兼容');
                    console.error('[TTS Error] 请检查：1) getAccent() 是否返回正确值 2) DOM 状态是否已更新');
                }
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
    // 只加载正常速度和当前口音（使用上面已声明的 currentAccent）
    const accents = targetLang === 'en' ? [currentAccent] : ['us']; // 只加载当前口音
    const audioVariants = accents.length; // 每个文本的音频数量（现在是1）

    // 初始化每个文本的计数器（考虑已缓存的）
    textsToPreload.forEach(text => {
        let cachedCount = 0;
        for (const accent of accents) {
            const cacheKey = `${text}:${accent}:${targetLang}`;
            if (preloadCache.audioUrls[cacheKey]) cachedCount++;
        }
        preloadCache.audioPartial[text] = cachedCount;
    });

    const audioTasks = [];
    for (const text of textsToPreload) {
        for (const accent of accents) {
            audioTasks.push(() =>
                loadSingleAudio(text, accent, targetLang).then((result) => {
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

    // 等待 wordInfo 完成后，并行预加载音频、例句和词根
    await wordInfoPromise;

    if (myId !== preloadCache.loadId) return;

    // 收集所有单词用于预加载例句和词根
    const allWords = entries.map(e => e.word);

    // 并行预加载：音频、例句、词根（仅英文）
    await Promise.all([
        promiseAllWithLimit(audioTasks, 6),
        preloadExamples(allWords, targetLang, signal, myId),
        targetLang === 'en' ? preloadLemmaWords(allWords, signal, myId) : Promise.resolve()
    ]);

    if (myId === preloadCache.loadId) {
        preloadCache.loading = false;
        updatePreloadProgress();
    }
}

/**
 * 预加载例句（静默失败）
 */
async function preloadExamples(words, targetLang, signal, loadId) {
    if (!words || words.length === 0) return;

    console.log('[Preload Examples] 开始预加载例句，单词数:', words.length);
    console.log('[Server] 开始预加载例句，单词数:', words.length);

    preloadCache.examplesTotal = words.length;
    preloadCache.examplesLoaded = 0;

    const tasks = words.map(word => async () => {
        if (loadId !== preloadCache.loadId) return;

        // 跳过已缓存的
        if (preloadCache.examples[word]) {
            preloadCache.examplesLoaded++;
            return;
        }

        try {
            const response = await fetch(
                `/api/dict/examples/${encodeURIComponent(word)}?lang=${targetLang}&limit=2`,
                { signal }
            );

            if (loadId !== preloadCache.loadId) return;

            if (response.ok) {
                const data = await response.json();
                if (data.examples && data.examples.length > 0) {
                    preloadCache.examples[word] = data.examples;
                    console.log(`[Preload Examples] ✓ 已缓存: ${word}, 例句数=${data.examples.length}`);
                    console.log(`[Server] ✓ 已缓存例句: ${word}, 例句数=${data.examples.length}`);
                } else {
                    preloadCache.examples[word] = [];
                    console.log(`[Preload Examples] ⚠ 无例句: ${word}`);
                }
            } else {
                console.warn(`[Preload Examples] ✗ 请求失败: ${word}, status=${response.status}`);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.warn(`[Preload Examples] ✗ 加载失败: ${word}, error=${err.message}`);
            }
        } finally {
            if (loadId === preloadCache.loadId) {
                preloadCache.examplesLoaded++;
                updatePreloadProgress();
            }
        }
    });

    await promiseAllWithLimit(tasks, 6);
    console.log('[Preload Examples] 预加载完成');
    console.log('[Server] 例句预加载完成');
}

/**
 * 预加载同词根词汇（仅英文，静默失败）
 */
async function preloadLemmaWords(words, signal, loadId) {
    if (!words || words.length === 0) return;

    console.log('[Preload Lemma] 开始预加载词根，单词数:', words.length);
    console.log('[Server] 开始预加载词根，单词数:', words.length);

    // 提取所有唯一的 lemma
    const lemmas = new Set();
    words.forEach(word => {
        const wordInfo = preloadCache.wordInfo[word];
        if (wordInfo?.lemma && wordInfo.lemma !== '-') {
            lemmas.add(wordInfo.lemma);
        }
    });

    const lemmaList = Array.from(lemmas);
    preloadCache.lemmaTotal = lemmaList.length;
    preloadCache.lemmaLoaded = 0;

    if (lemmaList.length === 0) {
        console.log('[Preload Lemma] 无需预加载（无有效词根）');
        return;
    }

    const tasks = lemmaList.map(lemma => async () => {
        if (loadId !== preloadCache.loadId) return;

        // 跳过已缓存的
        if (preloadCache.lemmaWords[lemma]) {
            preloadCache.lemmaLoaded++;
            return;
        }

        try {
            const response = await fetch(
                `/api/dict/lemma/${encodeURIComponent(lemma)}?limit=30`,
                { signal }
            );

            if (loadId !== preloadCache.loadId) return;

            if (response.ok) {
                const data = await response.json();
                if (data.words && data.words.length > 0) {
                    preloadCache.lemmaWords[lemma] = data.words;
                    console.log(`[Preload Lemma] ✓ 已缓存: ${lemma}, 词汇数=${data.words.length}`);
                    console.log(`[Server] ✓ 已缓存词根: ${lemma}, 词汇数=${data.words.length}`);
                } else {
                    preloadCache.lemmaWords[lemma] = [];
                    console.log(`[Preload Lemma] ⚠ 无词汇: ${lemma}`);
                }
            } else {
                console.warn(`[Preload Lemma] ✗ 请求失败: ${lemma}, status=${response.status}`);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.warn(`[Preload Lemma] ✗ 加载失败: ${lemma}, error=${err.message}`);
            }
        } finally {
            if (loadId === preloadCache.loadId) {
                preloadCache.lemmaLoaded++;
                updatePreloadProgress();
            }
        }
    });

    await promiseAllWithLimit(tasks, 6);
    console.log('[Preload Lemma] 预加载完成');
    console.log('[Server] 词根预加载完成');
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

    // 清空按钮点击事件
    const clearInputBtn = $("clearInputBtn");
    if (clearInputBtn && wordInput) {
        clearInputBtn.addEventListener("click", () => {
            console.log('[Clear] 清空按钮被点击');
            console.log('[Server] 清空按钮被点击');

            // 1. 清空 wordInput 内容
            wordInput.value = '';

            // 2. 移除只读状态（如果存在）
            if (wordInput.classList.contains('readonly-public')) {
                wordInput.classList.remove('readonly-public');
                wordInput.removeAttribute('readonly');
                console.log('[Clear] 已移除只读状态，用户可以重新输入');
                console.log('[Server] 已移除只读状态，用户可以重新输入');
            }

            // 3. 恢复 Save 按钮状态
            const saveBtn = $("saveListBtn");
            if (saveBtn) {
                saveBtn.textContent = t('save');
                saveBtn.removeAttribute('data-is-copy-mode');
                console.log('[Clear] Save 按钮已恢复为"保存"状态');
                console.log('[Server] Save 按钮已恢复为"保存"状态');
            }

            // 4. 清理缓存（类似 Shift+Click Load 的效果）
            startPreload(true);

            // 5. 日志记录
            console.log('[Clear] wordInput 内容已清空，缓存已清理');
            console.log('[Server] wordInput 内容已清空，缓存已清理');
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
