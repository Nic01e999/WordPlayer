/**
 * WebSocket 实时同步模块
 * 处理与服务端的 WebSocket 连接，实现多设备实时同步
 */

import { authToken, isLoggedIn } from '../auth/state.js';
import { applySettings } from './settings.js';
import { renderWordListCards } from '../wordlist/render.js';

// Socket.IO 客户端（需要加载 socket.io.js）
let socket = null;
let reconnectTimer = null;
let isConnected = false;

// 事件监听者
const eventListeners = {
    'settings:update': [],
    'layout:update': [],
    'wordlist:update': [],
    'connect': [],
    'disconnect': []
};

/**
 * 初始化 WebSocket 连接
 * @param {string} serverUrl - 服务器地址，如 'http://localhost:5001'
 */
export function initWebSocket(serverUrl = '') {
    // 如果已连接，先断开
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    // 检查 Socket.IO 是否可用
    if (typeof io === 'undefined') {
        console.warn('[WS] Socket.IO 客户端未加载，WebSocket 功能不可用');
        return;
    }

    if (!isLoggedIn()) {
        console.log('[WS] 未登录，跳过 WebSocket 连接');
        return;
    }

    const url = serverUrl || window.location.origin;

    try {
        socket = io(url, {
            auth: { token: authToken },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });

        // 连接事件
        socket.on('connect', () => {
            console.log('[WS] 已连接');
            isConnected = true;
            notifyListeners('connect', {});
        });

        // 断开事件
        socket.on('disconnect', (reason) => {
            console.log('[WS] 已断开:', reason);
            isConnected = false;
            notifyListeners('disconnect', { reason });
        });

        // 连接错误
        socket.on('connect_error', (error) => {
            console.error('[WS] 连接错误:', error.message);
        });

        // 设置更新
        socket.on('settings:update', (data) => {
            console.log('[WS] 收到设置更新:', data);
            if (data.settings) {
                applySettings(data.settings);
            } else if (data.key && data.value !== undefined) {
                applySettings({ [data.key]: data.value });
            }
            notifyListeners('settings:update', data);
        });

        // 布局更新
        socket.on('layout:update', (data) => {
            console.log('[WS] 收到布局更新:', data);
            // 重新渲染单词表卡片
            renderWordListCards();
            notifyListeners('layout:update', data);
        });

        // 单词表更新
        socket.on('wordlist:update', (data) => {
            console.log('[WS] 收到单词表更新:', data);
            // 重新渲染
            renderWordListCards();
            notifyListeners('wordlist:update', data);
        });

    } catch (e) {
        console.error('[WS] 初始化失败:', e);
    }
}

/**
 * 断开 WebSocket 连接
 */
export function disconnectWebSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    isConnected = false;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

/**
 * 发送设置更新
 * @param {string} key - 设置键
 * @param {*} value - 设置值
 */
export function sendSettingsUpdate(key, value) {
    if (!socket || !isConnected) return;

    socket.emit('settings:update', {
        key,
        value,
        timestamp: Date.now()
    });
}

/**
 * 发送布局更新
 * @param {object} layout - 布局配置
 * @param {object} cardColors - 卡片颜色
 */
export function sendLayoutUpdate(layout, cardColors) {
    if (!socket || !isConnected) return;

    socket.emit('layout:update', {
        layout,
        cardColors,
        timestamp: Date.now()
    });
}

/**
 * 发送单词表更新
 * @param {string} action - 操作类型: 'create' | 'update' | 'delete'
 * @param {string} name - 单词表名称
 * @param {object} data - 附加数据
 */
export function sendWordlistUpdate(action, name, data = {}) {
    if (!socket || !isConnected) return;

    socket.emit('wordlist:update', {
        action,
        name,
        ...data,
        timestamp: Date.now()
    });
}

/**
 * 检查是否已连接
 * @returns {boolean}
 */
export function isWebSocketConnected() {
    return isConnected;
}

/**
 * 添加事件监听器
 * @param {string} event - 事件名称
 * @param {Function} callback - 回调函数
 * @returns {Function} 取消监听的函数
 */
export function onWebSocketEvent(event, callback) {
    if (!eventListeners[event]) {
        eventListeners[event] = [];
    }
    eventListeners[event].push(callback);

    return () => {
        const idx = eventListeners[event].indexOf(callback);
        if (idx > -1) eventListeners[event].splice(idx, 1);
    };
}

/**
 * 通知所有监听者
 */
function notifyListeners(event, data) {
    const listeners = eventListeners[event] || [];
    listeners.forEach(cb => {
        try {
            cb(data);
        } catch (e) {
            console.error(`[WS] 事件 ${event} 回调错误:`, e);
        }
    });
}
