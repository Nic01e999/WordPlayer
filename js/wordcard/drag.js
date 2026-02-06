/**
 * 单词卡拖拽系统模块 - iOS SpringBoard 风格
 * 处理卡片和文件夹的拖拽排序（CSS Grid + DOM 重排）
 */

import { getLayout, saveLayout, isFolderNameExists, syncLayoutToServer } from './layout.js';
import { syncLayoutToCloud } from '../auth/sync.js';
import { showPrompt, showAlert } from '../utils/dialog.js';
import { showColorPicker, hideColorPicker, hasOpenColorPicker } from './colorpicker.js';
import { showSavingIndicator, hideSavingIndicator, showToast } from '../utils.js';
import { t } from '../i18n/index.js';
import { bindPointerInteraction, isJustInteracted } from './interactions.js';
import { isLoggedIn } from '../auth/state.js';
import { addOrUpdateFolder, getWordcards, getFolders, getCardColors } from './storage.js';

// 拖拽状态
let dragState = null;

// 编辑模式状态
let editMode = false;
let currentWorkplace = null;

// 事件委托标记
let dragEventsInitialized = false;
let globalTapHandlerInitialized = false;

// 延迟绑定的函数引用
let _renderWordcardCards = null;
let _syncPendingPublicStatusChanges = null;

/**
 * 设置延迟绑定的函数
 */
export function setDragDeps(deps) {
    _renderWordcardCards = deps.renderWordcardCards;
    _syncPendingPublicStatusChanges = deps.syncPendingPublicStatusChanges;
}

/**
 * 重置拖拽事件标记
 */
export function resetDragEventFlags() {
    dragEventsInitialized = false;
}

/**
 * 获取拖拽状态
 */
export function getDragState() {
    return dragState;
}

/**
 * 检查是否处于编辑模式
 */
export function isEditMode() {
    return editMode;
}

/**
 * 设置当前工作区
 */
export function setCurrentWorkplace(workplace) {
    currentWorkplace = workplace;
}

/**
 * 全局点击处理 - 点击非卡片区域退出编辑模式
 */
function handleGlobalTap(e) {
    // 如果点击在颜色选择器上，不处理
    if (e.target.closest('.color-picker-donut')) {
        return;
    }
    if (e.target.closest('.wordcard-card, .wordcard-folder, .wordcard-delete')) {
        return;
    }

    // 检查是否在文件夹内部（文件夹视图区域）
    const folderContent = e.target.closest('.folder-open-view');
    if (folderContent) {
        // 点击文件夹内部空白
        console.log('[Drag] 点击文件夹内部空白');
        hideColorPicker();
        if (editMode) {
            // 编辑模式：退出编辑模式，文件夹保持打开
            console.log('[Drag] 编辑模式下，退出编辑模式但保持文件夹打开');
            exitEditMode();
        }
        return;
    }

    // 检查是否在文件夹overlay背景上（文件夹外部空间）
    const folderOverlay = e.target.closest('.folder-open-overlay');
    if (folderOverlay && e.target === folderOverlay) {
        // 点击文件夹外部空间
        console.log('[Drag] 点击文件夹外部空间');
        hideColorPicker();
        if (editMode) {
            // 编辑模式：关闭文件夹，保持编辑模式
            console.log('[Drag] 编辑模式下，关闭文件夹但保持编辑模式');
            folderOverlay.remove();
        } else {
            // 非编辑模式：直接关闭文件夹
            console.log('[Drag] 非编辑模式下关闭文件夹');
            folderOverlay.remove();
        }
        return;
    }

    // 桌面点击空白
    console.log('[Drag] 点击桌面空白');
    hideColorPicker();
    if (editMode) {
        console.log('[Drag] 编辑模式下，退出编辑模式');
        exitEditMode();
    }
}

/**
 * 初始化全局点击处理器
 */
export function initGlobalTapHandler() {
    if (globalTapHandlerInitialized) return;
    globalTapHandlerInitialized = true;
    document.addEventListener('pointerdown', handleGlobalTap);
    console.log('[Drag] 全局点击处理器已初始化');
}

/**
 * 进入编辑模式 - 所有卡片开始抖动
 */
export function enterEditMode(workplace) {
    if (editMode) return;
    editMode = true;
    currentWorkplace = workplace;
    const items = workplace.querySelectorAll('.wordcard-card, .wordcard-folder');
    items.forEach(item => item.classList.add('edit-mode'));

    // 检查是否有打开的文件夹overlay
    const folderOverlay = document.querySelector('.folder-open-overlay');
    if (folderOverlay && !folderOverlay.querySelector('.readonly')) {
        // 给文件夹内的卡片也添加edit-mode
        folderOverlay.querySelectorAll('.wordcard-card').forEach(card => {
            card.classList.add('edit-mode');
        });
    }

    if (navigator.vibrate) {
        navigator.vibrate(10);
    }
}

