/**
 * 单词卡布局管理模块
 * 管理卡片和文件夹的排列顺序（CSS Grid 自动布局）
 */

import { getWordcards, removeWordcardFromStorage, removeWordcardsFromStorage, getCardColors, getFolders, removeFolder, removeCardFromAllFolders, isCardInAnyFolder, getPublicFolders, setPublicFoldersCache } from './storage.js';
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
    const lists = getWordcards();
    const entries = Object.values(lists).sort((a, b) =>
        new Date(b.updated || b.created) - new Date(a.updated || a.created)
    );

    // 返回字符串数组格式
    return entries.map(list => `card_${list.id}`);
}

/**
 * 同步 layout 和实际 wordcards（处理新增/删除的列表）
 * @param {Array<string>} layout 字符串数组
 * @returns {Array<string>} 同步后的字符串数组
 */
function syncLayout(layout) {
    const lists = getWordcards();
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

    // 过滤掉不存在的项和公开卡片
    const validLayout = layout.filter(item => {
        if (item.startsWith('card_')) {
            const cardId = parseInt(item.substring(5));
            if (!cardIds.has(cardId)) {
                return false;  // 卡片不存在，移除
            }
            // 【修复】检查是否为公开卡片
            const card = Object.values(lists).find(c => c.id === cardId);
            if (card && card.isPublic === true) {
                console.log(`[Layout] 从 layout 移除公开卡片: card_${cardId}`);
                return false;  // 公开卡片不应该在 layout 中，移除
            }
            return true;
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
        const inLayout = layoutCardIds.has(cardId);
        const inFolder = isCardInAnyFolder(cardId);

        // 【修复】检查卡片是否为公开文件夹的卡片
        const card = Object.values(lists).find(c => c.id === cardId);
        const isPublicCard = card && card.isPublic === true;

        if (isPublicCard) {
            // 公开文件夹的卡片不应该出现在用户的桌面 layout 中，跳过
            console.log(`[Layout] 跳过公开卡片: card_${cardId}`);
            continue;
        }

        if (!inLayout && !inFolder) {
            // 卡片不在 layout 中，也不在任何文件夹中，添加到 layout
            console.log(`[Layout] syncLayout 添加缺失卡片: card_${cardId}`);
            validLayout.push(`card_${cardId}`);
        } else if (inLayout && inFolder) {
            // ⚠️ 检测到卡片同时在 layout 和文件夹中（不应该发生）
            // 【自动修复】从 layout 中移除重复的卡片（卡片应该只在文件夹中）
            console.warn(`[Layout] ⚠️ 数据不一致: card_${cardId} 同时在 layout 和文件夹中，自动修复中...`);
            console.warn(`[网页控制台] ⚠️ 数据不一致: card_${cardId} 同时在 layout 和文件夹中，自动修复中...`);

            // 从 validLayout 中移除这个卡片
            const cardKey = `card_${cardId}`;
            const filteredLayout = validLayout.filter(item => item !== cardKey);
            validLayout.length = 0;  // 清空数组
            validLayout.push(...filteredLayout);  // 重新填充
            console.log(`[Layout] ✅ 已从 layout 移除重复卡片: ${cardKey}`);
            console.log(`[网页控制台] ✅ 已从 layout 移除重复卡片: ${cardKey}`);
        }
    }

    return validLayout;
}

/**
 * 删除单词卡（同时更新 storage 和 layout）
 */
export async function deleteWordcard(name) {
    // 先获取卡片信息（删除前）
    const lists = getWordcards();
    const card = Object.values(lists).find(c => c.name === name);

    if (!card) return false;

    if (!card.id) {
        console.error('[Layout] deleteWordcard 失败: 卡片缺少 ID');
        return false;
    }

    // 删除服务器数据（使用 ID）
    await removeWordcardFromStorage(card.id);

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
 * 删除文件夹（同时删除其中的所有单词卡）
 */
export async function deleteFolder(folderName) {
    const folders = getFolders();
    const folder = Object.values(folders).find(f => f.name === folderName);

    if (folder) {
        // 删除文件夹中的所有单词卡（直接使用 ID）
        await removeWordcardsFromStorage(folder.cards);

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
