/**
 * 单词表拖拽系统模块
 * 处理卡片和文件夹的拖拽排序
 */

import { getLayout, saveLayout } from './layout.js';

// 拖拽状态
let dragState = null;

// 编辑模式状态
let editMode = false;
let currentWorkplace = null;

// 事件委托标记
let dragEventsInitialized = false;

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
 * 进入编辑模式 - 所有卡片开始抖动
 */
export function enterEditMode(workplace) {
    if (editMode) return;
    editMode = true;
    currentWorkplace = workplace;
    const items = workplace.querySelectorAll('.wordlist-card, .wordlist-folder');
    items.forEach(item => item.classList.add('edit-mode'));
}

/**
 * 退出编辑模式 - 停止抖动
 */
export function exitEditMode() {
    if (!editMode) return;
    editMode = false;
    if (currentWorkplace) {
        const items = currentWorkplace.querySelectorAll('.wordlist-card, .wordlist-folder');
        items.forEach(item => item.classList.remove('edit-mode'));
    }
    currentWorkplace = null;
}

/**
 * 绑定拖拽事件
 */
export function bindDragEvents(workplace) {
    const grid = workplace.querySelector('.wordlist-grid');
    if (!grid || dragEventsInitialized) return;
    dragEventsInitialized = true;

    grid.addEventListener('pointerdown', (e) => {
        const item = e.target.closest('.wordlist-card, .wordlist-folder');
        if (!item) return;
        if (e.target.classList.contains('wordlist-delete')) return;
        if (e.button !== 0) return;

        const startX = e.clientX;
        const startY = e.clientY;

        if (editMode) {
            startDrag(e, item, workplace);
            return;
        }

        // 非编辑模式：长按后进入编辑模式并开始拖动
        const longPressTimer = setTimeout(() => {
            enterEditMode(workplace);
            startDrag(e, item, workplace);
        }, 300);

        const cancelLongPress = () => {
            clearTimeout(longPressTimer);
            item.removeEventListener('pointerup', cancelLongPress);
            item.removeEventListener('pointermove', onEarlyMove);
        };

        const onEarlyMove = (me) => {
            if (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5) {
                cancelLongPress();
            }
        };

        item.addEventListener('pointerup', cancelLongPress, { once: true });
        item.addEventListener('pointermove', onEarlyMove);
    });
}

