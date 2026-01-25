/**
 * 单词表模块（向后兼容重导出）
 * 实际实现在 wordlist/ 目录下
 */

export {
    getWordLists,
    saveWordList,
    loadWordList,
    deleteWordList,
    renderWordListCards,
    goHome,
    initWordListUI
} from './wordlist/index.js';
