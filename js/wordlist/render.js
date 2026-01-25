/**
 * 单词表渲染模块
 * 渲染卡片和文件夹视图
 */

import { $, showView, escapeHtml } from '../utils.js';
import { getWordLists, loadWordList } from './storage.js';
import { getLayout, deleteWordList, deleteFolder } from './layout.js';

// 延迟绑定的函数引用（由 index.js 设置）
let _bindDragEvents = null;
let _exitEditMode = null;
let _isEditMode = null;
let _setCurrentWorkplace = null;
let _getDragState = null;
let _openFolder = null;

/**
 * 设置延迟绑定的函数
 */
export function setRenderDeps(deps) {
    _bindDragEvents = deps.bindDragEvents;
    _exitEditMode = deps.exitEditMode;
    _isEditMode = deps.isEditMode;
    _setCurrentWorkplace = deps.setCurrentWorkplace;
    _getDragState = deps.getDragState;
    _openFolder = deps.openFolder;
}

// 事件委托标记
let cardEventsInitialized = false;

/**
 * 重置事件标记（在重新渲染时调用）
 */
export function resetEventFlags() {
    cardEventsInitialized = false;
}

/**
 * 统计单词数量
 */
function countWords(words) {
    return words.split(/\r?\n/).filter(line => line.trim()).length;
}

/**
 * 格式化日期
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString(navigator.language || 'en-US', { month: 'numeric', day: 'numeric' });
}

/**
 * 渲染单词表卡片
 */
export function renderWordListCards() {
    const content = $("wordlistContent");
    if (!content) return;
    if (window.currentActiveMode) return;

    showView('homeView');

    const lists = getWordLists();
    const layout = getLayout();

    // 重置事件委托标记
    resetEventFlags();

    if (Object.keys(lists).length === 0) {
        content.innerHTML = `
            <div class="wordlist-empty">
                <p>No saved word lists</p>
                <p class="hint">Enter words in the sidebar and click Save</p>
            </div>
        `;
        return;
    }

    content.innerHTML = `<div class="wordlist-grid">${layout.map((item, idx) => {
        if (item.type === 'card') {
            const list = lists[item.name];
            if (!list) return '';
            return renderCard(list, idx);
        } else if (item.type === 'folder') {
            return renderFolder(item, lists, idx);
        }
        return '';
    }).join('')}</div>`;

    bindCardEvents(content);
    if (_bindDragEvents) _bindDragEvents(content);

    // 如果还在编辑模式，重新应用到新渲染的元素
    if (_isEditMode && _isEditMode()) {
        if (_setCurrentWorkplace) _setCurrentWorkplace(content);
        const items = content.querySelectorAll('.wordlist-card, .wordlist-folder');
        items.forEach(item => item.classList.add('edit-mode'));
    }
}

/**
 * 渲染单个卡片
 */
function renderCard(list, layoutIdx) {
    return `
        <div class="wordlist-card" data-name="${escapeHtml(list.name)}" data-layout-idx="${layoutIdx}" data-type="card">
            <button class="wordlist-delete" data-name="${escapeHtml(list.name)}" title="Delete">&times;</button>
            <div class="wordlist-card-header">
                <span class="wordlist-name">${escapeHtml(list.name)}</span>
            </div>
            <div class="wordlist-info">
                <span>${countWords(list.words)} words</span>
                <span>${formatDate(list.updated || list.created)}</span>
            </div>
        </div>
    `;
}

/**
 * 渲染文件夹
 */
function renderFolder(folder, lists, layoutIdx) {
    const previewItems = folder.items.slice(0, 4).map(name => {
        const list = lists[name];
        return `<div class="wordlist-folder-preview-item">${escapeHtml(list ? list.name : name)}</div>`;
    }).join('');
    // 补全到 4 个空位
    const emptySlots = Math.max(0, 4 - folder.items.length);
    const emptyHtml = '<div class="wordlist-folder-preview-item"></div>'.repeat(emptySlots);

    return `
        <div class="wordlist-folder" data-folder-name="${escapeHtml(folder.name)}" data-layout-idx="${layoutIdx}" data-type="folder">
            <button class="wordlist-delete" data-folder-name="${escapeHtml(folder.name)}" title="Delete">&times;</button>
            <div class="wordlist-folder-preview">${previewItems}${emptyHtml}</div>
            <div class="wordlist-folder-name">${escapeHtml(folder.name)}</div>
            <div class="wordlist-folder-count">${folder.items.length} lists</div>
        </div>
    `;
}

/**
 * 绑定卡片事件（使用事件委托）
 */
function bindCardEvents(workplace) {
    const grid = workplace.querySelector('.wordlist-grid');
    if (!grid || cardEventsInitialized) return;
    cardEventsInitialized = true;

    grid.addEventListener('click', (e) => {
        const dragState = _getDragState ? _getDragState() : null;

        // 删除按钮
        const deleteBtn = e.target.closest('.wordlist-delete');
        if (deleteBtn) {
            e.stopPropagation();
            const name = deleteBtn.dataset.name;
            const folderName = deleteBtn.dataset.folderName;

            if (folderName) {
                if (confirm(`Delete folder "${folderName}" and all its contents?`)) {
                    deleteFolder(folderName);
                    if (_exitEditMode) _exitEditMode();
                    renderWordListCards();
                }
            } else if (name) {
                if (confirm(`Delete "${name}"?`)) {
                    deleteWordList(name);
                    if (_exitEditMode) _exitEditMode();
                    renderWordListCards();
                }
            }
            return;
        }

        // 卡片点击
        const card = e.target.closest('.wordlist-card');
        if (card) {
            if (dragState?.didDrag) return;
            if (_isEditMode && _isEditMode()) return;
            loadWordList(card.dataset.name);
            return;
        }

        // 文件夹点击
        const folder = e.target.closest('.wordlist-folder');
        if (folder) {
            if (dragState?.didDrag) return;
            if (_isEditMode && _isEditMode()) return;
            if (_openFolder) _openFolder(folder.dataset.folderName);
            return;
        }

        // 点击空白区域退出编辑模式
        if (e.target === grid || e.target === workplace) {
            if (_exitEditMode) _exitEditMode();
        }
    });
}
