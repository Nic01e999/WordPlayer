/**
 * 复读模式模块
 */

import { currentRepeaterState, setRepeaterState, setActiveMode, preloadCache } from './state.js';
import { $, getSettings, loadWordsFromTextarea, shuffleArray, clearWorkplace, logToWorkplace } from './utils.js';
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
    static currentSliderPosition = 0; // 0=翻译, 1=释义, 2=例句, 3=同反

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

        // 使用缓存的翻译，如果没有则显示"加载中"
        state.translations = words.map(w => preloadCache.translations[w] || "加载中...");

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

        const { words, currentIndex, currentRepeat, settings, entries } = state;
        const word = words[currentIndex];
        const entry = entries[currentIndex];
        const isCustomWord = entry.definition !== null;
        const wordInfo = preloadCache.wordInfo[word];
        const simpleTranslation = preloadCache.translations[word] ?? state.translations[currentIndex];

        let contentHTML;

        if (isCustomWord) {
            // 自定义单词：只显示翻译，无滑动条
            contentHTML = `<div class="current-translation">${simpleTranslation ?? '加载中...'}</div>`;
        } else {
            // 非自定义单词：显示滑动条（4个按钮）
            contentHTML = this.renderSliderContent(wordInfo, simpleTranslation);
        }

        info.innerHTML = `
            <div class="current-word">${word}</div>
            ${contentHTML}
            <div class="play-count">Play ${currentRepeat + 1}/${settings.repeat}</div>
        `;

        // 设置滑动条按钮事件
        if (!isCustomWord) {
            this.setupSliderListeners();
        }
    }

    static renderSliderContent(wordInfo, translation) {
        const position = this.currentSliderPosition;
        const labels = ['中文', '释义', '例句', '同反'];

        return `
            <div class="slider-container">
                <div class="slider-content">
                    ${this.renderViewContent(position, wordInfo, translation)}
                </div>
                <div class="slider-track">
                    ${labels.map((label, i) => `
                        <button class="slider-dot ${i === position ? 'active' : ''}"
                                data-position="${i}">${label}</button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    static renderViewContent(position, wordInfo, translation) {
        switch (position) {
            case 0: // 中文翻译
                return `<div class="view-translation">${translation ?? '加载中...'}</div>`;
            case 1: // 词性 + 英文释义
                return this.renderPosView(wordInfo);
            case 2: // 例句
                return this.renderExamplesView(wordInfo);
            case 3: // 同义词/反义词
                return this.renderSynonymsView(wordInfo);
            default:
                return '';
        }
    }

    static renderPosView(wordInfo) {
        if (!wordInfo?.definitions?.length) {
            return '<div class="view-empty">No definitions available</div>';
        }
        return `
            <div class="view-pos">
                ${wordInfo.definitions.map(def => `
                    <div class="pos-item">
                        <span class="pos-tag">${def.pos}</span>
                        <span class="pos-meaning">${def.meanings.slice(0, 2).join('; ')}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    static renderExamplesView(wordInfo) {
        const examples = wordInfo?.examples || [];
        if (examples.length === 0) {
            return '<div class="view-empty">No examples available</div>';
        }
        return `
            <div class="view-examples">
                ${examples.slice(0, 2).map(ex => `<p class="example-sentence">${ex}</p>`).join('')}
            </div>
        `;
    }

    static renderSynonymsView(wordInfo) {
        const synonyms = wordInfo?.synonyms || [];
        const antonyms = wordInfo?.antonyms || [];

        if (synonyms.length === 0 && antonyms.length === 0) {
            return '<div class="view-empty">No synonyms/antonyms available</div>';
        }

        return `
            <div class="view-synonyms">
                ${synonyms.length > 0 ? `
                    <div class="syn-group">
                        <span class="syn-label">Syn:</span>
                        <span class="syn-words">${synonyms.slice(0, 5).join(', ')}</span>
                    </div>
                ` : ''}
                ${antonyms.length > 0 ? `
                    <div class="ant-group">
                        <span class="ant-label">Ant:</span>
                        <span class="ant-words">${antonyms.slice(0, 3).join(', ')}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    static setupSliderListeners() {
        const dots = document.querySelectorAll('.slider-dot');
        dots.forEach(dot => {
            dot.onclick = (e) => {
                e.stopPropagation();
                const position = parseInt(e.target.dataset.position);
                if (position !== this.currentSliderPosition) {
                    this.currentSliderPosition = position;
                    this.updateInfo();
                }
            };
        });
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
        this.currentSliderPosition = 0; // 用户滚动时重置滑动条

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
                    this.currentSliderPosition = 0; // 切换单词时重置滑动条

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
