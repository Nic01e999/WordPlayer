/**
 * 认证模块入口
 * 导出所有认证相关功能
 */

// 状态管理
export {
    currentUser,
    authToken,
    syncStatus,
    isLoggedIn,
    setUser,
    setToken,
    clearAuth,
    getAuthHeader
} from './state.js';

// API 调用
export {
    register,
    login,
    logout,
    getCurrentUser,
    forgotPassword,
    resetPassword
} from './api.js';

// 同步功能
export {
    pullFromCloud,
    pushToCloud,
    saveWordlistToCloud,
    deleteWordlistFromCloud,
    syncLayoutToCloud
} from './sync.js';

// UI 功能
export {
    showLoginDialog,
    showRegisterDialog,
    closeDialog,
    doLogout,
    updateUserDisplay,
    initAuth,
    refreshLoginDialog
} from './login.js';
