/**
 * 认证 API 模块
 * 封装认证相关的 API 调用
 */

import { API_BASE } from '../api.js';
import { getAuthHeader } from './state.js';

/**
 * 注册新用户
 * @param {string} email 邮箱
 * @param {string} password 密码
 * @returns {Promise<{success: boolean, token?: string, user?: object, error?: string}>}
 */
export async function register(email, password) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return await response.json();
    } catch (e) {
        console.error('Register failed:', e);
        return { error: '网络错误，请稍后重试' };
    }
}

/**
 * 用户登录
 * @param {string} email 邮箱
 * @param {string} password 密码
 * @returns {Promise<{success: boolean, token?: string, user?: object, error?: string}>}
 */
export async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return await response.json();
    } catch (e) {
        console.error('Login failed:', e);
        return { error: '网络错误，请稍后重试' };
    }
}

/**
 * 登出
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function logout() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            }
        });
        return await response.json();
    } catch (e) {
        console.error('Logout failed:', e);
        return { error: '网络错误' };
    }
}

/**
 * 获取当前用户信息（验证 token 有效性）
 * @returns {Promise<{user?: object, error?: string}>}
 */
export async function getCurrentUser() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            method: 'GET',
            headers: getAuthHeader()
        });
        if (response.status === 401) {
            return { error: 'unauthorized' };
        }
        return await response.json();
    } catch (e) {
        console.error('Get current user failed:', e);
        return { error: '网络错误' };
    }
}

/**
 * 发送密码重置验证码
 * @param {string} email 邮箱
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function forgotPassword(email) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        return await response.json();
    } catch (e) {
        console.error('Forgot password failed:', e);
        return { error: '网络错误，请稍后重试' };
    }
}

/**
 * 重置密码
 * @param {string} email 邮箱
 * @param {string} code 验证码
 * @param {string} password 新密码
 * @returns {Promise<{success: boolean, token?: string, user?: object, error?: string}>}
 */
export async function resetPassword(email, code, password) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, password })
        });
        return await response.json();
    } catch (e) {
        console.error('Reset password failed:', e);
        return { error: '网络错误，请稍后重试' };
    }
}
