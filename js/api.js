/**
 * API 调用模块
 */

import { t } from './i18n/index.js';

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
    if (status === 404) return t('errorNotFound');
    if (status === 429) return t('errorRateLimit');
    if (status >= 500) return t('errorServer');
    return t('errorHttp', { status });
}

/**
 * 根据异常生成错误消息
 */
export function getFetchErrorMessage(e) {
    if (e.name === "TypeError") {
        if (e.message.includes("fetch") || e.message.includes("network") || e.message.includes("Failed to fetch")) {
            return t('errorNetwork');
        }
        return t('errorRequest');
    }
    if (e.name === "AbortError") return t('errorAborted');
    if (e.name === "TimeoutError") return t('errorTimeout');
    if (e.name === "SyntaxError") return t('errorParse');
    return t('errorUnknown', { message: e.message || 'Unknown error' });
}

/**
 * 获取 TTS URL（支持多语言）
 * @param {string} word - 单词或文本
 * @param {boolean} slow - 是否慢速
 * @param {string} accent - 口音 (us/uk，仅英语有效)
 * @param {string} lang - 语言代码 (en, ja, ko, fr, zh)
 */
export function getTtsUrl(word, slow = false, accent = 'us', lang = 'en') {
    // 验证参数兼容性
    if (lang !== 'en' && accent !== 'us') {
        console.warn(`[TTS] 非英语语言 ${lang} 不支持 ${accent} 口音，已重置为 us`);
        accent = 'us';
    }

    return `${API_BASE}/api/tts?word=${encodeURIComponent(word)}&slow=${slow ? 1 : 0}&accent=${accent}&lang=${lang}`;
}

/**
 * 获取有道翻译 API URL
 * @param {string} word - 要翻译的单词
 * @param {string} fromLang - 源语言
 * @param {string} toLang - 目标语言
 */
export function getYoudaoTranslateUrl(word, fromLang, toLang) {
    return `${API_BASE}/api/youdao/translate?word=${encodeURIComponent(word)}&from=${fromLang}&to=${toLang}`;
}

/**
 * 获取 DeepSeek 单词详情 API URL
 */
export function getWordDetailsUrl() {
    return `${API_BASE}/api/wordinfo/details`;
}


