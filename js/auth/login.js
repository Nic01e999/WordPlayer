/**
 * 登录界面模块
 * 处理登录/注册/忘记密码的 UI 交互
 */

import * as api from './api.js';
import * as state from './state.js';
import { pullFromCloud, pushToCloud } from './sync.js';
import { setWordListsCache, clearWordListsCache, getCardColors } from '../wordlist/storage.js';
import { t } from '../i18n/index.js';
import { getLayout, saveLayout } from '../wordlist/layout.js';
import { renderWordListCards } from '../wordlist/render.js';
import { initWebSocket, disconnectWebSocket } from '../sync/websocket.js';
import { applySettings, clearSettings } from '../sync/settings.js';

let currentDialog = null;
let currentMode = 'login'; // 'login' | 'register' | 'forgot' | 'reset'
let resetEmail = ''; // 保存重置密码时的邮箱

/**
 * 显示登录弹窗
 */
export function showLoginDialog() {
    currentMode = 'login';
    createDialog();
}

/**
 * 显示注册弹窗
 */
export function showRegisterDialog() {
    currentMode = 'register';
    createDialog();
}

/**
 * 关闭弹窗
 */
export function closeDialog() {
    if (currentDialog) {
        currentDialog.classList.remove('show');
        setTimeout(() => {
            currentDialog.remove();
            currentDialog = null;
        }, 200);
    }
}

/**
 * 创建弹窗
 */
function createDialog() {
    // 移除已存在的弹窗
    if (currentDialog) {
        currentDialog.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'glass-overlay';
    overlay.innerHTML = getDialogContent();

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeDialog();
        }
    });

    document.body.appendChild(overlay);
    currentDialog = overlay;

    // 触发动画
    requestAnimationFrame(() => {
        overlay.classList.add('show');
        const firstInput = overlay.querySelector('input');
        if (firstInput) firstInput.focus();
    });

    // 绑定事件
    bindEvents(overlay);
}

/**
 * 获取弹窗内容
 */
function getDialogContent() {
    switch (currentMode) {
        case 'login':
            return `
                <div class="glass-dialog auth-dialog">
                    <div class="auth-dialog-header">
                        <div class="auth-dialog-title">${t('loginTitle')}</div>
                        <div class="auth-dialog-subtitle">${t('loginSubtitle')}</div>
                    </div>
                    <div class="auth-form">
                        <div class="auth-input-group">
                            <input type="email" class="auth-input" id="authEmail" placeholder="${t('email')}" autocomplete="email">
                        </div>
                        <div class="auth-input-group">
                            <input type="password" class="auth-input" id="authPassword" placeholder="${t('password')}" autocomplete="current-password">
                        </div>
                        <div class="auth-error" id="authError"></div>
                        <div class="auth-buttons">
                            <button class="auth-btn-primary" id="authSubmit">${t('loginTitle')}</button>
                        </div>
                        <div class="auth-link" id="switchToRegister">${t('noAccount')}</div>
                        <div class="auth-link" id="switchToForgot">${t('forgotPassword')}</div>
                    </div>
                </div>
            `;

        case 'register':
            return `
                <div class="glass-dialog auth-dialog">
                    <div class="auth-dialog-header">
                        <div class="auth-dialog-title">${t('registerTitle')}</div>
                        <div class="auth-dialog-subtitle">${t('registerSubtitle')}</div>
                    </div>
                    <div class="auth-form">
                        <div class="auth-input-group">
                            <input type="email" class="auth-input" id="authEmail" placeholder="${t('email')}" autocomplete="email">
                        </div>
                        <div class="auth-input-group">
                            <input type="password" class="auth-input" id="authPassword" placeholder="${t('passwordHint')}" autocomplete="new-password">
                        </div>
                        <div class="auth-input-group">
                            <input type="password" class="auth-input" id="authPasswordConfirm" placeholder="${t('confirmPassword')}" autocomplete="new-password">
                        </div>
                        <div class="auth-input-group auth-code-group">
                            <input type="text" class="auth-input auth-code-input" id="authCode" placeholder="${t('verificationCode')}" maxlength="6" autocomplete="one-time-code">
                            <button class="auth-btn-code" id="sendCodeBtn">${t('sendCode')}</button>
                        </div>
                        <div class="auth-error" id="authError"></div>
                        <div class="auth-buttons">
                            <button class="auth-btn-primary" id="authSubmit">${t('registerTitle')}</button>
                        </div>
                        <div class="auth-link" id="switchToLogin">${t('hasAccount')}</div>
                    </div>
                </div>
            `;

        case 'forgot':
            return `
                <div class="glass-dialog auth-dialog">
                    <div class="auth-dialog-header">
                        <div class="auth-dialog-title">${t('forgotTitle')}</div>
                        <div class="auth-dialog-subtitle">${t('forgotSubtitle')}</div>
                    </div>
                    <div class="auth-form">
                        <div class="auth-input-group">
                            <input type="email" class="auth-input" id="authEmail" placeholder="${t('email')}" autocomplete="email">
                        </div>
                        <div class="auth-error" id="authError"></div>
                        <div class="auth-buttons">
                            <button class="auth-btn-primary" id="authSubmit">${t('sendCode')}</button>
                        </div>
                        <div class="auth-link" id="switchToLogin">${t('backToLogin')}</div>
                    </div>
                </div>
            `;

        case 'reset':
            return `
                <div class="glass-dialog auth-dialog">
                    <div class="auth-dialog-header">
                        <div class="auth-dialog-title">${t('resetTitle')}</div>
                        <div class="auth-dialog-subtitle">${t('resetSubtitle', { email: resetEmail })}</div>
                    </div>
                    <div class="auth-form">
                        <div class="auth-input-group">
                            <input type="text" class="auth-input auth-code-input" id="authCode" placeholder="${t('verificationCode')}" maxlength="6" autocomplete="one-time-code">
                        </div>
                        <div class="auth-input-group">
                            <input type="password" class="auth-input" id="authPassword" placeholder="${t('newPasswordHint')}" autocomplete="new-password">
                        </div>
                        <div class="auth-error" id="authError"></div>
                        <div class="auth-buttons">
                            <button class="auth-btn-primary" id="authSubmit">${t('resetTitle')}</button>
                        </div>
                        <div class="auth-link" id="switchToForgot">${t('resendCode')}</div>
                    </div>
                </div>
            `;
    }
}

