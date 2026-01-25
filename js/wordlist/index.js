/**
 * 单词表模块入口
 * 组合所有子模块并导出公共 API
 */

import { $ } from '../utils.js';
import { setActiveMode, setRepeaterState, preloadCache } from '../state.js';
import { updatePreloadProgress } from '../preload.js';
import { stopAudio } from '../audio.js';

// 导入子模块
import { getWordLists, saveWordList, loadWordList } from './storage.js';
import { getLayout, saveLayout, deleteWordList, deleteFolder } from './layout.js';
import { renderWordListCards, setRenderDeps, resetEventFlags } from './render.js';
import {
    bindDragEvents, exitEditMode, isEditMode, setCurrentWorkplace,
    getDragState, enterEditMode, setDragDeps, resetDragEventFlags
} from './drag.js';
import { openFolder, setFolderDeps } from './folder.js';

// 设置延迟绑定（解决循环依赖）
setRenderDeps({
    bindDragEvents,
    exitEditMode,
    isEditMode,
    setCurrentWorkplace,
    getDragState,
    openFolder
});

setDragDeps({
    renderWordListCards
});

setFolderDeps({
    renderWordListCards
});

/**
 * 返回主页
 */
export function goHome() {
    stopAudio();

    if (preloadCache.abortController) {
        preloadCache.abortController.abort();
        preloadCache.abortController = null;
    }
    preloadCache.loadId++;
    preloadCache.loading = false;
    updatePreloadProgress();

    $("dictationPopup")?.remove();

    setActiveMode(null);
    setRepeaterState(null);
    document.body.classList.remove('dictation-mode', 'repeater-mode');

    renderWordListCards();
}

/**
 * 初始化单词表 UI
 */
export function initWordListUI() {
    const saveBtn = $("saveListBtn");
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const defaultName = `wordlist-${new Date().toISOString().slice(0, 10)}`;
            const name = prompt("Enter list name:", defaultName);
            if (!name || !name.trim()) return;

            if (saveWordList(name.trim())) {
                renderWordListCards();
            }
        });
    }

    renderWordListCards();
}

// 导出公共 API
export {
    getWordLists,
    saveWordList,
    loadWordList,
    deleteWordList,
    renderWordListCards
};
