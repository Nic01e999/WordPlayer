/**
 * 同步模块入口
 * 统一导出所有同步相关功能
 */

export {
    getSettings,
    getSetting,
    updateLocalSettings,
    loadSettingsFromServer,
    saveSettingToServer,
    saveSettingsToServer,
    resetSettings,
    applySettings,
    onSettingsChange,
    clearSettings
} from './settings.js';

export {
    initWebSocket,
    disconnectWebSocket,
    sendSettingsUpdate,
    sendLayoutUpdate,
    sendWordlistUpdate,
    isWebSocketConnected,
    onWebSocketEvent
} from './websocket.js';
