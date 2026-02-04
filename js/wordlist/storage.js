/**
 * 单词表存储模块
 * 纯服务端存储，不再使用 localStorage 存储单词表数据
 */

import { $, detectLanguageFromInput, setTargetLang, updateAccentSelectorVisibility } from '../utils.js';
import { t } from '../i18n/index.js';
import { preloadCache, setLoadedWordList } from '../state.js';
import { startPreload } from '../preload.js';
import { API_BASE } from '../api.js';
import { isLoggedIn, getAuthHeader } from '../auth/state.js';
import { showLoginDialog } from '../auth/login.js';

const CARD_COLORS_KEY = 'cardColors';  // 保留用于数据迁移
const FOLDERS_KEY = 'folders';

// 内存缓存：存储从服务端拉取的单词表列表
let _wordlistsCache = {};

// 内存缓存：存储文件夹数据
let _foldersCache = {};

// 内存缓存：存储公开文件夹引用
let _publicFoldersCache = [];

/**
 * 从服务端拉取所有单词表
 * @returns {Promise<object>} 单词表对象 { name: { name, words, created, updated }, ... }
 */
export async function fetchWordLists() {
    if (!isLoggedIn()) {
        _wordlistsCache = {};
        return {};
    }

    try {
        const response = await fetch(`${API_BASE}/api/sync/pull`, {
            method: 'GET',
            headers: getAuthHeader()
        });

        if (!response.ok) {
            console.error('Failed to fetch wordlists:', response.status);
            return _wordlistsCache;
        }

        const data = await response.json();
        _wordlistsCache = data.wordlists || {};
        return _wordlistsCache;
    } catch (e) {
        console.error('Failed to fetch wordlists:', e);
        return _wordlistsCache;
    }
}

/**
 * 获取所有单词表（从内存缓存）
 * 注意：调用前需要先调用 fetchWordLists() 从服务端拉取
 */
export function getWordLists() {
    return _wordlistsCache;
}

/**
 * 设置单词表缓存（用于登录后同步）
 */
export function setWordListsCache(wordlists) {
    _wordlistsCache = wordlists || {};
}

/**
 * 清空单词表缓存（用于登出）
 */
export function clearWordListsCache() {
    _wordlistsCache = {};
}

/**
 * 保存单词表到服务端
 * @returns {Promise<boolean>} 是否成功
 */
export async function saveWordList(name) {
    const words = $("wordInput").value.trim();
    if (!words) return false;

    if (!isLoggedIn()) {
        showLoginDialog();
        return false;
    }

    const existingList = _wordlistsCache[name];
    const created = existingList?.created || new Date().toISOString();

    try {
        const response = await fetch(`${API_BASE}/api/sync/wordlist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                name,
                words,
                created
            })
        });

        if (!response.ok) {
            console.error('Failed to save wordlist:', response.status);
            return false;
        }

        // 更新内存缓存
        _wordlistsCache[name] = {
            name,
            words,
            created,
            updated: new Date().toISOString()
        };

        return true;
    } catch (e) {
        console.error('Failed to save wordlist:', e);
        return false;
    }
}

/**
 * 删除单词表
 * @returns {Promise<boolean>} 是否成功
 */
export async function removeWordListFromStorage(name) {
    if (!isLoggedIn()) {
        // 未登录时只从内存缓存删除
        delete _wordlistsCache[name];
        return true;
    }

    try {
        const response = await fetch(`${API_BASE}/api/sync/wordlist/${encodeURIComponent(name)}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });

        if (!response.ok) {
            console.error('Failed to delete wordlist:', response.status);
            return false;
        }

        // 更新内存缓存
        delete _wordlistsCache[name];
        return true;
    } catch (e) {
        console.error('Failed to delete wordlist:', e);
        return false;
    }
}

/**
 * 批量删除多个单词表
 * @returns {Promise<boolean>} 是否全部成功
 */
export async function removeWordListsFromStorage(names) {
    const results = await Promise.all(
        names.map(name => removeWordListFromStorage(name))
    );
    return results.every(r => r);
}

/**
 * 检查单词表名称是否已存在
 */
export function isWordListNameExists(name) {
    return name in _wordlistsCache;
}

/**
 * 加载单词表到 textarea
 * @returns {Promise<boolean>} 是否成功
 */