/**
 * 退出编辑模式 - 停止抖动，上传布局到服务端
 */
export async function exitEditMode() {
    if (!editMode) return;
    editMode = false;

    // 关闭颜色选择器
    hideColorPicker();

    if (currentWorkplace) {
        const items = currentWorkplace.querySelectorAll('.wordcard-card, .wordcard-folder');
        items.forEach(item => {
            item.classList.remove('edit-mode');
        });
    }

    // 移除文件夹内的edit-mode
    const folderOverlay = document.querySelector('.folder-open-overlay');
    if (folderOverlay) {
        folderOverlay.querySelectorAll('.wordcard-card').forEach(card => {
            card.classList.remove('edit-mode');
        });
    }

    currentWorkplace = null;

    // 退出编辑模式时同步公开状态变更和布局到服务端（仅在已登录时）
    if (isLoggedIn()) {
        console.log('[Drag] 退出编辑模式，开始保存...');

        // 显示保存指示器
        showSavingIndicator();

        // 先同步公开状态变更
        if (_syncPendingPublicStatusChanges) {
            await _syncPendingPublicStatusChanges();
        }

        // 再同步布局
        const result = await syncLayoutToServer();

        // 隐藏指示器
        hideSavingIndicator();

        // 显示结果提示（仅保留错误提示）
        if (result.success) {
            console.log('[Drag] 保存成功');
            // 移除toast提示以保持界面清爽
        } else if (result.error) {
            console.error('[Drag] 保存失败:', result.error);
            showToast(`保存失败: ${result.error}`, 'error', 10000);
        }
    } else {
        console.log('[Drag] 退出编辑模式，未登录状态，跳过保存');
    }
}

/**
 * 绑定拖拽事件 - 使用统一交互管理
 */
export function bindDragEvents(workplace) {
    const grid = workplace.querySelector('.wordcard-grid');
    if (!grid || dragEventsInitialized) return;
    dragEventsInitialized = true;

    const items = workplace.querySelectorAll('.wordcard-card, .wordcard-folder');

    items.forEach(item => {
        const isCard = item.dataset.type === 'card';

        // 统一绑定，在onClick内部根据editMode决定行为
        bindPointerInteraction(item, {
            onLongPress: (el) => {
                enterEditMode(workplace);
                if (isCard) {
                    showColorPicker(el);
                }
            },
            onDrag: (el, startEvent) => {
                hideColorPicker();
                startDrag(startEvent, el, workplace);
            },
            onClick: (el) => {
                if (isCard) {
                    if (editMode) {
                        // 编辑模式：打开/关闭色环
                        if (hasOpenColorPicker()) {
                            hideColorPicker();
                        } else {
                            showColorPicker(el);
                        }
                        console.log('[Drag] 编辑模式下点击单词卡，打开色环');
                    }
                    // 非编辑模式：由render.js的click监听器处理（加载单词卡）
                } else {
                    // 文件夹：由render.js的click监听器处理（打开文件夹）
                    // 编辑模式下不处理，保持抖动状态
                }
            }
        });
    });
}

/**
 * 根据鼠标位置计算插入索引
 */
function calculateInsertIndex(e, grid, draggedEl) {
    const items = Array.from(grid.querySelectorAll('.wordcard-card, .wordcard-folder'));
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item === draggedEl) continue;

        const rect = item.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // 如果鼠标在此项目的左侧或上方，插入到此位置
        if (mouseY < centerY - rect.height / 4) {
            return i;
        }
        if (mouseY < centerY + rect.height / 4 && mouseX < centerX) {
            return i;
        }
    }

    return items.length;  // 末尾
}

/**
 * DOM 重排实现让位效果（FLIP 动画）
 */
