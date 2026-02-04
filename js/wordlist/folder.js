/**
 * 文件夹展开和内部拖拽模块 - iOS 风格
 */

import { escapeHtml } from '../utils.js';
import { getWordLists, loadWordList, getCardColor, getFolders, addOrUpdateFolder, removeFolder } from './storage.js';
import { getLayout, saveLayout, deleteWordList, isFolderNameExists, syncLayoutToServer } from './layout.js';
import { showConfirm, showAlert } from '../utils/dialog.js';
import { CARD_COLORS, getCurrentThemeColors } from './render.js';
import { t } from '../i18n/index.js';
import { authToken, isLoggedIn } from '../auth/state.js';
import { showToast } from '../utils.js';
import { isEditMode, enterEditMode } from './drag.js';
import { showColorPicker, hideColorPicker } from './colorpicker.js';
import { bindPointerInteraction } from './interactions.js';

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
    const folders = getFolders();

    // 查找文件夹
    const folder = Object.values(folders).find(f => f.name === oldName);
    if (folder) {
        // 更新文件夹缓存：删除旧名称，添加新名称
        const folderData = { ...folder, name: newName };
        removeFolder(oldName);
        addOrUpdateFolder(newName, folderData);
        console.log('[Folder] 文件夹重命名，缓存已更新:', oldName, '->', newName);

        return true;
    }
    return false;
}

/**
 * 打开文件夹视图
 * @param {string} folderName 文件夹名称
 */
