/**
 * 音频控制模块
 */

import { preloadCache, loadingAudio } from './state.js';
import { getTtsUrl } from './api.js';
import { getAccent } from './utils.js';

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
 * 使用后端 TTS API 朗读单词
 */
export async function speakWord(word, slow = false) {
    const accent = getAccent();
    const cache = slow ? preloadCache.slowAudioUrls : preloadCache.audioUrls;
    const cacheKey = `${word}:${accent}`;
    const cachedUrl = cache[cacheKey];

    // 缓存命中，直接播放
    if (cachedUrl) {
        stopAudio();
        currentAudio = new Audio(cachedUrl);
        currentAudio.onerror = () => console.warn("音频加载失败");
        currentAudio.play().catch(() => {});
        return;
    }

    // 正在加载中，跳过（不停止当前播放）
    const loadingKey = `${cacheKey}:${slow}`;
    if (loadingAudio.has(loadingKey)) {
        return;
    }

    // 缓存未命中，fetch 并缓存
    loadingAudio.add(loadingKey);
    const url = getTtsUrl(word, slow, accent);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`TTS请求失败: ${res.status}`);

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        cache[cacheKey] = blobUrl;

        stopAudio();
        currentAudio = new Audio(blobUrl);
        currentAudio.onerror = () => console.warn("音频加载失败");
        currentAudio.play().catch(() => {});
    } catch (e) {
        console.warn("音频请求失败:", e.message);
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
    const cacheKey = `${text}:${accent}`;
    const wordCount = text.split(/\s+/).length;

    // 长句子(>3词)使用浏览器 Web Speech API
    if (wordCount > 3) {
        return speakWithWebSpeech(text, accent);
    }

    // 短文本使用有道TTS
    // 检查缓存
    let cachedUrl = preloadCache.sentenceAudioUrls[cacheKey];
    if (!cachedUrl) {
        const wordCache = slow ? preloadCache.slowAudioUrls : preloadCache.audioUrls;
        cachedUrl = wordCache[cacheKey];
    }

    if (cachedUrl) {
        currentAudio = new Audio(cachedUrl);
        return new Promise((resolve, reject) => {
            currentAudio.onended = resolve;
            currentAudio.onerror = (e) => {
                console.warn('音频播放失败:', e);
                resolve(); // 仍然 resolve 以避免阻塞流程
            };
            currentAudio.play().catch((e) => {
                console.warn('音频播放失败:', e);
                resolve(); // 仍然 resolve 以避免阻塞流程
            });
        });
    }

    // 未缓存，fetch 并缓存
    const url = getTtsUrl(text, slow, accent);

    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`TTS请求失败: ${res.status}`);
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);

        preloadCache.sentenceAudioUrls[cacheKey] = blobUrl;

        currentAudio = new Audio(blobUrl);
        return new Promise((resolve) => {
            currentAudio.onended = resolve;
            currentAudio.onerror = (e) => {
                console.warn('音频播放失败:', e);
                resolve();
            };
            currentAudio.play().catch((e) => {
                console.warn('音频播放失败:', e);
                resolve();
            });
        });
    } catch (e) {
        console.warn('有道TTS失败，尝试Web Speech:', e.message);
        return speakWithWebSpeech(text, accent);
    }
}

/**
 * 使用浏览器 Web Speech API 朗读文本
 */
function speakWithWebSpeech(text, accent = 'us') {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) {
            console.warn('浏览器不支持 Web Speech API');
            resolve();
            return;
        }

        // 停止之前的朗读
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
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
