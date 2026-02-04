/**
 * 单词表布局管理模块
 * 管理卡片和文件夹的排列顺序（CSS Grid 自动布局）
 */

import { getWordLists, removeWordListFromStorage, removeWordListsFromStorage, getCardColors, getFolders, removeFolder } from './storage.js';
import { syncLayoutToCloud } from '../auth/sync.js';

const LAYOUT_KEY = 'wordlist_layout';
const LAYOUT_VERSION = 3;

/**
 * 将旧版 row/col 布局转换为纯顺序数组
 */
function migrateFromGrid(oldLayout) {
    const items = oldLayout.items || [];

    // 如果已经没有 row/col，直接返回
    if (items.length === 0 || items[0].row === undefined) {
        return { version: LAYOUT_VERSION, items };
    }

    // 按 row/col 排序
    const sortedItems = [...items].sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
    });

    // 删除 row/col 属性
    const newItems = sortedItems.map(item => {
        const { row, col, ...rest } = item;
        return rest;
    });

    return { version: LAYOUT_VERSION, items: newItems };
}

/**
 * 获取布局
 */
export function getLayout() {
    try {
        const data = localStorage.getItem(LAYOUT_KEY);
        if (data) {
            let layout = JSON.parse(data);

            // 检测并迁移旧版格式（有 row/col 的转为纯顺序）
            if (Array.isArray(layout)) {
                // v1 格式：直接是数组
                layout = migrateFromGrid({ items: layout });
                saveLayout(layout);
            } else if (!layout.version || layout.version < LAYOUT_VERSION) {
                // 旧版格式
                layout = migrateFromGrid(layout);
                saveLayout(layout);
            }

            return syncLayout(layout);
        }
    } catch (e) {
        console.error('Failed to load layout:', e);
    }
    return buildDefaultLayout();
}

/**
 * 保存布局
 */
export function saveLayout(layout) {
    try {
        if (!layout.version) {
            layout = { version: LAYOUT_VERSION, items: layout.items || [] };
        }
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch (e) {
        console.error('Failed to save layout:', e);
    }
}

/**
 * 构建默认布局（按更新时间排序）
 */
function buildDefaultLayout() {
    const lists = getWordLists();
    const entries = Object.values(lists).sort((a, b) =>
        new Date(b.updated || b.created) - new Date(a.updated || a.created)
    );

    const items = entries.map(list => ({ type: 'card', name: list.name }));

    return { version: LAYOUT_VERSION, items };
}

/**
 * 同步 layout 和实际 wordlists（处理新增/删除的列表）
 */
function syncLayout(layout) {
    const lists = getWordLists();
    const allNames = new Set(Object.keys(lists));
    const layoutNames = new Set();

    // 收集 layout 中所有名称
    layout.items.forEach(item => {
        if (item.type === 'card') layoutNames.add(item.name);
        if (item.type === 'folder') item.items.forEach(n => layoutNames.add(n));
    });

    // 移除 layout 中已不存在的列表
    layout.items = layout.items.filter(item => {
        if (item.type === 'card') return allNames.has(item.name);
        if (item.type === 'folder') {
            item.items = item.items.filter(n => allNames.has(n));
            return item.items.length > 0;
        }
        return false;
    });

    // 新列表追加到末尾
    allNames.forEach(name => {
        if (!layoutNames.has(name)) {
            layout.items.push({ type: 'card', name });
        }
    });

    return layout;
}

/**
 * 删除单词表（同时更新 storage 和 layout）
 */
export async function deleteWordList(name) {
    await removeWordListFromStorage(name);

    // 从 layout 中移除
    let layout = getLayout();
    layout.items = layout.items.filter(item => {
        if (item.type === 'card' && item.name === name) return false;
        if (item.type === 'folder') {
            item.items = item.items.filter(n => n !== name);
            return item.items.length > 0;
        }
        return true;
    });
    saveLayout(layout);
    return true;
}

/**
 * 检查文件夹名称是否已存在
 */
export function isFolderNameExists(folderName) {
    const layout = getLayout();
    return layout.items.some(item => item.type === 'folder' && item.name === folderName);
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
    const layout = getLayout();
    const folderItem = layout.items.find(item => item.type === 'folder' && item.name === folderName);

    if (folderItem) {
        // 删除文件夹中的所有单词表
        await removeWordListsFromStorage(folderItem.items);

        // 从 layout 中移除文件夹
        layout.items = layout.items.filter(item => !(item.type === 'folder' && item.name === folderName));
        saveLayout(layout);

        // 从文件夹缓存中删除
        removeFolder(folderName);
        console.log('[Layout] 文件夹已删除，缓存已更新:', folderName);
    }
}
