/**
 * 单词表存储模块
 * 使用 localStorage 保存和加载单词表
 * 支持拖拽排列和文件夹分组
 */

import { $, clearWorkplace } from './utils.js';
import { setActiveMode, setRepeaterState, preloadCache, loadCacheFromStorage } from './state.js';
import { startPreload, updatePreloadProgress } from './preload.js';
import { stopAudio } from './audio.js';

const STORAGE_KEY = 'wordlists';
const LAYOUT_KEY = 'wordlist_layout';

// 拖拽状态
let dragState = null;

/**
 * 获取所有保存的单词表
 */
export function getWordLists() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error('Failed to load word lists:', e);
        return {};
    }
}

/**
 * 保存单词表（同时保存翻译数据）
 */
export function saveWordList(name) {
    const words = $("wordInput").value.trim();
    if (!words) return false;

    const translations = {};
    const wordInfo = {};

    preloadCache.entries.forEach(entry => {
        const word = entry.word;
        if (preloadCache.translations[word]) {
            translations[word] = preloadCache.translations[word];
        }
        if (preloadCache.wordInfo[word]) {
            wordInfo[word] = preloadCache.wordInfo[word];
        }
    });

    const lists = getWordLists();
    lists[name] = {
        name,
        created: lists[name]?.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        words,
        translations,
        wordInfo
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
        return true;
    } catch (e) {
        console.error('Failed to save word list:', e);
        return false;
    }
}

/**
 * 删除单词表
 */
export function deleteWordList(name) {
    const lists = getWordLists();
    delete lists[name];

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
        // 从 layout 中移除
        let layout = getLayout();
        layout = layout.filter(item => {
            if (item.type === 'card' && item.name === name) return false;
            if (item.type === 'folder') {
                item.items = item.items.filter(n => n !== name);
                return item.items.length > 0;
            }
            return true;
        });
        saveLayout(layout);
        return true;
    } catch (e) {
        console.error('Failed to delete word list:', e);
        return false;
    }
}

/**
 * 加载单词表到 textarea（恢复翻译数据）
 */
export function loadWordList(name) {
    const lists = getWordLists();
    const list = lists[name];
    if (!list) return false;

    preloadCache.loadId++;
    preloadCache.translations = {};
    preloadCache.wordInfo = {};
    preloadCache.entries = [];

    loadCacheFromStorage();

    if (list.translations) {
        Object.assign(preloadCache.translations, list.translations);
    }
    if (list.wordInfo) {
        Object.assign(preloadCache.wordInfo, list.wordInfo);
    }
    if (list.dictionaries) {
        Object.assign(preloadCache.wordInfo, list.dictionaries);
    }

    $("wordInput").value = list.words;
    startPreload();
    return true;
}

// ===== 布局持久化 =====

function getLayout() {
    try {
        const data = localStorage.getItem(LAYOUT_KEY);
        if (data) {
            const layout = JSON.parse(data);
            return syncLayout(layout);
        }
    } catch (e) {}
    return buildDefaultLayout();
}

function saveLayout(layout) {
    try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch (e) {
        console.error('Failed to save layout:', e);
    }
}

function buildDefaultLayout() {
    const lists = getWordLists();
    const entries = Object.values(lists).sort((a, b) =>
        new Date(b.updated || b.created) - new Date(a.updated || a.created)
    );
    return entries.map(list => ({ type: 'card', name: list.name }));
}

// 同步 layout 和实际 wordlists（处理新增/删除的列表）
function syncLayout(layout) {
    const lists = getWordLists();
    const allNames = new Set(Object.keys(lists));
    const layoutNames = new Set();

    // 收集 layout 中所有名称
    layout.forEach(item => {
        if (item.type === 'card') layoutNames.add(item.name);
        if (item.type === 'folder') item.items.forEach(n => layoutNames.add(n));
    });

    // 移除 layout 中已不存在的列表
    layout = layout.filter(item => {
        if (item.type === 'card') return allNames.has(item.name);
        if (item.type === 'folder') {
            item.items = item.items.filter(n => allNames.has(n));
            return item.items.length > 0;
        }
        return false;
    });

    // 添加新列表到末尾
    allNames.forEach(name => {
        if (!layoutNames.has(name)) {
            layout.push({ type: 'card', name });
        }
    });

    return layout;
}

