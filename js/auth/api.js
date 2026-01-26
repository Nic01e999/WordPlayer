/**
 * 认证 API 模块
 * 封装认证相关的 API 调用
 */

import { apiPost, apiGet } from '../utils/api.js';

/**
 * 注册新用户
 * @param {string} email 邮箱
 * @param {string} password 密码
 * @returns {Promise<{success: boolean, token?: string, user?: object, error?: string}>}
 */
export async function register(email, password) {
    return apiPost('/api/auth/register', { email, password }, { auth: false });
}

/**
 * 用户登录
 * @param {string} email 邮箱
 * @param {string} password 密码
 * @returns {Promise<{success: boolean, token?: string, user?: object, error?: string}>}
 */
export async function login(email, password) {
    return apiPost('/api/auth/login', { email, password }, { auth: false });
}

/**
 * 登出
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function logout() {
    return apiPost('/api/auth/logout');
}

/**
 * 获取当前用户信息（验证 token 有效性）
 * @returns {Promise<{user?: object, error?: string}>}
 */
export async function getCurrentUser() {
    const result = await apiGet('/api/auth/me');
    // 保持向后兼容：401 错误返回特殊标记
    if (result.error && result.error.includes('401')) {
        return { error: 'unauthorized' };
    }
    return result;
}

/**
 * 发送密码重置验证码
 * @param {string} email 邮箱
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function forgotPassword(email) {
    return apiPost('/api/auth/forgot-password', { email }, { auth: false });
}

/**
 * 重置密码
 * @param {string} email 邮箱
 * @param {string} code 验证码
 * @param {string} password 新密码
 * @returns {Promise<{success: boolean, token?: string, user?: object, error?: string}>}
 */
export async function resetPassword(email, code, password) {
    return apiPost('/api/auth/reset-password', { email, code, password }, { auth: false });
}
