/**
 * 数据同步模块（简化版）
 * 纯服务端存储，不再需要本地/云端合并
 */

import { API_BASE } from '../api.js';
import { getAuthHeader, isLoggedIn, setSyncStatus } from './state.js';

/**
 * 从云端拉取数据
 * @returns {Promise<{wordlists?: object, layout?: object, cardColors?: object, error?: string}>}
 */
export async function pullFromCloud() {
    if (!isLoggedIn()) {
        console.warn('[Sync] 未登录，无法同步');
        return { error: '未登录' };
    }

    console.log('[Sync] 开始从云端拉取数据...');
    setSyncStatus('syncing');

    try {
        const response = await fetch(`${API_BASE}/api/sync/pull`, {
            method: 'GET',
            headers: getAuthHeader()
        });

        console.log(`[Sync] 服务器响应: ${response.status}`);

        if (response.status === 401) {
            // Token 无效或已过期
            console.error('[Sync] Token 已失效，请重新登录');
            setSyncStatus('error');
            return { error: '登录已过期，请重新登录', needReauth: true };
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[Sync] 同步失败:', errorData);
            setSyncStatus('error');
            return { error: errorData.error || '同步失败' };
        }

        const data = await response.json();
        console.log('[Sync] 数据拉取成功');
        setSyncStatus('idle');
        return data;
    } catch (e) {
        console.error('[Sync] 网络错误:', e);
        setSyncStatus('error');
        return { error: '网络错误' };
    }
}

/**
 * 推送数据到云端（仅布局配置）
 * @param {object} data - { layout, cardColors }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function pushToCloud(data) {
    if (!isLoggedIn()) {
        return { error: '未登录' };
    }

    setSyncStatus('syncing');

    try {
        const response = await fetch(`${API_BASE}/api/sync/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            setSyncStatus('error');
            return { error: '同步失败' };
        }

        setSyncStatus('idle');
        return { success: true };
    } catch (e) {
        console.error('Push to cloud failed:', e);
        setSyncStatus('error');
        return { error: '网络错误' };
    }
}

/**
 * 同步布局配置到云端
 * @param {object} layout 布局配置
 * @param {object} cardColors 卡片颜色
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function syncLayoutToCloud(layout, cardColors) {
    if (!isLoggedIn()) {
        return { success: true };
    }

    return pushToCloud({ layout, cardColors, wordlists: {} });
}

// saveWordlistToCloud 和 deleteWordlistFromCloud 已移至 storage.js
// 这里保留空实现以兼容旧代码
export async function saveWordlistToCloud() {
    console.warn('saveWordlistToCloud is deprecated, use storage.saveWordList instead');
    return { success: true };
}

export async function deleteWordlistFromCloud() {
    console.warn('deleteWordlistFromCloud is deprecated, use storage.removeWordListFromStorage instead');
    return { success: true };
}
