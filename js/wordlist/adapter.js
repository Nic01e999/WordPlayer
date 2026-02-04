/**
 * 数据格式转换适配器
 * 负责在后端新格式和前端旧格式之间进行转换
 *
 * 后端格式：
 * - wordlists: { name: { id, name, words, color, created, updated } }
 * - folders: { name: { id, name, cards: [id1, id2], is_public, description, created, updated } }
 * - publicFolders: [{ id, folder_id, owner_id, owner_name, display_name, created }]
 * - layout: ["card_123", "folder_456", "public_789"]
 *
 * 前端格式：
 * - wordlists: { name: { name, words, created, updated } }
 * - cardColors: { name: '#color' }
 * - layout: { version: 3, items: [{ type: 'card', name }, { type: 'folder', name, items: [name1, name2] }] }
 */

/**
 * ID 和 Name 的映射关系（内存缓存）
 */
const idToNameMap = {
    cards: new Map(),      // cardId -> cardName
    folders: new Map(),    // folderId -> folderName
    publicFolders: new Map() // publicFolderId -> displayName
};

const nameToIdMap = {
    cards: new Map(),      // cardName -> cardId
    folders: new Map(),    // folderName -> folderId
    publicFolders: new Map() // displayName -> publicFolderId
};

/**
 * 更新映射关系
 */
function updateMappings(wordlists, folders, publicFolders) {
    // 清空旧映射
    idToNameMap.cards.clear();
    idToNameMap.folders.clear();
    idToNameMap.publicFolders.clear();
    nameToIdMap.cards.clear();
    nameToIdMap.folders.clear();
    nameToIdMap.publicFolders.clear();

    // 更新 wordlists 映射
    for (const [name, card] of Object.entries(wordlists)) {
        if (card.id) {
            idToNameMap.cards.set(card.id, name);
            nameToIdMap.cards.set(name, card.id);
        }
    }

    // 更新 folders 映射
    for (const [name, folder] of Object.entries(folders)) {
        if (folder.id) {
            idToNameMap.folders.set(folder.id, name);
            nameToIdMap.folders.set(name, folder.id);
        }
    }

    // 更新 publicFolders 映射
    for (const pf of publicFolders) {
        if (pf.id && pf.display_name) {
            idToNameMap.publicFolders.set(pf.id, pf.display_name);
            nameToIdMap.publicFolders.set(pf.display_name, pf.id);
        }
    }

    console.log('[Adapter] 映射关系已更新:', {
        cards: idToNameMap.cards.size,
        folders: idToNameMap.folders.size,
        publicFolders: idToNameMap.publicFolders.size
    });
}

/**
 * 后端格式 -> 前端格式
 * @param {object} backendData - { wordlists, folders, publicFolders, layout, settings }
 * @returns {object} - { wordlists, cardColors, layout, folders, publicFolders, settings }
 */
export function backendToFrontend(backendData) {
    console.log('[Adapter] 开始转换：后端 -> 前端');
    console.log('[Adapter] 后端数据:', backendData);

    const { wordlists = {}, folders = {}, publicFolders = [], layout = [], settings = {} } = backendData;

    // 更新映射关系
    updateMappings(wordlists, folders, publicFolders);

    // 1. 转换 wordlists（移除 id 和 color）
    const frontendWordlists = {};
    for (const [name, card] of Object.entries(wordlists)) {
        frontendWordlists[name] = {
            name: card.name,
            words: card.words,
            created: card.created,
            updated: card.updated
        };
    }

    // 2. 提取 cardColors
    const cardColors = {};
    for (const [name, card] of Object.entries(wordlists)) {
        if (card.color) {
            cardColors[name] = card.color;
        }
    }

    // 3. 转换 layout（字符串数组 -> 对象数组）
    const layoutItems = [];
    for (const item of layout) {
        if (item.startsWith('card_')) {
            const cardId = parseInt(item.substring(5));
            const cardName = idToNameMap.cards.get(cardId);
            if (cardName) {
                layoutItems.push({ type: 'card', name: cardName });
            } else {
                console.warn(`[Adapter] 找不到卡片 ID ${cardId} 对应的名称`);
            }
        } else if (item.startsWith('folder_')) {
            const folderId = parseInt(item.substring(7));
            const folderName = idToNameMap.folders.get(folderId);
            if (folderName && folders[folderName]) {
                const folder = folders[folderName];
                // 将 cards (ID数组) 转换为 items (名称数组)
                const items = folder.cards
                    .map(cardId => idToNameMap.cards.get(cardId))
                    .filter(name => name !== undefined);

                layoutItems.push({
                    type: 'folder',
                    name: folderName,
                    items: items
                });
            } else {
                console.warn(`[Adapter] 找不到文件夹 ID ${folderId} 对应的名称`);
            }
        } else if (item.startsWith('public_')) {
            const publicId = parseInt(item.substring(7));
            const displayName = idToNameMap.publicFolders.get(publicId);
            if (displayName) {
                // 找到对应的 publicFolder
                const pf = publicFolders.find(p => p.id === publicId);
                if (pf) {
                    layoutItems.push({
                        type: 'public_folder',
                        name: displayName,
                        folder_id: pf.folder_id,
                        owner_id: pf.owner_id,
                        owner_name: pf.owner_name
                    });
                }
            } else {
                console.warn(`[Adapter] 找不到公开文件夹 ID ${publicId} 对应的显示名称`);
            }
        }
    }

    const frontendLayout = {
        version: 3,
        items: layoutItems
    };

    // 4. 转换 folders（独立存储，供前端使用）
    const frontendFolders = {};
    for (const [name, folder] of Object.entries(folders)) {
        frontendFolders[name] = {
            id: folder.id,
            name: folder.name,
            cards: folder.cards,  // 保留 ID 数组
            is_public: folder.is_public,
            description: folder.description,
            created: folder.created,
            updated: folder.updated
        };
    }

    // 5. 转换 publicFolders
    const frontendPublicFolders = publicFolders.map(pf => ({
        id: pf.id,
        folder_id: pf.folder_id,
        owner_id: pf.owner_id,
        owner_name: pf.owner_name,
        display_name: pf.display_name,
        created: pf.created
    }));

    const result = {
        wordlists: frontendWordlists,
        cardColors: cardColors,
        layout: frontendLayout,
        folders: frontendFolders,
        publicFolders: frontendPublicFolders,
        settings: settings
    };

    console.log('[Adapter] 转换完成，前端数据:', result);
    return result;
}

