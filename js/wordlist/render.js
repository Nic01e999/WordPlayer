/**
 * 单词表渲染模块
 * 渲染卡片和文件夹视图 - iOS SpringBoard 风格
 */

import { $, showView, escapeHtml } from '../utils.js';
import { getWordLists, loadWordList, getCardColor } from './storage.js';
import { getLayout, deleteWordList, deleteFolder } from './layout.js';
import { resetDragEventFlags } from './drag.js';
import { showConfirm } from '../utils/dialog.js';
import { t } from '../i18n/index.js';

/**
 * 主题色配置 - 根据当前主题自动获取
 */
export const THEME_COLORS = {
    pink:   { light: ['#ffb6c1', '#ffc1cc'], dark: ['#ff8fa0', '#ff9faf'] },
    green:  { light: ['#50c878', '#6bd98b'], dark: ['#50c878', '#6bd98b'] },
    blue:   { light: ['#4da6ff', '#6bb5ff'], dark: ['#4da6ff', '#6bb5ff'] },
    purple: { light: ['#a855f7', '#b96ef8'], dark: ['#a855f7', '#b96ef8'] },
};

/**
 * 获取当前主题色
 */
export function getCurrentThemeColors() {
    const themeColor = document.documentElement.dataset.themeColor || 'pink';
    const themeMode = document.documentElement.dataset.themeMode || 'light';
    return THEME_COLORS[themeColor]?.[themeMode] || THEME_COLORS.pink.light;
}

/**
 * 卡片颜色配置 - 14种颜色（原色 + 13种预设）
 * 原色 = 跟随主题变化的颜色
 */
export const CARD_COLORS = [
    { id: 'original', label: '原色', colors: null, isOriginal: true },
    { id: 'red', label: '红橙', colors: ['#FF6B6B', '#FF8E53'] },
    { id: 'cyan', label: '青绿', colors: ['#4ECDC4', '#44A08D'] },
    { id: 'purple', label: '紫蓝', colors: ['#667EEA', '#764BA2'] },
    { id: 'pink', label: '粉红', colors: ['#F093FB', '#F5576C'] },
    { id: 'blue', label: '蓝青', colors: ['#4FACFE', '#00F2FE'] },
    { id: 'green', label: '绿青', colors: ['#43E97B', '#38F9D7'] },
    { id: 'gold', label: '粉黄', colors: ['#FA709A', '#FEE140'] },
    { id: 'pastel1', label: '淡青粉', colors: ['#A8EDEA', '#FED6E3'] },
    { id: 'pastel2', label: '淡粉', colors: ['#FF9A9E', '#FECFEF'] },
    { id: 'pastel3', label: '淡紫粉', colors: ['#A18CD1', '#FBC2EB'] },
    { id: 'navy', label: '金蓝', colors: ['#FFD89B', '#19547B'] },
    { id: 'lime', label: '绿黄', colors: ['#96FBC4', '#F9F586'] },
    { id: 'slate', label: '灰蓝', colors: ['#667db6', '#0082c8'] },
];

/**
 * hex 转 rgba
 */
function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 根据名称生成渐变色
 * 原色（null 或 'original'）= 当前主题色
 * 其他 colorId = 对应预设颜色
 */
function generateGradient(name, customColorId = null) {
    // 原色 = 使用当前主题色
    if (!customColorId || customColorId === 'original') {
        const themeColors = getCurrentThemeColors();
        return themeColors.map(c => hexToRgba(c, 0.75));
    }

    // 其他自定义颜色
    const colorConfig = CARD_COLORS.find(c => c.id === customColorId);
    if (colorConfig && colorConfig.colors) {
        return colorConfig.colors.map(c => hexToRgba(c, 0.75));
    }

    // 找不到配置，回退到主题色
    const themeColors = getCurrentThemeColors();
    return themeColors.map(c => hexToRgba(c, 0.75));
}

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
    resetDragEventFlags();

    if (Object.keys(lists).length === 0) {
        content.innerHTML = `
            <div class="wordlist-empty">
                <p>${t('emptyTitle')}</p>
                <p class="hint">${t('emptyHint')}</p>
            </div>
        `;
        return;
    }

    // 渲染卡片和文件夹（CSS Grid 自动布局）
    const cardsHtml = layout.items.map((item, idx) => {
        if (item.type === 'card') {
            const list = lists[item.name];
            if (!list) return '';
            return renderCard(list, idx);
        } else if (item.type === 'folder') {
            return renderFolder(item, lists, idx);
        }
        return '';
    }).join('');

    content.innerHTML = `<div class="wordlist-grid">${cardsHtml}</div>`;

    bindCardEvents(content);
    if (_bindDragEvents) _bindDragEvents(content);

    // 如果还在编辑模式，重新应用到新渲染的元素
    if (_isEditMode && _isEditMode()) {
        if (_setCurrentWorkplace) _setCurrentWorkplace(content);
        const items = content.querySelectorAll('.wordlist-card, .wordlist-folder');
        items.forEach(item => {
            // 强制重启动画，避免动画状态不同步
            item.style.animation = 'none';
            item.offsetHeight; // 强制 reflow
            item.style.animation = '';
            item.classList.add('edit-mode');
        });
    }
}

