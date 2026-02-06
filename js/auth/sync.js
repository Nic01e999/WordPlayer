/**
 * 数据同步模块（简化版）
 * 纯服务端存储，前端直接使用后端数据格式
 */

import { API_BASE } from '../api.js';
import { getAuthHeader, isLoggedIn, setSyncStatus } from './state.js';

/**
 * 从云端拉取数据
 * @returns {Promise<{wordcards?: object, layout?: array, cardColors?: object, folders?: object, publicFolders?: array, error?: string}>}
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

        const backendData = await response.json();
        console.log('[Sync] 后端数据拉取成功:', backendData);

        // 直接返回后端数据，不再转换
        setSyncStatus('idle');
        return backendData;
    } catch (e) {
        console.error('[Sync] 网络错误:', e);
        setSyncStatus('error');
        return { error: '网络错误' };
    }
}

/**
 * 推送数据到云端（仅布局配置）
 * @param {object} data - { layout, cardColors, folders }
 * @returns {Promise<{success: boolean, error?: string, statusCode?: number}>}
 */
export async function pushToCloud(data) {
    if (!isLoggedIn()) {
        return { error: '未登录' };
    }

    console.log('[Sync] 开始推送数据到云端...');
    console.log('[Sync] 推送数据:', data);
    setSyncStatus('syncing');

    try {
        // 直接发送数据，不再转换
        const response = await fetch(`${API_BASE}/api/sync/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            console.error(`[Sync] 推送失败: ${response.status}`);
            setSyncStatus('error');
            return {
                error: '同步失败',
                statusCode: response.status
            };
        }

        const result = await response.json();
        console.log('[Sync] 推送成功，服务器返回:', result);
        setSyncStatus('idle');
        return { success: true, result };
    } catch (e) {
        console.error('[Sync] 网络错误:', e);
        setSyncStatus('error');
        return { error: '网络错误' };
    }
}

/**
 * 同步布局配置到云端
 * @param {object} layout 布局配置
 * @param {object} cardColors 卡片颜色
 * @param {object} folders 文件夹配置
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function syncLayoutToCloud(layout, cardColors, folders = {}) {
    if (!isLoggedIn()) {
        return { success: true };
    }

    return pushToCloud({ layout, cardColors, folders, wordcards: {} });
}
