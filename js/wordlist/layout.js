/**
 * 单词表布局管理模块
 * 管理卡片和文件夹的排列顺序（CSS Grid 自动布局）
 */

import { getWordLists, removeWordListFromStorage, removeWordListsFromStorage, getCardColors, getFolders, removeFolder, removeCardFromAllFolders, isCardInAnyFolder, getPublicFolders, setPublicFoldersCache } from './storage.js';
import { syncLayoutToCloud } from '../auth/sync.js';
import { authToken } from '../auth/state.js';

// ============================================
// 布局内存缓存（不使用 localStorage）
// 后端格式：["card_1", "folder_2", "public_3"]
// ============================================
let _layoutCache = null;

/**
 * 获取布局（从内存缓存）
 * @returns {Array<string>} 字符串数组，如 ["card_1", "folder_2"]
 */
export function getLayout() {
    if (_layoutCache) {
        return syncLayout(_layoutCache);
    }
    return buildDefaultLayout();
}

/**
 * 保存布局（仅保存到内存）
 * @param {Array<string>} layout 字符串数组
 */
export function saveLayout(layout) {
    _layoutCache = Array.isArray(layout) ? layout : [];
}

/**
 * 设置布局（用于登录后同步）
 * @param {Array<string>} layout 字符串数组
 */
export function setLayout(layout) {
    _layoutCache = Array.isArray(layout) ? layout : [];
}

/**
 * 构建默认布局（按更新时间排序）
 * @returns {Array<string>} 字符串数组，如 ["card_1", "card_2"]
 */
function buildDefaultLayout() {
    const lists = getWordLists();
    const entries = Object.values(lists).sort((a, b) =>
        new Date(b.updated || b.created) - new Date(a.updated || a.created)
    );

    // 返回字符串数组格式
    return entries.map(list => `card_${list.id}`);
}

/**
 * 同步 layout 和实际 wordlists（处理新增/删除的列表）
 * @param {Array<string>} layout 字符串数组
 * @returns {Array<string>} 同步后的字符串数组
 */
function syncLayout(layout) {
    const lists = getWordLists();
    const folders = getFolders();

    // 建立 ID 集合
    const cardIds = new Set();
    for (const card of Object.values(lists)) {
        if (card.id) cardIds.add(card.id);
    }

    const folderIds = new Set();
    for (const folder of Object.values(folders)) {
        if (folder.id) folderIds.add(folder.id);
    }

    // 过滤掉不存在的项
    const validLayout = layout.filter(item => {
        if (item.startsWith('card_')) {
            const cardId = parseInt(item.substring(5));
            return cardIds.has(cardId);
        } else if (item.startsWith('folder_')) {
            // 保留临时文件夹 ID（folder_temp_*）
            if (item.startsWith('folder_temp_')) {
                return true;
            }
            const folderId = parseInt(item.substring(7));
            return folderIds.has(folderId);
        } else if (item.startsWith('public_')) {
            // 公开文件夹暂时保留
            return true;
        }
        return false;
    });

    // 添加新卡片（不在 layout 中的）
    const layoutCardIds = new Set();
    for (const item of validLayout) {
        if (item.startsWith('card_')) {
            layoutCardIds.add(parseInt(item.substring(5)));
        }
    }

    for (const cardId of cardIds) {
        if (!layoutCardIds.has(cardId) && !isCardInAnyFolder(cardId)) {
            validLayout.push(`card_${cardId}`);
        }
    }

    return validLayout;
}

/**
 * 删除单词表（同时更新 storage 和 layout）
 */
