/**
 * API 调用模块
 */

import { preloadCache } from './state.js';

// 后端API地址（自动检测）
// - 通过 Flask 直接访问 (port 5001) → 用相对路径
// - 通过 cloudflared 隧道访问 (trycloudflare.com) → 用相对路径
// - 通过 Live Server 等其他方式访问 → 指向 5001 端口
const isDirectAccess = location.port === "5001" || location.hostname.includes("trycloudflare.com");
export const API_BASE = isDirectAccess ? "" : `http://${location.hostname}:5001`;

/**
 * 根据 HTTP 状态码生成错误消息
 */
export function getHttpErrorMessage(status) {
    if (status === 404) return "翻译失败: 未找到该单词";
    if (status === 429) return "翻译失败: 请求过于频繁";
    if (status >= 500) return "翻译失败: 服务器错误";
    return `翻译失败: HTTP ${status}`;
}

/**
 * 根据异常生成错误消息
 */
export function getFetchErrorMessage(e) {
    if (e.name === "TypeError") {
        if (e.message.includes("fetch") || e.message.includes("network") || e.message.includes("Failed to fetch")) {
            return "翻译失败: 网络连接错误";
        }
        return "翻译失败: 请求构造错误";
    }
    if (e.name === "AbortError") return "翻译失败: 请求被中断";
    if (e.name === "TimeoutError") return "翻译失败: 请求超时";
    if (e.name === "SyntaxError") return "翻译失败: 响应解析错误";
    return `翻译失败: ${e.message || "未知错误"}`;
}

/**
 * 获取当前选择的翻译源
 */
export function getTranslatorProvider() {
    const select = document.getElementById("translatorProvider");
    return select ? select.value : "bing";
}

/**
 * 调用后端翻译 API 获取单词的中文翻译
 */
export async function translateWord(word) {
    // 先检查缓存
    if (preloadCache.translations[word]) {
        return preloadCache.translations[word];
    }

    try {
        const provider = getTranslatorProvider();
        const url = `${API_BASE}/api/translate?word=${encodeURIComponent(word)}&provider=${provider}`;
        const res = await fetch(url);

        if (!res.ok) return getHttpErrorMessage(res.status);

        let data;
        try {
            data = await res.json();
        } catch {
            return "翻译失败: 响应格式错误";
        }

        if (data.error) return `翻译失败: ${data.error}`;

        const translation = data.translation || "翻译失败: 无翻译结果";
        preloadCache.translations[word] = translation;
        return translation;
    } catch (e) {
        return getFetchErrorMessage(e);
    }
}

/**
 * 获取 TTS URL
 */
export function getTtsUrl(word, slow = false) {
    return `${API_BASE}/api/tts?word=${encodeURIComponent(word)}&slow=${slow ? 1 : 0}`;
}

/**
 * 获取单词词典信息（含词性）
 */
export async function fetchDictionary(word) {
    // 检查缓存
    if (preloadCache.dictionaries[word]) {
        return preloadCache.dictionaries[word];
    }

    try {
        const provider = getTranslatorProvider();
        const url = `${API_BASE}/api/dictionary?word=${encodeURIComponent(word)}&provider=${provider}`;
        const res = await fetch(url);

        if (!res.ok) {
            // 回退到简单翻译
            const translation = await translateWord(word);
            const fallback = {
                word,
                phonetic: null,
                definitions: [],
                translation
            };
            preloadCache.dictionaries[word] = fallback;
            return fallback;
        }

        const data = await res.json();
        preloadCache.dictionaries[word] = data;

        // 同时更新简单翻译缓存
        if (data.translation) {
            preloadCache.translations[word] = data.translation;
        }

        return data;
    } catch (e) {
        console.error("Dictionary fetch error:", e);
        return null;
    }
}
