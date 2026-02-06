/**
 * 单词卡存储模块
 * 纯服务端存储，不再使用 localStorage 存储单词卡数据
 */

import { $, detectLanguageFromInput, setTargetLang, updateAccentSelectorVisibility } from '../utils.js';
import { t } from '../i18n/index.js';
import { preloadCache, setLoadedWordcard } from '../state.js';
import { startPreload } from '../preload.js';
import { API_BASE } from '../api.js';
import { isLoggedIn, getAuthHeader } from '../auth/state.js';
import { showLoginDialog } from '../auth/login.js';

const CARD_COLORS_KEY = 'cardColors';  // 保留用于数据迁移
const FOLDERS_KEY = 'folders';

// 内存缓存：存储从服务端拉取的单词卡列表
let _wordcardsCache = {};

// 内存缓存：按 ID 索引单词卡（性能优化）
let _wordcardsCacheById = {};

// 内存缓存：存储文件夹数据
let _foldersCache = {};

// 内存缓存：存储公开文件夹引用
let _publicFoldersCache = [];

/**
 * 从服务端拉取所有单词卡
 * @returns {Promise<object>} 单词卡对象 { name: { name, words, created, updated }, ... }
 */
export async function fetchWordcards() {
    if (!isLoggedIn()) {
        _wordcardsCache = {};
        return {};
    }

    try {
        const response = await fetch(`${API_BASE}/api/sync/pull`, {
            method: 'GET',
            headers: getAuthHeader()
        });

        if (!response.ok) {
            console.error('Failed to fetch wordcards:', response.status);
            return _wordcardsCache;
        }

        const data = await response.json();
        _wordcardsCache = data.wordcards || {};
        return _wordcardsCache;
    } catch (e) {
        console.error('Failed to fetch wordcards:', e);
        return _wordcardsCache;
    }
}

/**
 * 获取所有单词卡（从内存缓存）
 * 注意：调用前需要先调用 fetchWordcards() 从服务端拉取
 */
export function getWordcards() {
    return _wordcardsCache;
}

/**
 * 设置单词卡缓存（用于登录后同步）
 */
export function setWordcardsCache(wordcards) {
    _wordcardsCache = wordcards || {};

    // 重建 ID 索引
    _wordcardsCacheById = {};
    for (const [name, data] of Object.entries(_wordcardsCache)) {
        if (data && data.id) {
            _wordcardsCacheById[data.id] = data;
        }
    }
}

/**
 * 通过 ID 获取单词卡（快速查找）
 * @param {number} id - 单词卡 ID
 * @returns {object|null} 单词卡数据或 null
 */
export function getWordcardById(id) {
    return _wordcardsCacheById[id] || null;
}

/**
 * 设置单个单词卡到缓存（用于公共文件夹卡片）
 * @param {string} name - 单词卡名称
 * @param {object} data - 单词卡数据 { id, name, words, color, isPublic, ... }
 */
export function setWordcardInCache(name, data) {
    _wordcardsCache[name] = data;

    // 同时维护 ID 索引（性能优化）
    if (data && data.id) {
        _wordcardsCacheById[data.id] = data;
        console.log('[Storage] setWordcardInCache:', name, 'ID:', data.id, '公共卡片:', data.isPublic);
    } else {
        console.log('[Storage] setWordcardInCache:', name, '公共卡片:', data.isPublic, '警告: 无 ID');
    }
}

/**
 * 清空单词卡缓存（用于登出）
 */
export function clearWordcardsCache() {
    _wordcardsCache = {};
    _wordcardsCacheById = {};  // 同时清空 ID 索引
}

/**
 * 清除公共卡片缓存
 * 刷新页面时调用，确保公共文件夹内容是最新的
 */
export function clearPublicCardCache() {
    // 遍历缓存，删除所有标记为 isPublic 的卡片
    for (const [name, data] of Object.entries(_wordcardsCache)) {
        if (data && data.isPublic) {
            delete _wordcardsCache[name];

            // 同时从 ID 索引中删除
            if (data.id) {
                delete _wordcardsCacheById[data.id];
            }

            console.log('[Storage] 清除公共卡片缓存:', name);
            console.log('[网页控制台] 清除公共卡片缓存:', name);
        }
    }
}

/**
 * 保存单词卡到服务端
 * @returns {Promise<boolean>} 是否成功
 */
