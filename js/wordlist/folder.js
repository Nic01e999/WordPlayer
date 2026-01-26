/**
 * 文件夹展开和内部拖拽模块 - iOS 风格
 */

import { escapeHtml } from '../utils.js';
import { getWordLists, loadWordList, getCardColor } from './storage.js';
import { getLayout, saveLayout, deleteWordList } from './layout.js';
import { showConfirm } from '../utils/dialog.js';
import { CARD_COLORS, getCurrentThemeColors } from './render.js';
import { t } from '../i18n/index.js';

// 分页配置
const CARDS_PER_PAGE = 9;  // 3x3 网格

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

/**
 * 重命名文件夹
 */
function renameFolder(oldName, newName) {
    const layout = getLayout();
    const folder = layout.items.find(item => item.type === 'folder' && item.name === oldName);
    if (folder) {
        folder.name = newName;
        saveLayout(layout);
        return true;
    }
    return false;
}

/**
 * 打开文件夹视图
 */
export function openFolder(folderName) {
    const layout = getLayout();
    const folderItem = layout.items.find(item => item.type === 'folder' && item.name === folderName);
    if (!folderItem) return;

    const lists = getWordLists();

    // 过滤有效卡片
    const validCards = folderItem.items.filter(name => lists[name]);

    // 计算总页数
    const totalPages = Math.max(1, Math.ceil(validCards.length / CARDS_PER_PAGE));

    // 生成分页 HTML
    const pagesHtml = [];
    for (let page = 0; page < totalPages; page++) {
        const pageCards = validCards.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE);
        const cardsHtml = pageCards.map(name => {
            const list = lists[name];
            const wordCount = countWords(list.words);
            const customColor = getCardColor(name);
            const [color1, color2] = generateGradient(name, customColor);
            return `
                <div class="wordlist-card" data-name="${escapeHtml(name)}" data-in-folder="${escapeHtml(folderName)}">
                    <button class="wordlist-delete" data-name="${escapeHtml(name)}" title="Delete">\u00d7</button>
                    <div class="wordlist-icon" style="background: linear-gradient(135deg, ${color1} 0%, ${color2} 100%)">
                        <span class="wordlist-icon-count">${wordCount}</span>
                    </div>
                    <div class="wordlist-label">${escapeHtml(name)}</div>
                </div>
            `;
        }).join('');
        pagesHtml.push(`<div class="folder-page">${cardsHtml}</div>`);
    }

    // 生成圆点指示器 HTML（仅多页时显示）
    const dotsHtml = totalPages > 1
        ? Array.from({ length: totalPages }, (_, i) =>
            `<div class="folder-page-dot${i === 0 ? ' active' : ''}" data-page="${i}"></div>`
          ).join('')
        : '';

    const overlay = document.createElement('div');
    overlay.className = 'folder-open-overlay';
    overlay.innerHTML = `
        <span class="folder-open-title">${escapeHtml(folderName)}</span>
        <div class="folder-open-view">
            <div class="folder-pages-container">
                ${pagesHtml.join('')}
            </div>
        </div>
        ${totalPages > 1 ? `<div class="folder-page-dots">${dotsHtml}</div>` : ''}
    `;

    document.body.appendChild(overlay);

    // 绑定分页交互
    if (totalPages > 1) {
        bindFolderPagination(overlay, totalPages);
    }

    // 当前文件夹名（可能被重命名）
    let currentFolderName = folderName;

    // 双击标题重命名
    function bindTitleDblClick(titleEl) {
        titleEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'folder-open-title-input';
            input.value = currentFolderName;
            titleEl.replaceWith(input);
            input.focus();
            input.select();

            let saved = false;
            const save = () => {
                if (saved) return;
                saved = true;
                const newName = input.value.trim();
                if (newName && newName !== currentFolderName) {
                    renameFolder(currentFolderName, newName);
                    currentFolderName = newName;
                    if (_renderWordListCards) _renderWordListCards();
                }
                const newTitle = document.createElement('span');
                newTitle.className = 'folder-open-title';
                newTitle.textContent = currentFolderName;
                input.replaceWith(newTitle);
                bindTitleDblClick(newTitle);
            };

            input.addEventListener('blur', save);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); save(); }
                if (e.key === 'Escape') { input.value = currentFolderName; save(); }
            });
        });
    }

    const titleEl = overlay.querySelector('.folder-open-title');
    bindTitleDblClick(titleEl);

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // 文件夹内卡片点击加载
    overlay.querySelectorAll('.wordlist-card').forEach(card => {
        card.addEventListener('click', async (e) => {
            if (e.target.classList.contains('wordlist-delete')) return;
            overlay.remove();
            await loadWordList(card.dataset.name);
        });
    });

    // 文件夹内删除
    overlay.querySelectorAll('.wordlist-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const name = btn.dataset.name;
            const confirmed = await showConfirm(t('deleteCard', { name }));
            if (confirmed) {
                await deleteWordList(name);
                overlay.remove();
                if (_renderWordListCards) _renderWordListCards();
            }
        });
    });

    // 文件夹内拖拽取出卡片
    bindFolderDrag(overlay, folderName);
}

