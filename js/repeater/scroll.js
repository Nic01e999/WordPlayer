/**
 * 复读模式 - 滚动控制
 */

import { currentRepeaterState } from '../state.js';
import { $ } from '../utils.js';
import { stopAudio } from '../audio.js';
import {
    ITEM_HEIGHT, scrollTimeout, setScrollTimeout,
    incrementPlayId, scrollListenersInitialized, setScrollListenersInitialized
} from './state.js';

// 延迟绑定
let _playPause = null;
let _highlightCurrent = null;
let _updateInfo = null;
let _startPlayLoop = null;

export function setScrollDeps(deps) {
    _playPause = deps.playPause;
    _highlightCurrent = deps.highlightCurrent;
    _updateInfo = deps.updateInfo;
    _startPlayLoop = deps.startPlayLoop;
}

export function setupScrollListener() {
    const scroll = $("repeaterScroll");
    if (!scroll) return;

    // 防止重复绑定
    if (scrollListenersInitialized) {
        scrollToIndex(0, false);
        return;
    }
    setScrollListenersInitialized(true);

    let userTouching = false;
    let scrollStartY = 0;

    const onStart = () => {
        userTouching = true;
        scrollStartY = scroll.scrollTop;
        clearTimeout(scrollTimeout);
        incrementPlayId();
        stopAudio();
    };

    const onEnd = () => {
        if (!userTouching) return;
        userTouching = false;
        const scrolled = Math.abs(scroll.scrollTop - scrollStartY) > 5;
        if (!scrolled) {
            _playPause?.();
        } else {
            clearTimeout(scrollTimeout);
            setScrollTimeout(setTimeout(() => onUserScrollEnd(), 200));
        }
    };

    const onWheel = () => {
        clearTimeout(scrollTimeout);
        incrementPlayId();
        stopAudio();
        setScrollTimeout(setTimeout(() => onUserScrollEnd(), 200));
    };

    scroll.addEventListener("touchstart", onStart, { passive: true });
    scroll.addEventListener("mousedown", onStart);
    scroll.addEventListener("touchend", onEnd);
    scroll.addEventListener("mouseup", onEnd);
    scroll.addEventListener("mouseleave", onEnd);
    scroll.addEventListener("wheel", onWheel, { passive: true });

    scrollToIndex(0, false);
}

function onUserScrollEnd() {
    const state = currentRepeaterState;
    if (!state) return;

    const scroll = $("repeaterScroll");
    if (!scroll) return;

    const newIndex = Math.round(scroll.scrollTop / ITEM_HEIGHT);
    const idx = Math.max(0, Math.min(newIndex, state.words.length - 1));

    state.currentIndex = idx;
    state.currentRepeat = 0;

    _highlightCurrent?.();
    _updateInfo?.();
    scrollToIndex(idx);

    // 不自动重新开始播放，让用户手动控制
    if (!state.isPaused) {
        setTimeout(() => _startPlayLoop?.(), 400);
    }
}

export function scrollToIndex(index, smooth = true) {
    const scroll = $("repeaterScroll");
    if (!scroll) return;

    const target = index * ITEM_HEIGHT;
    scroll.scrollTo({
        top: target,
        behavior: smooth ? 'smooth' : 'instant'
    });
}

export function highlightCurrent() {
    const state = currentRepeaterState;
    if (!state) return;

    document.querySelectorAll("#repeaterContent .word-item").forEach((div, i) => {
        div.classList.toggle('active', i === state.currentIndex);
    });
}
