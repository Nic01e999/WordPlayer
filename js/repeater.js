/**
 * 复读模式模块
 */

import { currentRepeaterState, setRepeaterState, setActiveMode, preloadCache } from './state.js';
import { $, getSettings, loadWordsFromTextarea, shuffleArray, clearWorkplace, logToWorkplace } from './utils.js';
import { stopAudio, isAudioPlaying, speakWord } from './audio.js';

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
    static keydownHandler = null;

    static setupKeyboardListener() {
        if (this.keydownHandler) return;
        this.keydownHandler = (e) => {
            if (!currentRepeaterState) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.playPause();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.goToPrevWord();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.goToNextWord();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.sliderLeft();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.sliderRight();
                    break;
            }
        };
        document.addEventListener('keydown', this.keydownHandler);
    }

    static removeKeyboardListener() {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
    }

    static goToPrevWord() {
        const state = currentRepeaterState;
        if (!state || state.currentIndex <= 0) return;

        this.playId++;
        stopAudio();
        state.currentIndex--;
        state.currentRepeat = 0;
        this.highlightCurrent();
        this.scrollToIndex(state.currentIndex);
        this.updateInfo();
    }

    static goToNextWord() {
        const state = currentRepeaterState;
        if (!state || state.currentIndex >= state.words.length - 1) return;

        this.playId++;
        stopAudio();
        state.currentIndex++;
        state.currentRepeat = 0;
        this.highlightCurrent();
        this.scrollToIndex(state.currentIndex);
        this.updateInfo();
    }

    static sliderLeft() {
        if (this.currentSliderPosition > 0) {
            const newPos = this.currentSliderPosition - 1;
            this.updateSliderUI(newPos);
            this.animateContentSwitch(newPos);
        }
    }

    static sliderRight() {
        if (this.currentSliderPosition < 3) {
            const newPos = this.currentSliderPosition + 1;
            this.updateSliderUI(newPos);
            this.animateContentSwitch(newPos);
        }
    }

    static updateSliderUI(position) {
        const slider = document.getElementById('appleSlider');
        if (!slider) return;

        const thumb = slider.querySelector('.apple-slider-thumb');
        const fill = slider.querySelector('.apple-slider-fill');
        const labels = slider.querySelectorAll('.apple-slider-label');

        if (thumb) thumb.style.left = `${(position / 3) * 100}%`;
        if (fill) fill.style.width = `${(position / 3) * 100}%`;
        labels?.forEach((l, i) => l.classList.toggle('active', i === position));
    }

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
        this.setupKeyboardListener();
        // 切换模式时默认暂停，不自动播放
        state.isPaused = true;
    }

    static renderUI() {
        $("workplace").innerHTML = `
            <div id="repeaterContainer" class="repeater-container">
                <div id="centerPointer" class="center-pointer">
                    <div class="pointer-arrow"></div>
                </div>
                <div id="repeaterScroll" class="repeater-scroll">
                    <div class="scroll-spacer"></div>
                    <div id="repeaterContent"></div>
                    <div class="scroll-spacer"></div>
                </div>
                <div id="playPauseIndicator" class="play-pause-indicator"></div>
            </div>
            <div class="word-info-wrapper">
                <div id="currentWordInfo" class="word-info"></div>
            </div>
        `;

        this.renderContent();
        this.setupScrollListener();
    }

    static renderContent() {
        const content = $("repeaterContent");
        const state = currentRepeaterState;
        if (!content || !state) return;

        content.innerHTML = state.words.map((word, i) => {
            return `
            <div id="word-${i}" class="word-item ${i === state.currentIndex ? 'active' : ''}">
                <strong>${i + 1}. ${word}</strong>
            </div>
        `;
        }).join('');

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
        const isPhrase = word.includes(' ');
        const wordInfo = preloadCache.wordInfo[word];
        const simpleTranslation = preloadCache.translations[word] ?? state.translations[currentIndex];

        let contentHTML;

        if (isCustomWord || isPhrase) {
            contentHTML = `<div class="current-translation">${simpleTranslation ?? '加载中...'}</div>`;
        } else {
            contentHTML = this.renderSliderContent(wordInfo, simpleTranslation);
        }

        info.innerHTML = `
            ${contentHTML}
            <div class="play-count">Play ${currentRepeat + 1}/${settings.repeat}</div>
        `;

        if (!isCustomWord && !isPhrase) {
            this.setupSliderListeners();
            // 设置例句和同反义词的点击事件
            const sliderContent = document.getElementById('sliderContent');
            this.setupContentClickHandlers(sliderContent);
        }
    }

    static renderSliderContent(wordInfo, translation) {
        const position = this.currentSliderPosition;
        const labels = ['中文', '释义', '例句', '同反'];

        return `
            <div class="slider-content" id="sliderContent">
                ${this.renderViewContent(position, wordInfo, translation)}
            </div>
            <div class="apple-slider" id="appleSlider" tabindex="0">
                <div class="apple-slider-labels">
                    ${labels.map((l, i) => `
                        <span class="apple-slider-label ${i === position ? 'active' : ''}"
                              data-index="${i}">${l}</span>
                    `).join('')}
                </div>
                <div class="apple-slider-track">
                    <div class="apple-slider-fill" style="width:${(position / 3) * 100}%"></div>
                    ${[0, 1, 2, 3].map(i => `
                        <div class="apple-slider-node" style="left:${(i / 3) * 100}%"></div>
                    `).join('')}
                    <div class="apple-slider-thumb" style="left:${(position / 3) * 100}%"></div>
                </div>
            </div>
        `;
    }

    static renderViewContent(position, wordInfo, translation) {
        const word = currentRepeaterState?.words[currentRepeaterState.currentIndex] || '';
        switch (position) {
            case 0: // 词性 + 中文意思
                return this.renderChinesePosView(wordInfo, translation);
            case 1: // 词性 + 英文释义
                return this.renderPosView(wordInfo);
            case 2: // 例句 (4个：2常用+2有趣)
                return this.renderExamplesView(wordInfo, word);
            case 3: // 同义词/反义词
                return this.renderSynonymsView(wordInfo);
            default:
                return '';
        }
    }

    static renderChinesePosView(wordInfo, fallbackTranslation) {
        const chineseDefs = wordInfo?.chineseDefinitions || [];
        if (chineseDefs.length === 0) {
            // 如果没有词性分组的中文释义，显示简单翻译
            return `<div class="view-translation">${fallbackTranslation ?? '加载中...'}</div>`;
        }
        return `
            <div class="view-chinese-pos">
                ${chineseDefs.map(def => `
                    <div class="pos-item">
                        <span class="pos-tag">${def.pos}</span>
                        <span class="pos-meaning">${def.meanings.join('；')}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    static highlightWord(sentence, word) {
        if (!sentence || !word) return sentence;
        // 创建正则匹配单词（大小写不敏感）
        const regex = new RegExp(`\\b(${word})\\b`, 'gi');
        return sentence.replace(regex, '<span class="word-highlight">$1</span>');
    }

    static escapeHtml(text) {
        return text.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

    static renderExamplesView(wordInfo, word) {
        const examples = wordInfo?.examples || {};
        const commonExamples = examples.common || [];
        const funExamples = examples.fun || [];

        // 兼容旧格式：如果 examples 是数组
        if (Array.isArray(wordInfo?.examples)) {
            const oldExamples = wordInfo.examples;
            if (oldExamples.length === 0) {
                return '<div class="view-empty">No examples available</div>';
            }
            return `
                <div class="view-examples">
                    ${oldExamples.slice(0, 2).map(ex => `<p class="example-sentence clickable-text" data-text="${this.escapeHtml(ex)}">${this.highlightWord(ex, word)}</p>`).join('')}
                </div>
            `;
        }

        if (commonExamples.length === 0 && funExamples.length === 0) {
            return '<div class="view-empty">No examples available</div>';
        }

        return `
            <div class="examples-grid">
                <div class="example-column">
                    <span class="example-label">常用</span>
                    ${commonExamples.slice(0, 2).map(ex => `<p class="example-sentence clickable-text" data-text="${this.escapeHtml(ex)}">${this.highlightWord(ex, word)}</p>`).join('')}
                </div>
                <div class="example-column">
                    <span class="example-label">有趣</span>
                    ${funExamples.slice(0, 2).map(ex => `<p class="example-sentence clickable-text" data-text="${this.escapeHtml(ex)}">${this.highlightWord(ex, word)}</p>`).join('')}
                </div>
            </div>
        `;
    }

    static renderSynonymsView(wordInfo) {
        const synonyms = wordInfo?.synonyms || [];
        const antonyms = wordInfo?.antonyms || [];

        if (synonyms.length === 0 && antonyms.length === 0) {
            return '<div class="view-empty">No synonyms/antonyms available</div>';
        }

        const renderClickableWords = (words) => words.map(w =>
            `<span class="clickable-word" data-word="${this.escapeHtml(w)}">${w}</span>`
        ).join(', ');

        return `
            <div class="view-synonyms">
                ${synonyms.length > 0 ? `
                    <div class="syn-group">
                        <span class="syn-label">Syn:</span>
                        <span class="syn-words">${renderClickableWords(synonyms.slice(0, 5))}</span>
                    </div>
                ` : ''}
                ${antonyms.length > 0 ? `
                    <div class="ant-group">
                        <span class="ant-label">Ant:</span>
                        <span class="ant-words">${renderClickableWords(antonyms.slice(0, 3))}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    static setupContentClickHandlers(container) {
        if (!container) return;

        // 处理例句点击
        container.querySelectorAll('.clickable-text').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = el.dataset.text;
                if (text) {
                    this.playTextWithFeedback(el, text);
                }
            });
        });

        // 处理近义词/反义词点击
        container.querySelectorAll('.clickable-word').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const word = el.dataset.word;
                if (word) {
                    this.playTextWithFeedback(el, word);
                }
            });
        });
    }

    static async playTextWithFeedback(element, text) {
        // 移除其他元素的 playing 状态
        document.querySelectorAll('.playing').forEach(el => el.classList.remove('playing'));

        // 添加视觉反馈
        element.classList.add('playing');

        // 动态导入并播放
        const { speakText } = await import('./audio.js');
        await speakText(text, false);

        // 播放结束后移除状态
        element.classList.remove('playing');
    }

    static setupSliderListeners() {
        const slider = document.getElementById('appleSlider');
        const track = slider?.querySelector('.apple-slider-track');
        const thumb = slider?.querySelector('.apple-slider-thumb');
        const fill = slider?.querySelector('.apple-slider-fill');
        const labels = slider?.querySelectorAll('.apple-slider-label');

        if (!slider || !track || !thumb) return;

        let isDragging = false;
        let dragStartX = 0;

        const getPositionFromX = (clientX) => {
            const rect = track.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return ratio;
        };

        const getNearestNode = (ratio) => {
            return Math.round(ratio * 3);
        };

        const updateThumbPosition = (ratio) => {
            const percent = ratio * 100;
            thumb.style.left = `${percent}%`;
            fill.style.width = `${percent}%`;
        };

        const snapToNode = (nodeIndex) => {
            // Animate thumb to node position
            thumb.classList.remove('dragging');
            fill.classList.remove('no-transition');
            const percent = (nodeIndex / 3) * 100;
            thumb.style.left = `${percent}%`;
            fill.style.width = `${percent}%`;

            if (nodeIndex === this.currentSliderPosition) return;

            // Update labels
            labels.forEach((l, i) => l.classList.toggle('active', i === nodeIndex));

            // Fade content transition
            this.animateContentSwitch(nodeIndex);
        };

        // Drag move
        const onDragMove = (e) => {
            if (!isDragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const ratio = getPositionFromX(clientX);
            updateThumbPosition(ratio);
        };

        // Drag end
        const onDragEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            thumb.style.transition = '';
            thumb.classList.remove('dragging');
            fill.classList.remove('no-transition');
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('touchmove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
            document.removeEventListener('touchend', onDragEnd);
            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const movedDistance = Math.abs(clientX - dragStartX);
            if (movedDistance >= 5) {
                Repeater.pauseIfPlaying();
                const ratio = getPositionFromX(clientX);
                const node = getNearestNode(ratio);
                snapToNode(node);
            }
        };

        // Drag start
        const onDragStart = (e) => {
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            dragStartX = clientX;
            isDragging = true;
            thumb.classList.add('dragging');
            fill.classList.add('no-transition');
            thumb.style.transition = 'box-shadow 0.2s, transform 0.1s';
            document.addEventListener('mousemove', onDragMove);
            document.addEventListener('touchmove', onDragMove, { passive: true });
            document.addEventListener('mouseup', onDragEnd);
            document.addEventListener('touchend', onDragEnd);
        };

        // Thumb events
        thumb.addEventListener('mousedown', onDragStart);
        thumb.addEventListener('touchstart', onDragStart, { passive: false });

        // Click on track to jump
        track.addEventListener('click', (e) => {
            if (isDragging) return;
            const ratio = getPositionFromX(e.clientX);
            const node = getNearestNode(ratio);
            snapToNode(node);
        });

        // Click on labels
        labels.forEach(label => {
            label.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                snapToNode(index);
            });
        });

        // Keyboard navigation
        slider.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                const next = Math.min(3, this.currentSliderPosition + 1);
                snapToNode(next);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = Math.max(0, this.currentSliderPosition - 1);
                snapToNode(prev);
            }
        });
    }

    static animateContentSwitch(newPosition) {
        const content = document.getElementById('sliderContent');
        if (!content) return;

        // Fade out
        content.classList.add('fading');

        setTimeout(() => {
            // Update position and content
            this.currentSliderPosition = newPosition;
            const state = currentRepeaterState;
            if (!state) return;

            const word = state.words[state.currentIndex];
            const wordInfo = preloadCache.wordInfo[word];
            const translation = preloadCache.translations[word] ?? state.translations[state.currentIndex];

            content.innerHTML = this.renderViewContent(newPosition, wordInfo, translation);

            // 设置例句和同反义词的点击事件
            this.setupContentClickHandlers(content);

            // Fade in
            content.classList.remove('fading');
        }, 150);
    }

    static setupScrollListener() {
        const scroll = $("repeaterScroll");
        if (!scroll) return;

        let userTouching = false;
        let scrollStartY = 0;

        const onStart = () => {
            userTouching = true;
            scrollStartY = scroll.scrollTop;
            clearTimeout(this.scrollTimeout);
            this.playId++;
            stopAudio();
        };

        const onEnd = () => {
            if (!userTouching) return;
            userTouching = false;
            const scrolled = Math.abs(scroll.scrollTop - scrollStartY) > 5;
            if (!scrolled) {
                this.playPause();
            } else {
                clearTimeout(this.scrollTimeout);
                this.scrollTimeout = setTimeout(() => this.onUserScrollEnd(), 200);
            }
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

        if (state.isPaused) {
            this.playId++;
            stopAudio();
        } else {
            this.startPlayLoop();
        }

        this.showPlayPauseIndicator(state.isPaused);
    }

    static pauseIfPlaying() {
        const state = currentRepeaterState;
        if (state && !state.isPaused) {
            state.isPaused = true;
            this.playId++;
            stopAudio();
        }
    }

    static showPlayPauseIndicator(isPaused) {
        const indicator = document.getElementById('playPauseIndicator');
        if (!indicator) return;
        indicator.textContent = isPaused ? '⏸' : '▶';
        indicator.classList.remove('show');
        void indicator.offsetWidth;
        indicator.classList.add('show');
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
        this.setupKeyboardListener();

        // 切换模式时默认暂停，不自动播放
        state.isPaused = true;
    }
}
