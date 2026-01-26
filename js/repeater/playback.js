/**
 * 复读模式 - 播放控制
 */

import { currentRepeaterState } from '../state.js';
import { stopAudio, isAudioPlaying, speakWord } from '../audio.js';
import { incrementPlayId, getPlayId } from './state.js';

// 延迟绑定
let _highlightCurrent = null;
let _scrollToIndex = null;
let _updateInfo = null;

export function setPlaybackDeps(deps) {
    _highlightCurrent = deps.highlightCurrent;
    _scrollToIndex = deps.scrollToIndex;
    _updateInfo = deps.updateInfo;
}

export function startPlayLoop() {
    incrementPlayId();
    playCurrentWord(getPlayId());
}

export function playCurrentWord(myId) {
    const state = currentRepeaterState;
    if (!state || state.isPaused) return;
    if (myId !== getPlayId()) return;

    speakWord(state.words[state.currentIndex], state.settings.slow);
    _updateInfo?.();
    waitSpeechEnd(myId);
}

function waitSpeechEnd(myId) {
    let checkCount = 0;
    const MAX_CHECKS = 300; // 30秒超时 (300 * 100ms)

    const check = setInterval(() => {
        if (myId !== getPlayId()) {
            clearInterval(check);
            return;
        }

        checkCount++;
        // 超时保护：如果30秒还没播放完，强制进入下一个
        if (checkCount >= MAX_CHECKS) {
            console.warn('Audio playback timeout, skipping to next');
            clearInterval(check);

            const state = currentRepeaterState;
            if (!state || state.isPaused) return;

            state.currentRepeat = 0;
            state.currentIndex++;
            if (state.currentIndex >= state.words.length) {
                state.currentIndex = 0;
            }

            _highlightCurrent?.();
            _scrollToIndex?.(state.currentIndex);

            const interval = state.settings.interval;
            setTimeout(() => playCurrentWord(myId), interval);
            return;
        }

        if (!isAudioPlaying()) {
            clearInterval(check);

            const state = currentRepeaterState;
            if (!state || state.isPaused) return;

            state.currentRepeat++;
            _updateInfo?.();

            if (state.currentRepeat >= state.settings.repeat) {
                state.currentRepeat = 0;
                state.currentIndex++;

                if (state.currentIndex >= state.words.length) {
                    state.currentIndex = 0;
                }

                _highlightCurrent?.();
                _scrollToIndex?.(state.currentIndex);
            }

            const interval = state.settings.interval;
            setTimeout(() => playCurrentWord(myId), interval);
        }
    }, 100);
}

// 防抖：防止短时间内重复调用
let lastPlayPauseTime = 0;
const PLAY_PAUSE_DEBOUNCE = 300; // 300ms 防抖

export function playPause() {
    const state = currentRepeaterState;
    if (!state) return;

    // 防抖检查
    const now = Date.now();
    if (now - lastPlayPauseTime < PLAY_PAUSE_DEBOUNCE) {
        console.log('[playPause] 防抖拦截，忽略重复调用');
        return;
    }
    lastPlayPauseTime = now;

    console.log('[playPause] 调用前 isPaused:', state.isPaused);
    state.isPaused = !state.isPaused;
    console.log('[playPause] 调用后 isPaused:', state.isPaused);

    if (state.isPaused) {
        incrementPlayId();
        stopAudio();
    } else {
        startPlayLoop();
    }

    showPlayPauseIndicator(state.isPaused);
}

export function pauseIfPlaying() {
    const state = currentRepeaterState;
    if (state && !state.isPaused) {
        state.isPaused = true;
        incrementPlayId();
        stopAudio();
    }
}

export function showPlayPauseIndicator(isPaused) {
    const indicator = document.getElementById('playPauseIndicator');
    if (!indicator) return;
    indicator.textContent = isPaused ? '▶' : '⏸';
    indicator.classList.remove('show');
    void indicator.offsetWidth;
    indicator.classList.add('show');
}
