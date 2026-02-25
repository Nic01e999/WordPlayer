/**
 * 听写模式 - 答题逻辑
 */

import { preloadCache } from '../state.js';
import { $, logToWorkplace, escapeHtml, updateTextareaFromEntries } from '../utils.js';
import { stopAudio, speakWord, updatePlayPauseBtn } from '../audio.js';
import { createPositionDragger } from '../utils/drag.js';
import { t, onLocaleChange } from '../i18n/index.js';

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

// 保存弹窗位置（同一 session 内保持）
let savedPopupPosition = null;

// DOM缓存变量（性能优化：复用弹窗DOM）
let popupElement = null;        // 缓存的弹窗DOM
let popupInputElement = null;   // 缓存输入框
let popupRetryInfo = null;      // 缓存重试信息
let popupTitle = null;          // 缓存标题

export function setQuizDeps(deps) {
    _getState = deps.getState;
    _setState = deps.setState;
}

// 注册语言变更监听器
onLocaleChange(() => {
    console.log('[Quiz] 检测到语言变更，刷新动态元素');
    refreshPopupLanguage();
    refreshResultsLanguage();
});

/**
 * 添加当前题目占位符到记录区
 */
function addCurrentItemPlaceholder(state) {
    const wp = document.getElementById("dictationWorkplace");
    if (!wp) return;

    const i = state.currentIndex;
    const provideText = state.provideTexts[i];
    const isCustom = state.isCustomWord[i];
    const shouldShowProvide = isCustom && (state.dictateProvide !== state.dictateWrite);

    const currentItemHTML = `<div class="result-item" id="current-item-${i}">
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

/**
 * 初始化拖拽功能（仅调用一次）
 */
function initializeDrag() {
    if (!popupElement) return;

    const handle = popupElement.querySelector('.popup-drag-handle');
    if (!handle) return;

    popupElement.style.position = 'absolute';
    popupElement.style.transform = 'rotate(-1deg)';

    // 恢复上次拖拽的位置
    if (savedPopupPosition) {
        popupElement.style.left = `${savedPopupPosition.left}px`;
        popupElement.style.top = `${savedPopupPosition.top}px`;
    }

    // 计算当前窗口内的拖拽边界
    const calcBounds = () => {
        const rect = popupElement.getBoundingClientRect();
        return {
            minX: 0,
            minY: 0,
            maxX: window.innerWidth - rect.width,
            maxY: window.innerHeight - rect.height
        };
    };

    dragHandler = createPositionDragger(popupElement, handle, {
        bounds: calcBounds(),

        onStart: () => popupElement.classList.add('dragging'),

        onEnd: () => {
            popupElement.classList.remove('dragging');

            // 保存当前位置
            const rect = popupElement.getBoundingClientRect();
            savedPopupPosition = {
                left: rect.left,
                top: rect.top
            };
        }
    });

    // 窗口变化时更新拖拽范围
    window.addEventListener('resize', () => {
        if (dragHandler) {
            dragHandler.bounds = calcBounds();
        }
    });
}

/**
 * 绑定弹窗事件（仅调用一次）
 */
function bindPopupEvents() {
    if (!popupInputElement) return;

    popupInputElement.addEventListener("keypress", e => {
        const s = _getState?.();
        if (e.key === "Enter" && !s?.isPaused && !s?.isSubmitting) {
            submit();
        }
    });
}

/**
 * 创建弹窗DOM（首次调用）
 */
function createPopup(state) {
    const i = state.currentIndex;
    const retries = state.attempts[i].length;
    const isCustom = state.isCustomWord[i];

    // 根据单词类型决定 write 提示
    const writeHint = isCustom
        ? (state.dictateWrite === 'A' ? t('writeWord') : t('writeDefinition'))
        : t('writeWord');

    const provideText = state.provideTexts[i];

    // 决定是否显示 provide
    let titleHtml;
    if (isCustom && state.dictateProvide !== state.dictateWrite) {
        titleHtml = `${t('wordNum', { num: i + 1 })} &lt;${provideText}&gt;`;
    } else {
        titleHtml = t('wordNum', { num: i + 1 });
    }

    const popup = document.createElement("div");
    popup.id = "dictationPopup";
    popup.className = "popup";
    popup.innerHTML = `
        <div class="popup-drag-handle" title=""></div>
        <h3>${titleHtml}</h3>
        <p id="retryInfo">${t('attempts')}: ${retries}/${state.maxRetry} &nbsp;&nbsp;  ${writeHint}</p>
        <br><br>
        <button onclick="Dictation.play()" class="btn-sound"></button>
        <input type="text" id="dictationInput" placeholder="${t('typeWordPlaceholder')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        <br><br>
    `;

    document.body.append(popup);

    // 缓存DOM引用
    popupElement = popup;
    popupTitle = popup.querySelector('h3');
    popupRetryInfo = popup.querySelector('#retryInfo');
    popupInputElement = popup.querySelector('#dictationInput');

    // 初始化拖拽和事件（仅一次）
    initializeDrag();
    bindPopupEvents();

    console.log('[createPopup] 弹窗DOM已创建并缓存');
}

/**
 * 更新弹窗内容（后续调用）
 */
function updatePopup(state) {
    if (!popupElement || !popupTitle || !popupRetryInfo || !popupInputElement) {
        console.warn('[updatePopup] 缓存的DOM引用失效，重新创建弹窗');
        createPopup(state);
        return;
    }

    const i = state.currentIndex;
    const retries = state.attempts[i].length;
    const isCustom = state.isCustomWord[i];

    // 根据单词类型决定 write 提示
    const writeHint = isCustom
        ? (state.dictateWrite === 'A' ? t('writeWord') : t('writeDefinition'))
        : t('writeWord');

    const provideText = state.provideTexts[i];

    // 决定是否显示 provide
    let titleHtml;
    if (isCustom && state.dictateProvide !== state.dictateWrite) {
        titleHtml = `${t('wordNum', { num: i + 1 })} &lt;${provideText}&gt;`;
    } else {
        titleHtml = t('wordNum', { num: i + 1 });
    }

    // 只更新3个动态元素
    popupTitle.innerHTML = titleHtml;
    popupRetryInfo.textContent = `${t('attempts')}: ${retries}/${state.maxRetry} \u00a0\u00a0  ${writeHint}`;
    popupInputElement.value = "";
    popupInputElement.placeholder = t('typeWordPlaceholder');

    // 显示弹窗（如果之前被隐藏）
    popupElement.style.display = 'block';

    console.log('[updatePopup] 弹窗内容已更新（复用DOM）');
}

export function showPopup() {
    const s = _getState?.();

    if (!s || s.currentIndex >= s.entries.length) {
        showResults();
        return;
    }

    // 手动添加当前题目的占位符
    addCurrentItemPlaceholder(s);

    // 首次创建或复用弹窗
    if (!popupElement) {
        createPopup(s);
    } else {
        updatePopup(s);
    }

    // 播放音频和设置焦点
    if (!s.isPaused) {
        setTimeout(() => play(), 500);
    }

    if (!s.isPaused) {
        popupInputElement?.focus();
    }
}

export function closePopup() {
    if (popupElement) {
        popupElement.style.display = 'none';  // 隐藏而不销毁
        if (popupInputElement) {
            popupInputElement.value = "";     // 清空输入
        }
        console.log('[closePopup] 弹窗已隐藏（保留DOM）');
    }
}

/**
 * 彻底销毁弹窗（模式切换时调用）
 */
export function destroyPopup() {
    if (dragHandler) {
        dragHandler.destroy();
        dragHandler = null;
    }
    if (popupElement) {
        popupElement.remove();
        popupElement = null;
        popupInputElement = null;
        popupRetryInfo = null;
        popupTitle = null;
        console.log('[destroyPopup] 弹窗DOM已彻底销毁');
    }
}

/**
 * 清除保存的弹窗位置（模式切换时调用）
 */
export function clearSavedPopupPosition() {
    savedPopupPosition = null;
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

    // 防止重复提交
    if (s.isSubmitting) {
        console.log('[submit] 提交正在处理中，忽略重复调用');
        return;
    }
    s.isSubmitting = true;  // 设置锁定

    // 使用缓存的 DOM 引用
    if (!popupInputElement) {
        console.warn('[submit] 输入框引用不存在');
        s.isSubmitting = false;  // 清除锁定
        return;
    }

    const answer = popupInputElement.value.trim();
    const correct = s.expectTexts[s.currentIndex];
    const i = s.currentIndex;

    s.attempts[i].push({
        answer,
        isCorrect: answer.toLowerCase() === correct.toLowerCase()
    });

    if (answer.toLowerCase() === correct.toLowerCase()) {
        s.results[i] = { status: "correct", retries: s.attempts[i].length };
        updateWorkplace();
        s.currentIndex++;
        setTimeout(() => {
            s.isSubmitting = false;  // 清除锁定
            showPopup();
        }, 500);
    } else {
        updateWorkplace();

        if (s.attempts[i].length >= s.maxRetry) {
            s.results[i] = { status: "failed", retries: s.attempts[i].length };
            updateWorkplace();
            s.currentIndex++;
            setTimeout(() => {
                s.isSubmitting = false;  // 清除锁定
                showPopup();
            }, 500);
        } else {
            // 使用缓存的 DOM 引用直接更新
            if (popupRetryInfo) {
                const isCustom = s.isCustomWord[i];
                const writeHint = isCustom
                    ? (s.dictateWrite === 'A' ? t('writeWord') : t('writeDefinition'))
                    : t('writeWord');
                popupRetryInfo.textContent = `${t('attempts')}: ${s.attempts[i].length}/${s.maxRetry} \u00a0\u00a0  ${writeHint}`;
            }
            popupInputElement.value = "";
            popupInputElement.focus();
            s.isSubmitting = false;  // 清除锁定（继续答题）
        }
    }
}

/**
 * 构建单题的答题记录HTML
 */
function buildAttemptsHTML(state, i) {
    const attempts = state.attempts[i];
    const result = state.results[i];

    return attempts.map((a, j) => {
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
            ? `<br><span class="correct">${state.entries[i].word} :<br>${formatTranslation(state.entries[i].definition || preloadCache.translations[state.entries[i].word] || '')}</span>`
            : '';

        return `<div class="${cls}">${a.answer} ${symbol}(${j + 1})${extra}</div>`;
    }).join('');
}

/**
 * 增量更新记录区（只更新当前题目）
 */
export function updateWorkplace() {
    const s = _getState?.();
    const wp = $("dictationWorkplace");
    if (!wp || !s) return;

    const i = s.currentIndex;

    // 找到当前题目的容器
    const currentItem = document.getElementById(`current-item-${i}`);
    if (currentItem) {
        // 增量更新：只更新当前题目的 attempts 区域
        const attemptsContainer = currentItem.querySelector('.result-attempts');
        if (attemptsContainer && s.attempts[i].length > 0) {
            const attemptsHTML = buildAttemptsHTML(s, i);
            attemptsContainer.innerHTML = attemptsHTML;
            console.log(`[updateWorkplace] 增量更新第 ${i + 1} 题`);
        }
    } else {
        // 降级方案：找不到容器时全量更新
        console.warn(`[updateWorkplace] 未找到 current-item-${i}，降级到全量更新`);
        fullUpdateWorkplace();
    }

    // 滚动到底部
    setTimeout(() => {
        const view = document.getElementById("dictationView");
        if (view) {
            view.scrollTop = view.scrollHeight;
        }
    }, 50);
}

/**
 * 全量更新记录区（降级方案）
 */
function fullUpdateWorkplace() {
    const s = _getState?.();
    const wp = $("dictationWorkplace");
    if (!wp || !s) return;

    // 生成当前轮次的 HTML（原有逻辑）
    const currentRoundHTML = s.attempts.map((attempts, i) => {
        if (!attempts.length) return '';  // 只显示已答题目

        const result = s.results[i];
        const rows = buildAttemptsHTML(s, i);

        const provideText = s.provideTexts[i];
        const isCustom = s.isCustomWord[i];
        const shouldShowProvide = isCustom && (s.dictateProvide !== s.dictateWrite);
        return `<div class="result-item">
                    <span class="result-index">${i + 1}.</span>
                    ${shouldShowProvide ? `<div class="result-listened">&lt;${provideText}&gt;</div>` : ''}
                    <div class="result-attempts">${rows}</div>
                </div>`;
    }).join('');

    // 如果有快照，先恢复快照，再追加当前内容
    if (s.workplaceSnapshot) {
        console.log('[fullUpdateWorkplace] 恢复快照 + 追加新内容');
        wp.innerHTML = s.workplaceSnapshot + currentRoundHTML;
    } else {
        // 首次听写，直接设置
        console.log('[fullUpdateWorkplace] 首次听写，直接设置内容');
        wp.innerHTML = currentRoundHTML;
    }
}

/**
 * 计算听写统计数据
 */
function calculateStatistics(state) {
    let correct = 0, warning = 0, failed = 0;
    state.results.forEach((r, i) => {
        if (r?.status === "correct" && state.attempts[i].length === 1) {
            correct++;
        } else if (r?.status === "correct") {
            warning++;
        } else if (r?.status === "failed") {
            failed++;
        }
    });
    return { correct, warning, failed };
}

/**
 * 保存当前轮次到历史记录
 */
function saveRoundToHistory(state) {
    const { correct, warning, failed } = calculateStatistics(state);
    const score = ((correct + warning * 0.5) / state.entries.length * 100).toFixed(1);

    if (!state.retryHistory) {
        state.retryHistory = [];
    }

    state.retryHistory.push({
        round: state.currentRound,
        roundType: state.currentRound === 0 ? 'initial' : 'retry',
        entries: JSON.parse(JSON.stringify(state.entries)),
        attempts: JSON.parse(JSON.stringify(state.attempts)),
        results: JSON.parse(JSON.stringify(state.results)),
        speakTexts: [...state.speakTexts],
        provideTexts: [...state.provideTexts],
        expectTexts: [...state.expectTexts],
        isCustomWord: [...state.isCustomWord],
        dictateProvide: state.dictateProvide,
        dictateWrite: state.dictateWrite,
        timestamp: Date.now(),
        statistics: { correct, warning, failed, score }
    });
}

/**
 * 获取错误单词的索引列表
 */
function getFailedIndices(state) {
    return state.results
        .map((r, i) => {
            const isFailed = r?.status === 'failed';
            const isWarning = state.attempts[i].length > 1;
            return (isFailed || isWarning) ? i : -1;
        })
        .filter(i => i !== -1);
}

/**
 * 在仿真纸上添加重试分隔线
 */
function addRetryDivider(roundNumber) {
    const wp = document.getElementById("dictationWorkplace");
    if (!wp) return;

    const divider = document.createElement('div');
    divider.className = 'retry-divider';
    divider.innerHTML = `
        <div class="retry-divider-line"></div>
        <div class="retry-divider-text">${t('retryRound', { num: roundNumber })}</div>
        <div class="retry-divider-line"></div>
    `;
    wp.appendChild(divider);

    // 自动滚动到底部
    setTimeout(() => {
        const view = document.getElementById("dictationView");
        if (view) view.scrollTop = view.scrollHeight;
    }, 50);
}

export function showResults() {
    const s = _getState?.();
    closePopup();

    if (!s) return;

    // 保存当前轮次到历史
    saveRoundToHistory(s);

    const { correct, warning, failed } = calculateStatistics(s);
    const score = ((correct + warning * 0.5) / s.entries.length * 100).toFixed(1);

    // 判断是否有错误
    const hasErrors = failed > 0 || warning > 0;

    // 根据轮次生成标题
    const titleKey = s.currentRound === 0 ? 'dictationComplete' : 'retryComplete';
    const titleParams = s.currentRound === 0 ? {} : { num: s.currentRound };

    // 保存完整结果供分享使用
    lastDictationResult = {
        retryHistory: s.retryHistory || [],
        currentRound: s.currentRound || 0
    };

    logToWorkplace(`
        <div class="results-box" data-round="${s.currentRound}">
            <h3>${t(titleKey, titleParams)}</h3>
            <p><strong>${t('score')}: ${score}</strong></p>
            <p>${t('firstTryCorrect')}: ${correct}</p>
            <p>${t('multipleTries')}: ${warning}</p>
            <p>${t('failed')}: ${failed}</p>
            <div class="results-actions">
                ${hasErrors ? `<button id="retryFailedBtn" class="retry-btn">${t('retryFailed')}</button>` : ''}
                <button id="shareResultBtn" class="share-btn">${t('shareResult')}</button>
            </div>
        </div>
    `);

    // 绑定按钮事件
    setTimeout(() => {
        const retryBtn = document.getElementById('retryFailedBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', startRetry);
        }

        const shareBtn = document.getElementById('shareResultBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => shareResult(lastDictationResult));
        }
    }, 100);

    // 不清空 state，保留历史记录以支持多轮重试
    // _setState?.(null);
}

/**
 * 开始错题重听
 */
export function startRetry() {
    const s = _getState?.();
    if (!s) return;

    // 删除当前 results-box 的按钮（因为要开始新一轮了）
    const currentResultsBox = document.querySelector('.results-box:last-of-type');
    if (currentResultsBox) {
        const actionsContainer = currentResultsBox.querySelector('.results-actions');
        if (actionsContainer) {
            actionsContainer.remove();
            console.log('[startRetry] 已删除当前结果框的按钮');
        }
    }

    // 获取错误单词的索引
    const failedIndices = getFailedIndices(s);
    if (failedIndices.length === 0) return;

    // 获取错误的单词条目
    const failedEntries = failedIndices.map(i => s.entries[i]);

    // 更新 textarea 显示错题集
    updateTextareaFromEntries(failedEntries);

    // 保存当前 workplace 的完整内容（在添加分隔线之前）
    const wp = document.getElementById("dictationWorkplace");
    if (wp) {
        // 移除所有旧的 current-item-X ID，避免与新一轮冲突
        const oldItems = wp.querySelectorAll('[id^="current-item-"]');
        oldItems.forEach(item => {
            console.log(`[startRetry] 移除旧 ID: ${item.id}`);
            item.removeAttribute('id');
        });

        // 保存清理后的快照
        s.workplaceSnapshot = wp.innerHTML;
        console.log('[startRetry] 已保存 workplace 快照（已清理 ID）');
    }

    // 添加分隔线
    addRetryDivider(s.currentRound + 1);

    // 构建新的 state（只包含错误单词）
    s.entries = failedEntries;  // 直接使用 failedEntries
    s.speakTexts = failedIndices.map(i => s.speakTexts[i]);
    s.provideTexts = failedIndices.map(i => s.provideTexts[i]);
    s.expectTexts = failedIndices.map(i => s.expectTexts[i]);
    s.isCustomWord = failedIndices.map(i => s.isCustomWord[i]);

    // 重置状态
    s.currentIndex = 0;
    s.attempts = s.entries.map(() => []);
    s.results = s.entries.map(() => null);
    s.currentRound++;
    s.isPaused = false;

    // 开始新一轮听写
    showPopup();
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

    // 显示加载状态
    const originalText = btn.textContent;
    btn.textContent = t('generating');
    btn.disabled = true;

    try {
        // 1. 创建隐藏的长图容器（包含所有轮次）
        const container = createShareContainerWithRetries(result);
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
                ? `<br><span class="correct">${state.entries[i].word} :<br>${formatTranslation(state.entries[i].definition || preloadCache.translations[state.entries[i].word] || '')}</span>`
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

/**
 * 生成单个轮次的详细记录 HTML
 */
function generateRoundDetails(round) {
    return round.attempts.map((attempts, i) => {
        if (!attempts.length) return '';

        const result = round.results[i];
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
                ? `<br><span class="correct">${round.entries[i].word} :<br>${formatTranslation(round.entries[i].definition || preloadCache.translations[round.entries[i].word] || '')}</span>`
                : '';

            return `<div class="${cls}">${a.answer} ${symbol}(${j + 1})${extra}</div>`;
        }).join('');

        const provideText = round.provideTexts[i];
        const isCustom = round.isCustomWord[i];
        const shouldShowProvide = isCustom && (round.dictateProvide !== round.dictateWrite);

        return `
            <div class="result-item">
                <span class="result-index">${i + 1}.</span>
                ${shouldShowProvide ? `<div class="result-listened">&lt;${provideText}&gt;</div>` : ''}
                <div class="result-attempts">${rows}</div>
            </div>
        `;
    }).join('');
}

/**
 * 创建包含多轮重试记录的分享容器
 */
function createShareContainerWithRetries(result) {
    const container = document.createElement('div');
    container.id = 'shareContainer';
    container.className = 'share-container';

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 标题
    let html = `
        <div class="share-header">
            <h2>${t('dictationRecord')}</h2>
            <p class="share-timestamp">${timestamp}</p>
        </div>
    `;

    // 遍历所有轮次
    const history = result.retryHistory || [];
    history.forEach((round, index) => {
        const isFirstRound = index === 0;
        const titleKey = isFirstRound ? 'dictationComplete' : 'retryComplete';
        const titleParams = isFirstRound ? {} : { num: index };

        // 添加分隔线（第二轮及之后）
        if (!isFirstRound) {
            html += `
                <div class="share-retry-divider">
                    <div class="retry-divider-line"></div>
                    <div class="retry-divider-text">${t('retryRound', { num: index })}</div>
                    <div class="retry-divider-line"></div>
                </div>
            `;
        }

        // 汇总信息
        html += `
            <div class="share-summary">
                <h3>${t(titleKey, titleParams)}</h3>
                <div class="share-score">${t('score')}: ${round.statistics.score}</div>
                <div class="share-stats">
                    <span>${t('firstTryCorrect')}: ${round.statistics.correct}</span>
                    <span>${t('multipleTries')}: ${round.statistics.warning}</span>
                    <span>${t('failed')}: ${round.statistics.failed}</span>
                </div>
            </div>
        `;

        // 详细记录
        const detailsHTML = generateRoundDetails(round);
        html += `<div class="share-details">${detailsHTML}</div>`;
    });

    container.innerHTML = html;
    return container;
}

/**
 * 刷新答题弹窗的语言文本（兼容缓存DOM）
 */
function refreshPopupLanguage() {
    // 使用缓存的DOM引用
    if (!popupElement || !popupTitle || !popupRetryInfo || !popupInputElement) {
        console.log('[refreshPopupLanguage] 弹窗未显示或DOM引用不存在，跳过更新');
        return;
    }

    const s = _getState?.();
    if (!s) return;

    const i = s.currentIndex;
    const retries = s.attempts[i]?.length || 0;
    const isCustom = s.isCustomWord[i];

    // 更新标题
    const provideText = s.provideTexts[i];
    let titleHtml;
    if (isCustom && s.dictateProvide !== s.dictateWrite) {
        titleHtml = `${t('wordNum', { num: i + 1 })} &lt;${provideText}&gt;`;
    } else {
        titleHtml = t('wordNum', { num: i + 1 });
    }
    popupTitle.innerHTML = titleHtml;

    // 更新"尝试次数"文本
    const writeHint = isCustom
        ? (s.dictateWrite === 'A' ? t('writeWord') : t('writeDefinition'))
        : t('writeWord');
    popupRetryInfo.textContent = `${t('attempts')}: ${retries}/${s.maxRetry} \u00a0\u00a0  ${writeHint}`;

    // 更新输入框placeholder
    popupInputElement.placeholder = t('typeWordPlaceholder');

    console.log('[refreshPopupLanguage] 答题弹窗语言已更新（使用缓存DOM）');
}

/**
 * 刷新结果框的语言文本
 */
function refreshResultsLanguage() {
    const resultsBoxes = document.querySelectorAll('.results-box');
    if (resultsBoxes.length === 0) return;

    const s = _getState?.();
    if (!s || !s.retryHistory) return;

    resultsBoxes.forEach((box, boxIndex) => {
        const round = parseInt(box.getAttribute('data-round') || '0');
        const history = s.retryHistory[boxIndex];

        if (!history) return;

        const { correct, warning, failed, score } = history.statistics;
        const hasErrors = failed > 0 || warning > 0;

        // 更新标题
        const titleKey = round === 0 ? 'dictationComplete' : 'retryComplete';
        const titleParams = round === 0 ? {} : { num: round };
        const titleEl = box.querySelector('h3');
        if (titleEl) titleEl.textContent = t(titleKey, titleParams);

        // 更新统计信息
        const paragraphs = box.querySelectorAll('p');
        if (paragraphs[0]) paragraphs[0].innerHTML = `<strong>${t('score')}: ${score}</strong>`;
        if (paragraphs[1]) paragraphs[1].textContent = `${t('firstTryCorrect')}: ${correct}`;
        if (paragraphs[2]) paragraphs[2].textContent = `${t('multipleTries')}: ${warning}`;
        if (paragraphs[3]) paragraphs[3].textContent = `${t('failed')}: ${failed}`;

        // 更新按钮文本
        const retryBtn = box.querySelector('.retry-btn');
        if (retryBtn) retryBtn.textContent = t('retryFailed');

        const shareBtn = box.querySelector('.share-btn');
        if (shareBtn) shareBtn.textContent = t('shareResult');
    });

    console.log('[refreshResultsLanguage] 结果框语言已更新');
}