/**
 * 绑定弹窗事件
 */
function bindEvents(overlay) {
    const submitBtn = overlay.querySelector('#authSubmit');
    const emailInput = overlay.querySelector('#authEmail');
    const passwordInput = overlay.querySelector('#authPassword');
    const passwordConfirmInput = overlay.querySelector('#authPasswordConfirm');
    const codeInput = overlay.querySelector('#authCode');
    const errorDiv = overlay.querySelector('#authError');

    // 回车提交
    overlay.querySelectorAll('input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        });
    });

    // 提交按钮
    submitBtn.addEventListener('click', async () => {
        const email = emailInput?.value.trim();
        const password = passwordInput?.value;
        const passwordConfirm = passwordConfirmInput?.value;
        const code = codeInput?.value.trim();

        // 清除错误
        errorDiv.classList.remove('show');
        errorDiv.textContent = '';

        // 禁用按钮
        submitBtn.disabled = true;
        submitBtn.textContent = t('processing');

        try {
            let result;

            switch (currentMode) {
                case 'login':
                    result = await api.login(email, password);
                    if (result.success) {
                        state.setToken(result.token);
                        state.setUser(result.user);
                        closeDialog();
                        await syncAfterLogin();
                    }
                    break;

                case 'register':
                    if (password !== passwordConfirm) {
                        result = { error: t('passwordMismatch') };
                    } else if (!code) {
                        result = { error: t('codeRequired') || '请输入验证码' };
                    } else {
                        // 使用验证码创建账户（复用 resetPassword API）
                        result = await api.resetPassword(email, code, password);
                        if (result.success) {
                            state.setToken(result.token);
                            state.setUser(result.user);
                            closeDialog();
                            await syncAfterLogin();
                        }
                    }
                    break;

                case 'forgot':
                    result = await api.forgotPassword(email);
                    if (result.success) {
                        resetEmail = email;
                        currentMode = 'reset';
                        updateDialogContent();
                        return;
                    }
                    break;

                case 'reset':
                    result = await api.resetPassword(resetEmail, code, password);
                    if (result.success) {
                        state.setToken(result.token);
                        state.setUser(result.user);
                        closeDialog();
                        await syncAfterLogin();
                    }
                    break;
            }

            if (result?.error) {
                errorDiv.textContent = result.error;
                errorDiv.classList.add('show');
            }
        } catch (e) {
            errorDiv.textContent = t('operationFailed');
            errorDiv.classList.add('show');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = getSubmitButtonText();
        }
    });

    // 发送验证码按钮（仅注册模式）
    const sendCodeBtn = overlay.querySelector('#sendCodeBtn');
    if (sendCodeBtn) {
        let countdown = 0;

        sendCodeBtn.addEventListener('click', async () => {
            if (countdown > 0) return;

            const email = emailInput?.value.trim();
            if (!email) {
                errorDiv.textContent = t('emailRequired') || '请输入邮箱';
                errorDiv.classList.add('show');
                return;
            }

            sendCodeBtn.disabled = true;
            sendCodeBtn.textContent = t('sending') || '发送中...';

            try {
                // 调用发送验证码 API
                const result = await api.forgotPassword(email);
                if (result.success) {
                    // 开始倒计时
                    countdown = 60;
                    const timer = setInterval(() => {
                        countdown--;
                        sendCodeBtn.textContent = `${countdown}秒后重发`;
                        if (countdown <= 0) {
                            clearInterval(timer);
                            sendCodeBtn.disabled = false;
                            sendCodeBtn.textContent = t('sendCode') || '发送验证码';
                        }
                    }, 1000);
                } else {
                    errorDiv.textContent = result.error || '发送失败';
                    errorDiv.classList.add('show');
                    sendCodeBtn.disabled = false;
                    sendCodeBtn.textContent = t('sendCode') || '发送验证码';
                }
            } catch (e) {
                errorDiv.textContent = t('operationFailed') || '发送失败';
                errorDiv.classList.add('show');
                sendCodeBtn.disabled = false;
                sendCodeBtn.textContent = t('sendCode') || '发送验证码';
            }
        });
    }

    // 切换模式
    overlay.querySelector('#switchToRegister')?.addEventListener('click', () => {
        currentMode = 'register';
        updateDialogContent();
    });

    overlay.querySelector('#switchToLogin')?.addEventListener('click', () => {
        currentMode = 'login';
        updateDialogContent();
    });

    overlay.querySelector('#switchToForgot')?.addEventListener('click', () => {
        currentMode = 'forgot';
        updateDialogContent();
    });
}