export async function saveWordcard(name) {
    const words = $("wordInput").value.trim();
    if (!words) return false;

    if (!isLoggedIn()) {
        showLoginDialog();
        return false;
    }

    const existingList = _wordcardsCache[name];
    const created = existingList?.created || new Date().toISOString();

    try {
        const response = await fetch(`${API_BASE}/api/sync/wordcard`, {
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
            console.error('[Storage] 保存单词卡失败:', response.status);
            return false;
        }

        // 获取服务端返回的数据（包含卡片 ID）
        const result = await response.json();
        const cardId = result.id;

        // 更新内存缓存，包含卡片 ID
        _wordcardsCache[name] = {
            id: cardId,  // 添加 ID 字段
            name,
            words,
            created,
            updated: new Date().toISOString()
        };

        console.log('[Storage] 单词卡已保存，ID:', cardId, '名称:', name);
        return true;
    } catch (e) {
        console.error('Failed to save wordcard:', e);
        return false;
    }
}

/**
 * 删除单词卡
 * @param {number} cardId - 卡片 ID
 * @returns {Promise<boolean>} 是否成功
 */
export async function removeWordcardFromStorage(cardId) {
    if (!cardId) {
        console.error('[Storage] removeWordcardFromStorage 失败: 缺少 ID');
        return false;
    }

    if (!isLoggedIn()) {
        // 未登录时只从内存缓存删除
        delete _wordcardsCacheById[cardId];
        // 从名称索引中查找并删除
        for (const [name, data] of Object.entries(_wordcardsCache)) {
            if (data.id === cardId) {
                delete _wordcardsCache[name];
                break;
            }
        }
        return true;
    }

    try {
        console.log('[Storage] 通过ID删除单词卡:', cardId);
        console.log('[网页控制台] 通过ID删除单词卡:', cardId);

        const response = await fetch(`${API_BASE}/api/sync/wordcard/by-id/${cardId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });

        if (!response.ok) {
            console.error('[Storage] 删除失败:', response.status);
            return false;
        }

        // 更新缓存
        delete _wordcardsCacheById[cardId];
        for (const [name, data] of Object.entries(_wordcardsCache)) {
            if (data.id === cardId) {
                delete _wordcardsCache[name];
                break;
            }
        }

        return true;
    } catch (e) {
        console.error('[Storage] 删除失败:', e);
        return false;
    }
}

/**
 * 批量删除多个单词卡
 * @param {Array<number>} cardIds - 卡片 ID 数组
 * @returns {Promise<boolean>} 是否全部成功
 */
export async function removeWordcardsFromStorage(cardIds) {
    const results = await Promise.all(
        cardIds.map(id => removeWordcardFromStorage(id))
    );
    return results.every(r => r);
}

/**
 * 检查单词卡名称是否已存在
 */
export function isWordcardNameExists(name) {
    return name in _wordcardsCache;
}

/**
 * 加载单词卡到 textarea
 * @param {number} cardId - 单词卡 ID
 * @returns {Promise<boolean>} 是否成功
 */
export async function loadWordcard(cardId) {
    if (!cardId) {
        console.error('[Storage] loadWordcard 失败: 缺少 ID');
        return false;
    }

    // 通过 ID 查找
    const list = _wordcardsCacheById[cardId];

    if (!list) {
        console.error('[Storage] loadWordcard 失败，缓存中找不到 ID:', cardId);
        return false;
    }

    const name = list.name;
    console.log('[Storage] loadWordcard 通过ID加载:', name, 'ID:', cardId);

    // 重置预加载缓存
    preloadCache.loadId++;
    preloadCache.translations = {};
    preloadCache.wordInfo = {};
    preloadCache.entries = [];

    // 设置 textarea 内容
    $("wordInput").value = list.words;
    setLoadedWordcard(name, list.words);

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
 * 更新已存在的单词卡
 * @returns {Promise<boolean>} 是否成功
 */
export async function updateWordcard(name) {
    const words = $("wordInput").value.trim();
    if (!words || !name) return false;

    if (!_wordcardsCache[name]) return false;

    if (!isLoggedIn()) {
        showLoginDialog();
        return false;
    }

    // 获取当前颜色配置和 ID
    const existingData = _wordcardsCache[name] || {};
    const color = existingData.color || null;
    const created = _wordcardsCache[name].created;
    const cardId = existingData.id;  // 读取 ID

    console.log('[Storage] 更新单词卡，ID:', cardId, '颜色:', color);
    console.log('[网页控制台] 更新单词卡，ID:', cardId, '颜色:', color);

    try {
        const response = await fetch(`${API_BASE}/api/sync/wordcard`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                name,
                words,
                created,
                color,  // 添加颜色字段
                id: cardId  // 传递 ID
            })
        });

        if (!response.ok) {
            console.error('[Storage] 更新单词卡失败:', response.status);
            return false;
        }

        // 解析响应获取卡片 ID
        const data = await response.json();
        const resultId = data.id;

        // 更新内存缓存（同时更新双索引）
        _wordcardsCache[name] = {
            id: resultId || cardId || existingData.id,
            name,
            words,
            color: existingData.color,  // 保留颜色
            created,
            updated: new Date().toISOString()
        };

        // 更新 ID 索引
        if (resultId || cardId) {
            _wordcardsCacheById[resultId || cardId] = _wordcardsCache[name];
        }

        console.log('[Storage] 保存单词卡成功:', name, 'ID:', resultId);
        setLoadedWordcard(name, words);
        return true;
    } catch (e) {
        console.error('[Storage] 更新失败:', e);
        return false;
    }
}

// ============================================
// 卡片颜色缓存（纯内存，不使用 localStorage）
// 键是单词卡 ID（数字），值是颜色 ID（字符串）
// 格式：{3: "cyan", 5: "purple"}
// ============================================

let _cardColorsCache = {};

/**
 * 获取所有卡片的自定义颜色
 */
export function getCardColors() {
    return _cardColorsCache;
}

/**
 * 获取单个卡片的颜色
 * 优先从 wordcard.color 读取，如果没有则从内存缓存读取
 * @param {number} id - 单词卡 ID
 */
export function getCardColor(id) {
    // 从 wordcards 缓存中查找（wordcards 缓存的键是 name，需要遍历）
    for (const card of Object.values(_wordcardsCache)) {
        if (card.id === id && card.color) {
            return card.color;
        }
    }
    // 从颜色缓存读取（键是 ID）
    return _cardColorsCache[id] || null;
}

/**
 * 设置卡片颜色
 * @param {number} id - 单词卡 ID
 * @param {string} colorId - 颜色 ID
 */
export function setCardColor(id, colorId) {
    if (colorId === 'original' || !colorId) {
        delete _cardColorsCache[id];
    } else {
        _cardColorsCache[id] = colorId;
    }

    // 更新 wordcards 缓存中对应卡片的 color 字段
    for (const card of Object.values(_wordcardsCache)) {
        if (card.id === id) {
            card.color = colorId === 'original' || !colorId ? null : colorId;
            break;
        }
    }

    return true;
}

/**
 * 批量设置卡片颜色（用于登录后同步）
 */
export function setCardColors(colors) {
    _cardColorsCache = colors || {};
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
 * 从内存缓存中删除单词卡（不删除服务端数据）
 * 用于将卡片移入文件夹时
 */
export function removeWordcardFromCache(name) {
    if (_wordcardsCache[name]) {
        // 同时从 ID 索引中删除
        const id = _wordcardsCache[name].id;
        if (id) {
            delete _wordcardsCacheById[id];
        }

        delete _wordcardsCache[name];
        console.log('[Storage] 单词卡已从缓存移除:', name);
    }
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

/**
 * 从所有文件夹中移除指定卡片的引用
 * @param {number} cardId - 卡片 ID
 * @returns {boolean} 是否有文件夹被更新
 */
export function removeCardFromAllFolders(cardId) {
    const folders = getFolders();
    let updated = false;

    for (const folder of Object.values(folders)) {
        if (folder.cards && folder.cards.includes(cardId)) {
            folder.cards = folder.cards.filter(id => id !== cardId);
            addOrUpdateFolder(folder.name, folder);
            updated = true;
            console.log(`[Storage] 从文件夹 ${folder.name} 中移除卡片 ID ${cardId}`);
            console.log(`[Server] 从文件夹 ${folder.name} 中移除卡片 ID ${cardId}`);
        }
    }

    return updated;
}

/**
 * 检查卡片是否在任何文件夹中
 * @param {number} cardId - 卡片 ID
 * @returns {boolean} 是否在文件夹中
 */
export function isCardInAnyFolder(cardId) {
    const folders = getFolders();
    for (const folder of Object.values(folders)) {
        if (folder.cards && folder.cards.includes(cardId)) {
            return true;
        }
    }
    return false;
}
