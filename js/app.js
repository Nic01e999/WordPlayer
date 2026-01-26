/**
 * 英语听写/复读工具 - 应用入口
 */

import { currentActiveMode, currentRepeaterState } from './state.js';
import { initPreloadListeners } from './preload.js';
import { Repeater, setDictationRef } from './repeater/index.js';
import { Dictation, setRepeaterRef } from './dictation/index.js';
import {
    $,
    isValidForLanguage,
    filterInvalidChars,
    getTargetLang,
    getTranslationLang,
    getUiLang,
    updateAccentSelectorVisibility,
    detectLanguageFromInput,
    setTargetLang,
    LANG_NAMES
} from './utils.js';
import { initWordListUI, goHome, renderWordListCards } from './wordlist/index.js';
import { initTheme, applyTheme, getStoredTheme, setThemeChangeCallback } from './theme.js';
import { initAuth, showLoginDialog, updateUserDisplay, refreshLoginDialog } from './auth.js';
import { initI18n, setLocale, t, updatePageTexts } from './i18n/index.js';
import {
    getSetting,
    saveSettingToServer,
    applySettings,
    clearSettings,
    onSettingsChange
} from './sync/settings.js';
import { initWebSocket, disconnectWebSocket } from './sync/websocket.js';
import { clearLocalWordInfo } from './storage/localCache.js';

// 在 DOMContentLoaded 之前应用主题（防止页面闪烁）
applyTheme(getStoredTheme());

// 设置循环引用
setDictationRef(Dictation);
setRepeaterRef(Repeater);

// 暴露到全局（供 HTML onclick 使用）
window.Repeater = Repeater;
window.Dictation = Dictation;
window.goHome = goHome;
window.showLoginDialog = showLoginDialog;

// 暴露当前模式到全局（供模块内部检测使用）
Object.defineProperty(window, 'currentActiveMode', {
    get: () => currentActiveMode
});

/**
 * 初始化多语言输入过滤
 */
function initInputFilter() {
    const wordInput = $("wordInput");
    if (!wordInput) return;

    let warningTimer = null;

    wordInput.addEventListener("input", (e) => {
        const text = e.target.value;

        // 自动检测语言
        const detected = detectLanguageFromInput(text);
        if (detected) {
            setTargetLang(detected);
            updateAccentSelectorVisibility();
        }

        const targetLang = getTargetLang();

        // 检查每一行是否有效（跳过 word:definition 格式的定义部分）
        const lines = text.split('\n');
        let hasInvalid = false;

        for (const line of lines) {
            const colonIdx = line.indexOf(':');
            const wordPart = colonIdx !== -1 ? line.substring(0, colonIdx) : line;
            if (wordPart.trim() && !isValidForLanguage(wordPart, targetLang)) {
                hasInvalid = true;
                break;
            }
        }

        if (hasInvalid) {
            // 过滤无效字符（仅过滤单词部分，保留定义部分）
            const cursorPos = e.target.selectionStart;
            const filtered = lines.map(line => {
                const colonIdx = line.indexOf(':');
                if (colonIdx !== -1) {
                    const wordPart = line.substring(0, colonIdx);
                    const defPart = line.substring(colonIdx);
                    return filterInvalidChars(wordPart, targetLang) + defPart;
                }
                return filterInvalidChars(line, targetLang);
            }).join('\n');

            const charsRemoved = text.length - filtered.length;
            e.target.value = filtered;
            e.target.selectionStart = e.target.selectionEnd = Math.max(0, cursorPos - charsRemoved);

            showInputWarning(targetLang);
        }
    });

    function showInputWarning(lang) {
        let warning = $("inputWarning");
        if (!warning) {
            warning = document.createElement("div");
            warning.id = "inputWarning";
            warning.className = "input-warning";
            wordInput.parentNode.insertBefore(warning, wordInput.nextSibling);
        }
        warning.textContent = t('warningInvalidLang', { lang: LANG_NAMES[lang] || lang });
        warning.style.display = "block";

        clearTimeout(warningTimer);
        warningTimer = setTimeout(() => {
            warning.style.display = "none";
        }, 2000);
    }
}

/**
 * 初始化设置控件事件监听
 * 当设置变更时更新播放状态并同步到服务端
 */
