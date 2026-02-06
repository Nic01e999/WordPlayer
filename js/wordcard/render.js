/**
 * 单词卡渲染模块
 * 渲染卡片和文件夹视图 - iOS SpringBoard 风格
 */

import { $, showView, escapeHtml, showToast } from '../utils.js';
import { getWordcards, loadWordcard, getCardColor, getFolders, getPublicFolders, addOrUpdateFolder } from './storage.js';
import { getLayout, saveLayout, deleteWordcard, deleteFolder, deletePublicFolderRef } from './layout.js';
import { resetDragEventFlags } from './drag.js';
import { showConfirm } from '../utils/dialog.js';
import { t } from '../i18n/index.js';
import { authToken } from '../auth/state.js';
import { isJustInteracted } from './interactions.js';
import { countWords, hexToRgba, generateGradient, generateFolderPreview } from './folder.js';

// 待同步的文件夹公开状态变更（内存缓存）
// 格式：{ folderName: isPublic }
let pendingPublicStatusChanges = {};

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

// 延迟绑定的函数引用（由 index.js 设置）
let _bindDragEvents = null;
let _exitEditMode = null;
let _isEditMode = null;
let _setCurrentWorkplace = null;
let _getDragState = null;
let _openFolder = null;
let _getCurrentUser = null;

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
    _getCurrentUser = deps.getCurrentUser;
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
 * 格式化日期
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString(navigator.language || 'en-US', { month: 'numeric', day: 'numeric' });
}

/**
 * 渲染单词卡
 */