export async function openFolder(folderName) {
    const folders = getFolders();

    // 根据名称查找文件夹
    const folder = Object.values(folders).find(f => f.name === folderName);
    if (!folder) {
        console.error('[Folder] 找不到文件夹:', folderName);
        return;
    }

    // 检查是否为公开文件夹
    const isPublic = folder.is_public || false;
    const publicFolderId = folder.publicFolderId;

    let lists;
    let validCards;

    if (isPublic && publicFolderId) {
        // 公开文件夹：从 API 获取实时内容
        try {
            const content = await fetchPublicFolderContent(publicFolderId);
            lists = {};
            validCards = [];

            // 将 API 返回的卡片转换为 lists 格式
            content.cards.forEach(card => {
                lists[card.name] = {
                    name: card.name,
                    words: card.words,
                    translations: card.translations,
                    wordInfo: card.wordInfo
                };
                validCards.push(card.name);
            });
        } catch (error) {
            console.error('[文件夹] 获取公开文件夹内容失败:', error);
            showToast(t('loadFailed') || '加载失败', 'error');
            return;
        }
    } else {
        // 自己的文件夹：使用 folder.cards (ID 数组)
        lists = getWordLists();

        // 建立 ID → 卡片的映射
        const cardById = {};
        for (const card of Object.values(lists)) {
            if (card.id) cardById[card.id] = card;
        }

        // 根据 ID 数组获取卡片名称
        validCards = folder.cards
            .map(cardId => {
                const card = cardById[cardId];
                return card ? card.name : null;
            })
            .filter(name => name !== null);
    }

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

            // 只读模式下不显示删除按钮
            const deleteBtn = isPublic ? '' : `<button class="wordlist-delete" data-name="${escapeHtml(name)}" title="Delete">&times;</button>`;

            return `
                <div class="wordlist-card ${isPublic ? 'readonly' : ''}" data-name="${escapeHtml(name)}" data-in-folder="${escapeHtml(folderName)}">
                    ${deleteBtn}
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
        <span class="folder-open-title ${isPublic ? 'readonly' : ''}">${escapeHtml(folderName)}</span>
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

    // 检查桌面是否在编辑模式
    const inEditMode = isEditMode();
    if (inEditMode && !isPublic) {
        // 如果桌面在编辑模式，文件夹内卡片也抖动
        overlay.querySelectorAll('.wordlist-card').forEach(card => {
            card.classList.add('edit-mode');
        });
    }

    // 当前文件夹名（可能被重命名）
    let currentFolderName = folderName;

    // 双击标题重命名
    // 发布者的公开文件夹（isPublic && !ownerEmail）不允许重命名
    // 添加者的公开文件夹（isPublic && ownerEmail）允许重命名
    // 普通文件夹允许重命名
    const isOwner = isPublic && !folder.ownerEmail;  // 发布者
    const isAdder = isPublic && folder.ownerEmail;   // 添加者

    if (!isOwner) {  // 非发布者可以重命名
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
                const save = async () => {
                    if (saved) return;
                    saved = true;
                    const newName = input.value.trim();

                    // 检查是否为空或无变化
                    if (!newName || newName === currentFolderName) {
                        // 恢复原标题
                        const newTitle = document.createElement('span');
                        newTitle.className = 'folder-open-title';
                        newTitle.textContent = currentFolderName;
                        input.replaceWith(newTitle);
                        bindTitleDblClick(newTitle);
                        return;
                    }

                    // 检查是否与其他文件夹重名
                    if (isFolderNameExists(newName)) {
                        await showAlert(t('folderNameExists', { name: newName }));

                        // 恢复原标题（不保存重复名称）
                        const newTitle = document.createElement('span');
                        newTitle.className = 'folder-open-title';
                        newTitle.textContent = currentFolderName;
                        input.replaceWith(newTitle);
                        bindTitleDblClick(newTitle);
                        return;
                    }

                    // 名称有效且不重复，执行重命名
                    let success = false;

                    if (isAdder) {
                        // 添加者的公开文件夹：调用专用API
                        try {
                            const response = await fetch('/api/public/folder/rename', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${authToken}`
                                },
                                body: JSON.stringify({
                                    publicFolderId: folder.publicFolderId,
                                    newDisplayName: newName
                                })
                            });

                            if (!response.ok) {
                                const error = await response.json();
                                throw new Error(error.error || '重命名失败');
                            }

                            const data = await response.json();

                            // 更新本地 layout
                            if (data.layout) {
                                saveLayout(data.layout);
                            }

                            success = true;
                            currentFolderName = newName;
                            if (_renderWordListCards) _renderWordListCards();

                            console.log('[Folder] 公开文件夹重命名成功:', newName);
                        } catch (error) {
                            console.error('[Folder] 公开文件夹重命名失败:', error);
                            showToast(error.message || '重命名失败', 'error');
                        }
                    } else {
                        // 普通文件夹：使用原有逻辑
                        success = renameFolder(currentFolderName, newName);
                        if (success) {
                            currentFolderName = newName;
                            if (_renderWordListCards) _renderWordListCards();

                            // 关键修复：立即同步到云端
                            if (isLoggedIn()) {
                                console.log('[Folder] 文件夹重命名，开始同步到云端...');
                                const result = await syncLayoutToServer();

                                if (result.success) {
                                    console.log('[Folder] 云端同步成功');
                                } else if (result.error) {
                                    console.error('[Folder] 云端同步失败:', result.error);
                                    showToast(`保存失败: ${result.error}`, 'error', 5000);
                                }
                            }
                        }
                    }

                    // 更新标题显示
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
    }

    // 文件夹内卡片点击加载
    overlay.querySelectorAll('.wordlist-card').forEach(card => {
        card.addEventListener('click', async (e) => {
            if (e.target.classList.contains('wordlist-delete')) return;

            // 检查是否在编辑模式
            if (isEditMode()) {
                // 编辑模式：显示颜色选择器
                e.stopPropagation();
                showColorPicker(card);
                return;
            }

            // 非编辑模式：关闭文件夹并加载单词卡
            overlay.remove();
            await loadWordList(card.dataset.name);
        });
    });

    // 文件夹内删除（只读模式下不绑定）
    if (!isPublic) {
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

        // 文件夹内拖拽取出卡片（只读模式下不绑定）
        const view = overlay.querySelector('.folder-open-view');
        const container = overlay.querySelector('.folder-pages-container');
        const pages = overlay.querySelectorAll('.folder-page');
        bindFolderInteractions(overlay, folderName, view, container, pages);
    }
}

/**
 * 获取公开文件夹的实时内容
 */
