/**
 * 单词表布局管理模块
 * 管理卡片和文件夹的排列顺序
 */

import { getWordLists, removeWordListFromStorage, removeWordListsFromStorage } from './storage.js';

const LAYOUT_KEY = 'wordlist_layout';

/**
 * 获取布局
 */
export function getLayout() {
    try {
        const data = localStorage.getItem(LAYOUT_KEY);
        if (data) {
            const layout = JSON.parse(data);
            return syncLayout(layout);
        }
    } catch (e) {}
    return buildDefaultLayout();
}

/**
 * 保存布局
 */
export function saveLayout(layout) {
    try {
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
    return entries.map(list => ({ type: 'card', name: list.name }));
}

/**
 * 同步 layout 和实际 wordlists（处理新增/删除的列表）
 */
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

/**
 * 删除单词表（同时更新 storage 和 layout）
 */
export function deleteWordList(name) {
    removeWordListFromStorage(name);

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
}

/**
 * 删除文件夹（同时删除其中的所有单词表）
 */
export function deleteFolder(folderName) {
    const layout = getLayout();
    const folderItem = layout.find(item => item.type === 'folder' && item.name === folderName);

    if (folderItem) {
        // 删除文件夹中的所有单词表
        removeWordListsFromStorage(folderItem.items);

        // 从 layout 中移除文件夹
        const newLayout = layout.filter(item => !(item.type === 'folder' && item.name === folderName));
        saveLayout(newLayout);
    }
}