function reorderDOM(grid, draggedEl, targetIdx) {
    const items = Array.from(grid.querySelectorAll('.wordcard-card, .wordcard-folder'));
    const currentIdx = items.indexOf(draggedEl);

    if (currentIdx === targetIdx || currentIdx === -1) return;

    // 1. First - 记录所有元素初始位置
    const firstRects = new Map();
    items.forEach(item => {
        if (item !== draggedEl) {
            firstRects.set(item, item.getBoundingClientRect());
        }
    });

    // 2. 执行 DOM 重排
    if (targetIdx >= items.length) {
        grid.appendChild(draggedEl);
    } else {
        const targetEl = items[targetIdx];
        if (targetEl !== draggedEl) {
            grid.insertBefore(draggedEl, targetEl);
        }
    }

    // 3. Last & Invert & Play - FLIP 动画
    firstRects.forEach((firstRect, item) => {
        const lastRect = item.getBoundingClientRect();
        const dx = firstRect.left - lastRect.left;
        const dy = firstRect.top - lastRect.top;

        if (dx !== 0 || dy !== 0) {
            // Invert - 用 transform 移回原位
            item.style.transform = `translate(${dx}px, ${dy}px)`;
            item.style.transition = 'none';

            // Play - 强制 reflow 后动画到新位置
            item.offsetHeight;
            item.style.transition = 'transform 0.25s cubic-bezier(0.28, 0.11, 0.32, 1)';
            item.style.transform = '';
        }
    });
}

/**
 * 根据 DOM 顺序更新 layout
 * @param {Array<string>} layout 字符串数组
 * @param {HTMLElement} grid 网格容器
 * @returns {Array<string>} 新的 layout 数组
 */
function updateLayoutOrder(layout, grid) {
    const items = Array.from(grid.querySelectorAll('.wordcard-card, .wordcard-folder'));
    const newLayout = [];

    items.forEach(el => {
        const type = el.dataset.type;
        if (type === 'card') {
            const cardId = el.dataset.cardId;
            if (cardId) {
                newLayout.push(`card_${cardId}`);
            }
        } else if (type === 'folder') {
            const folderId = el.dataset.folderId;
            if (folderId) {
                newLayout.push(`folder_${folderId}`);
            }
        } else if (type === 'public-folder') {
            // 处理公开文件夹引用
            const publicRefId = el.dataset.publicRefId;
            if (publicRefId) {
                newLayout.push(`public_${publicRefId}`);
            }
        }
    });

    console.log('[Drag] 更新后的布局:', newLayout);
    console.log('[Server] 更新后的布局:', newLayout);
    return newLayout;
}

