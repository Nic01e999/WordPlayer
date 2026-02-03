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
import { showContextMenu } from '../utils/context-menu.js';
import { authToken } from '../auth/state.js';
import { showToast } from '../utils.js';

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
    { id: 'blue', label: '蓝青', colors: ['#b268cb78', '#ffb5ed'] },
    { id: 'pastel2', label: '淡粉', colors: ['#fb7eac', '#f3acdc'] },
    { id: 'pastel3', label: '淡紫粉', colors: ['#c8b0ff', '#ff48b0a7'] },
    { id: 'pink', label: '粉红', colors: ['#F093FB', '#F5576C'] },
    { id: 'purple', label: '紫蓝', colors: ['#9daced', '#d561e4'] },
    { id: 'cyan', label: '青绿', colors: ['#8aeee7', '#a055e1'] },
    { id: 'slate', label: '灰蓝', colors: ['#434ff2', '#71cdff'] },
    { id: 'navy', label: '金蓝', colors: ['#FFD89B', '#79c9fe'] },
    { id: 'pastel1', label: '淡青粉', colors: ['#A8EDEA', '#FED6E3'] },
    { id: 'green', label: '绿青', colors: ['#81ffc2', '#26d5d5'] },
    { id: 'lime', label: '绿黄', colors: ['#80e2ac', '#f2f461'] },
    { id: 'red', label: '红橙', colors: ['#FF6B6B', '#7cebff'] },
    { id: 'gold', label: '粉黄', colors: ['#FA709A', '#FEE140'] },
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

    // 检查是否为公开文件夹
    const isPublic = folder.isPublic || false;
    const publicIcon = isPublic ? '<span class="folder-public-icon">🌐</span>' : '';
    const ownerInfo = isPublic && folder.ownerEmail
        ? `<div class="folder-owner-info">👤 ${escapeHtml(folder.ownerEmail)}</div>`
        : '';

    return `
        <div class="wordlist-folder ${isPublic ? 'public-folder' : ''}"
             data-folder-name="${escapeHtml(folder.name)}"
             data-layout-idx="${layoutIdx}"
             data-type="folder"
             ${isPublic ? `data-public-folder-id="${folder.publicFolderId || ''}"` : ''}>
            <button class="wordlist-delete" data-folder-name="${escapeHtml(folder.name)}" title="Delete">&times;</button>
            <div class="wordlist-folder-icon">
                ${publicIcon}
                <div class="wordlist-folder-preview">${previewItems}${emptyHtml}</div>
            </div>
            <div class="wordlist-label">${escapeHtml(folder.name)}</div>
            ${ownerInfo}
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

    // 添加右键菜单事件
    grid.addEventListener('contextmenu', (e) => {
        // 只在非编辑模式下显示右键菜单
        if (_isEditMode && _isEditMode()) return;

        const folder = e.target.closest('.wordlist-folder');
        if (folder) {
            e.preventDefault();
            e.stopPropagation();
            handleFolderContextMenu(folder, e.clientX, e.clientY);
            return;
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

/**
 * 处理文件夹右键菜单
 */
async function handleFolderContextMenu(folderElement, x, y) {
    const folderName = folderElement.dataset.folderName;
    const isPublic = folderElement.classList.contains('public-folder');
    const publicFolderId = folderElement.dataset.publicFolderId;

    const menuItems = [];

    if (isPublic && publicFolderId) {
        // 这是别人的公开文件夹
        menuItems.push({
            label: t('createCopy') || '创建副本',
            icon: '📋',
            action: () => handleCopyPublicFolder(publicFolderId, folderName)
        });
    } else {
        // 这是自己的文件夹
        // 检查是否已公开
        const isPublished = await checkFolderPublicStatus(folderName);

        if (isPublished) {
            menuItems.push({
                label: t('unpublishFolder') || '取消公开',
                icon: '🔒',
                action: () => handleToggleFolderPublic(folderName, false)
            });
        } else {
            menuItems.push({
                label: t('publishFolder') || '设为公开',
                icon: '🌐',
                action: () => handleToggleFolderPublic(folderName, true)
            });
        }

        menuItems.push({
            label: t('createCopy') || '创建副本',
            icon: '📋',
            action: () => handleCopyOwnFolder(folderName)
        });
    }

    showContextMenu(menuItems, x, y);
}

/**
 * 检查文件夹是否已公开
 */
async function checkFolderPublicStatus(folderName) {
    try {
        const token = authToken;
        if (!token) return false;

        const response = await fetch('/api/public/folder/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ folderName })
        });

        if (!response.ok) return false;

        const data = await response.json();
        return data.isPublic || false;
    } catch (error) {
        console.error('[右键菜单] 检查公开状态失败:', error);
        return false;
    }
}

/**
 * 切换文件夹公开状态
 */
async function handleToggleFolderPublic(folderName, isPublic) {
    try {
        const token = authToken;
        if (!token) {
            showToast(t('pleaseLogin') || '请先登录', 'error');
            return;
        }

        const response = await fetch('/api/public/folder/set', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                folderName,
                isPublic,
                description: ''
            })
        });

        if (!response.ok) {
            let errorMsg = '操作失败';
            try {
                const error = await response.json();
                errorMsg = error.error || errorMsg;
            } catch (e) {
                // 无法解析 JSON，使用默认错误信息
                console.error('[右键菜单] 无法解析错误响应:', e);
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();

        if (isPublic) {
            showToast(t('folderPublished') || '文件夹已设为公开', 'success');
            console.log(`[右键菜单] 文件夹 "${folderName}" 已设为公开 (ID: ${data.publicFolderId})`);
        } else {
            showToast(t('folderUnpublished') || '文件夹已取消公开', 'success');
            console.log(`[右键菜单] 文件夹 "${folderName}" 已取消公开`);
        }
    } catch (error) {
        console.error('[右键菜单] 切换公开状态失败:', error);
        showToast(error.message || t('operationFailed') || '操作失败', 'error');
    }
}

/**
 * 复制公开文件夹
 */
async function handleCopyPublicFolder(publicFolderId, originalName) {
    try {
        const token = authToken;
        if (!token) {
            showToast(t('pleaseLogin') || '请先登录', 'error');
            return;
        }

        // 生成新文件夹名称
        const newFolderName = `${originalName} (副本)`;

        const response = await fetch('/api/public/folder/copy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                publicFolderId: parseInt(publicFolderId),
                newFolderName
            })
        });

        if (!response.ok) {
            let errorMsg = '复制失败';
            try {
                const error = await response.json();
                errorMsg = error.error || errorMsg;
            } catch (e) {
                // 无法解析 JSON，使用默认错误信息
                console.error('[右键菜单] 无法解析错误响应:', e);
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();

        // 重新渲染主页
        renderWordListCards();

        showToast(t('folderCopyCreated') || '已创建副本', 'success');
        console.log(`[右键菜单] 已创建公开文件夹副本: ${newFolderName}`);
    } catch (error) {
        console.error('[右键菜单] 复制公开文件夹失败:', error);
        showToast(error.message || t('copyFailed') || '复制失败', 'error');
    }
}

/**
 * 复制自己的文件夹
 */
async function handleCopyOwnFolder(folderName) {
    // TODO: 实现复制自己文件夹的逻辑
    showToast('此功能即将推出', 'info');
    console.log(`[右键菜单] 复制自己的文件夹: ${folderName}`);
}