function startDrag(startEvent, draggedEl, workplace) {
    const layoutIdx = parseInt(draggedEl.dataset.layoutIdx);
    const type = draggedEl.dataset.type;

    draggedEl.classList.add('dragging');

    // 创建浮动克隆
    const clone = draggedEl.cloneNode(true);
    clone.className = (type === 'folder' ? 'wordlist-folder' : 'wordlist-card') + ' drag-clone';
    const rect = draggedEl.getBoundingClientRect();
    clone.style.width = rect.width + 'px';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    document.body.appendChild(clone);

    const offsetX = startEvent.clientX - rect.left;
    const offsetY = startEvent.clientY - rect.top;

    // 追踪插入位置
    let currentInsertIdx = layoutIdx;

    dragState = {
        didDrag: true,
        draggedEl,
        clone,
        layoutIdx,
        type,
        mergeTarget: null,
        mergeTimer: null
    };

    const grid = workplace.querySelector('.wordlist-grid');
    const allItems = () => Array.from(grid.querySelectorAll('.wordlist-card, .wordlist-folder'));

    // 记录所有项目的位置信息
    const itemsInfo = allItems().map(item => ({
        el: item,
        rect: item.getBoundingClientRect(),
        idx: parseInt(item.dataset.layoutIdx)
    }));

    // 清除所有躲避状态
    const clearAllDodge = () => {
        itemsInfo.forEach(info => {
            info.el.classList.remove('dodge-right');
        });
    };

    // 更新躲避状态
    const updateDodge = (insertIdx) => {
        itemsInfo.forEach(info => {
            if (info.el === draggedEl) return;

            let shouldDodge = false;

            if (insertIdx < layoutIdx) {
                shouldDodge = info.idx >= insertIdx && info.idx < layoutIdx;
            } else if (insertIdx > layoutIdx) {
                shouldDodge = false;
            }

            if (shouldDodge) {
                info.el.classList.add('dodge-right');
            } else {
                info.el.classList.remove('dodge-right');
            }
        });
    };

    // 根据指针位置计算插入索引
    const getInsertIndex = (pointerX, pointerY) => {
        for (const info of itemsInfo) {
            if (info.el === draggedEl) continue;

            const rect = info.rect;
            if (pointerX < rect.left + rect.width / 2 &&
                pointerY >= rect.top - 20 && pointerY <= rect.bottom + 20) {
                return info.idx;
            }
        }

        const lastItem = itemsInfo.filter(i => i.el !== draggedEl).pop();
        if (lastItem) {
            const rect = lastItem.rect;
            if (pointerY >= rect.top - 20 && pointerY <= rect.bottom + 20) {
                return lastItem.idx + 1;
            }
        }

        return layoutIdx;
    };

    const onMove = (e) => {
        clone.style.left = (e.clientX - offsetX) + 'px';
        clone.style.top = (e.clientY - offsetY) + 'px';

        const target = getDropTarget(e, allItems(), draggedEl);

        if (target && target !== draggedEl) {
            const targetType = target.dataset.type;
            const isCard = type === 'card';
            const targetIsCard = targetType === 'card';
            const inCenter = isOverCenter(e, target);

            // 卡片拖到文件夹中心
            if (isCard && targetType === 'folder' && inCenter) {
                clearAllDodge();
                if (dragState.mergeTarget !== target) {
                    clearMergeState();
                    dragState.mergeTarget = target;
                    dragState.mergeTimer = setTimeout(() => {
                        target.classList.add('drag-target');
                    }, 500);
                }
                return;
            }

            // 两个卡片中心重叠
            if (isCard && targetIsCard && inCenter) {
                clearAllDodge();
                if (dragState.mergeTarget !== target) {
                    clearMergeState();
                    dragState.mergeTarget = target;
                    dragState.mergeTimer = setTimeout(() => {
                        target.classList.add('drag-target');
                    }, 500);
                }
                return;
            }

            clearMergeState();

            const insertIdx = getInsertIndex(e.clientX, e.clientY);
            if (insertIdx !== currentInsertIdx) {
                currentInsertIdx = insertIdx;
                updateDodge(insertIdx);
            }
        } else {
            clearMergeState();
            const insertIdx = getInsertIndex(e.clientX, e.clientY);
            if (insertIdx !== currentInsertIdx) {
                currentInsertIdx = insertIdx;
                updateDodge(insertIdx);
            }
        }
    };

    const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        clone.remove();
        draggedEl.classList.remove('dragging');
        clearAllDodge();

        const layout = getLayout();

        // 检查是否要合并
        if (dragState.mergeTarget && dragState.mergeTarget.classList.contains('drag-target')) {
            const targetEl = dragState.mergeTarget;
            targetEl.classList.remove('drag-target');

            const dragName = draggedEl.dataset.name || draggedEl.dataset.folderName;
            const targetElType = targetEl.dataset.type;

            if (targetElType === 'folder') {
                // 拖入已有文件夹
                const targetFolderName = targetEl.dataset.folderName;
                const folderItem = layout.find(item => item.type === 'folder' && item.name === targetFolderName);
                if (folderItem) {
                    folderItem.items.push(dragName);
                    const newLayout = layout.filter((_, idx) => idx !== layoutIdx);
                    saveLayout(newLayout);
                    if (_renderWordListCards) _renderWordListCards();
                }
            } else {
                // 两个卡片合并创建新文件夹
                const targetName = targetEl.dataset.name;
                const targetLayoutIdx = parseInt(targetEl.dataset.layoutIdx);

                const folderName = prompt('文件夹名称:', '新文件夹');
                if (folderName && folderName.trim()) {
                    const newLayout = layout.filter((_, idx) =>
                        idx !== layoutIdx && idx !== targetLayoutIdx
                    );
                    const insertAt = Math.min(layoutIdx, targetLayoutIdx);
                    newLayout.splice(Math.min(insertAt, newLayout.length), 0, {
                        type: 'folder',
                        name: folderName.trim(),
                        items: [targetName, dragName]
                    });
                    saveLayout(newLayout);
                    if (_renderWordListCards) _renderWordListCards();
                }
            }
        } else if (currentInsertIdx !== layoutIdx) {
            const draggedItem = layout[layoutIdx];
            const newLayout = layout.filter((_, idx) => idx !== layoutIdx);
            let insertIdx = currentInsertIdx;
            if (insertIdx > layoutIdx) insertIdx--;
            insertIdx = Math.max(0, Math.min(insertIdx, newLayout.length));
            newLayout.splice(insertIdx, 0, draggedItem);
            saveLayout(newLayout);
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
        const rect = item.getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {
            return item;
        }
    }
    return null;
}

function isOverCenter(event, target) {
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = Math.abs(event.clientX - cx);
    const dy = Math.abs(event.clientY - cy);
    return dx < rect.width * 0.5 && dy < rect.height * 0.5;
}