function startDrag(startEvent, draggedEl, workplace) {
    const layoutIdx = parseInt(draggedEl.dataset.layoutIdx);
    const type = draggedEl.dataset.type;
    const dragName = draggedEl.dataset.name || draggedEl.dataset.folderName;

    draggedEl.classList.add('dragging');

    const grid = workplace.querySelector('.wordcard-grid');

    // 获取所有项目
    const allItems = Array.from(grid.querySelectorAll('.wordcard-card, .wordcard-folder'));

    // 创建浮动克隆（fixed 定位跟随鼠标）
    const clone = draggedEl.cloneNode(true);
    clone.className = (type === 'folder' ? 'wordcard-folder' : 'wordcard-card') + ' drag-clone';
    clone.style.animation = 'none';
    clone.style.rotate = 'none';
    clone.style.scale = 'none';

    const draggedRect = draggedEl.getBoundingClientRect();
    clone.style.width = draggedRect.width + 'px';
    clone.style.left = draggedRect.left + 'px';
    clone.style.top = draggedRect.top + 'px';
    document.body.appendChild(clone);

    const offsetX = startEvent.clientX - draggedRect.left;
    const offsetY = startEvent.clientY - draggedRect.top;

    dragState = {
        didDrag: true,
        draggedEl,
        clone,
        layoutIdx,
        type,
        dragName,
        mergeTarget: null,
        mergeTimer: null,
        currentInsertIdx: -1
    };

    const onMove = (e) => {
        // 克隆体跟随鼠标
        clone.style.left = (e.clientX - offsetX) + 'px';
        clone.style.top = (e.clientY - offsetY) + 'px';

        // 检查是否悬停在某个目标上（用于合并）
        const target = getDropTarget(e, allItems, draggedEl);

        if (target && target !== draggedEl) {
            const targetType = target.dataset.type;
            const isCard = type === 'card';
            const targetIsCard = targetType === 'card';
            const inCenter = isOverCenter(e, target);

            // 卡片拖到文件夹中心 - 准备合并
            if (isCard && targetType === 'folder' && inCenter) {
                // 检查是否为公开文件夹 - 不允许合并
                const isPublicFolder = target.dataset.type === 'public-folder';
                if (isPublicFolder) {
                    clearMergeState();
                    return;
                }

                if (dragState.mergeTarget !== target) {
                    clearMergeState();
                    dragState.mergeTarget = target;
                    dragState.mergeTimer = setTimeout(() => {
                        target.classList.add('drag-target');
                    }, 400);
                }
                return;
            }

            // 两个卡片中心重叠 - 准备创建文件夹
            if (isCard && targetIsCard && inCenter) {
                if (dragState.mergeTarget !== target) {
                    clearMergeState();
                    dragState.mergeTarget = target;
                    dragState.mergeTimer = setTimeout(() => {
                        target.classList.add('drag-target');
                    }, 400);
                }
                return;
            }
        }

        clearMergeState();

        // 计算插入位置并重排 DOM
        const insertIdx = calculateInsertIndex(e, grid, draggedEl);
        if (insertIdx !== dragState.currentInsertIdx) {
            dragState.currentInsertIdx = insertIdx;
            reorderDOM(grid, draggedEl, insertIdx);
        }
    };

    const onUp = async () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        clone.remove();
        draggedEl.classList.remove('dragging');

        const layout = getLayout();

        // 检查是否要合并
        if (dragState.mergeTarget && dragState.mergeTarget.classList.contains('drag-target')) {
            const targetEl = dragState.mergeTarget;
            targetEl.classList.remove('drag-target');

            const targetElType = targetEl.dataset.type;

            if (targetElType === 'folder') {
                // 检查是否为公开文件夹 - 不允许合并
                const isPublicFolder = targetEl.dataset.type === 'public-folder';
                if (isPublicFolder) {
                    console.warn('[Drag] 不允许将卡片拖入公开文件夹');
                    console.warn('[Server] 不允许将卡片拖入公开文件夹');
                    clearMergeState();
                    return;
                }

                // 拖入已有文件夹
                const targetFolderName = targetEl.dataset.folderName;
                const folders = getFolders();
                const folder = Object.values(folders).find(f => f.name === targetFolderName);

                if (folder) {
                    // 获取拖拽卡片的 ID
                    const lists = getWordcards();
                    const dragCard = Object.values(lists).find(c => c.name === dragName);

                    if (dragCard && dragCard.id) {
                        // 添加卡片 ID 到文件夹
                        folder.cards.push(dragCard.id);
                        addOrUpdateFolder(targetFolderName, folder);

                        // 从 layout 中移除卡片
                        const newLayout = layout.filter((_, idx) => idx !== layoutIdx);
                        saveLayout(newLayout);

                        // 卡片已添加到文件夹，数据保留在数据库中
                        console.log('[Drag] 卡片已添加到文件夹:', dragName);

                        if (_renderWordcardCards) _renderWordcardCards();
                    }
                }
            } else {
                // 两个卡片合并创建新文件夹
                const targetName = targetEl.dataset.name;
                const targetLayoutIdx = parseInt(targetEl.dataset.layoutIdx);

                createNewFolder(layout, layoutIdx, targetLayoutIdx, targetName, dragName);
            }
        } else {
            // 根据 DOM 顺序更新 layout
            const newLayout = updateLayoutOrder(layout, grid);
            saveLayout(newLayout);
            // 重新渲染以同步 layoutIdx
            if (_renderWordcardCards) _renderWordcardCards();
        }

        setTimeout(() => {
            dragState = null;
        }, 50);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
}

function clearMergeState() {
    if (!dragState) return;
    if (dragState.mergeTimer) {
        clearTimeout(dragState.mergeTimer);
        dragState.mergeTimer = null;
    }
    if (dragState.mergeTarget) {
        dragState.mergeTarget.classList.remove('drag-target');
        dragState.mergeTarget = null;
    }
}

function getDropTarget(event, items, excludeEl) {
    for (const item of items) {
        if (item === excludeEl) continue;
        const iconEl = item.querySelector('.wordcard-icon, .wordcard-folder-icon');
        if (iconEl) {
            const iconRect = iconEl.getBoundingClientRect();
            if (event.clientX >= iconRect.left && event.clientX <= iconRect.right &&
                event.clientY >= iconRect.top && event.clientY <= iconRect.bottom) {
                return item;
            }
        }
    }
    return null;
}

function isOverCenter(event, target) {
    const iconEl = target.querySelector('.wordcard-icon, .wordcard-folder-icon');
    const rect = iconEl ? iconEl.getBoundingClientRect() : target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = Math.abs(event.clientX - cx);
    const dy = Math.abs(event.clientY - cy);
    return dx < rect.width * 0.35 && dy < rect.height * 0.35;
}

/**
 * 创建新文件夹（异步弹窗）
 */