/**
 * 更新弹窗内容
 */
function updateDialogContent() {
    if (!currentDialog) return;

    const dialog = currentDialog.querySelector('.glass-dialog');
    const newContent = document.createElement('div');
    newContent.innerHTML = getDialogContent();
    const newDialog = newContent.querySelector('.glass-dialog');

    dialog.innerHTML = newDialog.innerHTML;
    bindEvents(currentDialog);

    const firstInput = currentDialog.querySelector('input');
    if (firstInput) firstInput.focus();
}

/**
 * 刷新登录弹窗（语言变更时调用）
 */
export function refreshLoginDialog() {
    if (currentDialog) {
        updateDialogContent();
    }
}

/**
 * 获取提交按钮文字
 */
function getSubmitButtonText() {
    switch (currentMode) {
        case 'login': return t('loginTitle');
        case 'register': return t('registerTitle');
        case 'forgot': return t('sendCode');
        case 'reset': return t('resetTitle');
    }
}

/**
 * 登录后同步数据（纯服务端存储模式）
 */
async function syncAfterLogin() {
    console.log('[Sync] 开始从云端拉取数据...');

    // 从云端拉取数据
    const cloudData = await pullFromCloud();

    if (cloudData.error) {
        console.error('[Sync] 同步失败:', cloudData.error);

        // 如果是认证错误，清除登录状态并提示用户
        if (cloudData.needReauth) {
            const { clearAuth, showLoginDialog } = await import('./state.js');
            clearAuth();
            alert(cloudData.error);
            showLoginDialog();
        }
        return;
    }

    console.log('[Sync] 云端数据拉取成功');

    // 将云端单词表存入内存缓存
    setWordListsCache(cloudData.wordlists || {});
    console.log('[Sync] 单词表已更新:', Object.keys(cloudData.wordlists || {}).length, '个');

    // 同步布局配置（云端 -> 本地）
    if (cloudData.layout) {
        saveLayout(cloudData.layout);
        console.log('[Sync] 布局配置已更新');
    }

    if (cloudData.cardColors && Object.keys(cloudData.cardColors).length > 0) {
        localStorage.setItem('cardColors', JSON.stringify(cloudData.cardColors));
        console.log('[Sync] 卡片颜色已更新');
    }

    // 应用用户设置（语言、主题、播放设置等）
    if (cloudData.settings) {
        applySettings(cloudData.settings);
        console.log('[Sync] 用户设置已应用');
    }

    // 如果本地有布局配置但云端没有，推送到云端
    const localLayout = getLayout();
    const localCardColors = getCardColors();
    if (localLayout && !cloudData.layout) {
        console.log('[Sync] 推送本地布局到云端...');
        await pushToCloud({
            layout: localLayout,
            cardColors: localCardColors,
            wordlists: {}
        });
    }

    // 刷新 UI
    renderWordListCards();
    console.log('[Sync] UI 已刷新');

    // 初始化 WebSocket 连接（实时同步）
    initWebSocket();
    console.log('[Sync] WebSocket 连接已初始化');
}

