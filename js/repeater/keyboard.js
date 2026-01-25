/**
 * 复读模式 - 键盘控制
 */

import { currentRepeaterState } from '../state.js';
import { stopAudio } from '../audio.js';
import {
    keydownHandler, setKeydownHandler, incrementPlayId
} from './state.js';

// 延迟绑定的依赖
let _playPause = null;
let _highlightCurrent = null;
let _scrollToIndex = null;
let _updateInfo = null;
let _sliderLeft = null;
let _sliderRight = null;

export function setKeyboardDeps(deps) {
    _playPause = deps.playPause;
    _highlightCurrent = deps.highlightCurrent;
    _scrollToIndex = deps.scrollToIndex;
    _updateInfo = deps.updateInfo;
    _sliderLeft = deps.sliderLeft;
    _sliderRight = deps.sliderRight;
}

export function setupKeyboardListener() {
    if (keydownHandler) return;

    const handler = (e) => {
        if (!currentRepeaterState) return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                _playPause?.();
                break;
            case 'ArrowUp':
                e.preventDefault();
                goToPrevWord();
                break;
            case 'ArrowDown':
                e.preventDefault();
                goToNextWord();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                _sliderLeft?.();
                break;
            case 'ArrowRight':
                e.preventDefault();
                _sliderRight?.();
                break;
        }
    };

    setKeydownHandler(handler);
    document.addEventListener('keydown', handler);
}

export function removeKeyboardListener() {
    if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler);
        setKeydownHandler(null);
    }
}

export function goToPrevWord() {
    const state = currentRepeaterState;
    if (!state || state.currentIndex <= 0) return;

    incrementPlayId();
    stopAudio();
    state.currentIndex--;
    state.currentRepeat = 0;
    _highlightCurrent?.();
    _scrollToIndex?.(state.currentIndex);
    _updateInfo?.();
}

export function goToNextWord() {
    const state = currentRepeaterState;
    if (!state || state.currentIndex >= state.words.length - 1) return;

    incrementPlayId();
    stopAudio();
    state.currentIndex++;
    state.currentRepeat = 0;
    _highlightCurrent?.();
    _scrollToIndex?.(state.currentIndex);
    _updateInfo?.();
}
