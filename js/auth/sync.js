/**
 * 数据同步模块
 * 处理单词表等数据的云同步
 */

import { API_BASE } from '../api.js';
import { getAuthHeader, isLoggedIn, setSyncStatus } from './state.js';

/**
 * 从云端拉取数据
 * @returns {Promise<{wordlists?: object, layout?: object, cardColors?: object, error?: string}>}
 */
export async function pullFromCloud() {
    if (!isLoggedIn()) {
        return { error: '未登录' };
    }

    setSyncStatus('syncing');

    try {
        const response = await fetch(`${API_BASE}/api/sync/pull`, {
            method: 'GET',
            headers: getAuthHeader()
        });

        if (!response.ok) {
            setSyncStatus('error');
            return { error: '同步失败' };
        }

        const data = await response.json();
        setSyncStatus('idle');
        return data;
    } catch (e) {
        console.error('Pull from cloud failed:', e);
        setSyncStatus('error');
        return { error: '网络错误' };
    }
}

/**
 * 推送数据到云端
 * @param {object} data - { wordlists, layout, cardColors }
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
 * 保存单个单词表到云端
 * @param {string} name 单词表名称
 * @param {object} wordlist 单词表数据
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveWordlistToCloud(name, wordlist) {
    if (!isLoggedIn()) {
        return { success: true }; // 未登录时静默成功
    }

    try {
        const response = await fetch(`${API_BASE}/api/sync/wordlist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                name,
                words: wordlist.words,
                translations: wordlist.translations,
                wordInfo: wordlist.wordInfo,
                created: wordlist.created,
                updated: wordlist.updated
            })
        });

        if (!response.ok) {
            console.error('Save wordlist to cloud failed');
            return { error: '同步失败' };
        }

        return { success: true };
    } catch (e) {
        console.error('Save wordlist to cloud failed:', e);
        return { error: '网络错误' };
    }
}

/**
 * 从云端删除单词表
 * @param {string} name 单词表名称
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteWordlistFromCloud(name) {
    if (!isLoggedIn()) {
        return { success: true }; // 未登录时静默成功
    }

    try {
        const response = await fetch(`${API_BASE}/api/sync/wordlist/${encodeURIComponent(name)}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });

        if (!response.ok) {
            console.error('Delete wordlist from cloud failed');
            return { error: '同步失败' };
        }

        return { success: true };
    } catch (e) {
        console.error('Delete wordlist from cloud failed:', e);
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

/**
 * 合并云端和本地数据
 * @param {object} cloudData 云端数据
 * @param {object} localData 本地数据
 * @returns {object} 合并后的数据
 */
export function mergeData(cloudData, localData) {
    const merged = { ...localData };

    // 合并单词表（以更新时间较新的为准）
    if (cloudData.wordlists) {
        for (const [name, cloudWl] of Object.entries(cloudData.wordlists)) {
            const localWl = merged.wordlists?.[name];
            if (!localWl) {
                // 云端有，本地没有
                merged.wordlists = merged.wordlists || {};
                merged.wordlists[name] = cloudWl;
            } else {
                // 两边都有，比较更新时间
                const cloudTime = new Date(cloudWl.updated || 0);
                const localTime = new Date(localWl.updated || 0);
                if (cloudTime > localTime) {
                    merged.wordlists[name] = cloudWl;
                }
            }
        }
    }

    // 合并布局（以更新时间较新的为准）
    if (cloudData.layout) {
        merged.layout = cloudData.layout;
    }

    if (cloudData.cardColors && Object.keys(cloudData.cardColors).length > 0) {
        merged.cardColors = { ...merged.cardColors, ...cloudData.cardColors };
    }

    return merged;
}