/**
 * 绑定文件夹分页交互（滑动 + 圆点点击）
 */
function bindFolderPagination(overlay, totalPages) {
    const container = overlay.querySelector('.folder-pages-container');
    const view = overlay.querySelector('.folder-open-view');
    const dots = overlay.querySelectorAll('.folder-page-dot');

    let currentPage = 0;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    // 使用页面实际宽度计算翻页偏移
    const firstPage = container.querySelector('.folder-page');
    const pageWidth = firstPage ? firstPage.offsetWidth : view.clientWidth;

    const goToPage = (pageIndex) => {
        pageIndex = Math.max(0, Math.min(totalPages - 1, pageIndex));
        currentPage = pageIndex;
        container.style.transform = `translateX(${-pageIndex * pageWidth}px)`;

        // 更新圆点状态
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === pageIndex);
        });
    };

    // 圆点点击跳转
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const page = parseInt(dot.dataset.page);
            goToPage(page);
        });
    });

    // 触摸/鼠标拖拽
    const onStart = (e) => {
        // 如果点击的是卡片或删除按钮，不启动拖拽
        if (e.target.closest('.wordlist-card')) return;

        isDragging = true;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        currentX = startX;
        container.style.transition = 'none';
    };

    const onMove = (e) => {
        if (!isDragging) return;
        currentX = e.touches ? e.touches[0].clientX : e.clientX;
        const deltaX = currentX - startX;
        const baseOffset = -currentPage * pageWidth;
        container.style.transform = `translateX(${baseOffset + deltaX}px)`;
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        container.style.transition = '';

        const deltaX = currentX - startX;
        const threshold = pageWidth * 0.2;  // 20% 阈值触发翻页

        if (deltaX < -threshold && currentPage < totalPages - 1) {
            goToPage(currentPage + 1);
        } else if (deltaX > threshold && currentPage > 0) {
            goToPage(currentPage - 1);
        } else {
            goToPage(currentPage);  // 回弹
        }
    };

    // 键盘左右翻页
    const onKeyDown = (e) => {
        if (e.key === 'ArrowLeft') {
            goToPage(currentPage - 1);
        } else if (e.key === 'ArrowRight') {
            goToPage(currentPage + 1);
        }
    };

    // 绑定事件
    view.addEventListener('touchstart', onStart, { passive: true });
    view.addEventListener('touchmove', onMove, { passive: true });
    view.addEventListener('touchend', onEnd);

    view.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('keydown', onKeyDown);

    // overlay 移除时清理事件
    const observer = new MutationObserver(() => {
        if (!document.body.contains(overlay)) {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('keydown', onKeyDown);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true });
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
        const folderItem = layout.items.find(item => item.type === 'folder' && item.name === folderName);
        if (folderItem) {
            folderItem.items = folderItem.items.filter(n => n !== name);
            // 文件夹为空则删除
            if (folderItem.items.length === 0) {
                const idx = layout.items.indexOf(folderItem);
                layout.items.splice(idx, 1);
            }
            // 将卡片放到文件夹后面
            const folderIdx = layout.items.indexOf(folderItem);
            const insertIdx = folderIdx >= 0 ? folderIdx + 1 : layout.items.length;
            layout.items.splice(insertIdx, 0, { type: 'card', name });
            saveLayout(layout);
        }

        overlay.remove();
        if (_renderWordListCards) _renderWordListCards();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
}
