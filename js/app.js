/**
 * 英语听写/复读工具 - 应用入口
 */

import { currentActiveMode, currentRepeaterState } from './state.js';
import { initPreloadListeners, startPreload } from './preload.js';
import { Repeater, setDictationRef } from './repeater/index.js';
import { Dictation, setRepeaterRef } from './dictation/index.js';
import {
    $,
    isValidForLanguage,
    filterInvalidChars,
    getTargetLang,
    getTranslationLang,
    getUiLang,
    getAccent,
    updateAccentSelectorVisibility,
    detectLanguageFromInput,
    setTargetLang,
    loadLangSettings,
    initSettingsToggle,
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
import { checkFirstTime } from './guide.js';
import { initPublicSearch, openPublicSearch } from './public-search.js';

// 在 DOMContentLoaded 之前应用主题（防止页面闪烁）
applyTheme(getStoredTheme());

// 设置循环引用
setDictationRef(Dictation);
setRepeaterRef(Repeater);

/**
 * Home 按钮点击处理
 * 如果已在 home，则打开搜索框；否则返回 home
 */
function goHomeOrSearch() {
    if (!window.currentActiveMode) {
        // 已经在 home，打开搜索框
        openPublicSearch();
    } else {
        // 不在 home，返回 home
        goHome();
    }
}

// 暴露到全局（供 HTML onclick 使用）
window.Repeater = Repeater;
window.Dictation = Dictation;
window.goHome = goHomeOrSearch;  // 使用新的函数
window.showLoginDialog = showLoginDialog;

// 暴露当前模式到全局（供模块内部检测使用）
Object.defineProperty(window, 'currentActiveMode', {
    get: () => currentActiveMode
});

// 防抖定时器
let refreshModeTimer = null;

/**
 * 刷新当前模式（重新启动以应用新设置）
 * 使用防抖避免快速修改多个设置时重复刷新
 */
function refreshCurrentMode() {
    // 清除之前的定时器
    if (refreshModeTimer) {
        clearTimeout(refreshModeTimer);
    }

    // 300ms 防抖延迟
    refreshModeTimer = setTimeout(() => {
        const mode = window.currentActiveMode;

        if (mode === 'repeater') {
            // 重新启动 Repeater 模式
            if (window.Repeater?.startRepeater) {
                window.Repeater.startRepeater();
            }
        } else if (mode === 'dictation') {
            // 重新启动 Dictation 模式
            if (window.Dictation?.startDictation) {
                window.Dictation.startDictation();
            }
        }
        // 如果不在任何模式中，不做任何操作

        // 界面刷新完成后，重新加载预加载数据
        if (mode === 'repeater' || mode === 'dictation') {
            console.log('[refreshCurrentMode] 触发 reload，重新加载预加载数据');
            startPreload(true);
        }

        refreshModeTimer = null;
    }, 300);
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

            // 立即刷新当前模式
            refreshCurrentMode();
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

            // 立即刷新当前模式
            refreshCurrentMode();
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

            // 立即刷新当前模式
            refreshCurrentMode();
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

            // 立即刷新当前模式
            refreshCurrentMode();
        });
    }

    // retry 重试次数
    const retryInput = $("retry");
    if (retryInput) {
        retryInput.addEventListener("change", async () => {
            const value = parseInt(retryInput.value) || 1;
            await saveSettingToServer('retry_count', value);

            // 立即刷新当前模式
            refreshCurrentMode();
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

            // 立即刷新当前模式（与 shuffle/slow 保持一致）
            refreshCurrentMode();
        });
    });

    // dictateProvide 和 dictateWrite 听写模式配置
    const dictateProvideRadios = document.querySelectorAll('input[name="dictate-provide"]');
    const dictateWriteRadios = document.querySelectorAll('input[name="dictate-write"]');

    if (dictateProvideRadios.length > 0 && dictateWriteRadios.length > 0) {
        // 监听 provide 变化
        dictateProvideRadios.forEach(radio => {
            radio.addEventListener("change", async () => {
                const provideValue = document.querySelector('input[name="dictate-provide"]:checked')?.value;

                // provide=B 时，write 只能选 A
                if (provideValue === 'B') {
                    document.getElementById('write-word').checked = true;
                    document.getElementById('write-def').disabled = true;
                } else {
                    document.getElementById('write-def').disabled = false;
                }

                await saveSettingToServer('dictate_provide', provideValue);

                // 立即刷新当前模式
                refreshCurrentMode();
            });
        });

        // 监听 write 变化
        dictateWriteRadios.forEach(radio => {
            radio.addEventListener("change", async () => {
                const writeValue = document.querySelector('input[name="dictate-write"]:checked')?.value;

                // write=B 时，provide 只能选 A
                if (writeValue === 'B') {
                    document.getElementById('provide-word').checked = true;
                    document.getElementById('provide-def').disabled = true;
                } else {
                    document.getElementById('provide-def').disabled = false;
                }

                await saveSettingToServer('dictate_write', writeValue);

                // 立即刷新当前模式
                refreshCurrentMode();
            });
        });
    }
}

/**
 * 初始化语言选择器事件
 */
