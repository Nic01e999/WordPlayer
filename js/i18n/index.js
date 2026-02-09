/**
 * 国际化模块
 * 根据用户的母语设置显示界面文字
 */

import zh from './zh.js';
import en from './en.js';
import ja from './ja.js';
import ko from './ko.js';

// 语言包映射
const locales = { zh, en, ja, ko };

// 当前语言（默认中文）
let currentLang = 'zh';

// 语言变更回调列表
const listeners = [];

/**
 * 设置当前语言
 * @param {string} lang - 语言代码 (zh, en, ja, ko, fr)
 */
export function setLocale(lang) {
    if (locales[lang]) {
        currentLang = lang;
        // 通知所有监听者
        listeners.forEach(callback => callback(lang));
    } else {
        console.warn(`[i18n] Unsupported language: ${lang}`);
    }
}

/**
 * 获取当前语言
 * @returns {string} 当前语言代码
 */
export function getLocale() {
    return currentLang;
}

/**
 * 获取翻译文本
 * @param {string} key - 翻译键
 * @param {Object} params - 插值参数 (可选)
 * @returns {string} 翻译后的文本
 */
export function t(key, params = {}) {
    const locale = locales[currentLang] || locales['zh'];
    let text = locale[key] || locales['en'][key] || key;

    // 简单的参数替换 {name} -> value
    Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });

    return text;
}

/**
 * 监听语言变更
 * @param {Function} callback - 回调函数，接收新语言代码
 * @returns {Function} 取消监听的函数
 */
export function onLocaleChange(callback) {
    listeners.push(callback);
    return () => {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
    };
}

/**
 * 更新页面上所有带有 data-i18n 属性的元素
 */
export function updatePageTexts() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        // 跳过处于特殊模式的按钮（如公开卡片的"创建副本"按钮）
        if (el.hasAttribute('data-is-copy-mode')) {
            const isCopyMode = el.getAttribute('data-is-copy-mode') === 'true';
            el.textContent = t(isCopyMode ? 'createCopy' : 'save');
            return;
        }

        const key = el.getAttribute('data-i18n');
        const attr = el.getAttribute('data-i18n-attr');

        if (attr) {
            // 更新属性 (如 placeholder)
            el.setAttribute(attr, t(key));
        } else {
            // 更新文本内容
            el.textContent = t(key);
        }
    });

    // 更新 CSS 变量（用于 ::before/::after content）
    document.documentElement.style.setProperty('--i18n-stamp', `"${t('stamp')}"`);
}

/**
 * 初始化国际化
 * @param {string} lang - 初始语言代码
 */
export function initI18n(lang = 'zh') {
    setLocale(lang);
    updatePageTexts();
}

// 导出语言包（用于调试或扩展）
export { locales };