/**
 * 渲染单个卡片 - iOS App 图标风格（CSS Grid 自动布局）
 */
function renderCard(list, layoutIdx) {
    const wordCount = countWords(list.words);
    const customColor = getCardColor(list.name);
    const [color1, color2] = generateGradient(list.name, customColor);

    return `
        <div class="wordlist-card" data-name="${escapeHtml(list.name)}" data-layout-idx="${layoutIdx}" data-type="card">
            <button class="wordlist-delete" data-name="${escapeHtml(list.name)}" title="Delete">&times;</button>
            <div class="wordlist-icon" style="background: linear-gradient(135deg, ${color1} 0%, ${color2} 100%)">
                <span class="wordlist-icon-count">${wordCount}</span>
            </div>
            <div class="wordlist-label">${escapeHtml(list.name)}</div>
        </div>
    `;
}

/**
 * 渲染文件夹 - iOS 风格 2x2 预览（CSS Grid 自动布局）
 */
function renderFolder(folder, lists, layoutIdx) {
    // 生成 2x2 迷你图标预览
    const previewItems = folder.items.slice(0, 4).map(name => {
        const list = lists[name];
        if (!list) return '<div class="wordlist-folder-mini"></div>';
        const customColor = getCardColor(name);
        const [color1, color2] = generateGradient(name, customColor);
        return `<div class="wordlist-folder-mini" style="background: linear-gradient(135deg, ${color1} 0%, ${color2} 100%)"></div>`;
    }).join('');

    // 补全到 4 个空位
    const emptySlots = Math.max(0, 4 - folder.items.length);
    const emptyHtml = '<div class="wordlist-folder-mini empty"></div>'.repeat(emptySlots);

    return `
        <div class="wordlist-folder" data-folder-name="${escapeHtml(folder.name)}" data-layout-idx="${layoutIdx}" data-type="folder">
            <button class="wordlist-delete" data-folder-name="${escapeHtml(folder.name)}" title="Delete">&times;</button>
            <div class="wordlist-folder-icon">
                <div class="wordlist-folder-preview">${previewItems}${emptyHtml}</div>
            </div>
            <div class="wordlist-label">${escapeHtml(folder.name)}</div>
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

    grid.addEventListener('click', async (e) => {
        const dragState = _getDragState ? _getDragState() : null;

        // 删除按钮
        const deleteBtn = e.target.closest('.wordlist-delete');
        if (deleteBtn) {
            e.stopPropagation();
            const name = deleteBtn.dataset.name;
            const folderName = deleteBtn.dataset.folderName;

            if (folderName) {
                handleDeleteFolder(folderName);
            } else if (name) {
                handleDeleteCard(name);
            }
            return;
        }

        // 卡片点击
        const card = e.target.closest('.wordlist-card');
        if (card) {
            if (dragState?.didDrag) return;
            if (_isEditMode && _isEditMode()) return;
            await loadWordList(card.dataset.name);
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

/**
 * 处理删除文件夹（异步弹窗）
 */
async function handleDeleteFolder(folderName) {
    const confirmed = await showConfirm(t('deleteFolder', { name: folderName }));
    if (confirmed) {
        await deleteFolder(folderName);
        if (_exitEditMode) _exitEditMode();
        renderWordListCards();
    }
}

/**
 * 处理删除卡片（异步弹窗）
 */
async function handleDeleteCard(name) {
    const confirmed = await showConfirm(t('deleteCard', { name }));
    if (confirmed) {
        await deleteWordList(name);
        if (_exitEditMode) _exitEditMode();
        renderWordListCards();
    }
}
