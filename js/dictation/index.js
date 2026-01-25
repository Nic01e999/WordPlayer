/**
 * 听写模式模块入口
 * 组合所有子模块并导出公共 API
 */

import { currentRepeaterState, setActiveMode, preloadCache } from '../state.js';
import { incrementPlayId } from '../repeater/state.js';
import { $, getSettings, loadWordsFromTextarea, shuffleArray, showView, logToWorkplace } from '../utils.js';
import { stopAudio } from '../audio.js';

// 导入子模块
import { clearDragCleanupFns } from './drag.js';
import {
    showPopup, closePopup, play, submit,
    updateWorkplace, showResults, playPause,
    setQuizDeps
} from './quiz.js';

// Repeater 引用（解决循环依赖）
let Repeater = null;

export function setRepeaterRef(ref) {
    Repeater = ref;
}

/**
 * 暂停另一个模式
 */
function pauseOtherMode() {
    stopAudio();
    if (Repeater) {
        Repeater.removeKeyboardListener();
    }
    if (currentRepeaterState) {
        incrementPlayId();
        currentRepeaterState.isPaused = true;
    }
}

/**
 * 听写模式类
 */
export class Dictation {
    static state = null;

    static {
        // 设置 quiz 模块的状态依赖
        setQuizDeps({
            getState: () => this.state,
            setState: (val) => { this.state = val; }
        });
    }

    static async startDictation() {
        pauseOtherMode();
        closePopup();
        this.state = null;
        setActiveMode("dictation");
        document.body.classList.remove('repeater-mode');
        document.body.classList.add('dictation-mode');

        showView('dictationView');
        $("dictationWorkplace").innerHTML = "";

        const entries = loadWordsFromTextarea();
        if (!entries.length) {
            logToWorkplace("<p>No words provided.</p>");
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

        showPopup();
    }

    static switchToDictation() {
        if (window.currentActiveMode === "dictation") {
            this.startDictation();
            return;
        }

        if (currentRepeaterState) {
            currentRepeaterState.isPaused = true;
            incrementPlayId();
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

        showView('dictationView');
        $("dictationWorkplace").innerHTML = "";
        updateWorkplace();

        this.state.isPaused = false;

        if (this.state.currentIndex < this.state.entries.length) {
            showPopup();
        } else {
            showResults();
        }
    }

    // 静态方法代理到子模块
    static closePopup() { closePopup(); }
    static play() { play(); }
    static submit() { submit(); }
    static playPause() { playPause(); }
    static updateWorkplace() { updateWorkplace(); }
    static showResults() { showResults(); }
}
