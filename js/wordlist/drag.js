/**
 * 单词表拖拽系统模块 - iOS SpringBoard 风格
 * 处理卡片和文件夹的拖拽排序（CSS Grid + DOM 重排）
 */

import { getLayout, saveLayout, isFolderNameExists, syncLayoutToServer } from './layout.js';
import { showPrompt, showAlert } from '../utils/dialog.js';
import { showColorPicker, hideColorPicker, hasOpenColorPicker } from './colorpicker.js';
import { showSavingIndicator, hideSavingIndicator, showToast } from '../utils.js';
import { t } from '../i18n/index.js';
import { bindPointerInteraction, isJustInteracted } from './interactions.js';
import { isLoggedIn } from '../auth/state.js';

// 拖拽状态
let dragState = null;

// 编辑模式状态
let editMode = false;
let currentWorkplace = null;

// 事件委托标记
let dragEventsInitialized = false;
let globalTapHandlerInitialized = false;

// 延迟绑定的函数引用
let _renderWordListCards = null;

/**
 * 设置延迟绑定的函数
 */
export function setDragDeps(deps) {
    _renderWordListCards = deps.renderWordListCards;
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
    if (e.target.closest('.wordlist-card, .wordlist-folder, .wordlist-delete')) {
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
    const items = workplace.querySelectorAll('.wordlist-card, .wordlist-folder');
    items.forEach(item => item.classList.add('edit-mode'));

    // 检查是否有打开的文件夹overlay
    const folderOverlay = document.querySelector('.folder-open-overlay');
    if (folderOverlay && !folderOverlay.querySelector('.readonly')) {
        // 给文件夹内的卡片也添加edit-mode
        folderOverlay.querySelectorAll('.wordlist-card').forEach(card => {
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
        const items = currentWorkplace.querySelectorAll('.wordlist-card, .wordlist-folder');
        items.forEach(item => {
            item.classList.remove('edit-mode');
        });
    }

    // 移除文件夹内的edit-mode
    const folderOverlay = document.querySelector('.folder-open-overlay');
    if (folderOverlay) {
        folderOverlay.querySelectorAll('.wordlist-card').forEach(card => {
            card.classList.remove('edit-mode');
        });
    }

    currentWorkplace = null;

    // 退出编辑模式时上传布局到服务端（仅在已登录时）
    if (isLoggedIn()) {
        console.log('[Drag] 退出编辑模式，开始保存布局...');

        // 显示保存指示器
        showSavingIndicator();

        // 等待保存完成
        const result = await syncLayoutToServer();

        // 隐藏指示器
        hideSavingIndicator();

        // 显示结果提示（仅保留错误提示）
        if (result.success) {
            console.log('[Drag] 布局保存成功');
            // 移除toast提示以保持界面清爽
        } else if (result.error) {
            console.error('[Drag] 布局保存失败:', result.error);
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
    const grid = workplace.querySelector('.wordlist-grid');
    if (!grid || dragEventsInitialized) return;
    dragEventsInitialized = true;

    const items = workplace.querySelectorAll('.wordlist-card, .wordlist-folder');

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
    const items = Array.from(grid.querySelectorAll('.wordlist-card, .wordlist-folder'));
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
    const items = Array.from(grid.querySelectorAll('.wordlist-card, .wordlist-folder'));
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
 */
function updateLayoutOrder(layout, grid) {
    const items = Array.from(grid.querySelectorAll('.wordlist-card, .wordlist-folder'));
    const newItems = [];

    items.forEach(el => {
        const type = el.dataset.type;
        if (type === 'card') {
            const name = el.dataset.name;
            const existing = layout.items.find(i => i.type === 'card' && i.name === name);
            if (existing) newItems.push({ type: 'card', name });
        } else if (type === 'folder') {
            const folderName = el.dataset.folderName;
            const existing = layout.items.find(i => i.type === 'folder' && i.name === folderName);
            if (existing) newItems.push({ type: 'folder', name: folderName, items: existing.items });
        }
    });

    layout.items = newItems;
}

function startDrag(startEvent, draggedEl, workplace) {
    const layoutIdx = parseInt(draggedEl.dataset.layoutIdx);
    const type = draggedEl.dataset.type;
    const dragName = draggedEl.dataset.name || draggedEl.dataset.folderName;

    draggedEl.classList.add('dragging');

    const grid = workplace.querySelector('.wordlist-grid');

    // 获取所有项目
    const allItems = Array.from(grid.querySelectorAll('.wordlist-card, .wordlist-folder'));

    // 创建浮动克隆（fixed 定位跟随鼠标）
    const clone = draggedEl.cloneNode(true);
    clone.className = (type === 'folder' ? 'wordlist-folder' : 'wordlist-card') + ' drag-clone';
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

    const onUp = () => {
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
                // 拖入已有文件夹
                const targetFolderName = targetEl.dataset.folderName;
                const folderItem = layout.items.find(item => item.type === 'folder' && item.name === targetFolderName);
                if (folderItem) {
                    folderItem.items.push(dragName);
                    layout.items = layout.items.filter((_, idx) => idx !== layoutIdx);
                    saveLayout(layout);
                    if (_renderWordListCards) _renderWordListCards();
                }
            } else {
                // 两个卡片合并创建新文件夹
                const targetName = targetEl.dataset.name;
                const targetLayoutIdx = parseInt(targetEl.dataset.layoutIdx);

                createNewFolder(layout, layoutIdx, targetLayoutIdx, targetName, dragName);
            }
        } else {
            // 根据 DOM 顺序更新 layout
            updateLayoutOrder(layout, grid);
            saveLayout(layout);
            // 重新渲染以同步 layoutIdx
            if (_renderWordListCards) _renderWordListCards();
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
        const iconEl = item.querySelector('.wordlist-icon, .wordlist-folder-icon');
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
    const iconEl = target.querySelector('.wordlist-icon, .wordlist-folder-icon');
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
        await showAlert(t('folderNameExists', { name: trimmedName }));
        return;
    }

    // 在目标位置创建文件夹
    const newFolder = {
        type: 'folder',
        name: trimmedName,
        items: [targetName, dragName]
    };

    // 移除原来的两个卡片，添加新文件夹（按索引从大到小删除避免偏移）
    const indicesToRemove = [layoutIdx, targetLayoutIdx].sort((a, b) => b - a);
    indicesToRemove.forEach(idx => layout.items.splice(idx, 1));
    layout.items.push(newFolder);

    saveLayout(layout);
    if (_renderWordListCards) _renderWordListCards();
}
