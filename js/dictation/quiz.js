/**
 * 听写模式 - 答题逻辑
 */

import { preloadCache } from '../state.js';
import { $, logToWorkplace } from '../utils.js';
import { stopAudio, speakWord, updatePlayPauseBtn } from '../audio.js';
import { initDrag, clearDragCleanupFns } from './drag.js';
import { t } from '../i18n/index.js';

// 状态引用（由 index.js 设置）
let _getState = null;
let _setState = null;

export function setQuizDeps(deps) {
    _getState = deps.getState;
    _setState = deps.setState;
}

export function showPopup() {
    const s = _getState?.();

    if (!s || s.currentIndex >= s.entries.length) {
        showResults();
        return;
    }

    const i = s.currentIndex;
    const retries = s.attempts[i].length;

    const entry = s.entries[i];
    let writeHint;
    if (entry.definition) {
        writeHint = s.dictateMode === "listenB_writeA" ? t('writeWord') : t('writeDefinition');
    } else {
        writeHint = t('writeWord');
    }

    const popup = document.createElement("div");
    popup.id = "dictationPopup";
    popup.className = "popup";
    popup.innerHTML = `
        <div class="popup-drag-handle" title=""></div>
        <h3>${t('wordNum', { num: i + 1 })}</h3>
        <p id="retryInfo">${t('attempts')}: ${retries}/${s.maxRetry} &nbsp;&nbsp;  ${writeHint}</p>
        <button onclick="Dictation.play()" class="btn-sound"></button>
        <br><br>
        <button onclick="Dictation.playPause()" id="dictationPlayPauseBtn" class="${s.isPaused ? 'btn-play' : 'btn-pause'}">${s.isPaused ? '>' : '||'}</button>
        <input type="text" id="dictationInput" placeholder="${t('typeWordPlaceholder')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ${s.isPaused ? 'disabled' : ''}>
        <br><br>
    `;

    document.body.append(popup);
    initDrag(popup);

    if (!s.isPaused) {
        setTimeout(() => play(), 500);
    }

    $("dictationInput").addEventListener("keypress", e => {
        if (e.key === "Enter" && !_getState?.()?.isPaused) submit();
    });

    if (!s.isPaused) {
        $("dictationInput").focus();
    }
}

export function closePopup() {
    clearDragCleanupFns();
    $("dictationPopup")?.remove();
}

export function play() {
    const s = _getState?.();
    if (s) {
        const textToSpeak = s.speakTexts[s.currentIndex];
        speakWord(textToSpeak, s.slow);
    }
}

export function submit() {
    const s = _getState?.();
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
        updateWorkplace();
        closePopup();
        s.currentIndex++;
        setTimeout(() => showPopup(), 500);
    } else {
        updateWorkplace();

        if (s.attempts[i].length >= s.maxRetry) {
            s.results[i] = { status: "failed", retries: s.attempts[i].length };
            updateWorkplace();
            closePopup();
            s.currentIndex++;
            setTimeout(() => showPopup(), 500);
        } else {
            $("retryInfo").textContent = `${t('attempts')}: ${s.attempts[i].length}/${s.maxRetry}`;
            input.value = "";
            input.focus();
        }
    }
}

export function updateWorkplace() {
    const s = _getState?.();
    const wp = $("dictationWorkplace");
    if (!wp || !s) return;

    wp.innerHTML = s.attempts.map((attempts, i) => {
        if (!attempts.length) return '';

        const result = s.results[i];

        const rows = attempts.map((a, j) => {
            const isLast = j === attempts.length - 1;
            let symbol, cls;

            if (a.isCorrect) {
                symbol = "O";
                cls = "correct";
            } else if (isLast && result?.status === "failed") {
                symbol = "X";
                cls = "failed";
            } else {
                symbol = "!";
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
        const view = document.getElementById("dictationView");
        if (view) {
            view.scrollTop = view.scrollHeight;
        }
    }, 50);
}

export function showResults() {
    const s = _getState?.();
    closePopup();

    if (!s) return;

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
            <h3>${t('dictationComplete')}</h3>
            <p><strong>${t('score')}: ${score}</strong></p>
            <p>${t('firstTryCorrect')}: ${correct}</p>
            <p>${t('multipleTries')}: ${warning}</p>
            <p>${t('failed')}: ${failed}</p>
        </div>
    `);

    _setState?.(null);
}

export function playPause() {
    const s = _getState?.();
    if (!s) return;

    s.isPaused = !s.isPaused;
    updatePlayPauseBtn($("dictationPlayPauseBtn"), s.isPaused);

    const input = $("dictationInput");
    if (s.isPaused) {
        stopAudio();
        if (input) input.disabled = true;
    } else {
        if (input) {
            input.disabled = false;
            input.focus();
        }
        play();
    }
}
