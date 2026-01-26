/**
 * 登录界面模块
 * 处理登录/注册/忘记密码的 UI 交互
 */

import * as api from './api.js';
import * as state from './state.js';
import { pullFromCloud, pushToCloud, mergeData } from './sync.js';
import { getWordLists, saveWordListsToStorage, getCardColors } from '../wordlist/storage.js';
import { getLayout, saveLayout } from '../wordlist/layout.js';
import { renderWordListCards } from '../wordlist/render.js';

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
                        <div class="auth-dialog-title">登录</div>
                        <div class="auth-dialog-subtitle">登录后可同步数据到云端</div>
                    </div>
                    <div class="auth-form">
                        <div class="auth-input-group">
                            <input type="email" class="auth-input" id="authEmail" placeholder="邮箱" autocomplete="email">
                        </div>
                        <div class="auth-input-group">
                            <input type="password" class="auth-input" id="authPassword" placeholder="密码" autocomplete="current-password">
                        </div>
                        <div class="auth-error" id="authError"></div>
                        <div class="auth-buttons">
                            <button class="auth-btn-primary" id="authSubmit">登录</button>
                        </div>
                        <div class="auth-link" id="switchToRegister">没有账号？注册</div>
                        <div class="auth-link" id="switchToForgot">忘记密码？</div>
                    </div>
                </div>
            `;

        case 'register':
            return `
                <div class="glass-dialog auth-dialog">
                    <div class="auth-dialog-header">
                        <div class="auth-dialog-title">注册</div>
                        <div class="auth-dialog-subtitle">创建账号开始使用</div>
                    </div>
                    <div class="auth-form">
                        <div class="auth-input-group">
                            <input type="email" class="auth-input" id="authEmail" placeholder="邮箱" autocomplete="email">
                        </div>
                        <div class="auth-input-group">
                            <input type="password" class="auth-input" id="authPassword" placeholder="密码（至少6位）" autocomplete="new-password">
                        </div>
                        <div class="auth-input-group">
                            <input type="password" class="auth-input" id="authPasswordConfirm" placeholder="确认密码" autocomplete="new-password">
                        </div>
                        <div class="auth-error" id="authError"></div>
                        <div class="auth-buttons">
                            <button class="auth-btn-primary" id="authSubmit">注册</button>
                        </div>
                        <div class="auth-link" id="switchToLogin">已有账号？登录</div>
                    </div>
                </div>
            `;

        case 'forgot':
            return `
                <div class="glass-dialog auth-dialog">
                    <div class="auth-dialog-header">
                        <div class="auth-dialog-title">忘记密码</div>
                        <div class="auth-dialog-subtitle">输入邮箱接收验证码</div>
                    </div>
                    <div class="auth-form">
                        <div class="auth-input-group">
                            <input type="email" class="auth-input" id="authEmail" placeholder="邮箱" autocomplete="email">
                        </div>
                        <div class="auth-error" id="authError"></div>
                        <div class="auth-buttons">
                            <button class="auth-btn-primary" id="authSubmit">发送验证码</button>
                        </div>
                        <div class="auth-link" id="switchToLogin">返回登录</div>
                    </div>
                </div>
            `;

        case 'reset':
            return `
                <div class="glass-dialog auth-dialog">
                    <div class="auth-dialog-header">
                        <div class="auth-dialog-title">重置密码</div>
                        <div class="auth-dialog-subtitle">验证码已发送到 ${resetEmail}</div>
                    </div>
                    <div class="auth-form">
                        <div class="auth-input-group">
                            <input type="text" class="auth-input auth-code-input" id="authCode" placeholder="验证码" maxlength="6" autocomplete="one-time-code">
                        </div>
                        <div class="auth-input-group">
                            <input type="password" class="auth-input" id="authPassword" placeholder="新密码（至少6位）" autocomplete="new-password">
                        </div>
                        <div class="auth-error" id="authError"></div>
                        <div class="auth-buttons">
                            <button class="auth-btn-primary" id="authSubmit">重置密码</button>
                        </div>
                        <div class="auth-link" id="switchToForgot">重新发送验证码</div>
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
        submitBtn.textContent = '处理中...';

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
                        result = { error: '两次输入的密码不一致' };
                    } else {
                        result = await api.register(email, password);
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
            errorDiv.textContent = '操作失败，请稍后重试';
            errorDiv.classList.add('show');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = getSubmitButtonText();
        }
    });

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
 * 获取提交按钮文字
 */
function getSubmitButtonText() {
    switch (currentMode) {
        case 'login': return '登录';
        case 'register': return '注册';
        case 'forgot': return '发送验证码';
        case 'reset': return '重置密码';
    }
}

/**
 * 登录后同步数据
 */
async function syncAfterLogin() {
    // 拉取云端数据
    const cloudData = await pullFromCloud();

    if (cloudData.error) {
        console.error('Sync failed:', cloudData.error);
        return;
    }

    // 获取本地数据
    const localWordlists = getWordLists();
    const localLayout = getLayout();
    const localCardColors = getCardColors();

    // 合并数据
    const merged = mergeData(cloudData, {
        wordlists: localWordlists,
        layout: localLayout,
        cardColors: localCardColors
    });

    // 保存合并后的数据到本地
    if (merged.wordlists && Object.keys(merged.wordlists).length > 0) {
        saveWordListsToStorage(merged.wordlists);
    }

    if (merged.layout) {
        saveLayout(merged.layout);
    }

    if (merged.cardColors && Object.keys(merged.cardColors).length > 0) {
        localStorage.setItem('cardColors', JSON.stringify(merged.cardColors));
    }

    // 推送合并后的数据到云端
    await pushToCloud({
        wordlists: merged.wordlists || {},
        layout: merged.layout,
        cardColors: merged.cardColors || {}
    });

    // 刷新 UI
    renderWordListCards();
}

/**
 * 登出
 */
export async function doLogout() {
    await api.logout();
    state.clearAuth();
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
                    <span>🔄</span>
                    <span>同步数据</span>
                </div>
                <div class="user-dropdown-item danger" id="logoutBtn">
                    <span>🚪</span>
                    <span>退出登录</span>
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
            <button class="auth-btn" id="loginBtn">登录</button>
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
        // 验证 token 是否有效
        const result = await api.getCurrentUser();
        if (result.error === 'unauthorized') {
            // token 无效，清除登录状态
            state.clearAuth();
        } else if (result.user) {
            // 更新用户信息
            state.setUser(result.user);
        }
    }

    // 更新 UI
    updateUserDisplay();
}