async function fetchPublicFolderContent(publicFolderId) {
    const token = authToken;
    if (!token) {
        throw new Error('请先登录');
    }

    const response = await fetch(`/api/public/folder/${publicFolderId}/content`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error(`获取内容失败: ${response.status}`);
    }

    const data = await response.json();
    return data;
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

/**
 * 绑定文件夹内卡片交互 - 使用统一交互管理
 */
function bindFolderInteractions(overlay, folderName, view, container, pages) {
    const inEditMode = isEditMode();

    overlay.querySelectorAll('.wordlist-card').forEach(card => {
        if (inEditMode) {
            // 编辑模式：拖拽排序（点击事件由 folder.js:241 的 click 监听器处理）
            bindPointerInteraction(card, {
                onDrag: (el, startEvent) => {
                    hideColorPicker();
                    startFolderCardDrag(startEvent, el, overlay, folderName, view, container, pages);
                }
            });
        } else {
            // 非编辑模式：长按进入编辑模式
            bindPointerInteraction(card, {
                onLongPress: (el) => {
                    console.log('[Folder] 文件夹内长按，进入编辑模式');

                    // 进入编辑模式
                    const workplace = document.querySelector('#wordlistContent');
                    if (workplace) {
                        enterEditMode(workplace);
                    }

                    // 文件夹内卡片同步编辑模式
                    console.log('[Folder] 文件夹内同步编辑模式状态');
                    overlay.querySelectorAll('.wordlist-card').forEach(c => {
                        c.classList.add('edit-mode');
                    });

                    // 显示色环
                    showColorPicker(el);

                    // 振动反馈
                    if (navigator.vibrate) {
                        navigator.vibrate(10);
                    }
                },
                onDrag: (el, startEvent) => {
                    hideColorPicker();
                    startFolderCardDrag(startEvent, el, overlay, folderName, view, container, pages);
                }
            });
        }
    });
}

function startFolderCardDrag(startEvent, card, overlay, folderName, view, container, pages) {
    const name = card.dataset.name;
    card.classList.add('dragging');

    // 创建拖拽克隆
    const clone = card.cloneNode(true);
    clone.className = 'wordlist-card drag-clone';
    const rect = card.getBoundingClientRect();
    clone.style.width = rect.width + 'px';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    document.body.appendChild(clone);

    const offsetX = startEvent.clientX - rect.left;
    const offsetY = startEvent.clientY - rect.top;

    // 获取文件夹边界
    const viewRect = view.getBoundingClientRect();

    // 分页信息
    const totalPages = pages.length;
    let currentPage = getCurrentPage(container, pages);

    // 边缘翻页状态
    let edgeScrollTimer = null;
    let isOutsideFolder = false;

    const onMove = (e) => {
        // 更新克隆位置
        clone.style.left = (e.clientX - offsetX) + 'px';
        clone.style.top = (e.clientY - offsetY) + 'px';

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        // 动态获取当前页（因为可能已通过拖拽边缘或手动翻页）
        currentPage = getCurrentPage(container, pages);

        // 检测是否在文件夹边界外
        isOutsideFolder = (
            mouseX < viewRect.left ||
            mouseX > viewRect.right ||
            mouseY < viewRect.top ||
            mouseY > viewRect.bottom
        );

        if (isOutsideFolder) {
            // 在边界外：关闭文件夹（视觉上淡出）
            overlay.style.opacity = '0.3';
        } else {
            // 在边界内：恢复显示
            overlay.style.opacity = '1';

            // 文件夹内排序：计算插入位置
            const currentPageEl = pages[currentPage];
            const cardsInPage = Array.from(currentPageEl.querySelectorAll('.wordlist-card'));
            const insertIndex = calculateInsertIndexInFolder(e, cardsInPage, card);

            if (insertIndex !== -1) {
                reorderFolderCards(currentPageEl, card, insertIndex);
            }

            // 边缘翻页（多页时）
            if (totalPages > 1) {
                const dragX = mouseX - viewRect.left;
                const edgeThreshold = viewRect.width * 0.15;

                // 左边缘 → 上一页
                if (dragX < edgeThreshold && currentPage > 0) {
                    if (!edgeScrollTimer) {
                        edgeScrollTimer = setTimeout(() => {
                            currentPage--;
                            goToPage(container, pages, currentPage);
                            edgeScrollTimer = null;
                        }, 500);
                    }
                }
                // 右边缘 → 下一页
                else if (dragX > viewRect.width - edgeThreshold && currentPage < totalPages - 1) {
                    if (!edgeScrollTimer) {
                        edgeScrollTimer = setTimeout(() => {
                            currentPage++;
                            goToPage(container, pages, currentPage);
                            edgeScrollTimer = null;
                        }, 500);
                    }
                }
                // 离开边缘
                else {
                    if (edgeScrollTimer) {
                        clearTimeout(edgeScrollTimer);
                        edgeScrollTimer = null;
                    }
                }
            }
        }
    };

    const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        clone.remove();
        card.classList.remove('dragging');

        if (edgeScrollTimer) {
            clearTimeout(edgeScrollTimer);
        }

        overlay.style.opacity = '1';

        // 获取当前布局和文件夹数据
        let layout = getLayout();  // 字符串数组：["card_1", "folder_2"]
        const folders = getFolders();  // 对象：{ "folderName": { id, name, cards: [1,2,3] } }
        const folder = folders[folderName];

        if (!folder) {
            console.error('[Folder] 文件夹不存在:', folderName);
            return;
        }

        // 获取卡片 ID
        const lists = getWordLists();
        const cardData = Object.values(lists).find(c => c.name === name);
        if (!cardData || !cardData.id) {
            console.error('[Folder] 卡片 ID 不存在:', name);
            return;
        }
        const cardId = cardData.id;

        if (isOutsideFolder) {
            // 拖到边界外：从文件夹中移除，放到桌面
            console.log('[Folder] 卡片拖出文件夹:', name);

            // 从文件夹的 cards 数组中移除卡片 ID
            folder.cards = folder.cards.filter(id => id !== cardId);
            addOrUpdateFolder(folderName, folder);
            console.log('[Folder] 文件夹已更新，移除卡片 ID:', cardId);

            // 将卡片添加回 layout（在文件夹后面）
            const folderLayoutId = `folder_${folder.id}`;
            const folderIdx = layout.indexOf(folderLayoutId);
            const insertIdx = folderIdx >= 0 ? folderIdx + 1 : layout.length;
            layout.splice(insertIdx, 0, `card_${cardId}`);
            console.log('[Folder] 卡片已添加回 layout，位置:', insertIdx);

            // 如果文件夹为空，删除文件夹
            if (folder.cards.length === 0) {
                layout = layout.filter(item => item !== folderLayoutId);
                removeFolder(folderName);
                console.log('[Folder] 空文件夹已删除:', folderName);
            }

            saveLayout(layout);
            syncLayoutToServer();

            // 关闭文件夹
            overlay.remove();
            if (_renderWordListCards) _renderWordListCards();
        } else {
            // 在文件夹内：更新文件夹内卡片顺序
            console.log('[Folder] 更新文件夹内卡片顺序');

            const newOrder = [];
            pages.forEach(page => {
                page.querySelectorAll('.wordlist-card').forEach(c => {
                    const cardName = c.dataset.name;
                    if (cardName) {
                        const card = Object.values(lists).find(l => l.name === cardName);
                        if (card && card.id && !newOrder.includes(card.id)) {
                            newOrder.push(card.id);
                        }
                    }
                });
            });

            folder.cards = newOrder;
            addOrUpdateFolder(folderName, folder);
            saveLayout(layout);
            syncLayoutToServer();
            console.log('[Folder] 文件夹内卡片顺序已更新:', newOrder);
        }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
}

/**
 * 计算文件夹内插入位置
 */
function calculateInsertIndexInFolder(e, cards, draggedCard) {
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (card === draggedCard) continue;

        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        if (mouseY < centerY - rect.height / 4) {
            return i;
        }
        if (mouseY < centerY + rect.height / 4 && mouseX < centerX) {
            return i;
        }
    }

    return cards.length;
}

