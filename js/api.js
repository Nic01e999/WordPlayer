/**
 * API 调用模块
 */

import { preloadCache } from './state.js';

// 后端API地址（自动检测）
export const API_BASE = location.port === "5001" ? "" : `http://${location.hostname}:5001`;

/**
 * 调用后端翻译 API 获取单词的中文翻译
 */
export async function translateWord(word) {
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
 * 获取 TTS URL
 */
export function getTtsUrl(word, slow = false) {
    return `${API_BASE}/api/tts?word=${encodeURIComponent(word)}&slow=${slow ? 1 : 0}`;
}
