/**
 * 认证状态管理模块
 * 管理用户登录状态和 token
 */

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

// 当前用户信息
export let currentUser = null;

// 认证 token
export let authToken = null;

// 同步状态: 'idle' | 'syncing' | 'error'
export let syncStatus = 'idle';

// 状态变更回调
let onAuthChange = null;

/**
 * 设置状态变更回调
 */
export function setOnAuthChange(callback) {
    onAuthChange = callback;
}

/**
 * 设置用户信息
 */
export function setUser(user) {
    currentUser = user;
    if (user) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
        localStorage.removeItem(AUTH_USER_KEY);
    }
    onAuthChange?.();
}

/**
 * 设置 token
 */
export function setToken(token) {
    authToken = token;
    if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
    }
}

/**
 * 设置同步状态
 */
export function setSyncStatus(status) {
    syncStatus = status;
    onAuthChange?.();
}

/**
 * 检查是否已登录
 */
export function isLoggedIn() {
    return !!authToken && !!currentUser;
}

/**
 * 从 localStorage 恢复登录状态
 */
export function restoreAuth() {
    try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const userStr = localStorage.getItem(AUTH_USER_KEY);

        if (token && userStr) {
            authToken = token;
            currentUser = JSON.parse(userStr);
            return true;
        }
    } catch (e) {
        console.error('Failed to restore auth state:', e);
    }
    return false;
}

/**
 * 清除登录状态
 */
export function clearAuth() {
    currentUser = null;
    authToken = null;
    syncStatus = 'idle';
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    onAuthChange?.();
}

/**
 * 获取授权头
 */
export function getAuthHeader() {
    if (!authToken) return {};
    return {
        'Authorization': `Bearer ${authToken}`
    };
}
