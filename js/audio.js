/**
 * 音频控制模块
 */

import { preloadCache, loadingAudio } from './state.js';
import { t } from './i18n/index.js';
import { getTtsUrl } from './api.js';
import { getAccent, getTargetLang } from './utils.js';
import { audioBlobManager, sentenceAudioBlobManager } from './storage/blobManager.js';

// Web Speech API 语言代码映射
const WEB_SPEECH_LANG_CODES = {
    en: { us: 'en-US', uk: 'en-GB' },
    ja: 'ja-JP',
    ko: 'ko-KR',
    fr: 'fr-FR',
    zh: 'zh-CN'
};

// 当前播放的音频对象
export let currentAudio = null;

/**
 * 停止当前播放的音频
 */
export function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    // 同时停止 Web Speech
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}

/**
 * 检查音频是否正在播放
 */
export function isAudioPlaying() {
    return currentAudio && !currentAudio.paused && !currentAudio.ended;
}

/**
 * 使用后端 TTS API 朗读单词（支持多语言）
 */
export async function speakWord(word, slow = false) {
    const accent = getAccent();
    const lang = getTargetLang();
    const cache = preloadCache.audioUrls; // 只使用正常速度缓存
    const cacheKey = `${word}:${accent}:${lang}`;
    const cachedUrl = cache[cacheKey];

    // 缓存命中，直接播放
    if (cachedUrl) {
        stopAudio();
        currentAudio = new Audio(cachedUrl);
        currentAudio.playbackRate = slow ? 0.75 : 1.0; // 使用 playbackRate 实现慢速
        currentAudio.onerror = () => console.warn(t('errorAudioLoad'));
        currentAudio.play().catch(() => {});
        return;
    }

    // 正在加载中，跳过（不停止当前播放）
    const loadingKey = cacheKey; // 移除 slow 参数
    if (loadingAudio.has(loadingKey)) {
        return;
    }

    // 缓存未命中，fetch 并缓存
    loadingAudio.add(loadingKey);
    const url = getTtsUrl(word, false, accent, lang); // slow 固定为 false
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`[TTS Error] 请求失败: ${res.status}`, {
                word,
                lang,
                accent,
                url: url.substring(0, 100)
            });
            if (res.status === 500) {
                console.error('[TTS Error] 可能的原因：accent 和 lang 参数不兼容');
                console.error('[TTS Error] 请检查：1) getAccent() 是否返回正确值 2) DOM 状态是否已更新');
            }
            throw new Error(`TTS请求失败: ${res.status}`);
        }

        const blob = await res.blob();
        const blobManager = audioBlobManager; // 只使用正常速度 BlobManager

        // 检查是否已经有缓存（避免重复创建 Blob URL）
        if (!cache[cacheKey]) {
            const blobUrl = blobManager.create(blob, cacheKey);
            cache[cacheKey] = blobUrl;
        }

        stopAudio();
        currentAudio = new Audio(cache[cacheKey]);
        currentAudio.playbackRate = slow ? 0.75 : 1.0; // 使用 playbackRate 实现慢速
        currentAudio.onerror = () => console.warn(t('errorAudioLoad'));
        currentAudio.play().catch(() => {});
    } catch (e) {
        console.warn(t('errorAudioPlay', { error: e.message }));
    } finally {
        loadingAudio.delete(loadingKey);
    }
}

/**
 * 播放任意文本（单词或句子），带缓存支持
 * 返回 Promise，音频播放结束时 resolve
 */
export async function speakText(text, slow = false) {
    stopAudio();

    const accent = getAccent();
    const lang = getTargetLang();
    const cacheKey = `${text}:${accent}:${lang}`;
    const wordCount = text.split(/\s+/).length;

    // 长句子(>3词)使用浏览器 Web Speech API
    if (wordCount > 3) {
        return speakWithWebSpeech(text, lang, accent);
    }

    // 短文本使用有道TTS
    // 检查缓存（只使用正常速度缓存）
    let cachedUrl = preloadCache.sentenceAudioUrls[cacheKey];
    if (!cachedUrl) {
        cachedUrl = preloadCache.audioUrls[cacheKey];
    }

    if (cachedUrl) {
        currentAudio = new Audio(cachedUrl);
        currentAudio.playbackRate = slow ? 0.75 : 1.0; // 使用 playbackRate 实现慢速
        return new Promise((resolve, reject) => {
            currentAudio.onended = resolve;
            currentAudio.onerror = (e) => {
                console.warn(t('errorAudioPlay', { error: e }));
                resolve(); // 仍然 resolve 以避免阻塞流程
            };
            currentAudio.play().catch((e) => {
                console.warn(t('errorAudioPlay', { error: e }));
                resolve(); // 仍然 resolve 以避免阻塞流程
            });
        });
    }

    // 未缓存，fetch 并缓存（只获取正常速度）
    const url = getTtsUrl(text, false, accent, lang); // slow 固定为 false

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`TTS请求失败: ${res.status}`, { text, lang, accent });
            if (res.status === 500) {
                console.warn('可能的原因：accent 和 lang 参数不兼容');
            }
            throw new Error(`TTS请求失败: ${res.status}`);
        }
        const blob = await res.blob();
        const blobUrl = sentenceAudioBlobManager.create(blob, cacheKey);

        preloadCache.sentenceAudioUrls[cacheKey] = blobUrl;

        currentAudio = new Audio(blobUrl);
        currentAudio.playbackRate = slow ? 0.75 : 1.0; // 使用 playbackRate 实现慢速
        return new Promise((resolve) => {
            currentAudio.onended = resolve;
            currentAudio.onerror = (e) => {
                console.warn(t('errorAudioPlay', { error: e }));
                resolve();
            };
            currentAudio.play().catch((e) => {
                console.warn(t('errorAudioPlay', { error: e }));
                resolve();
            });
        });
    } catch (e) {
        console.warn(t('warnWebSpeech', { error: e.message }));
        return speakWithWebSpeech(text, lang, accent);
    }
}

/**
 * 使用浏览器 Web Speech API 朗读文本（支持多语言）
 * @param {string} text - 要朗读的文本
 * @param {string} lang - 语言代码 (en, ja, ko, fr, zh)
 * @param {string} accent - 口音 (us/uk，仅英语有效)
 */
function speakWithWebSpeech(text, lang = 'en', accent = 'us') {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) {
            console.warn(t('warnNoWebSpeech'));
            resolve();
            return;
        }

        // 停止之前的朗读
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // 获取语言代码
        const langCode = WEB_SPEECH_LANG_CODES[lang];
        if (typeof langCode === 'object') {
            // 英语有口音选择
            utterance.lang = langCode[accent] || langCode.us;
        } else {
            utterance.lang = langCode || 'en-US';
        }

        utterance.rate = 0.9;
        utterance.onend = resolve;
        utterance.onerror = resolve;

        window.speechSynthesis.speak(utterance);
    });
}

/**
 * 更新播放/暂停按钮状态
 */
export function updatePlayPauseBtn(btn, isPaused) {
    if (!btn) return;
    btn.className = isPaused ? "btn-play" : "btn-pause";
    btn.textContent = isPaused ? "▶" : "⏸";
}
