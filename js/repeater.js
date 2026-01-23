/**
 * 复读模式模块
 */

import { currentRepeaterState, setRepeaterState, setActiveMode, preloadCache } from './state.js';
import { $, getSettings, loadWordsFromTextarea, shuffleArray, clearWorkplace, logToWorkplace } from './utils.js';
import { translateWord } from './api.js';
import { stopAudio, isAudioPlaying, speakWord, updatePlayPauseBtn } from './audio.js';

// 导入时需要的外部引用（在 app.js 中设置）
let Dictation = null;

export function setDictationRef(ref) {
    Dictation = ref;
}

/**
 * 暂停另一个模式（复读模式专用）
 */
function pauseOtherMode() {
    stopAudio();
    if (Dictation && Dictation.state) {
        Dictation.state.isPaused = true;
        Dictation.closePopup();
    }
}

/**
 * 复读模式类
 */
export class Repeater {
    static ITEM_HEIGHT = 60;
    static scrollTimeout = null;
    static playId = 0;

    static async startRepeater() {
        pauseOtherMode();
        this.playId++;
        const myId = this.playId;
        setRepeaterState(null);
        setActiveMode("repeater");
        document.body.classList.remove('dictation-mode');
        document.body.classList.add('repeater-mode');

        clearWorkplace();

        const entries = loadWordsFromTextarea();
        if (!entries.length) {
            logToWorkplace("<p>⚠️ No words provided.</p>");
            return;
        }

        const settings = getSettings();
        const list = settings.shuffle ? shuffleArray(entries) : [...entries];
        const words = list.map(e => e.word);
        const allCached = words.every(w => preloadCache.translations[w]);

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

        if (allCached) {
            state.translations = words.map(w => preloadCache.translations[w]);
        } else {
            logToWorkplace(`<h3>📖 Repeater Mode</h3><p>Loading translations...</p>`);

            const translationPromises = list.map(entry => {
                if (entry.definition) {
                    return Promise.resolve(entry.definition);
                }
                return translateWord(entry.word);
            });
            const translations = await Promise.all(translationPromises);

            if (myId !== this.playId) return;

            state.translations = translations;
        }

        clearWorkplace();
        this.renderUI();
        this.startPlayLoop();
    }

    static renderUI() {
        $("workplace").innerHTML = `
            <div id="repeaterContainer" class="repeater-container">
                <div id="centerPointer" class="center-pointer">
                    <div class="pointer-arrow"></div>
                </div>
                <div id="repeaterScroll" class="repeater-scroll">
                    <div style="height:170px"></div>
                    <div id="repeaterContent"></div>
                    <div style="height:170px"></div>
                </div>
            </div>
            <div style="margin:15px 0;text-align:center">
                <button onclick="Repeater.playPause()" id="playPauseBtn" class="btn-pause">⏸</button>
            </div>
            <div id="currentWordInfo" class="word-info"></div>
        `;

        this.renderContent();
        this.setupScrollListener();
    }

    static renderContent() {
        const content = $("repeaterContent");
        const state = currentRepeaterState;
        if (!content || !state) return;

        content.innerHTML = state.words.map((word, i) => `
            <div id="word-${i}" class="word-item ${i === state.currentIndex ? 'active' : ''}">
                <strong>${i + 1}. ${word}</strong>
                <span class="translation">${state.translations[i]?.startsWith('翻译失败') ? '...' : (state.translations[i] || "...")}</span>
            </div>
        `).join('');

        this.updateInfo();
    }

    static updateInfo() {
        const info = $("currentWordInfo");
        const state = currentRepeaterState;
        if (!info || !state) return;

        const { words, currentIndex, currentRepeat, settings } = state;
        const word = words[currentIndex];
        const translation = preloadCache.translations[word] ?? state.translations[currentIndex];

        info.innerHTML = `
            <div class="current-word">${word}</div>
            <div class="current-translation ${translation?.startsWith('翻译失败') ? 'translation-error' : ''}">${translation ?? '加载中...'}</div>
            <div class="play-count">Play ${currentRepeat + 1}/${settings.repeat}</div>
        `;
    }

