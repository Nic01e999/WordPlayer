/**
 * 存储模块入口
 * 统一导出所有存储相关功能
 */

export {
    getLocalWordInfo,
    setLocalWordInfo,
    getWordInfo,
    hasWordInfo,
    addWordInfo,
    addWordInfoBatch,
    clearLocalWordInfo,
    getCacheStats,
    filterCachedWords
} from './localCache.js';