function initLangSelectors() {
    // 界面语言变更 - 只影响UI，不影响翻译
    const uiLangRadios = document.querySelectorAll('input[name="ui-lang"]');

    uiLangRadios.forEach(radio => {
        radio.addEventListener("change", async () => {
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
    });
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initLangSelectors();
    initSettingsListeners();
    initPreloadListeners();
    initWordListUI();
    initSettingsToggle();  // 初始化设置面板点击切换功能
    initPublicSearch();    // 初始化公开文件夹搜索功能

    // 从 localStorage 恢复语言设置（未登录用户使用，已登录用户会被服务端设置覆盖）
    loadLangSettings();

    // 初始化认证（会在登录后初始化 WebSocket 和加载设置）
    initAuth();

    // 初始化国际化（使用默认语言，登录后会根据用户设置更新）
    initI18n(getUiLang());

    // 检查是否首次进入 home 模式，显示用户指引
    checkFirstTime('home');

    // 主题切换时重新渲染卡片（更新原色卡片）
    setThemeChangeCallback(() => {
        if (!window.currentActiveMode) {
            renderWordListCards();
        }
    });

    // 监听设置变更（从服务端同步时更新 UI）
    onSettingsChange((settings) => {
        // 更新目标语言内部状态
        // 注意：只有在没有输入内容时才应用 target_lang，避免覆盖自动检测的语言
        if (settings.target_lang) {
            const wordInput = $("wordInput");
            const hasInput = wordInput && wordInput.value.trim().length > 0;

            // 只有在没有输入内容时，才使用设置中的 target_lang
            if (!hasInput) {
                setTargetLang(settings.target_lang);
                updateAccentSelectorVisibility();
            }

            // 如果切换到非英语语言，自动重置 accent 为 'us'
            if (settings.target_lang !== 'en') {
                const currentAccent = getAccent();
                if (currentAccent !== 'us') {
                    console.log(`[设置] 非英语语言不支持 ${currentAccent} 口音，已重置为 us`);

                    // 重置 UI
                    const usRadio = document.querySelector('input[name="accent"][value="us"]');
                    if (usRadio) usRadio.checked = true;

                    // 更新 Repeater 状态
                    if (window.currentRepeaterState?.settings) {
                        window.currentRepeaterState.settings.accent = 'us';
                    }

                    // 同步到服务端
                    saveSettingToServer('accent', 'us');
                }
            }
        }
        if (settings.ui_lang) {
            const uiLangRadio = document.querySelector(`input[name="ui-lang"][value="${settings.ui_lang}"]`);
            if (uiLangRadio) {
                uiLangRadio.checked = true;
                updatePageTexts();
                updateUserDisplay();
                refreshLoginDialog();
                if (!window.currentActiveMode) {
                    renderWordListCards();
                }
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
        if (settings.dictate_provide !== undefined) {
            const provideRadio = document.querySelector(`input[name="dictate-provide"][value="${settings.dictate_provide}"]`);
            if (provideRadio) provideRadio.checked = true;
        }
        if (settings.dictate_write !== undefined) {
            const writeRadio = document.querySelector(`input[name="dictate-write"][value="${settings.dictate_write}"]`);
            if (writeRadio) writeRadio.checked = true;
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

        // 检查是否有影响播放行为的设置变更
        const playbackSettings = [
            'shuffle_mode', 'slow_mode', 'repeat_count',
            'interval_ms', 'retry_count', 'dictate_provide', 'dictate_write', 'accent'
        ];

        const hasPlaybackChange = playbackSettings.some(key => settings[key] !== undefined);

        if (hasPlaybackChange) {
            // 立即刷新当前模式以应用新设置
            refreshCurrentMode();
        }
    });
});

// ===== 移动端Menu折叠功能 =====
(function initMobileMenuCollapse() {
    // 检测是否为移动端
    function isMobile() {
        return window.innerWidth <= 700;
    }

    // 只在移动端启用
    if (!isMobile()) {
        window.addEventListener('resize', () => {
            if (isMobile()) {
                initMobileMenuCollapse();
            }
        });
        return;
    }

    let autoCollapseTimer = null;
    const menu = document.querySelector('#menu');

    if (!menu) return;

    // 默认展开状态
    document.body.classList.add('menu-expanded');
    console.log('[移动端Menu] 默认展开状态');

    // 展开menu（重置计时）
    function expandMenu() {
        document.body.classList.add('menu-expanded');

        // 清除之前的定时器
        if (autoCollapseTimer) {
            clearTimeout(autoCollapseTimer);
        }

        // 3秒后自动折叠
        autoCollapseTimer = setTimeout(() => {
            collapseMenu();
        }, 3000);

        console.log('[移动端Menu] 已展开，3秒后自动折叠');
    }

    // 折叠menu
    function collapseMenu() {
        document.body.classList.remove('menu-expanded');

        if (autoCollapseTimer) {
            clearTimeout(autoCollapseTimer);
            autoCollapseTimer = null;
        }

        console.log('[移动端Menu] 已折叠');
    }

    // 点击menu内的按钮时，重置3秒计时
    menu.addEventListener('click', (e) => {
        if (document.body.classList.contains('menu-expanded')) {
            // 重置定时器
            if (autoCollapseTimer) {
                clearTimeout(autoCollapseTimer);
            }
            autoCollapseTimer = setTimeout(() => {
                collapseMenu();
            }, 3000);

            console.log('[移动端Menu] 重置3秒计时');
        } else {
            // 如果已折叠，点击menu展开
            expandMenu();
        }
    });

    // 点击页面其他区域时折叠menu
    document.addEventListener('click', (e) => {
        if (document.body.classList.contains('menu-expanded')) {
            if (!menu.contains(e.target)) {
                collapseMenu();
            }
        }
    });

    // 初始化时启动3秒计时
    expandMenu();

    console.log('[移动端Menu] 折叠功能已初始化');
})();
