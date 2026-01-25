/**
 * 英语听写/复读工具 - 应用入口
 */

import { currentActiveMode } from './state.js';
import { initPreloadListeners } from './preload.js';
import { Repeater, setDictationRef } from './repeater/index.js';
import { Dictation, setRepeaterRef } from './dictation/index.js';
import { $, containsChinese, filterChinese } from './utils.js';
import { initWordListUI, goHome, renderWordListCards } from './wordlist/index.js';
import { initTheme, applyTheme, getStoredTheme, setThemeChangeCallback } from './theme.js';

// 在 DOMContentLoaded 之前应用主题（防止页面闪烁）
applyTheme(getStoredTheme());

// 设置循环引用
setDictationRef(Dictation);
setRepeaterRef(Repeater);

// 暴露到全局（供 HTML onclick 使用）
window.Repeater = Repeater;
window.Dictation = Dictation;
window.goHome = goHome;

// 暴露当前模式到全局（供模块内部检测使用）
Object.defineProperty(window, 'currentActiveMode', {
    get: () => currentActiveMode
});

/**
 * 初始化中文输入过滤
 */
function initChineseFilter() {
    const wordInput = $("wordInput");
    if (!wordInput) return;

    let warningTimer = null;

    wordInput.addEventListener("input", (e) => {
        if (containsChinese(e.target.value)) {
            // 过滤中文字符
            const cursorPos = e.target.selectionStart;
            const filtered = filterChinese(e.target.value);
            const charsRemoved = e.target.value.length - filtered.length;
            e.target.value = filtered;
            // 恢复光标位置
            e.target.selectionStart = e.target.selectionEnd = Math.max(0, cursorPos - charsRemoved);

            // 显示警告
            showChineseWarning();
        }
    });

    function showChineseWarning() {
        let warning = $("chineseWarning");
        if (!warning) {
            warning = document.createElement("div");
            warning.id = "chineseWarning";
            warning.className = "input-warning";
            warning.textContent = "⚠️ 只允许输入英文单词";
            wordInput.parentNode.insertBefore(warning, wordInput.nextSibling);
        }
        warning.style.display = "block";

        // 2秒后自动隐藏
        clearTimeout(warningTimer);
        warningTimer = setTimeout(() => {
            warning.style.display = "none";
        }, 2000);
    }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initPreloadListeners();
    initChineseFilter();
    initWordListUI();

    // 主题切换时重新渲染卡片（更新原色卡片）
    setThemeChangeCallback(() => {
        if (!window.currentActiveMode) {
            renderWordListCards();
        }
    });
});
