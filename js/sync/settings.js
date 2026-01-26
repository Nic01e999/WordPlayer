/**
 * 设置同步模块
 * 管理用户设置的服务端同步
 */

import { apiGet, apiPut, apiPost } from '../utils/api.js';
import { isLoggedIn } from '../auth/state.js';
import { setLocale } from '../i18n/index.js';

// 默认设置
const DEFAULT_SETTINGS = {
    target_lang: 'en',
    translation_lang: 'zh',
    ui_lang: 'zh',
    theme: 'system',
    accent: 'us',
    repeat_count: 1,
    retry_count: 1,
    interval_ms: 300,
    slow_mode: false,
    shuffle_mode: false,
    dictate_mode: false
};

// 当前用户设置（内存中）
let userSettings = { ...DEFAULT_SETTINGS };

// 设置变更回调列表
const listeners = [];

/**
 * 获取当前设置
 * @returns {object} 当前设置对象
 */
export function getSettings() {
    return { ...userSettings };
}

/**
 * 获取单个设置值
 * @param {string} key - 设置键
 * @param {*} defaultValue - 默认值
 * @returns {*} 设置值
 */
export function getSetting(key, defaultValue = null) {
    return userSettings[key] ?? defaultValue;
}

/**
 * 更新本地设置（不同步到服务端）
 * @param {string|object} keyOrSettings - 设置键或设置对象
 * @param {*} value - 设置值（当第一个参数是键时）
 */
export function updateLocalSettings(keyOrSettings, value) {
    if (typeof keyOrSettings === 'object') {
        Object.assign(userSettings, keyOrSettings);
    } else {
        userSettings[keyOrSettings] = value;
    }

    // 如果是界面语言变更，更新 i18n
    if (keyOrSettings === 'ui_lang' || keyOrSettings?.ui_lang) {
        setLocale(userSettings.ui_lang);
    }

    // 通知监听者
    notifyListeners();
}

/**
 * 从服务端加载设置
 * @returns {Promise<{success: boolean, settings?: object, error?: string}>}
 */
export async function loadSettingsFromServer() {
    if (!isLoggedIn()) {
        return { success: false, error: '未登录' };
    }

    const data = await apiGet('/api/settings');

    if (data.settings) {
        userSettings = { ...DEFAULT_SETTINGS, ...data.settings };
        setLocale(userSettings.ui_lang);
        notifyListeners();
        return { success: true, settings: userSettings };
    }

    return { success: false, error: data.error || '加载设置失败' };
}

/**
 * 保存单个设置到服务端
 * @param {string} key - 设置键
 * @param {*} value - 设置值
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveSettingToServer(key, value) {
    // 先更新本地
    updateLocalSettings(key, value);

    if (!isLoggedIn()) {
        return { success: true }; // 未登录时只更新本地
    }

    const result = await apiPut('/api/settings', { key, value });

    // 检查结果
    if (!result.success) {
        console.error('设置保存失败:', result.error);
    }

    return result;
}

/**
 * 保存多个设置到服务端
 * @param {object} settings - 设置对象
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveSettingsToServer(settings) {
    // 先更新本地
    updateLocalSettings(settings);

    if (!isLoggedIn()) {
        return { success: true };
    }

    return apiPut('/api/settings', { settings });
}

/**
 * 重置为默认设置
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function resetSettings() {
    userSettings = { ...DEFAULT_SETTINGS };
    setLocale(DEFAULT_SETTINGS.ui_lang);
    notifyListeners();

    if (!isLoggedIn()) {
        return { success: true };
    }

    return apiPost('/api/settings/reset');
}

/**
 * 应用设置到 UI（从服务端拉取的数据）
 * @param {object} settings - 设置对象
 */
export function applySettings(settings) {
    if (!settings) return;

    userSettings = { ...DEFAULT_SETTINGS, ...settings };
    setLocale(userSettings.ui_lang);
    notifyListeners();
}

/**
 * 监听设置变更
 * @param {Function} callback - 回调函数
 * @returns {Function} 取消监听的函数
 */
export function onSettingsChange(callback) {
    listeners.push(callback);
    return () => {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
    };
}

/**
 * 通知所有监听者
 */
function notifyListeners() {
    listeners.forEach(callback => {
        try {
            callback(userSettings);
        } catch (e) {
            console.error('Settings change callback error:', e);
        }
    });
}

/**
 * 清除设置（登出时调用）
 */
export function clearSettings() {
    userSettings = { ...DEFAULT_SETTINGS };
}