/**
 * 前端格式 -> 后端格式
 * @param {object} frontendData - { wordlists, cardColors, layout, folders, publicFolders }
 * @returns {object} - { wordlists, folders, layout }
 */
export function frontendToBackend(frontendData) {
    console.log('[Adapter] 开始转换：前端 -> 后端');
    console.log('[Adapter] 前端数据:', frontendData);

    const { wordlists = {}, cardColors = {}, layout = {}, folders = {}, publicFolders = [] } = frontendData;

    // 1. 转换 wordlists（添加 id 和 color）
    const backendWordlists = {};
    for (const [name, card] of Object.entries(wordlists)) {
        backendWordlists[name] = {
            id: nameToIdMap.cards.get(name) || null,
            name: card.name,
            words: card.words,
            color: cardColors[name] || null,
            created: card.created,
            updated: card.updated
        };
    }

    // 2. 转换 folders
    const backendFolders = {};
    for (const [name, folder] of Object.entries(folders)) {
        backendFolders[name] = {
            id: folder.id || nameToIdMap.folders.get(name) || null,
            name: folder.name,
            cards: folder.cards || [],  // 已经是 ID 数组
            is_public: folder.is_public || false,
            description: folder.description || null,
            created: folder.created,
            updated: folder.updated
        };
    }

    // 3. 转换 layout（对象数组 -> 字符串数组）
    const layoutItems = layout.items || [];
    const backendLayout = [];

    for (const item of layoutItems) {
        if (item.type === 'card') {
            const cardId = nameToIdMap.cards.get(item.name);
            if (cardId) {
                backendLayout.push(`card_${cardId}`);
            } else {
                console.warn(`[Adapter] 找不到卡片 ${item.name} 对应的 ID`);
            }
        } else if (item.type === 'folder') {
            const folderId = nameToIdMap.folders.get(item.name);
            if (folderId) {
                backendLayout.push(`folder_${folderId}`);
            } else {
                // 新文件夹还没有 ID，跳过（等后端返回 ID 后再同步）
                console.warn(`[Adapter] 文件夹 ${item.name} 还没有 ID，暂时跳过`);
            }
        } else if (item.type === 'public_folder') {
            const publicId = nameToIdMap.publicFolders.get(item.name);
            if (publicId) {
                backendLayout.push(`public_${publicId}`);
            } else {
                console.warn(`[Adapter] 找不到公开文件夹 ${item.name} 对应的 ID`);
            }
        }
    }

    const result = {
        wordlists: backendWordlists,
        folders: backendFolders,
        layout: backendLayout
    };

    console.log('[Adapter] 转换完成，后端数据:', result);
    return result;
}

/**
 * 获取映射关系（供其他模块使用）
 */
export function getMappings() {
    return {
        idToName: {
            cards: Object.fromEntries(idToNameMap.cards),
            folders: Object.fromEntries(idToNameMap.folders),
            publicFolders: Object.fromEntries(idToNameMap.publicFolders)
        },
        nameToId: {
            cards: Object.fromEntries(nameToIdMap.cards),
            folders: Object.fromEntries(nameToIdMap.folders),
            publicFolders: Object.fromEntries(nameToIdMap.publicFolders)
        }
    };
}

/**
 * 根据名称获取 ID
 */
export function getIdByName(type, name) {
    return nameToIdMap[type]?.get(name) || null;
}

/**
 * 根据 ID 获取名称
 */
export function getNameById(type, id) {
    return idToNameMap[type]?.get(id) || null;
}

/**
 * 更新文件夹 ID 映射（用于新创建的文件夹）
 * @param {object} folderIdMap - { folderName: folderId, ... }
 */
export function updateFolderIdMapping(folderIdMap) {
    for (const [name, id] of Object.entries(folderIdMap)) {
        if (id && !nameToIdMap.folders.has(name)) {
            nameToIdMap.folders.set(name, id);
            idToNameMap.folders.set(id, name);
            console.log(`[Adapter] 文件夹映射已添加: ${name} -> ${id}`);
        }
    }
}

