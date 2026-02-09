/**
 * 听写模式模块入口
 * 组合所有子模块并导出公共 API
 */

import { currentRepeaterState, setActiveMode, preloadCache } from '../state.js';
import { incrementPlayId } from '../repeater/state.js';
import { $, getSettings, loadWordsFromTextarea, shuffleArray, showView, logToWorkplace } from '../utils.js';
import { stopAudio } from '../audio.js';
import { checkFirstTime } from '../guide.js';

// 导入子模块
import {
    showPopup, closePopup, play, submit,
    updateWorkplace, showResults, playPause,
    setQuizDeps, clearSavedPopupPosition
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

        // 检查是否首次进入听写模式
        checkFirstTime('dictation');

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

        const { dictateProvide, dictateWrite } = settings;
        const speakTexts = [];      // 要播放的音频文本（只有 provide=A 时才有）
        const provideTexts = [];    // 要显示的 provide 文本
        const expectTexts = [];     // 期望的答案

        list.forEach(entry => {
            const wordText = entry.word;
            const isCustomWord = entry.definition !== null;  // 区分单词类型
            const defText = entry.definition || wordText;

            if (isCustomWord) {
                // 自定义单词：按照用户设置的 provide/write 处理
                if (dictateProvide === 'A') {
                    speakTexts.push(wordText);      // 播放单词读音
                    provideTexts.push(wordText);    // provide 显示单词
                } else {
                    speakTexts.push(null);          // 不播放音频
                    provideTexts.push(defText);     // provide 显示释义
                }

                if (dictateWrite === 'A') {
                    expectTexts.push(wordText);     // 期望写单词
                } else {
                    expectTexts.push(defText);      // 期望写释义
                }
            } else {
                // 非自定义单词：固定为 provide=A, write=A（听单词→写单词）
                speakTexts.push(wordText);
                provideTexts.push(wordText);
                expectTexts.push(wordText);
            }
        });

        this.state = {
            entries: list,
            words,
            speakTexts,
            provideTexts,
            expectTexts,
            dictateProvide,
            dictateWrite,
            currentIndex: 0,
            maxRetry: settings.retry,
            attempts: list.map(() => []),
            results: list.map(() => null),
            slow: settings.slow,
            isPaused: false,
            isCustomWord: list.map(entry => entry.definition !== null),  // 新增：标记每个单词是否为自定义单词
            retryHistory: [],  // 存储所有轮次的完整记录
            currentRound: 0,    // 当前轮次编号（0=首次，1=第一次重试）
            workplaceSnapshot: ''  // 新增：保存进入当前轮次前的workplace内容
        };

        showPopup();
    }

    static switchToDictation() {
        // 清除保存的弹窗位置
        clearSavedPopupPosition();

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
