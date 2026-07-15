/**
 * 听写历史记录 UI 模块
 * 在听写按钮上悬浮显示历史记录列表
 */

import { getHistory } from './history.js';
import { t } from '../i18n/index.js';
import { showView } from '../utils.js';

// 历史记录弹窗DOM
let historyPopup = null;

/**
 * 格式化时间戳
 * @param {number} timestamp - 毫秒时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('justNow') || '刚刚';
    if (diffMins < 60) return `${diffMins}${t('minutesAgo') || '分钟前'}`;
    if (diffHours < 24) return `${diffHours}${t('hoursAgo') || '小时前'}`;
    if (diffDays < 7) return `${diffDays}${t('daysAgo') || '天前'}`;

    // 超过7天显示完整日期
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 创建历史记录弹窗
 */
function createHistoryPopup() {
    if (historyPopup) {
        historyPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'dictation-history-popup';
    popup.innerHTML = `
        <div class="history-header">
            <h4>${t('dictationHistory') || '听写历史'}</h4>
        </div>
        <div class="history-list"></div>
    `;

    document.body.appendChild(popup);
    historyPopup = popup;

    return popup;
}

/**
 * 更新历史记录列表内容
 */
function updateHistoryList() {
    if (!historyPopup) return;

    const history = getHistory();
    const listContainer = historyPopup.querySelector('.history-list');

    if (history.length === 0) {
        listContainer.innerHTML = `<div class="history-empty">${t('noHistory') || '暂无听写记录'}</div>`;
        return;
    }

    listContainer.innerHTML = history.map(record => {
        const displayName = record.cardName || record.firstWord || t('untitled') || '未命名';
        const timeStr = formatTimestamp(record.timestamp);
        const scoreStr = record.finalScore.toFixed(1);

        return `
            <div class="history-item" data-id="${record.id}">
                <div class="history-item-name">${displayName}</div>
                <div class="history-item-meta">
                    <span class="history-item-time">${timeStr}</span>
                    <span class="history-item-score">${t('score') || '分数'}: ${scoreStr}</span>
                </div>
            </div>
        `;
    }).join('');

    // 绑定点击事件
    listContainer.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.id;
            loadHistoryRecord(id);
            hideHistoryPopup();
        });
    });
}

/**
 * 显示历史记录弹窗
 * @param {HTMLElement} triggerButton - 触发按钮元素
 */
export function showHistoryPopup(triggerButton) {
    createHistoryPopup();
    updateHistoryList();

    // 定位到按钮下方
    const rect = triggerButton.getBoundingClientRect();
    historyPopup.style.top = `${rect.bottom + 5}px`;
    historyPopup.style.left = `${rect.left}px`;
    historyPopup.style.display = 'block';

    console.log('[HistoryUI] 显示历史记录弹窗');
}

/**
 * 隐藏历史记录弹窗
 */
export function hideHistoryPopup() {
    if (historyPopup) {
        historyPopup.style.display = 'none';
        console.log('[HistoryUI] 隐藏历史记录弹窗');
    }
}

/**
 * 加载历史记录并显示
 * @param {string} id - 记录ID
 */
function loadHistoryRecord(id) {
    const history = getHistory();
    const record = history.find(r => r.id === id);

    if (!record) {
        console.error('[HistoryUI] 未找到历史记录:', id);
        return;
    }

    console.log('[HistoryUI] 加载历史记录:', record);

    // 切换到听写视图
    showView('dictationView');
    document.body.classList.remove('repeater-mode');
    document.body.classList.add('dictation-mode');

    // 恢复 workplace 内容
    const wp = document.getElementById('dictationWorkplace');
    if (wp) {
        wp.innerHTML = record.workplaceHTML;
        console.log('[HistoryUI] 已恢复历史记录内容');
    }
}

/**
 * 初始化历史记录UI（绑定到听写按钮）
 */
export function initHistoryUI() {
    const dictationBtn = document.getElementById('dictation-btn');
    if (!dictationBtn) {
        console.warn('[HistoryUI] 未找到听写按钮');
        return;
    }

    // 鼠标悬浮显示历史记录
    let showTimer = null;
    dictationBtn.addEventListener('mouseenter', () => {
        showTimer = setTimeout(() => {
            showHistoryPopup(dictationBtn);
        }, 500); // 悬浮500ms后显示
    });

    dictationBtn.addEventListener('mouseleave', () => {
        if (showTimer) {
            clearTimeout(showTimer);
            showTimer = null;
        }
        // 延迟隐藏，给用户时间移动鼠标到弹窗
        setTimeout(() => {
            if (historyPopup && !historyPopup.matches(':hover')) {
                hideHistoryPopup();
            }
        }, 200);
    });

    // 弹窗本身的鼠标事件
    document.addEventListener('mouseover', (e) => {
        if (historyPopup && historyPopup.contains(e.target)) {
            // 鼠标在弹窗内，不隐藏
        } else if (historyPopup && historyPopup.style.display === 'block' && !dictationBtn.contains(e.target)) {
            // 鼠标不在按钮和弹窗上，隐藏
            hideHistoryPopup();
        }
    });

    console.log('[HistoryUI] 历史记录UI已初始化');
}
