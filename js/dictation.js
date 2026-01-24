/**
 * 听写模式模块
 */

import { currentRepeaterState, setActiveMode, preloadCache } from './state.js';
import { $, getSettings, loadWordsFromTextarea, shuffleArray, clearWorkplace, logToWorkplace } from './utils.js';
import { stopAudio, speakWord, updatePlayPauseBtn } from './audio.js';

// 导入时需要的外部引用（在 app.js 中设置）
let Repeater = null;

export function setRepeaterRef(ref) {
    Repeater = ref;
}

/**
 * 暂停另一个模式（听写模式专用）
 */
function pauseOtherMode() {
    stopAudio();
    if (Repeater) {
        Repeater.removeKeyboardListener();
    }
    if (currentRepeaterState) {
        if (Repeater) Repeater.playId++;
        currentRepeaterState.isPaused = true;
    }
}

/**
 * 听写模式类
 */
export class Dictation {
    static state = null;

    static async startDictation() {
        pauseOtherMode();
        this.closePopup();
        this.state = null;
        setActiveMode("dictation");
        document.body.classList.remove('repeater-mode');
        document.body.classList.add('dictation-mode');

        clearWorkplace();

        const entries = loadWordsFromTextarea();
        if (!entries.length) {
            logToWorkplace("<p>⚠️ No words provided.</p>");
            return;
        }

        const settings = getSettings();
        const list = settings.shuffle ? shuffleArray(entries) : [...entries];
        const words = list.map(e => e.word);

        const dictateMode = settings.dictateMode;
        const speakTexts = [];
        const expectTexts = [];

        list.forEach(entry => {
            if (entry.definition) {
                if (dictateMode === "listenA_writeB") {
                    speakTexts.push(entry.word);
                    expectTexts.push(entry.definition);
                } else {
                    speakTexts.push(entry.definition);
                    expectTexts.push(entry.word);
                }
            } else {
                speakTexts.push(entry.word);
                expectTexts.push(entry.word);
            }
        });

        this.state = {
            entries: list,
            words,
            speakTexts,
            expectTexts,
            dictateMode,
            currentIndex: 0,
            maxRetry: settings.retry,
            attempts: list.map(() => []),
            results: list.map(() => null),
            slow: settings.slow,
            isPaused: false
        };

        this.renderDictationUI();
        this.showPopup();
    }

    static renderDictationUI() {
        logToWorkplace(`<div id="dictationWorkplace"></div>`);
    }

    static showPopup() {
        const s = this.state;

        if (!s || s.currentIndex >= s.entries.length) {
            this.showResults();
            return;
        }

        const i = s.currentIndex;
        const retries = s.attempts[i].length;

        const entry = s.entries[i];
        let writeHint;
        if (entry.definition) {
            writeHint = s.dictateMode === "listenB_writeA" ? "Write: Word" : "Write: Definition";
        } else {
            writeHint = "Write: Word";
        }

        const popup = document.createElement("div");
        popup.id = "dictationPopup";
        popup.className = "popup";
        popup.innerHTML = `
            <div class="popup-drag-handle" title="拖拽移动"></div>
            <h3>Word #${i + 1}</h3>
            <p id="retryInfo">Attempts: ${retries}/${s.maxRetry} &nbsp;&nbsp;  ${writeHint}</p>
            <button onclick="Dictation.play()" class="btn-sound">🎧</button>
            <br><br>
            <button onclick="Dictation.playPause()" id="dictationPlayPauseBtn" class="${s.isPaused ? 'btn-play' : 'btn-pause'}">${s.isPaused ? '▶' : '⏸'}</button>
            <input type="text" id="dictationInput" placeholder="Type the word" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ${s.isPaused ? 'disabled' : ''}>
            <br><br>
        `;

        document.body.append(popup);
        this.initDrag(popup);

        if (!s.isPaused) {
            setTimeout(() => this.play(), 500);
        }

        $("dictationInput").addEventListener("keypress", e => {
            if (e.key === "Enter" && !this.state?.isPaused) this.submit();
        });

        if (!s.isPaused) {
            $("dictationInput").focus();
        }
    }

    static closePopup() {
        $("dictationPopup")?.remove();
    }