// ===== 渲染 =====

function countWords(words) {
    return words.split(/\r?\n/).filter(line => line.trim()).length;
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function renderWordListCards() {
    const workplace = $("workplace");
    if (!workplace) return;
    if (window.currentActiveMode) return;

    const lists = getWordLists();
    const layout = getLayout();

    if (Object.keys(lists).length === 0) {
        workplace.innerHTML = `
            <div class="wordlist-empty">
                <p>No saved word lists</p>
                <p class="hint">Enter words in the sidebar and click Save</p>
            </div>
        `;
        return;
    }

    workplace.innerHTML = `<div class="wordlist-grid">${layout.map((item, idx) => {
        if (item.type === 'card') {
            const list = lists[item.name];
            if (!list) return '';
            return renderCard(list, idx);
        } else if (item.type === 'folder') {
            return renderFolder(item, lists, idx);
        }
        return '';
    }).join('')}</div>`;

    bindCardEvents(workplace);
    bindDragEvents(workplace);
}

function renderCard(list, layoutIdx) {
    return `
        <div class="wordlist-card" data-name="${escapeHtml(list.name)}" data-layout-idx="${layoutIdx}" data-type="card">
            <div class="wordlist-card-header">
                <span class="wordlist-name">${escapeHtml(list.name)}</span>
                <button class="wordlist-delete" data-name="${escapeHtml(list.name)}" title="Delete">\u00d7</button>
            </div>
            <div class="wordlist-info">
                <span>${countWords(list.words)} words</span>
                <span>${formatDate(list.updated || list.created)}</span>
            </div>
        </div>
    `;
}

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
            <div class="wordlist-folder-preview">${previewItems}${emptyHtml}</div>
            <div class="wordlist-folder-name">${escapeHtml(folder.name)}</div>
            <div class="wordlist-folder-count">${folder.items.length} lists</div>
        </div>
    `;
}

function bindCardEvents(workplace) {
    // 卡片点击
    workplace.querySelectorAll('.wordlist-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (dragState?.didDrag) return;
            if (e.target.classList.contains('wordlist-delete')) return;
            loadWordList(card.dataset.name);
        });
    });

    // 删除按钮
    workplace.querySelectorAll('.wordlist-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.name;
            if (confirm(`Delete "${name}"?`)) {
                deleteWordList(name);
                renderWordListCards();
            }
        });
    });

    // 文件夹点击
    workplace.querySelectorAll('.wordlist-folder').forEach(folder => {
        folder.addEventListener('click', () => {
            if (dragState?.didDrag) return;
            openFolder(folder.dataset.folderName);
        });
    });
}

// ===== 文件夹展开 =====

function openFolder(folderName) {
    const layout = getLayout();
    const folderItem = layout.find(item => item.type === 'folder' && item.name === folderName);
    if (!folderItem) return;

    const lists = getWordLists();

    const overlay = document.createElement('div');
    overlay.className = 'folder-open-overlay';
    overlay.innerHTML = `
        <div class="folder-open-view">
            <div class="folder-open-header">
                <span class="folder-open-title">${escapeHtml(folderName)}</span>
                <button class="folder-open-close">\u00d7</button>
            </div>
            <div class="folder-open-grid">
                ${folderItem.items.map(name => {
                    const list = lists[name];
                    if (!list) return '';
                    return `
                        <div class="wordlist-card" data-name="${escapeHtml(name)}" data-in-folder="${escapeHtml(folderName)}">
                            <div class="wordlist-card-header">
                                <span class="wordlist-name">${escapeHtml(name)}</span>
                                <button class="wordlist-delete" data-name="${escapeHtml(name)}" title="Delete">\u00d7</button>
                            </div>
                            <div class="wordlist-info">
                                <span>${countWords(list.words)} words</span>
                                <span>${formatDate(list.updated || list.created)}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // 关闭按钮
    overlay.querySelector('.folder-open-close').addEventListener('click', () => {
        overlay.remove();
    });

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // 文件夹内卡片点击加载
    overlay.querySelectorAll('.wordlist-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('wordlist-delete')) return;
            overlay.remove();
            loadWordList(card.dataset.name);
        });
    });

    // 文件夹内删除
    overlay.querySelectorAll('.wordlist-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.name;
            if (confirm(`Delete "${name}"?`)) {
                deleteWordList(name);
                overlay.remove();
                renderWordListCards();
            }
        });
    });

    // 文件夹内拖拽取出卡片
    bindFolderDrag(overlay, folderName);
}

function bindFolderDrag(overlay, folderName) {
    const cards = overlay.querySelectorAll('.wordlist-card');
    cards.forEach(card => {
        card.addEventListener('pointerdown', (e) => {
            if (e.target.classList.contains('wordlist-delete')) return;
            const longPressTimer = setTimeout(() => {
                startFolderCardDrag(e, card, overlay, folderName);
            }, 300);

            const cancelLongPress = () => {
                clearTimeout(longPressTimer);
                card.removeEventListener('pointerup', cancelLongPress);
                card.removeEventListener('pointermove', onMove);
            };
            const onMove = (me) => {
                if (Math.abs(me.clientX - e.clientX) > 5 || Math.abs(me.clientY - e.clientY) > 5) {
                    cancelLongPress();
                }
            };
            card.addEventListener('pointerup', cancelLongPress, { once: true });
            card.addEventListener('pointermove', onMove);
        });
    });
}

function startFolderCardDrag(startEvent, card, overlay, folderName) {
    const name = card.dataset.name;
    card.classList.add('dragging');

    const clone = card.cloneNode(true);
    clone.className = 'wordlist-card drag-clone';
    const rect = card.getBoundingClientRect();
    clone.style.width = rect.width + 'px';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    document.body.appendChild(clone);

    const offsetX = startEvent.clientX - rect.left;
    const offsetY = startEvent.clientY - rect.top;

    const onMove = (e) => {
        clone.style.left = (e.clientX - offsetX) + 'px';
        clone.style.top = (e.clientY - offsetY) + 'px';
    };

    const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        clone.remove();
        card.classList.remove('dragging');

        // 从文件夹中取出
        const layout = getLayout();
        const folderItem = layout.find(item => item.type === 'folder' && item.name === folderName);
        if (folderItem) {
            folderItem.items = folderItem.items.filter(n => n !== name);
            // 文件夹为空则删除
            if (folderItem.items.length === 0) {
                const idx = layout.indexOf(folderItem);
                layout.splice(idx, 1);
            }
            // 将卡片放到文件夹后面
            const folderIdx = layout.indexOf(folderItem);
            const insertIdx = folderIdx >= 0 ? folderIdx + 1 : layout.length;
            layout.splice(insertIdx, 0, { type: 'card', name });
            saveLayout(layout);
        }

        overlay.remove();
        renderWordListCards();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
}

// ===== 拖拽系统 =====

function bindDragEvents(workplace) {
    const items = workplace.querySelectorAll('.wordlist-card, .wordlist-folder');
    items.forEach(item => {
        item.addEventListener('pointerdown', (e) => {
            if (e.target.classList.contains('wordlist-delete')) return;
            if (e.button !== 0) return;

            const startX = e.clientX;
            const startY = e.clientY;

            const longPressTimer = setTimeout(() => {
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

    // 追踪 drop 位置
    let dropTarget = null;
    let dropSide = null; // 'left' or 'right'

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

    const clearDropIndicator = () => {
        if (dropTarget) {
            dropTarget.classList.remove('drop-indicator-left', 'drop-indicator-right');
            dropTarget = null;
            dropSide = null;
        }
    };

    const onMove = (e) => {
        clone.style.left = (e.clientX - offsetX) + 'px';
        clone.style.top = (e.clientY - offsetY) + 'px';

        // 找到指针下方的目标
        const target = getDropTarget(e, allItems(), draggedEl);

        if (target && target !== draggedEl) {
            const targetType = target.dataset.type;
            const isCard = type === 'card';
            const targetIsCard = targetType === 'card';

            // 卡片拖到文件夹上中心 → 加入文件夹
            if (isCard && targetType === 'folder' && isOverCenter(e, target)) {
                clearDropIndicator();
                if (dragState.mergeTarget !== target) {
                    clearMergeState();
                    dragState.mergeTarget = target;
                    dragState.mergeTimer = setTimeout(() => {
                        target.classList.add('drag-target');
                    }, 200);
                }
                return;
            }
            // 两个卡片中心重叠 → 合并成新文件夹
            if (isCard && targetIsCard && isOverCenter(e, target)) {
                clearDropIndicator();
                if (dragState.mergeTarget !== target) {
                    clearMergeState();
                    dragState.mergeTarget = target;
                    dragState.mergeTimer = setTimeout(() => {
                        target.classList.add('drag-target');
                    }, 200);
                }
                return;
            }
            clearMergeState();

            // 显示 drop indicator（不移动 DOM）
            const targetRect = target.getBoundingClientRect();
            const midX = targetRect.left + targetRect.width / 2;
            const side = e.clientX < midX ? 'left' : 'right';

            if (dropTarget !== target || dropSide !== side) {
                clearDropIndicator();
                dropTarget = target;
                dropSide = side;
                target.classList.add(side === 'left' ? 'drop-indicator-left' : 'drop-indicator-right');
            }
        } else {
            clearMergeState();
            clearDropIndicator();
        }
    };

    const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        clone.remove();
        draggedEl.classList.remove('dragging');
        clearDropIndicator();

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
                }
            }
        } else if (dropTarget) {
            // 根据 indicator 位置计算新顺序
            const targetLayoutIdx = parseInt(dropTarget.dataset.layoutIdx);
            if (!isNaN(targetLayoutIdx) && targetLayoutIdx !== layoutIdx) {
                const draggedItem = layout[layoutIdx];
                // 先移除被拖项
                const newLayout = layout.filter((_, idx) => idx !== layoutIdx);
                // 计算插入位置
                let insertIdx = newLayout.findIndex((_, idx) => {
                    // 找到 target 在新数组中的位置
                    const origIdx = idx >= layoutIdx ? idx + 1 : idx;
                    return origIdx === targetLayoutIdx;
                });
                if (insertIdx === -1) insertIdx = newLayout.length;
                if (dropSide === 'right') insertIdx++;
                newLayout.splice(insertIdx, 0, draggedItem);
                saveLayout(newLayout);
            }
        }

        // 延迟清除 didDrag 防止触发 click
        setTimeout(() => {
            dragState = null;
        }, 50);

        renderWordListCards();
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
    return dx < rect.width * 0.3 && dy < rect.height * 0.3;
}

// ===== 导航 =====

export function goHome() {
    stopAudio();

    if (preloadCache.abortController) {
        preloadCache.abortController.abort();
        preloadCache.abortController = null;
    }
    preloadCache.loadId++;
    preloadCache.loading = false;
    updatePreloadProgress();

    $("dictationPopup")?.remove();

    setActiveMode(null);
    setRepeaterState(null);
    document.body.classList.remove('dictation-mode', 'repeater-mode');

    clearWorkplace();
    renderWordListCards();
}

// ===== 初始化 =====

export function initWordListUI() {
    const saveBtn = $("saveListBtn");
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const defaultName = `wordlist-${new Date().toISOString().slice(0, 10)}`;
            const name = prompt("Enter list name:", defaultName);
            if (!name || !name.trim()) return;

            if (saveWordList(name.trim())) {
                renderWordListCards();
            }
        });
    }

    renderWordListCards();
}