export async function deleteWordList(name) {
    // 先获取卡片信息（删除前）
    const lists = getWordLists();
    const card = Object.values(lists).find(c => c.name === name);

    if (!card) return false;

    if (!card.id) {
        console.error('[Layout] deleteWordList 失败: 卡片缺少 ID');
        return false;
    }

    // 删除服务器数据（使用 ID）
    await removeWordListFromStorage(card.id);

    // 从 layout 中移除
    let layout = getLayout();
    layout = layout.filter(item => item !== `card_${card.id}`);
    saveLayout(layout);

    // 从所有文件夹中移除引用
    const foldersUpdated = removeCardFromAllFolders(card.id);

    // 如果更新了文件夹，同步到服务器
    if (foldersUpdated) {
        await syncLayoutToServer();
        console.log('[Layout] 文件夹更新已同步到服务器');
        console.log('[Server] 文件夹更新已同步到服务器');
    }

    return true;
}

/**
 * 检查文件夹名称是否已存在
 */
export function isFolderNameExists(folderName) {
    const folders = getFolders();
    return Object.keys(folders).some(name => name === folderName);
}

/**
 * 同步布局到服务端（退出编辑模式时调用）
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function syncLayoutToServer() {
    const layout = getLayout();
    const cardColors = getCardColors();
    const folders = getFolders();
    return await syncLayoutToCloud(layout, cardColors, folders);
}

/**
 * 删除文件夹（同时删除其中的所有单词表）
 */
export async function deleteFolder(folderName) {
    const folders = getFolders();
    const folder = Object.values(folders).find(f => f.name === folderName);

    if (folder) {
        // 删除文件夹中的所有单词表（直接使用 ID）
        await removeWordListsFromStorage(folder.cards);

        // 从 layout 中移除文件夹
        let layout = getLayout();
        layout = layout.filter(item => item !== `folder_${folder.id}`);
        saveLayout(layout);

        // 从文件夹缓存中删除
        removeFolder(folderName);
        console.log('[Layout] 文件夹已删除，缓存已更新:', folderName);

        // 同步到服务器
        await syncLayoutToServer();
        console.log('[Layout] 文件夹删除已同步到服务器:', folderName);
        console.log('[Server] 文件夹删除已同步到服务器:', folderName);
    }
}

/**
 * 删除公开文件夹引用
 */
export async function deletePublicFolderRef(refId, displayName) {
    console.log('[Layout] 删除公开文件夹引用:', refId, displayName);
    console.log('[Server] 删除公开文件夹引用:', refId, displayName);

    // 先从缓存中移除（乐观更新）
    const publicFolders = getPublicFolders();
    const updatedFolders = publicFolders.filter(f => f.id !== refId);
    setPublicFoldersCache(updatedFolders);
    console.log('[Layout] 已从缓存中移除公开文件夹:', displayName);
    console.log('[Server] 已从缓存中移除公开文件夹:', displayName);

    // 从 layout 中移除
    let layout = getLayout();
    const originalLayout = [...layout]; // 备份原始layout
    layout = layout.filter(item => item !== `public_${refId}`);
    saveLayout(layout);

    // 调用服务器 API 删除引用
    const token = authToken;
    if (token) {
        try {
            const response = await fetch('/api/public/folder/remove', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ displayName: displayName })
            });

            if (!response.ok) {
                console.error('[Layout] 删除公开文件夹引用失败:', response.status);
                console.error('[Server] 删除公开文件夹引用失败:', response.status);

                // 恢复缓存和layout
                setPublicFoldersCache(publicFolders);
                saveLayout(originalLayout);

                throw new Error('删除失败，请重试');
            } else {
                const data = await response.json();
                console.log('[Layout] 公开文件夹引用已从服务器删除:', refId);
                console.log('[Server] 公开文件夹引用已从服务器删除:', refId);

                // 使用服务器返回的layout（如果有）
                if (data.layout) {
                    saveLayout(data.layout);
                }
            }
        } catch (error) {
            console.error('[Layout] 删除公开文件夹引用时出错:', error);
            console.error('[Server] 删除公开文件夹引用时出错:', error);

            // 恢复缓存和layout
            setPublicFoldersCache(publicFolders);
            saveLayout(originalLayout);

            throw error; // 重新抛出错误，让调用者处理
        }
    }

    // 不需要再次同步到服务器，因为已经调用了API
}
