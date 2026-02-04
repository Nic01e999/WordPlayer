/**
 * 数据同步模块（简化版）
 * 纯服务端存储，不再需要本地/云端合并
 */

import { API_BASE } from '../api.js';
import { getAuthHeader, isLoggedIn, setSyncStatus } from './state.js';
import { backendToFrontend, frontendToBackend, updateFolderIdMapping } from '../wordlist/adapter.js';

/**
 * 从云端拉取数据
 * @returns {Promise<{wordlists?: object, layout?: object, cardColors?: object, folders?: object, publicFolders?: array, error?: string}>}
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

        // 使用 adapter 转换为前端格式
        const frontendData = backendToFrontend(backendData);
        console.log('[Sync] 数据转换完成，前端格式:', frontendData);

        setSyncStatus('idle');
        return frontendData;
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
    console.log('[Sync] 前端数据:', data);
    setSyncStatus('syncing');

    try {
        // 使用 adapter 转换前端格式 -> 后端格式
        const backendData = frontendToBackend(data);
        console.log('[Sync] 转换后的后端数据:', backendData);

        const response = await fetch(`${API_BASE}/api/sync/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(backendData)
        });

        if (!response.ok) {
            console.error(`[Sync] 推送失败: ${response.status}`);
            setSyncStatus('error');
            return {
                error: '同步失败',
                statusCode: response.status
            };
        }

        // 获取返回的 ID 映射
        const result = await response.json();
        if (result.folderIdMap) {
            updateFolderIdMapping(result.folderIdMap);
            console.log('[Sync] 文件夹 ID 映射已更新:', result.folderIdMap);
        }

        console.log('[Sync] 推送成功');
        setSyncStatus('idle');
        return { success: true };
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

    return pushToCloud({ layout, cardColors, folders, wordlists: {} });
}