async function createNewFolder(layout, layoutIdx, targetLayoutIdx, targetName, dragName) {
    const folderName = await showPrompt(t('folderPromptName'), t('newFolder'));
    if (!folderName || !folderName.trim()) return;

    const trimmedName = folderName.trim();
    if (isFolderNameExists(trimmedName)) {
        // 等待一帧，确保前一个弹窗的事件处理完成
        await new Promise(resolve => requestAnimationFrame(resolve));
        await showAlert(t('folderNameExists', { name: trimmedName }));
        return;
    }

    // 获取所有单词卡
    const lists = getWordcards();

    // 根据名称查找卡片 ID
    const targetCard = Object.values(lists).find(c => c.name === targetName);
    const dragCard = Object.values(lists).find(c => c.name === dragName);

    if (!targetCard || !dragCard) {
        console.error('[Drag] 找不到卡片:', targetName, dragName);
        return;
    }

    const targetCardId = targetCard.id;
    const dragCardId = dragCard.id;

    // 创建文件夹数据对象（后端格式）
    const now = new Date().toISOString();
    const folderData = {
        id: null,  // 新文件夹还没有服务器 ID
        name: trimmedName,
        cards: [targetCardId, dragCardId],  // 直接使用 ID 数组
        is_public: false,
        description: null,
        created: now,
        updated: now
    };

    // 添加到文件夹缓存
    addOrUpdateFolder(trimmedName, folderData);
    console.log('[Drag] 文件夹已添加到缓存:', trimmedName, folderData);

    // 更新 layout：移除两个卡片，添加文件夹
    // layout 是字符串数组：["card_1", "card_2", ...]
    // 【修复】按卡片 ID 删除（而非索引），确保删除正确的卡片
    const targetCardKey = `card_${targetCardId}`;
    const dragCardKey = `card_${dragCardId}`;
    const newLayout = layout.filter(item => item !== targetCardKey && item !== dragCardKey);
    console.log(`[Drag] 从 layout 移除卡片: ${targetCardKey}, ${dragCardKey}`);
    console.log(`[网页控制台] 从 layout 移除卡片: ${targetCardKey}, ${dragCardKey}`);

    // 卡片已添加到文件夹，数据保留在数据库中
    console.log('[Drag] 卡片已添加到文件夹:', targetName, dragName);

    // 暂时使用临时标识，等同步后获取真实 ID
    const tempFolderId = `folder_temp_${Date.now()}`;
    newLayout.push(tempFolderId);

    saveLayout(newLayout);
    if (_renderWordcardCards) _renderWordcardCards();

    // 立即同步到服务器获取 ID
    console.log('[Drag] 立即同步新文件夹到服务器...');
    const syncResult = await syncLayoutToServer();
    if (syncResult.success && syncResult.result && syncResult.result.folderIdMap) {
        console.log('[Drag] 新文件夹同步成功，folderIdMap:', syncResult.result.folderIdMap);

        // 从 folderIdMap 中获取真实的 folder ID
        const realFolderId = syncResult.result.folderIdMap[trimmedName];

        if (realFolderId) {
            // 更新 layout：将临时标识替换为真实 ID
            let currentLayout = getLayout();
            currentLayout = currentLayout.map(item => {
                if (item === tempFolderId) {
                    return `folder_${realFolderId}`;
                }
                return item;
            });

            saveLayout(currentLayout);
            console.log('[Drag] 布局已更新:', `${tempFolderId} -> folder_${realFolderId}`);

            // 更新文件夹缓存中的 ID
            const folders = getFolders();
            if (folders[trimmedName]) {
                folders[trimmedName].id = realFolderId;
                addOrUpdateFolder(trimmedName, folders[trimmedName]);
                console.log('[Drag] 文件夹缓存已更新 ID:', realFolderId);
            }

            // 添加调试日志
            console.log('[Drag] 准备推送的 layout:', currentLayout);
            console.log('[Drag] 准备推送的 folders:', folders);

            // 再次推送修复后的 layout（直接使用 syncLayoutToCloud 避免 syncLayout 过滤）
            const cardColors = getCardColors();
            await syncLayoutToCloud(currentLayout, cardColors, folders);
            console.log('[Drag] 修复后的布局已推送到服务器');

            // 重新渲染界面
            if (_renderWordcardCards) {
                _renderWordcardCards();
                console.log('[Drag] 界面已刷新');
            }
        } else {
            console.error('[Drag] 未能从 folderIdMap 中获取文件夹 ID');
        }
    } else {
        console.warn('[Drag] 新文件夹同步失败或未返回 folderIdMap:', syncResult.error);
    }
}
