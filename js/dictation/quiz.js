/**
 * 听写模式 - 答题逻辑
 */

import { preloadCache } from '../state.js';
import { $, logToWorkplace, escapeHtml } from '../utils.js';
import { stopAudio, speakWord, updatePlayPauseBtn } from '../audio.js';
import { createPositionDragger } from '../utils/drag.js';
import { t } from '../i18n/index.js';

/**
 * 格式化翻译文本：转换换行符并限制显示行数
 * @param {string} text - 原始翻译文本
 * @param {number} maxLines - 最大显示行数，默认为 2
 * @returns {string} - 格式化后的 HTML
 */
function formatTranslation(text, maxLines = 2) {
    if (!text) return '';

    // 分割成行，过滤空行
    const lines = text.split(/\\n|\n/).filter(line => line.trim());

    // 只取前 maxLines 行，转义 HTML 并用 <br> 连接
    return lines.slice(0, maxLines).map(escapeHtml).join('<br>');
}

// 状态引用（由 index.js 设置）
let _getState = null;
let _setState = null;

// 保存最后一次听写结果供分享使用
let lastDictationResult = null;

// 拖拽处理器
let dragHandler = null;

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

    // 在显示弹窗前，先更新记录区显示已答题目
    updateWorkplace();

    // 手动添加当前题目的占位符
    const wp = document.getElementById("dictationWorkplace");
    if (wp) {
        const provideText = s.provideTexts[i];
        const isCustom = s.isCustomWord[i];
        const shouldShowProvide = isCustom && (s.dictateProvide !== s.dictateWrite);

        const currentItemHTML = `<div class="result-item">
            <span class="result-index">${i + 1}.</span>
            ${shouldShowProvide ? `<div class="result-listened">&lt;${provideText}&gt;</div>` : ''}
            <div class="result-attempts"></div>
        </div>`;

        wp.insertAdjacentHTML('beforeend', currentItemHTML);

        // 自动滚动到底部
        setTimeout(() => {
            const view = document.getElementById("dictationView");
            if (view) {
                view.scrollTop = view.scrollHeight;
            }
        }, 50);
    }

    const retries = s.attempts[i].length;

    const entry = s.entries[i];
    const isCustom = s.isCustomWord[i];  // 获取单词类型标记

    // 根据单词类型决定 write 提示
    const writeHint = isCustom
        ? (s.dictateWrite === 'A' ? t('writeWord') : t('writeDefinition'))
        : t('writeWord');  // 非自定义单词永远是"写单词"

    const { dictateProvide, dictateWrite, provideTexts } = s;
    const provideText = provideTexts[i];

    // 决定是否显示 provide
    let titleHtml;
    if (isCustom && dictateProvide !== dictateWrite) {
        // 自定义单词 && provide != write，显示 provide 内容
        titleHtml = `${t('wordNum', { num: i + 1 })} &lt;${provideText}&gt;`;
    } else {
        // 非自定义单词 || provide == write，不显示 provide
        titleHtml = t('wordNum', { num: i + 1 });
    }

    const popup = document.createElement("div");
    popup.id = "dictationPopup";
    popup.className = "popup";
    popup.innerHTML = `
        <div class="popup-drag-handle" title=""></div>
        <h3>${titleHtml}</h3>
        <p id="retryInfo">${t('attempts')}: ${retries}/${s.maxRetry} &nbsp;&nbsp;  ${writeHint}</p>
        <br><br>
        <button onclick="Dictation.play()" class="btn-sound"></button>
        <input type="text" id="dictationInput" placeholder="${t('typeWordPlaceholder')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        <br><br>
    `;

    document.body.append(popup);

    // 初始化拖拽
    const handle = popup.querySelector('.popup-drag-handle');
    if (handle) {
        popup.style.position = 'absolute';
        popup.style.transform = 'rotate(-1deg)';
        dragHandler = createPositionDragger(popup, handle, {
            onStart: () => popup.classList.add('dragging'),
            onEnd: () => popup.classList.remove('dragging')
        });
    }

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
    if (dragHandler) {
        dragHandler.destroy();
        dragHandler = null;
    }
    $("dictationPopup")?.remove();
}

