/**
 * 统一的 API 请求包装器
 * 自动处理认证、错误处理和响应解析
 */

import { t } from '../i18n/index.js';

// 智能检测 API 基础 URL
// - 如果直接访问 5001 端口或通过 Cloudflare tunnel，使用相对路径
// - 否则显式指定 5001 端口
const isDirectAccess = location.port === "5001" || location.hostname.includes("trycloudflare.com");
const API_BASE = isDirectAccess ? "" : `http://${location.hostname}:5001`;

/**
 * 获取认证请求头
 * @returns {Object} 包含 Authorization 的请求头对象
 */
function getAuthHeader() {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * 统一的 API 请求函数
 *
 * @param {string} endpoint - API 端点路径（例如：'/api/auth/login'）
 * @param {Object} options - 请求选项
 * @param {string} options.method - HTTP 方法（GET, POST, PUT, DELETE）
 * @param {Object} [options.body] - 请求体（会自动转换为 JSON）
 * @param {Object} [options.headers] - 额外的请求头
 * @param {boolean} [options.auth=true] - 是否包含认证头
 * @returns {Promise<Object>} 响应数据
 */
export async function apiRequest(endpoint, options = {}) {
    const {
        method = 'GET',
        body = null,
        headers = {},
        auth = true
    } = options;

    const requestOptions = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    };

    // 添加认证头
    if (auth) {
        Object.assign(requestOptions.headers, getAuthHeader());
    }

    // 添加请求体
    if (body) {
        requestOptions.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, requestOptions);

        // 处理非 2xx 响应
        if (!response.ok) {
            console.error(`API request failed: ${method} ${endpoint}`, response.status);

            // 尝试解析错误响应
            try {
                const errorData = await response.json();
                return {
                    success: false,
                    error: errorData.error || `请求失败: ${response.status}`
                };
            } catch {
                return {
                    success: false,
                    error: `请求失败: ${response.status}`
                };
            }
        }

        // 解析成功响应
        return await response.json();

    } catch (error) {
        console.error(`API request error: ${method} ${endpoint}`, error);
        return {
            success: false,
            error: t('networkError')
        };
    }
}

/**
 * GET 请求快捷方法
 */
export async function apiGet(endpoint, options = {}) {
    return apiRequest(endpoint, { ...options, method: 'GET' });
}

/**
 * POST 请求快捷方法
 */
export async function apiPost(endpoint, body, options = {}) {
    return apiRequest(endpoint, { ...options, method: 'POST', body });
}

/**
 * PUT 请求快捷方法
 */
export async function apiPut(endpoint, body, options = {}) {
    return apiRequest(endpoint, { ...options, method: 'PUT', body });
}

/**
 * DELETE 请求快捷方法
 */
export async function apiDelete(endpoint, options = {}) {
    return apiRequest(endpoint, { ...options, method: 'DELETE' });
}
