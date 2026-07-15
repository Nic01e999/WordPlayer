/**
 * 听写历史记录管理模块
 * 保存最近10次听写记录，支持回溯查看
 */

const HISTORY_KEY = 'dictation_history';
const MAX_HISTORY = 10;

/**
 * 获取所有历史记录
 * @returns {Array} 历史记录数组
 */
export function getHistory() {
    try {
        const data = localStorage.getItem(HISTORY_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('[History] 读取历史记录失败:', e);
        return [];
    }
}

/**
 * 保存一条新的历史记录
 * @param {Object} record - 历史记录对象
 * @param {Object} record.retryHistory - 重试历史
 * @param {number} record.timestamp - 时间戳
 * @param {string} record.cardName - 单词卡名称
 * @param {string} record.firstWord - 第一个单词
 * @param {number} record.finalScore - 最终分数
 * @param {number} record.totalWords - 总单词数
 * @param {string} record.workplaceHTML - workplace 的 HTML 快照
 * @returns {string} 返回新创建的记录ID
 */
export function saveHistory(record) {
    try {
        const history = getHistory();

        // 生成唯一ID
        const id = Date.now() + Math.random().toString(36).substr(2, 9);

        // 添加新记录到开头
        history.unshift({
            ...record,
            id: id
        });

        // 只保留最近10条
        const trimmed = history.slice(0, MAX_HISTORY);

        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
        console.log('[History] 已保存新历史记录，ID:', id, '当前总数:', trimmed.length);

        return id;
    } catch (e) {
        console.error('[History] 保存历史记录失败:', e);
        return null;
    }
}

/**
 * 更新已存在的历史记录
 * @param {string} id - 记录ID
 * @param {Object} updates - 要更新的字段
 */
export function updateHistory(id, updates) {
    try {
        const history = getHistory();
        const index = history.findIndex(record => record.id === id);

        if (index === -1) {
            console.warn('[History] 未找到要更新的记录:', id);
            return false;
        }

        // 更新记录
        history[index] = {
            ...history[index],
            ...updates,
            id: id // 保持ID不变
        };

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        console.log('[History] 已更新历史记录，ID:', id);

        return true;
    } catch (e) {
        console.error('[History] 更新历史记录失败:', e);
        return false;
    }
}

/**
 * 根据ID获取历史记录
 * @param {string} id - 记录ID
 * @returns {Object|null} 历史记录对象
 */
export function getHistoryById(id) {
    const history = getHistory();
    return history.find(record => record.id === id) || null;
}

/**
 * 删除指定ID的历史记录
 * @param {string} id - 记录ID
 */
export function deleteHistory(id) {
    try {
        const history = getHistory();
        const filtered = history.filter(record => record.id !== id);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
        console.log('[History] 已删除历史记录:', id);
    } catch (e) {
        console.error('[History] 删除历史记录失败:', e);
    }
}

/**
 * 清空所有历史记录
 */
export function clearHistory() {
    try {
        localStorage.removeItem(HISTORY_KEY);
        console.log('[History] 已清空所有历史记录');
    } catch (e) {
        console.error('[History] 清空历史记录失败:', e);
    }
}
