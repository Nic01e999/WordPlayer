/**
 * 文件夹展开和内部拖拽模块
 */

import { escapeHtml } from '../utils.js';
import { getWordLists, loadWordList } from './storage.js';
import { getLayout, saveLayout, deleteWordList } from './layout.js';

// 延迟绑定的函数引用
let _renderWordListCards = null;

/**
 * 设置延迟绑定的函数
 */
export function setFolderDeps(deps) {
    _renderWordListCards = deps.renderWordListCards;
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
 * 打开文件夹视图
 */
export function openFolder(folderName) {
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
                if (_renderWordListCards) _renderWordListCards();
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
        if (_renderWordListCards) _renderWordListCards();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
}
