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
    const check = setInterval(() => {
        if (myId !== getPlayId()) {
            clearInterval(check);
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

export function playPause() {
    const state = currentRepeaterState;
    if (!state) return;

    state.isPaused = !state.isPaused;

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
    indicator.textContent = isPaused ? '||' : '>';
    indicator.classList.remove('show');
    void indicator.offsetWidth;
    indicator.classList.add('show');
}