    static initDrag(popup) {
        const handle = popup.querySelector('.popup-drag-handle');
        if (!handle) return;

        let isDragging = false;
        let startX, startY;
        let initialX, initialY;

        const rect = popup.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        popup.style.left = initialX + 'px';
        popup.style.top = initialY + 'px';
        popup.style.transform = 'rotate(-1deg)';

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = popup.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;

            popup.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            popup.style.left = (initialX + deltaX) + 'px';
            popup.style.top = (initialY + deltaY) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
            }
        });

        handle.addEventListener('touchstart', (e) => {
            isDragging = true;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;

            const rect = popup.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;

            popup.classList.add('dragging');
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            popup.style.left = (initialX + deltaX) + 'px';
            popup.style.top = (initialY + deltaY) + 'px';
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
            }
        });
    }

    static play() {
        if (this.state) {
            const textToSpeak = this.state.speakTexts[this.state.currentIndex];
            speakWord(textToSpeak, this.state.slow);
        }
    }

    static submit() {
        const s = this.state;
        if (!s) return;

        const input = $("dictationInput");
        const answer = input.value.trim();
        const correct = s.expectTexts[s.currentIndex];
        const i = s.currentIndex;

        s.attempts[i].push({
            answer,
            isCorrect: answer.toLowerCase() === correct.toLowerCase()
        });

        if (answer.toLowerCase() === correct.toLowerCase()) {
            s.results[i] = { status: "correct", retries: s.attempts[i].length };
            this.updateWorkplace();
            this.closePopup();
            s.currentIndex++;
            setTimeout(() => this.showPopup(), 500);
        } else {
            this.updateWorkplace();

            if (s.attempts[i].length >= s.maxRetry) {
                s.results[i] = { status: "failed", retries: s.attempts[i].length };
                this.updateWorkplace();
                this.closePopup();
                s.currentIndex++;
                setTimeout(() => this.showPopup(), 500);
            } else {
                $("retryInfo").textContent = `Attempts: ${s.attempts[i].length}/${s.maxRetry}`;
                input.value = "";
                input.focus();
            }
        }
    }

    static updateWorkplace() {
        const s = this.state;
        const wp = $("dictationWorkplace");
        if (!wp || !s) return;

        wp.innerHTML = s.attempts.map((attempts, i) => {
            if (!attempts.length) return '';

            const result = s.results[i];

            const rows = attempts.map((a, j) => {
                const isLast = j === attempts.length - 1;
                let symbol, cls;

                if (a.isCorrect) {
                    symbol = "✔️";
                    cls = "correct";
                } else if (isLast && result?.status === "failed") {
                    symbol = "❌";
                    cls = "failed";
                } else {
                    symbol = "⚠️";
                    cls = "warning";
                }

                const extra = (isLast && result?.status === "failed")
                    ? `<br><span class="correct">(${s.entries[i].word} - ${s.entries[i].definition || preloadCache.translations[s.entries[i].word] || ''})</span>`
                    : '';

                return `<div class="${cls}">${a.answer} ${symbol}(${j + 1})${extra}</div>`;
            }).join('');

            const listenedText = s.speakTexts[i];
            const hasCustomDef = s.entries[i].definition !== null;
            return `<div class="result-item">
                        <span class="result-index">${i + 1}.</span>
                        ${hasCustomDef ? `<div class="result-listened">&lt${listenedText}&gt</div>` : ''}
                        <div class="result-attempts">${rows}</div>
                    </div>`;
        }).join('');

        setTimeout(() => {
            const main = document.querySelector(".main");
            if (main) {
                main.scrollTop = main.scrollHeight;
            }
        }, 50);
    }

    static showResults() {
        const s = this.state;
        this.closePopup();

        let correct = 0;
        let warning = 0;
        let failed = 0;

        s.results.forEach((r, i) => {
            if (r?.status === "correct" && s.attempts[i].length === 1) {
                correct++;
            } else if (r?.status === "correct") {
                warning++;
            } else if (r?.status === "failed") {
                failed++;
            }
        });

        const score = ((correct + warning * 0.5) / s.entries.length * 100).toFixed(1);

        logToWorkplace(`
            <div class="results-box">
                <h3>📊 Dictation Complete!</h3>
                <p><strong>Score: ${score}</strong></p>
                <p>✅ First try correct: ${correct}</p>
                <p>⚠️ Multiple tries: ${warning}</p>
                <p>❌ Failed: ${failed}</p>
            </div>
        `);

        this.state = null;
    }

    static playPause() {
        if (!this.state) return;

        this.state.isPaused = !this.state.isPaused;
        updatePlayPauseBtn($("dictationPlayPauseBtn"), this.state.isPaused);

        const input = $("dictationInput");
        if (this.state.isPaused) {
            stopAudio();
            if (input) input.disabled = true;
        } else {
            if (input) {
                input.disabled = false;
                input.focus();
            }
            this.play();
        }
    }

    static switchToDictation() {
        if (window.currentActiveMode === "dictation") {
            this.startDictation();
            return;
        }

        if (currentRepeaterState) {
            currentRepeaterState.isPaused = true;
            if (Repeater) Repeater.playId++;
            stopAudio();
        }

        if (this.state) {
            const currentEntries = loadWordsFromTextarea();
            const currentWords = currentEntries.map(e => e.word);
            const stateWords = this.state.words;
            const currentSet = new Set(currentWords);
            const stateSet = new Set(stateWords);
            const wordsChanged = currentWords.length !== stateWords.length ||
                currentWords.some(w => !stateSet.has(w)) ||
                stateWords.some(w => !currentSet.has(w));

            if (!wordsChanged) {
                this.resumeDictation();
                return;
            }
        }

        this.startDictation();
    }

    static resumeDictation() {
        if (!this.state) return;

        setActiveMode("dictation");
        document.body.classList.remove('repeater-mode');
        document.body.classList.add('dictation-mode');

        clearWorkplace();
        this.renderDictationUI();
        this.updateWorkplace();

        this.state.isPaused = false;

        if (this.state.currentIndex < this.state.entries.length) {
            this.showPopup();
        } else {
            this.showResults();
        }
    }
}
