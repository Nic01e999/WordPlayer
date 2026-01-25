/**
 * 复读模式模块入口
 * 组合所有子模块并导出公共 API
 */

import { currentRepeaterState, setRepeaterState, setActiveMode, preloadCache } from '../state.js';
import { $, getSettings, loadWordsFromTextarea, shuffleArray, showView } from '../utils.js';
import { stopAudio } from '../audio.js';

// 导入子模块
import { setScrollListenersInitialized, setDictationRef, getDictation } from './state.js';
import { setupKeyboardListener, removeKeyboardListener, setKeyboardDeps } from './keyboard.js';
import { sliderLeft, sliderRight, setupSliderListeners, setSliderDeps } from './slider.js';
import { setupScrollListener, scrollToIndex, highlightCurrent, setScrollDeps } from './scroll.js';
import { startPlayLoop, playPause, pauseIfPlaying, setPlaybackDeps } from './playback.js';
import { renderUI, renderContent, updateInfo, renderViewContent, setupContentClickHandlers, setRenderDeps } from './render.js';

// 设置延迟绑定（解决循环依赖）
setKeyboardDeps({
    playPause,
    highlightCurrent,
    scrollToIndex,
    updateInfo,
    sliderLeft,
    sliderRight
});

setSliderDeps({
    pauseIfPlaying,
    renderViewContent,
    setupContentClickHandlers
});

setScrollDeps({
    playPause,
    highlightCurrent,
    updateInfo,
    startPlayLoop
});

setPlaybackDeps({
    highlightCurrent,
    scrollToIndex,
    updateInfo
});

setRenderDeps({
    setupScrollListener,
    setupSliderListeners
});

/**
 * 暂停另一个模式
 */
function pauseOtherMode() {
    stopAudio();
    const Dictation = getDictation();
    if (Dictation && Dictation.state) {
        Dictation.state.isPaused = true;
        Dictation.closePopup();
    }
}

/**
 * 复读模式类
 */
export class Repeater {
    static async startRepeater() {
        pauseOtherMode();
        setScrollListenersInitialized(false);
        setRepeaterState(null);
        setActiveMode("repeater");
        document.body.classList.remove('dictation-mode');
        document.body.classList.add('repeater-mode');

        const entries = loadWordsFromTextarea();
        if (!entries.length) {
            showView('repeaterView');
            $("repeaterContent").innerHTML = "<p>No words provided.</p>";
            return;
        }

        const settings = getSettings();
        const list = settings.shuffle ? shuffleArray(entries) : [...entries];
        const words = list.map(e => e.word);

        const state = {
            entries: list,
            words,
            currentIndex: 0,
            currentRepeat: 0,
            settings,
            isPaused: false,
            translations: []
        };
        setRepeaterState(state);

        state.translations = words.map(w => preloadCache.translations[w] || "...");

        renderUI();
        setupKeyboardListener();
        state.isPaused = true;
    }

    static switchToRepeater() {
        const state = currentRepeaterState;
        const Dictation = getDictation();

        if (window.currentActiveMode === "repeater") {
            this.startRepeater();
            return;
        }

        if (Dictation && Dictation.state) {
            Dictation.state.isPaused = true;
            Dictation.closePopup();
            stopAudio();
        }

        if (state) {
            const currentEntries = loadWordsFromTextarea();
            const currentWords = currentEntries.map(e => e.word);
            const stateWords = state.words;
            const currentSet = new Set(currentWords);
            const stateSet = new Set(stateWords);
            const wordsChanged = currentWords.length !== stateWords.length ||
                currentWords.some(w => !stateSet.has(w)) ||
                stateWords.some(w => !currentSet.has(w));

            if (!wordsChanged) {
                this.resumeRepeater();
                return;
            }
        }

        this.startRepeater();
    }

    static resumeRepeater() {
        const state = currentRepeaterState;
        if (!state) return;

        setActiveMode("repeater");
        document.body.classList.remove('dictation-mode');
        document.body.classList.add('repeater-mode');

        renderUI();
        scrollToIndex(state.currentIndex);
        setupKeyboardListener();
        state.isPaused = true;
    }

    // 静态方法代理到子模块
    static setupKeyboardListener() { setupKeyboardListener(); }
    static removeKeyboardListener() { removeKeyboardListener(); }
    static playPause() { playPause(); }
    static pauseIfPlaying() { pauseIfPlaying(); }
    static highlightCurrent() { highlightCurrent(); }
    static scrollToIndex(idx, smooth) { scrollToIndex(idx, smooth); }
    static updateInfo() { updateInfo(); }
    static renderUI() { renderUI(); }
    static renderContent() { renderContent(); }
}

// 导出引用设置函数
export { setDictationRef };