    static setupScrollListener() {
        const scroll = $("repeaterScroll");
        if (!scroll) return;

        let userTouching = false;

        const onStart = () => {
            userTouching = true;
            clearTimeout(this.scrollTimeout);
            this.playId++;
            stopAudio();
        };

        const onEnd = () => {
            if (!userTouching) return;
            userTouching = false;
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => this.onUserScrollEnd(), 200);
        };

        const onWheel = () => {
            clearTimeout(this.scrollTimeout);
            this.playId++;
            stopAudio();
            this.scrollTimeout = setTimeout(() => this.onUserScrollEnd(), 200);
        };

        scroll.addEventListener("touchstart", onStart, { passive: true });
        scroll.addEventListener("mousedown", onStart);
        scroll.addEventListener("touchend", onEnd);
        scroll.addEventListener("mouseup", onEnd);
        scroll.addEventListener("mouseleave", onEnd);
        scroll.addEventListener("wheel", onWheel, { passive: true });

        this.scrollToIndex(0, false);
    }

    static onUserScrollEnd() {
        const state = currentRepeaterState;
        if (!state) return;

        const scroll = $("repeaterScroll");
        if (!scroll) return;

        const newIndex = Math.round(scroll.scrollTop / this.ITEM_HEIGHT);
        const idx = Math.max(0, Math.min(newIndex, state.words.length - 1));

        state.currentIndex = idx;
        state.currentRepeat = 0;

        this.highlightCurrent();
        this.updateInfo();
        this.scrollToIndex(idx);

        if (!state.isPaused) {
            setTimeout(() => this.startPlayLoop(), 400);
        }
    }

    static scrollToIndex(index, smooth = true) {
        const scroll = $("repeaterScroll");
        if (!scroll) return;

        const target = index * this.ITEM_HEIGHT;
        scroll.scrollTo({
            top: target,
            behavior: smooth ? 'smooth' : 'instant'
        });
    }

    static highlightCurrent() {
        const state = currentRepeaterState;
        if (!state) return;

        document.querySelectorAll("#repeaterContent .word-item").forEach((div, i) => {
            div.classList.toggle('active', i === state.currentIndex);
        });
    }

    static startPlayLoop() {
        this.playId++;
        this.playCurrentWord(this.playId);
    }

    static playCurrentWord(myId) {
        const state = currentRepeaterState;
        if (!state || state.isPaused) return;
        if (myId !== this.playId) return;

        speakWord(state.words[state.currentIndex], state.settings.slow);
        this.updateInfo();
        this.waitSpeechEnd(myId);
    }

    static waitSpeechEnd(myId) {
        const check = setInterval(() => {
            if (myId !== this.playId) {
                clearInterval(check);
                return;
            }

            if (!isAudioPlaying()) {
                clearInterval(check);

                const state = currentRepeaterState;
                if (!state || state.isPaused) return;

                state.currentRepeat++;
                this.updateInfo();

                if (state.currentRepeat >= state.settings.repeat) {
                    state.currentRepeat = 0;
                    state.currentIndex++;

                    if (state.currentIndex >= state.words.length) {
                        state.currentIndex = 0;
                    }

                    this.highlightCurrent();
                    this.scrollToIndex(state.currentIndex);
                }

                const interval = state.settings.interval;
                setTimeout(() => this.playCurrentWord(myId), interval);
            }
        }, 100);
    }

    static playPause() {
        const state = currentRepeaterState;
        if (!state) return;

        state.isPaused = !state.isPaused;
        updatePlayPauseBtn($("playPauseBtn"), state.isPaused);

        if (state.isPaused) {
            this.playId++;
            stopAudio();
        } else {
            this.startPlayLoop();
        }
    }

    static switchToRepeater() {
        const state = currentRepeaterState;

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

        clearWorkplace();
        this.renderUI();
        this.scrollToIndex(state.currentIndex);

        state.isPaused = false;
        updatePlayPauseBtn($("playPauseBtn"), false);
        this.startPlayLoop();
    }
}