export async function loadWordList(name) {
    // 优先从缓存获取
    let list = _wordlistsCache[name];

    // 如果缓存中没有且已登录，尝试从服务端获取
    if (!list && isLoggedIn()) {
        try {
            const response = await fetch(`${API_BASE}/api/sync/wordlist/${encodeURIComponent(name)}`, {
                method: 'GET',
                headers: getAuthHeader()
            });

            if (response.ok) {
                list = await response.json();
                // 更新缓存
                _wordlistsCache[name] = list;
            }
        } catch (e) {
            console.error('Failed to load wordlist from server:', e);
        }
    }

    if (!list) return false;

    // 重置预加载缓存
    preloadCache.loadId++;
    preloadCache.translations = {};
    preloadCache.wordInfo = {};
    preloadCache.entries = [];

    // 设置 textarea 内容
    $("wordInput").value = list.words;
    setLoadedWordList(name, list.words);

    // 自动检测语言
    const detected = detectLanguageFromInput(list.words);
    if (detected) {
        setTargetLang(detected);
        updateAccentSelectorVisibility();
    }

    // 启动预加载
    startPreload();
    return true;
}

/**
 * 更新已存在的单词表
 * @returns {Promise<boolean>} 是否成功
 */
export async function updateWordList(name) {
    const words = $("wordInput").value.trim();
    if (!words || !name) return false;

    if (!_wordlistsCache[name]) return false;

    if (!isLoggedIn()) {
        showLoginDialog();
        return false;
    }

    const created = _wordlistsCache[name].created;

    try {
        const response = await fetch(`${API_BASE}/api/sync/wordlist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                name,
                words,
                created
            })
        });

        if (!response.ok) {
            console.error('Failed to update wordlist:', response.status);
            return false;
        }

        // 更新内存缓存
        _wordlistsCache[name] = {
            name,
            words,
            created,
            updated: new Date().toISOString()
        };

        setLoadedWordList(name, words);
        return true;
    } catch (e) {
        console.error('Failed to update wordlist:', e);
        return false;
    }
}

/**
 * 获取所有卡片的自定义颜色
 */
export function getCardColors() {
    try {
        const data = localStorage.getItem(CARD_COLORS_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error('Failed to load card colors:', e);
        return {};
    }
}

/**
 * 获取单个卡片的颜色
 * 优先从 wordlist.color 读取，如果没有则从 localStorage 的 cardColors 读取（兼容旧数据）
 */
export function getCardColor(name) {
    // 优先从内存缓存的 wordlist.color 读取
    if (_wordlistsCache[name] && _wordlistsCache[name].color) {
        return _wordlistsCache[name].color;
    }

    // 兼容旧数据：从 localStorage 的 cardColors 读取
    const colors = getCardColors();
    return colors[name] || null;
}

/**
 * 设置卡片颜色
 */
export function setCardColor(name, colorId) {
    try {
        const colors = getCardColors();
        if (colorId === 'original' || !colorId) {
            delete colors[name];
        } else {
            colors[name] = colorId;
        }
        localStorage.setItem(CARD_COLORS_KEY, JSON.stringify(colors));

        // 同时更新内存缓存中的 color 字段
        if (_wordlistsCache[name]) {
            _wordlistsCache[name].color = colorId === 'original' || !colorId ? null : colorId;
        }

        return true;
    } catch (e) {
        console.error('Failed to save card color:', e);
        return false;
    }
}

/**
 * 设置文件夹缓存（用于登录后同步）
 */
export function setFoldersCache(folders) {
    _foldersCache = folders || {};
}

/**
 * 获取所有文件夹（从内存缓存）
 */
export function getFolders() {
    return _foldersCache;
}

/**
 * 添加或更新单个文件夹到缓存
 * @param {string} name - 文件夹名称
 * @param {object} folderData - 文件夹数据 { id, name, cards, is_public, description, created, updated }
 */
export function addOrUpdateFolder(name, folderData) {
    _foldersCache[name] = folderData;
    console.log(`[Storage] 文件夹已添加/更新: ${name}`, folderData);
}

/**
 * 删除单个文件夹从缓存
 * @param {string} name - 文件夹名称
 */
export function removeFolder(name) {
    delete _foldersCache[name];
    console.log(`[Storage] 文件夹已删除: ${name}`);
}

/**
 * 获取单个文件夹
 */
export function getFolder(name) {
    return _foldersCache[name] || null;
}

/**
 * 清空文件夹缓存（用于登出）
 */
export function clearFoldersCache() {
    _foldersCache = {};
}

/**
 * 设置公开文件夹缓存（用于登录后同步）
 */
export function setPublicFoldersCache(publicFolders) {
    _publicFoldersCache = publicFolders || [];
}

/**
 * 获取所有公开文件夹引用（从内存缓存）
 */
export function getPublicFolders() {
    return _publicFoldersCache;
}

/**
 * 清空公开文件夹缓存（用于登出）
 */
export function clearPublicFoldersCache() {
    _publicFoldersCache = [];
}