/**
 * 登出
 */
export async function doLogout() {
    // 断开 WebSocket 连接
    disconnectWebSocket();
    // 清除用户设置
    clearSettings();

    await api.logout();
    state.clearAuth();
    // 清空单词表缓存
    clearWordListsCache();
    // 刷新 UI
    renderWordListCards();
}

/**
 * 更新用户信息显示
 */
export function updateUserDisplay() {
    const authSection = document.querySelector('.auth-section');
    if (!authSection) return;

    if (state.isLoggedIn()) {
        const email = state.currentUser.email;
        const initial = email.charAt(0).toUpperCase();

        authSection.innerHTML = `
            <div class="user-info" id="userInfoBtn">
                <div class="user-avatar">${initial}</div>
                <span class="user-email">${email}</span>
                <span class="sync-status ${state.syncStatus === 'syncing' ? 'syncing' : ''}">${getSyncIcon()}</span>
            </div>
            <div class="user-dropdown" id="userDropdown">
                <div class="user-dropdown-item" id="manualSync">
                    <span></span>
                    <span>${t('syncData')}</span>
                </div>
                <div class="user-dropdown-item danger" id="logoutBtn">
                    <span></span>
                    <span>${t('logout')}</span>
                </div>
            </div>
        `;

        // 绑定事件
        const userInfoBtn = authSection.querySelector('#userInfoBtn');
        const userDropdown = authSection.querySelector('#userDropdown');
        const logoutBtn = authSection.querySelector('#logoutBtn');
        const manualSyncBtn = authSection.querySelector('#manualSync');

        userInfoBtn.addEventListener('click', () => {
            userDropdown.classList.toggle('show');
        });

        // 点击外部关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!authSection.contains(e.target)) {
                userDropdown.classList.remove('show');
            }
        });

        logoutBtn.addEventListener('click', async () => {
            await doLogout();
            updateUserDisplay();
        });

        manualSyncBtn.addEventListener('click', async () => {
            userDropdown.classList.remove('show');
            await syncAfterLogin();
        });

    } else {
        authSection.innerHTML = `
            <button class="auth-btn" id="loginBtn">${t('loginTitle')}</button>
        `;

        authSection.querySelector('#loginBtn').addEventListener('click', showLoginDialog);
    }
}

/**
 * 获取同步状态图标
 */
function getSyncIcon() {
    switch (state.syncStatus) {
        case 'syncing': return '🔄';
        case 'error': return '⚠️';
        default: return '✓';
    }
}

/**
 * 初始化认证模块
 */
export async function initAuth() {
    // 设置状态变更回调
    state.setOnAuthChange(updateUserDisplay);

    // 尝试恢复登录状态
    if (state.restoreAuth()) {
        console.log('[Auth] 检测到已登录状态，开始验证 token...');
        console.log('[Auth] 当前 token:', state.authToken?.substring(0, 10) + '...');

        // 验证 token 是否有效
        const result = await api.getCurrentUser();
        if (result.error === 'unauthorized' || result.error) {
            // token 无效，清除登录状态
            console.log('[Auth] Token 已失效或验证失败，清除登录状态');
            console.log('[Auth] 错误信息:', result.error);
            state.clearAuth();
            console.log('[Auth] 本地认证状态已清除，请重新登录');
        } else if (result.user) {
            // 更新用户信息
            state.setUser(result.user);
            console.log('[Auth] Token 验证成功，用户:', result.user.email);
            console.log('[Auth] 开始自动同步数据...');
            // 页面加载时自动同步（拉取最新数据）
            await syncAfterLogin();
            console.log('[Auth] 自动同步完成');
        }
    } else {
        console.log('[Auth] 未检测到登录状态');
    }

    // 更新 UI
    updateUserDisplay();
}