function initSettingsListeners() {
    // shuffle 随机模式
    const shuffleCheckbox = $("shuffle");
    if (shuffleCheckbox) {
        shuffleCheckbox.addEventListener("change", async () => {
            const value = shuffleCheckbox.checked;
            if (currentRepeaterState?.settings) {
                currentRepeaterState.settings.shuffle = value;
            }
            await saveSettingToServer('shuffle_mode', value);
        });
    }

    // slow 慢速模式
    const slowCheckbox = $("slow");
    if (slowCheckbox) {
        slowCheckbox.addEventListener("change", async () => {
            const value = slowCheckbox.checked;
            if (currentRepeaterState?.settings) {
                currentRepeaterState.settings.slow = value;
            }
            await saveSettingToServer('slow_mode', value);
        });
    }

    // repeat 重复次数
    const repeatInput = $("repeat");
    if (repeatInput) {
        repeatInput.addEventListener("change", async () => {
            const value = parseInt(repeatInput.value) || 1;
            if (currentRepeaterState?.settings) {
                currentRepeaterState.settings.repeat = value;
            }
            await saveSettingToServer('repeat_count', value);
        });
    }

    // interval 播放间隔
    const intervalInput = $("interval");
    if (intervalInput) {
        intervalInput.addEventListener("change", async () => {
            const value = parseInt(intervalInput.value) || 300;
            if (currentRepeaterState?.settings) {
                currentRepeaterState.settings.interval = value;
            }
            await saveSettingToServer('interval_ms', value);
        });
    }

    // retry 重试次数
    const retryInput = $("retry");
    if (retryInput) {
        retryInput.addEventListener("change", async () => {
            const value = parseInt(retryInput.value) || 1;
            await saveSettingToServer('retry_count', value);
        });
    }

    // accent 口音选择
    document.querySelectorAll('input[name="accent"]').forEach(radio => {
        radio.addEventListener("change", async (e) => {
            const value = e.target.value;
            if (currentRepeaterState?.settings) {
                currentRepeaterState.settings.accent = value;
            }
            await saveSettingToServer('accent', value);
        });
    });
}

/**
 * 初始化语言选择器事件
 */
function initLangSelectors() {
    const translationLangSelect = $("translationLang");
    const uiLangSelect = $("uiLang");

    // 翻译语言变更 - 只影响翻译，不影响UI
    if (translationLangSelect) {
        translationLangSelect.addEventListener("change", async () => {
            const translationLang = getTranslationLang();

            // 清空本地 word info 缓存（翻译语言变了）
            clearLocalWordInfo();

            // 同步到服务端
            await saveSettingToServer('translation_lang', translationLang);
        });
    }

    // 界面语言变更 - 只影响UI，不影响翻译
    if (uiLangSelect) {
        uiLangSelect.addEventListener("change", async () => {
            const uiLang = getUiLang();

            // 更新界面语言
            setLocale(uiLang);
            updatePageTexts();

            // 重新渲染动态生成的组件（登录按钮、单词列表、登录弹窗等）
            updateUserDisplay();
            refreshLoginDialog();
            if (!window.currentActiveMode) {
                renderWordListCards();
            }

            // 同步到服务端
            await saveSettingToServer('ui_lang', uiLang);
        });
    }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initLangSelectors();
    initSettingsListeners();
    initPreloadListeners();
    initInputFilter();
    initWordListUI();

    // 初始化认证（会在登录后初始化 WebSocket 和加载设置）
    initAuth();

    // 初始化国际化（使用默认语言，登录后会根据用户设置更新）
    initI18n(getUiLang());

    // 主题切换时重新渲染卡片（更新原色卡片）
    setThemeChangeCallback(() => {
        if (!window.currentActiveMode) {
            renderWordListCards();
        }
    });

    // 监听设置变更（从服务端同步时更新 UI）
    onSettingsChange((settings) => {
        // 更新目标语言内部状态
        if (settings.target_lang) {
            setTargetLang(settings.target_lang);
            updateAccentSelectorVisibility();
        }
        if (settings.translation_lang && $("translationLang")) {
            $("translationLang").value = settings.translation_lang;
        }
        if (settings.ui_lang && $("uiLang")) {
            $("uiLang").value = settings.ui_lang;
            updatePageTexts();
            updateUserDisplay();
            refreshLoginDialog();
            if (!window.currentActiveMode) {
                renderWordListCards();
            }
        }

        // 同步其他设置控件的 UI 状态
        if (settings.shuffle_mode !== undefined && $("shuffle")) {
            $("shuffle").checked = settings.shuffle_mode;
        }
        if (settings.slow_mode !== undefined && $("slow")) {
            $("slow").checked = settings.slow_mode;
        }
        if (settings.repeat_count !== undefined && $("repeat")) {
            $("repeat").value = settings.repeat_count;
        }
        if (settings.interval_ms !== undefined && $("interval")) {
            $("interval").value = settings.interval_ms;
        }
        if (settings.retry_count !== undefined && $("retry")) {
            $("retry").value = settings.retry_count;
        }
        if (settings.accent) {
            const accentRadio = document.querySelector(`input[name="accent"][value="${settings.accent}"]`);
            if (accentRadio) accentRadio.checked = true;
        }

        // 更新播放状态中的设置
        if (currentRepeaterState?.settings) {
            if (settings.shuffle_mode !== undefined) currentRepeaterState.settings.shuffle = settings.shuffle_mode;
            if (settings.slow_mode !== undefined) currentRepeaterState.settings.slow = settings.slow_mode;
            if (settings.repeat_count !== undefined) currentRepeaterState.settings.repeat = settings.repeat_count;
            if (settings.interval_ms !== undefined) currentRepeaterState.settings.interval = settings.interval_ms;
            if (settings.accent) currentRepeaterState.settings.accent = settings.accent;
        }
    });
});