export function renderWordcardCards() {
    const content = $("wordcardContent");
    if (!content) return;
    if (window.currentActiveMode) return;

    showView('homeView');

    const lists = getWordcards();
    const layout = getLayout();  // 字符串数组：["card_1", "folder_2", "public_3"]

    // 重置事件委托标记
    resetEventFlags();
    resetDragEventFlags();

    if (Object.keys(lists).length === 0) {
        content.innerHTML = `
            <div class="wordcard-empty">
                <p>${t('emptyTitle')}</p>
                <p class="hint">${t('emptyHint')}</p>
            </div>
        `;
        return;
    }

    // 建立 ID → 数据的映射
    const cardById = {};
    for (const card of Object.values(lists)) {
        if (card.id) cardById[card.id] = card;
    }

    const folders = getFolders();
    const folderById = {};
    for (const folder of Object.values(folders)) {
        if (folder.id) folderById[folder.id] = folder;
    }

    // 渲染卡片和文件夹（CSS Grid 自动布局）
    const cardsHtml = layout.map((item, idx) => {
        if (item.startsWith('card_')) {
            const cardId = parseInt(item.substring(5));
            const card = cardById[cardId];
            if (!card) return '';
            return renderCard(card, idx);
        } else if (item.startsWith('folder_')) {
            const folderId = parseInt(item.substring(7));
            const folder = folderById[folderId];
            if (!folder) return '';
            return renderFolder(folder, lists, idx);
        } else if (item.startsWith('public_')) {
            // 处理公开文件夹引用
            const refId = parseInt(item.substring(7)); // 提取 ref_id (如 "public_3" → 3)
            const publicFolderRef = getPublicFolders().find(ref => ref.id === refId);

            if (!publicFolderRef) {
                // 引用不存在，可能已被删除
                console.warn(`[Render] 公开文件夹引用不存在: ${item}`);
                return '';
            }

            return renderPublicFolder(publicFolderRef, idx);
        }
        return '';
    }).join('');

    content.innerHTML = `<div class="wordcard-grid">${cardsHtml}</div>`;

    bindCardEvents(content);
    if (_bindDragEvents) _bindDragEvents(content);

    // 如果还在编辑模式，重新应用到新渲染的元素
    if (_isEditMode && _isEditMode()) {
        if (_setCurrentWorkplace) _setCurrentWorkplace(content);
        const items = content.querySelectorAll('.wordcard-card, .wordcard-folder');
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
    const customColor = getCardColor(list.id);
    const [color1, color2] = generateGradient(list.name, customColor);

    return `
        <div class="wordcard-card"
             data-card-id="${list.id}"
             data-name="${escapeHtml(list.name)}"
             data-layout-idx="${layoutIdx}"
             data-type="card">
            <button class="wordcard-delete" data-name="${escapeHtml(list.name)}" title="Delete">&times;</button>
            <div class="wordcard-icon" style="background: linear-gradient(135deg, ${color1} 0%, ${color2} 100%)">
                <span class="wordcard-icon-count">${wordCount}</span>
            </div>
            <div class="wordcard-label">${escapeHtml(list.name)}</div>
        </div>
    `;
}

/**
 * 渲染文件夹 - iOS 风格 2x2 预览（CSS Grid 自动布局）
 */
function renderFolder(folder, lists, layoutIdx) {
    // 检查是否为公开文件夹（提前检查，因为预览生成需要用到）
    const isPublic = folder.is_public || false;

    // 建立 ID → 卡片的映射
    const cardById = {};
    for (const card of Object.values(lists)) {
        if (card.id) cardById[card.id] = card;
    }

    // 生成 2x2 迷你图标预览（使用统一的预览生成函数）
    const previewHtml = generateFolderPreview(folder.cards, cardById);

    // 公开文件夹图标和所有者信息
    // 区分发布者和添加者：
    // - 公开文件夹引用（有 ownerEmail）：一直显示 🌐
    // - 所有者的文件夹（无 ownerEmail）：添加可切换的图标（通过 CSS 控制显示/隐藏）
    let publicIcon = '';
    // 公开文件夹引用：一直显示 🌐
    if (isPublic && folder.ownerEmail) {
        publicIcon = '<span class="folder-public-icon">🌐</span>';
    }
    // 所有者的文件夹：添加可切换的图标（通过 CSS 控制显示/隐藏）
    else if (!folder.ownerEmail) {
        const icon = isPublic ? '📂' : '📁';
        publicIcon = `<span class="folder-public-icon folder-owner-toggle" data-folder-name="${escapeHtml(folder.name)}" data-is-public="${isPublic}">${icon}</span>`;
    }

    const ownerInfo = isPublic && folder.ownerEmail
        ? `<div class="folder-owner-info">👤 ${escapeHtml(folder.ownerEmail)}</div>`
        : '';

    return `
        <div class="wordcard-folder ${isPublic ? 'public-folder' : ''}"
             data-folder-id="${folder.id}"
             data-folder-name="${escapeHtml(folder.name)}"
             data-layout-idx="${layoutIdx}"
             data-type="folder"
             ${isPublic ? `data-public-folder-id="${folder.publicFolderId || ''}"` : ''}>
            <button class="wordcard-delete" data-folder-name="${escapeHtml(folder.name)}" title="Delete">&times;</button>
            <div class="wordcard-folder-icon">
                ${publicIcon}
                <div class="wordcard-folder-preview">${previewHtml}</div>
            </div>
            <div class="wordcard-label">${escapeHtml(folder.name)}</div>
            ${ownerInfo}
        </div>
    `;
}

/**
 * 渲染公开文件夹引用 - 根据角色显示不同图标
 * 发布者（owner）显示📂，添加者显示🌐
 */
function renderPublicFolder(publicFolderRef, layoutIdx) {
    const displayName = publicFolderRef.display_name || '未命名文件夹';
    const ownerName = publicFolderRef.owner_name || '未知作者';
    const previewCards = publicFolderRef.preview_cards || [];
    const isInvalid = publicFolderRef.isInvalid || false;

    // 判断当前用户是否为发布者
    const currentUserId = _getCurrentUser ? _getCurrentUser()?.id : null;
    const isOwner = currentUserId && publicFolderRef.owner_id === currentUserId;
    const folderIcon = isOwner ? '📂' : '🌐';
    const invalidClass = isInvalid ? 'folder-invalid' : '';

    // 生成 2x2 预览（使用统一的预览生成函数）
    const previewHtml = generateFolderPreview(previewCards);

    // 生成失效标签（使用国际化）
    const invalidBadge = isInvalid ? `<div class="folder-invalid-badge">${t('folderInvalid')}</div>` : '';

    return `
        <div class="wordcard-folder public-folder ${invalidClass}"
             data-public-ref-id="${publicFolderRef.id}"
             data-folder-id="${publicFolderRef.folder_id}"
             data-folder-name="${escapeHtml(displayName)}"
             data-layout-idx="${layoutIdx}"
             data-type="public-folder"
             data-owner-email="${escapeHtml(ownerName)}">
            <button class="wordcard-delete" data-folder-name="${escapeHtml(displayName)}" title="Delete">&times;</button>
            ${invalidBadge}
            <div class="wordcard-folder-icon">
                <span class="folder-public-icon">${folderIcon}</span>
                <div class="wordcard-folder-preview">${previewHtml}</div>
            </div>
            <div class="wordcard-label">${escapeHtml(displayName)}</div>
        </div>
    `;
}

/**
 * 绑定卡片事件（使用事件委托）
 */
function bindCardEvents(workplace) {
    const grid = workplace.querySelector('.wordcard-grid');
    if (!grid || cardEventsInitialized) return;
    cardEventsInitialized = true;

    grid.addEventListener('click', async (e) => {
        const dragState = _getDragState ? _getDragState() : null;

        // 所有者文件夹的公开状态切换图标点击（优先级最高，先检查）
        const toggleIcon = e.target.closest('.folder-owner-toggle');
        if (toggleIcon) {
            e.stopPropagation(); // 阻止事件冒泡
            e.preventDefault(); // 阻止默认行为
            const folderName = toggleIcon.dataset.folderName;
            console.log(`[公开状态] 点击切换图标: ${folderName}`);
            toggleFolderPublicStatus(folderName);
            return; // 立即返回，不继续处理其他事件
        }

        // 删除按钮
        const deleteBtn = e.target.closest('.wordcard-delete');
        if (deleteBtn) {
            e.stopPropagation();
            const name = deleteBtn.dataset.name;
            const folderName = deleteBtn.dataset.folderName;

            // 检查是否为公开文件夹引用
            const parentFolder = deleteBtn.closest('.wordcard-folder');
            if (parentFolder && parentFolder.dataset.type === 'public-folder') {
                // 删除公开文件夹引用
                const refId = parentFolder.dataset.publicRefId;
                handleDeletePublicFolderRef(parseInt(refId), folderName);
            } else if (folderName) {
                handleDeleteFolder(folderName);
            } else if (name) {
                handleDeleteCard(name);
            }
            return;
        }

        // 卡片点击
        const card = e.target.closest('.wordcard-card');
        if (card) {
            if (dragState?.didDrag) return;
            if (_isEditMode && _isEditMode()) return;

            const cardId = parseInt(card.dataset.cardId, 10);
            if (!cardId || isNaN(cardId)) {
                console.error('[Render] 卡片缺少有效ID，无法加载');
                return;
            }

            await loadWordcard(cardId);
            return;
        }

        // 文件夹点击
        const folder = e.target.closest('.wordcard-folder');
        if (folder) {
            if (dragState?.didDrag) return;

            // 如果刚刚交互过（长按），不打开
            if (isJustInteracted(folder)) {
                console.log('[Render] 文件夹刚刚长按过，跳过打开操作');
                return;
            }

            // 检查是否为公开文件夹引用
            const folderType = folder.dataset.type;
            if (folderType === 'public-folder') {
                // 打开公开文件夹引用
                const folderId = folder.dataset.folderId;
                const displayName = folder.dataset.folderName;
                const ownerEmail = folder.dataset.ownerEmail;

                // 动态导入 openPublicFolderRef 函数
                import('./folder.js').then(module => {
                    module.openPublicFolderRef(parseInt(folderId), displayName, ownerEmail);
                });
            } else {
                // 打开普通文件夹
                if (_openFolder) _openFolder(folder.dataset.folderName);
            }
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
        renderWordcardCards();
    }
}

/**
 * 处理删除公开文件夹引用（异步弹窗）
 */
async function handleDeletePublicFolderRef(refId, displayName) {
    const confirmed = await showConfirm(t('deleteFolder', { name: displayName }));
    if (confirmed) {
        try {
            await deletePublicFolderRef(refId, displayName);

            // 删除成功后，先退出编辑模式
            if (_exitEditMode) _exitEditMode();

            // 然后重新渲染
            renderWordcardCards();

            // 显示成功提示
            showToast(t('deleteSuccess') || '删除成功', 'success');
        } catch (error) {
            console.error('[Render] 删除公开文件夹失败:', error);
            console.error('[Server] 删除公开文件夹失败:', error);

            // 显示错误提示
            showToast(error.message || t('deleteFailed') || '删除失败', 'error');

            // 即使失败也重新渲染，以恢复UI状态
            renderWordcardCards();
        }
    }
}

/**
 * 处理删除卡片（异步弹窗）
 */
async function handleDeleteCard(name) {
    const confirmed = await showConfirm(t('deleteCard', { name }));
    if (confirmed) {
        await deleteWordcard(name);
        if (_exitEditMode) _exitEditMode();
        renderWordcardCards();
    }
}

/**
 * 切换文件夹公开状态（仅更新本地状态）
 */
function toggleFolderPublicStatus(folderName) {
    const folders = getFolders();
    const folder = folders[folderName];
    if (!folder) {
        console.error(`[公开状态] 文件夹不存在: ${folderName}`);
        return;
    }

    // 切换状态
    const newStatus = !folder.is_public;
    folder.is_public = newStatus;

    // 更新缓存
    addOrUpdateFolder(folderName, folder);

    // 记录待同步的变更
    pendingPublicStatusChanges[folderName] = newStatus;

    console.log(`[公开状态] 本地切换: ${folderName}, is_public=${newStatus}`);
    console.log(`[Server] 本地切换: ${folderName}, is_public=${newStatus}`);

    // 重新渲染（更新图标）
    renderWordcardCards();
}

/**
 * 同步所有待处理的公开状态变更到服务器
 */
export async function syncPendingPublicStatusChanges() {
    if (Object.keys(pendingPublicStatusChanges).length === 0) {
        console.log('[公开状态] 没有待同步的变更');
        return;
    }

    const token = authToken;
    if (!token) {
        console.warn('[公开状态] 未登录，无法同步');
        pendingPublicStatusChanges = {};
        return;
    }

    console.log('[公开状态] 开始同步变更:', pendingPublicStatusChanges);
    console.log('[Server] 开始同步变更:', pendingPublicStatusChanges);

    // 批量同步
    const promises = Object.entries(pendingPublicStatusChanges).map(async ([folderName, isPublic]) => {
        try {
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
                throw new Error(`同步失败: ${folderName}`);
            }

            const data = await response.json();
            console.log(`[公开状态] 同步成功: ${folderName}, is_public=${isPublic}`);
            console.log(`[Server] 同步成功: ${folderName}, is_public=${isPublic}`);

            // 更新 layout（如果服务器返回）
            if (data.layout) {
                saveLayout(data.layout);
            }

            return { success: true, folderName };
        } catch (error) {
            console.error(`[公开状态] 同步失败: ${folderName}`, error);
            console.error(`[Server] 同步失败: ${folderName}`, error);
            return { success: false, folderName, error };
        }
    });

    const results = await Promise.all(promises);

    // 清空待同步列表
    pendingPublicStatusChanges = {};

    // 检查是否有失败的
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
        showToast(`部分文件夹同步失败: ${failures.map(f => f.folderName).join(', ')}`, 'error');
    } else {
        console.log('[公开状态] 所有变更已同步');
        console.log('[Server] 所有变更已同步');
    }

    // 重新渲染以确保 UI 一致
    renderWordcardCards();
}

/**
 * 清空待同步的公开状态变更
 */
export function clearPendingPublicStatusChanges() {
    pendingPublicStatusChanges = {};
    console.log('[公开状态] 已清空待同步变更');
}

