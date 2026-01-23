/**
 * 音频控制模块
 */

import { preloadCache } from './state.js';
import { API_BASE } from './api.js';

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
export function speakWord(word, slow = false) {
    stopAudio();

    // 先检查缓存的 Blob URL
    const cache = slow ? preloadCache.slowAudioUrls : preloadCache.audioUrls;
    const cachedUrl = cache[word];

    const url = cachedUrl || `${API_BASE}/api/tts?word=${encodeURIComponent(word)}&slow=${slow ? 1 : 0}`;
    currentAudio = new Audio(url);
    currentAudio.onerror = () => console.warn("音频加载失败，请检查后端服务是否运行");
    currentAudio.play().catch(() => {});
}

/**
 * 更新播放/暂停按钮状态
 */
export function updatePlayPauseBtn(btn, isPaused) {
    if (!btn) return;
    btn.className = isPaused ? "btn-play" : "btn-pause";
    btn.textContent = isPaused ? "▶" : "⏸";
}
