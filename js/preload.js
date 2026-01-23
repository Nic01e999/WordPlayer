/**
 * 预加载系统模块
 */

import { preloadCache } from './state.js';
import { $, loadWordsFromTextarea, debounce, adjustSidebarWidth } from './utils.js';
import { API_BASE } from './api.js';

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

    // 增加加载 ID，取消旧的加载
    preloadCache.loadId++;
    const myId = preloadCache.loadId;

    // 重置缓存
    preloadCache.entries = entries.map(e => ({ ...e }));
    preloadCache.loading = true;
    preloadCache.loaded = 0;

    const definitionCount = entries.filter(e => e.definition).length;
    preloadCache.total = entries.length * 3 + definitionCount * 2;
    updatePreloadProgress();

    // 并行加载所有翻译
    const translationPromises = entries.map(async (entry) => {
        if (myId !== preloadCache.loadId) return;

        const { word, definition } = entry;

        if (definition) {
            preloadCache.translations[word] = definition;
            preloadCache.loaded++;
            updatePreloadProgress();
            return;
        }

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

    // 收集所有需要预加载音频的文本
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
