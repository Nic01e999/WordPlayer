/**
 * 数据迁移模块
 * 负责将旧格式的 localStorage 数据迁移到新格式
 */

const MIGRATION_VERSION_KEY = 'migration_version';
const CURRENT_MIGRATION_VERSION = 1;

/**
 * 检查是否需要迁移
 */
function needsMigration() {
    try {
        const version = localStorage.getItem(MIGRATION_VERSION_KEY);
        return !version || parseInt(version) < CURRENT_MIGRATION_VERSION;
    } catch (e) {
        console.error('[Migration] 检查迁移版本失败:', e);
        return false;
    }
}

/**
 * 执行数据迁移
 * 主要任务：
 * 1. 将 cardColors 合并到 wordcards 中
 * 2. 从 layout 中提取 folders 并独立存储
 * 3. 为文件夹中的卡片名称创建临时 ID 映射
 */
export function migrateLocalStorage() {
    if (!needsMigration()) {
        console.log('[Migration] 无需迁移，数据已是最新版本');
        return;
    }

    console.log('[Migration] 开始数据迁移...');

    try {
        // 备份旧数据
        backupOldData();

        // 1. 迁移 cardColors 到 wordcards（如果 wordcards 存在于 localStorage）
        migrateCardColors();

        // 2. 从 layout 中提取 folders
        migrateFolders();

        // 标记迁移完成
        localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
        console.log('[Migration] 数据迁移完成');
    } catch (e) {
        console.error('[Migration] 数据迁移失败:', e);
        // 不抛出错误，让应用继续运行
    }
}

/**
 * 备份旧数据到 localStorage（以防迁移失败）
 */
function backupOldData() {
    try {
        const backup = {
            cardColors: localStorage.getItem('cardColors'),
            wordcard_layout: localStorage.getItem('wordcard_layout'),
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('migration_backup', JSON.stringify(backup));
        console.log('[Migration] 旧数据已备份');
    } catch (e) {
        console.error('[Migration] 备份失败:', e);
    }
}

/**
 * 迁移 cardColors 到 wordcards
 * 注意：这里只处理 localStorage 中的数据（如果存在）
 * 实际上新版本不再使用 localStorage 存储 wordcards，而是从服务端拉取
 */
function migrateCardColors() {
    try {
        const cardColorsStr = localStorage.getItem('cardColors');
        if (!cardColorsStr) {
            console.log('[Migration] 没有找到 cardColors，跳过迁移');
            return;
        }

        const cardColors = JSON.parse(cardColorsStr);
        console.log('[Migration] 找到 cardColors:', Object.keys(cardColors).length, '个颜色');

        // 注意：新版本的 wordcards 存储在内存缓存中，不在 localStorage
        // 这里只是保留 cardColors 用于后续同步到服务器
        // 实际的颜色合并会在登录后从服务器拉取数据时完成

        console.log('[Migration] cardColors 迁移完成（保留在 localStorage 用于同步）');
    } catch (e) {
        console.error('[Migration] cardColors 迁移失败:', e);
    }
}

/**
 * 从 layout 中提取 folders 并独立存储
 */
function migrateFolders() {
    try {
        const layoutStr = localStorage.getItem('wordcard_layout');
        if (!layoutStr) {
            console.log('[Migration] 没有找到 layout，跳过文件夹迁移');
            return;
        }

        const layout = JSON.parse(layoutStr);
        const items = layout.items || [];

        // 提取所有文件夹
        const folders = {};
        let folderCount = 0;

        for (const item of items) {
            if (item.type === 'folder') {
                folders[item.name] = {
                    id: null,  // 等待服务器分配
                    name: item.name,
                    cards: item.items || [],  // 暂时存储卡片名称，等同步后转换为 ID
                    is_public: false,
                    description: null,
                    created: new Date().toISOString(),
                    updated: new Date().toISOString()
                };
                folderCount++;
            }
        }

        if (folderCount > 0) {
            localStorage.setItem('folders', JSON.stringify(folders));
            console.log('[Migration] 提取了', folderCount, '个文件夹');
        } else {
            console.log('[Migration] 没有找到文件夹');
        }
    } catch (e) {
        console.error('[Migration] 文件夹迁移失败:', e);
    }
}

/**
 * 恢复备份数据（如果迁移失败）
 */
export function restoreBackup() {
    try {
        const backupStr = localStorage.getItem('migration_backup');
        if (!backupStr) {
            console.log('[Migration] 没有找到备份数据');
            return false;
        }

        const backup = JSON.parse(backupStr);
        if (backup.cardColors) {
            localStorage.setItem('cardColors', backup.cardColors);
        }
        if (backup.wordcard_layout) {
            localStorage.setItem('wordcard_layout', backup.wordcard_layout);
        }

        console.log('[Migration] 备份数据已恢复');
        return true;
    } catch (e) {
        console.error('[Migration] 恢复备份失败:', e);
        return false;
    }
}

/**
 * 清理备份数据
 */
export function cleanupBackup() {
    try {
        localStorage.removeItem('migration_backup');
        console.log('[Migration] 备份数据已清理');
    } catch (e) {
        console.error('[Migration] 清理备份失败:', e);
    }
}