export function play() {
    const s = _getState?.();
    if (s) {
        const textToSpeak = s.speakTexts[s.currentIndex];
        if (textToSpeak) {  // 只有 provide=A 时才播放
            speakWord(textToSpeak, s.slow);
        }
        // provide=B 时，textToSpeak 为 null，不播放音频
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
        if (!attempts.length) return '';  // 只显示已答题目

        const result = s.results[i];

        const rows = attempts.map((a, j) => {
            const isLast = j === attempts.length - 1;
            let symbol, cls;

            if (a.isCorrect) {
                symbol = "";
                cls = "correct";
            } else if (isLast && result?.status === "failed") {
                symbol = "X";
                cls = "failed";
            } else {
                symbol = "!";
                cls = "warning";
            }

            const extra = (isLast && result?.status === "failed")
                ? `<br><span class="correct">${s.entries[i].word} - ${formatTranslation(s.entries[i].definition || preloadCache.translations[s.entries[i].word] || '')}</span>`
                : '';

            return `<div class="${cls}">${a.answer} ${symbol}(${j + 1})${extra}</div>`;
        }).join('');

        const provideText = s.provideTexts[i];
        const isCustom = s.isCustomWord[i];
        const shouldShowProvide = isCustom && (s.dictateProvide !== s.dictateWrite);
        return `<div class="result-item">
                    <span class="result-index">${i + 1}.</span>
                    ${shouldShowProvide ? `<div class="result-listened">&lt;${provideText}&gt;</div>` : ''}
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

    // 保存结果数据供分享使用（深拷贝）
    lastDictationResult = {
        state: JSON.parse(JSON.stringify(s)),
        score,
        correct,
        warning,
        failed
    };

    logToWorkplace(`
        <div class="results-box">
            <h3>${t('dictationComplete')}</h3>
            <p><strong>${t('score')}: ${score}</strong></p>
            <p>${t('firstTryCorrect')}: ${correct}</p>
            <p>${t('multipleTries')}: ${warning}</p>
            <p>${t('failed')}: ${failed}</p>
            <button id="shareResultBtn" class="share-btn">${t('shareResult')}</button>
        </div>
    `);

    // 绑定分享按钮事件
    setTimeout(() => {
        const btn = document.getElementById('shareResultBtn');
        if (btn) {
            btn.addEventListener('click', () => shareResult(lastDictationResult));
        }
    }, 100);

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

/**
 * 生成听写结果长图并复制到剪贴板
 */
async function shareResult(result) {
    if (!result) return;

    const btn = document.getElementById('shareResultBtn');
    if (!btn) return;

    const { state, score, correct, warning, failed } = result;

    // 显示加载状态
    const originalText = btn.textContent;
    btn.textContent = t('generating');
    btn.disabled = true;

    try {
        // 1. 创建隐藏的长图容器
        const container = createShareContainer(state, score, correct, warning, failed);
        document.body.appendChild(container);

        // 2. 等待字体和样式加载
        await new Promise(resolve => setTimeout(resolve, 300));

        // 3. 检查 html2canvas 是否可用
        if (typeof html2canvas === 'undefined') {
            console.error('[Quiz] html2canvas 库未加载，无法生成分享图片');
            btn.textContent = t('shareError');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 2000);
            document.body.removeChild(container);
            return;
        }

        // 4. 使用 html2canvas 生成图片
        const canvas = await html2canvas(container, {
            backgroundColor: '#f5f5dc', // 米黄色背景
            scale: 2, // 2倍分辨率，提高清晰度
            logging: false,
            useCORS: true,
            allowTaint: true
        });

        // 5. 转换为 Blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

        // 6. 复制到剪贴板（带兼容性检查）
        let copySuccess = false;
        if (navigator.clipboard && typeof navigator.clipboard.write === 'function') {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                copySuccess = true;
                console.log('[Success] 图片已复制到剪贴板');
            } catch (clipboardErr) {
                console.warn('[Warning] 剪贴板复制失败，降级为下载:', clipboardErr);
                copySuccess = false;
            }
        } else {
            console.warn('[Warning] 浏览器不支持剪贴板 API，降级为下载');
            copySuccess = false;
        }

        // 如果复制失败，降级为下载
        if (!copySuccess) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dictation-share-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('[Success] 图片已下载');
        }

        // 7. 清理和提示
        document.body.removeChild(container);
        btn.textContent = copySuccess ? t('copySuccess') : t('savedToDownload');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('[Error] 分享失败:', error);
        const container = document.getElementById('shareContainer');
        if (container) document.body.removeChild(container);
        btn.textContent = t('copyFailed');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 2000);
    }
}

/**
 * 创建用于生成长图的隐藏容器
 */
function createShareContainer(state, score, correct, warning, failed) {
    const container = document.createElement('div');
    container.id = 'shareContainer';
    container.className = 'share-container';

    // 生成时间戳
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 生成详细记录 HTML
    const detailsHTML = state.attempts.map((attempts, i) => {
        if (!attempts.length) return '';  // 只显示已答题目

        const result = state.results[i];
        const rows = attempts.map((a, j) => {
            const isLast = j === attempts.length - 1;
            let symbol, cls;

            if (a.isCorrect) {
                symbol = "";
                cls = "correct";
            } else if (isLast && result?.status === "failed") {
                symbol = "X";
                cls = "failed";
            } else {
                symbol = "!";
                cls = "warning";
            }

            const extra = (isLast && result?.status === "failed")
                ? `<br><span class="correct">${state.entries[i].word} - ${formatTranslation(state.entries[i].definition || preloadCache.translations[state.entries[i].word] || '')}</span>`
                : '';

            return `<div class="${cls}">${a.answer} ${symbol}(${j + 1})${extra}</div>`;
        }).join('');

        const provideText = state.provideTexts[i];
        const isCustom = state.isCustomWord[i];
        const shouldShowProvide = isCustom && (state.dictateProvide !== state.dictateWrite);

        return `<div class="result-item">
                    <span class="result-index">${i + 1}.</span>
                    ${shouldShowProvide ? `<div class="result-listened">&lt;${provideText}&gt;</div>` : ''}
                    <div class="result-attempts">${rows}</div>
                </div>`;
    }).join('');

    // 组装完整 HTML
    container.innerHTML = `
        <div class="share-header">
            <h2>${t('dictationRecord')}</h2>
            <p class="share-timestamp">${timestamp}</p>
        </div>

        <div class="share-summary">
            <div class="share-score">${t('score')}: ${score}</div>
            <div class="share-stats">
                <span>${t('firstTryCorrect')}: ${correct}</span>
                <span>${t('multipleTries')}: ${warning}</span>
                <span>${t('failed')}: ${failed}</span>
            </div>
        </div>

        <div class="share-details">
            ${detailsHTML}
        </div>
    `;

    return container;
}