/**
 * 文件夹内 DOM 重排（FLIP 动画）
 */
function reorderFolderCards(pageEl, draggedCard, targetIdx) {
    const cards = Array.from(pageEl.querySelectorAll('.wordlist-card'));
    const currentIdx = cards.indexOf(draggedCard);

    if (currentIdx === targetIdx || currentIdx === -1) return;

    // First - 记录初始位置
    const firstRects = new Map();
    cards.forEach(card => {
        if (card !== draggedCard) {
            firstRects.set(card, card.getBoundingClientRect());
        }
    });

    // 执行 DOM 重排
    if (targetIdx >= cards.length) {
        pageEl.appendChild(draggedCard);
    } else {
        const targetCard = cards[targetIdx];
        if (targetCard !== draggedCard) {
            pageEl.insertBefore(draggedCard, targetCard);
        }
    }

    // Last & Invert & Play - FLIP 动画
    firstRects.forEach((firstRect, card) => {
        const lastRect = card.getBoundingClientRect();
        const dx = firstRect.left - lastRect.left;
        const dy = firstRect.top - lastRect.top;

        if (dx !== 0 || dy !== 0) {
            card.style.transform = `translate(${dx}px, ${dy}px)`;
            card.style.transition = 'none';
            card.offsetHeight;
            card.style.transition = 'transform 0.25s cubic-bezier(0.28, 0.11, 0.32, 1)';
            card.style.transform = '';
        }
    });
}

/**
 * 获取当前页码
 */
function getCurrentPage(container, pages) {
    if (!container || pages.length === 0) return 0;
    const pageWidth = pages[0].offsetWidth;
    const transform = container.style.transform;
    const match = transform.match(/translateX\((-?\d+)px\)/);
    if (match) {
        const offset = parseInt(match[1]);
        return Math.round(Math.abs(offset) / pageWidth);
    }
    return 0;
}

/**
 * 跳转到指定页
 */
function goToPage(container, pages, pageIndex) {
    if (!container || pages.length === 0) return;
    const pageWidth = pages[0].offsetWidth;
    pageIndex = Math.max(0, Math.min(pages.length - 1, pageIndex));
    container.style.transform = `translateX(${-pageIndex * pageWidth}px)`;

    const dots = document.querySelectorAll('.folder-page-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === pageIndex);
    });
}
