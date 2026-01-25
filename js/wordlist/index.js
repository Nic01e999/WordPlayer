/**
 * 单词表模块入口
 * 组合所有子模块并导出公共 API
 */

import { $ } from '../utils.js';
import { setActiveMode, setRepeaterState, preloadCache } from '../state.js';
import { updatePreloadProgress } from '../preload.js';
import { stopAudio } from '../audio.js';
import { showPrompt, showAlert } from '../utils/dialog.js';

// 导入子模块
import { getWordLists, saveWordList, loadWordList, isWordListNameExists } from './storage.js';
import { getLayout, saveLayout, deleteWordList, deleteFolder } from './layout.js';
import { renderWordListCards, setRenderDeps, resetEventFlags } from './render.js';
import {
    bindDragEvents, exitEditMode, isEditMode, setCurrentWorkplace,
    getDragState, enterEditMode, setDragDeps, resetDragEventFlags
} from './drag.js';
import { openFolder, setFolderDeps } from './folder.js';
import { setColorPickerDeps } from './colorpicker.js';

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

setColorPickerDeps({
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
        saveBtn.addEventListener('click', async () => {
            const defaultName = `wordlist-${new Date().toISOString().slice(0, 10)}`;
            const name = await showPrompt("输入单词表名称：", defaultName);
            if (!name || !name.trim()) return;

            const trimmedName = name.trim();
            if (isWordListNameExists(trimmedName)) {
                await showAlert(`名称 "${trimmedName}" 已存在，请使用其他名称`);
                return;
            }

            if (saveWordList(trimmedName)) {
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
