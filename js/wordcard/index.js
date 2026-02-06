/**
 * 单词卡模块入口
 * 组合所有子模块并导出公共 API
 */

import { $ } from '../utils.js';
import { setActiveMode, setRepeaterState, preloadCache, loadedWordcard, clearLoadedWordcard } from '../state.js';
import { updatePreloadProgress } from '../preload.js';
import { stopAudio } from '../audio.js';
import { showPrompt, showAlert } from '../utils/dialog.js';
import { t } from '../i18n/index.js';
import { getCurrentUser } from '../auth/state.js';

// 导入子模块
import { getWordcards, saveWordcard, loadWordcard, updateWordcard, isWordcardNameExists } from './storage.js';
import { getLayout, saveLayout, deleteWordcard, deleteFolder } from './layout.js';
import { renderWordcardCards, setRenderDeps, resetEventFlags, syncPendingPublicStatusChanges } from './render.js';
import {
    bindDragEvents, exitEditMode, isEditMode, setCurrentWorkplace,
    getDragState, enterEditMode, setDragDeps, resetDragEventFlags, initGlobalTapHandler
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
    openFolder,
    getCurrentUser
});

setDragDeps({
    renderWordcardCards,
    syncPendingPublicStatusChanges
});

setFolderDeps({
    renderWordcardCards
});

setColorPickerDeps({
    renderWordcardCards
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

    renderWordcardCards();
}

/**
 * 初始化单词卡 UI
 */
export function initWordcardUI() {
    const saveBtn = $("saveListBtn");
    const updateBtn = $("updateListBtn");
    const wordInput = $("wordInput");

    // 初始化全局点击处理器
    initGlobalTapHandler();

    // Save 按钮
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const defaultName = `wordcard-${new Date().toISOString().slice(0, 10)}`;
            const name = await showPrompt(t('promptName'), defaultName);
            if (!name || !name.trim()) return;

            const trimmedName = name.trim();
            if (isWordcardNameExists(trimmedName)) {
                await showAlert(t('nameExists', { name: trimmedName }));
                return;
            }

            if (await saveWordcard(trimmedName)) {
                clearLoadedWordcard();
                hideUpdateButton();
                renderWordcardCards();
            }
        });
    }

    // Update 按钮
    if (updateBtn) {
        updateBtn.addEventListener('click', async () => {
            if (!loadedWordcard.name) return;
            if (await updateWordcard(loadedWordcard.name)) {
                hideUpdateButton();
                renderWordcardCards();
            }
        });
    }

    // 监听 textarea 变化
    if (wordInput) {
        wordInput.addEventListener('input', checkUpdateButtonVisibility);
    }

    renderWordcardCards();
}

/**
 * 检查并更新 Update 按钮的可见性
 */
function checkUpdateButtonVisibility() {
    const updateBtn = $("updateListBtn");
    if (!updateBtn) return;

    const currentContent = $("wordInput")?.value || '';

    if (loadedWordcard.name &&
        loadedWordcard.originalContent !== null &&
        currentContent !== loadedWordcard.originalContent) {
        updateBtn.style.display = 'inline-block';
    } else {
        updateBtn.style.display = 'none';
    }
}

/**
 * 隐藏 Update 按钮
 */
function hideUpdateButton() {
    const updateBtn = $("updateListBtn");
    if (updateBtn) updateBtn.style.display = 'none';
}

// 导出公共 API
export {
    getWordcards,
    saveWordcard,
    updateWordcard,
    loadWordcard,
    deleteWordcard,
    renderWordcardCards
};
