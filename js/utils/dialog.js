/**
 * 液态玻璃弹窗组件
 * 替代原生 alert/confirm/prompt
 */

import { t } from '../i18n/index.js';

/**
 * 创建弹窗 DOM 结构
 */
function createDialog({ title, message, input, buttons }) {
    const overlay = document.createElement('div');
    overlay.className = 'glass-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'glass-dialog';

    let html = '';
    if (title) {
        html += `<div class="glass-dialog-title">${title}</div>`;
    }
    if (message) {
        html += `<div class="glass-dialog-message">${message}</div>`;
    }
    if (input) {
        html += `<input type="text" class="glass-dialog-input" value="${input.defaultValue || ''}" placeholder="${input.placeholder || ''}">`;
    }
    html += '<div class="glass-dialog-buttons">';
    buttons.forEach((btn, idx) => {
        const isPrimary = idx === buttons.length - 1;
        html += `<button class="glass-dialog-btn ${isPrimary ? 'primary' : ''}" data-action="${btn.action}">${btn.text}</button>`;
    });
    html += '</div>';

    dialog.innerHTML = html;
    overlay.appendChild(dialog);

    return overlay;
}

/**
 * 通用对话框显示和生命周期管理
 *
 * @param {Object} config - 对话框配置
 * @param {string} config.message - 消息内容
 * @param {Array} config.buttons - 按钮配置数组
 * @param {Object} [config.input] - 输入框配置
 * @param {Function} config.onShow - 显示后的回调（用于设置焦点等）
 * @param {Function} config.handleAction - 处理用户操作的函数 (action, inputValue) => result
 * @returns {Promise} 返回用户操作结果
 */
function showDialog(config) {
    return new Promise((resolve) => {
        const { message, buttons, input, onShow, handleAction } = config;

        const overlay = createDialog({ message, input, buttons });
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));

        const dialog = overlay.querySelector('.glass-dialog');
        const inputElement = input ? dialog.querySelector('.glass-dialog-input') : null;

        // 执行显示后的回调（设置焦点等）
        if (onShow) {
            onShow(dialog, inputElement);
        }

        // 关闭对话框
        const close = (result) => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        };

        // 处理点击事件
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                // 点击遮罩层
                close(handleAction('overlay', inputElement?.value));
            } else if (e.target.dataset.action) {
                // 点击按钮
                close(handleAction(e.target.dataset.action, inputElement?.value));
            }
        });

        // 处理键盘事件
        const keydownTarget = inputElement || dialog;
        keydownTarget.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                close(handleAction('enter', inputElement?.value));
            } else if (e.key === 'Escape') {
                close(handleAction('escape', inputElement?.value));
            }
        });
    });
}

/**
 * 显示警告框
 * @param {string} message - 消息内容
 * @returns {Promise<void>}
 */
export function showAlert(message) {
    return showDialog({
        message,
        buttons: [{ text: t('confirm'), action: 'ok' }],
        onShow: (dialog) => {
            dialog.querySelector('.glass-dialog-btn').focus();
        },
        handleAction: () => undefined // alert 总是返回 undefined
    });
}

/**
 * 显示确认框
 * @param {string} message - 消息内容
 * @returns {Promise<boolean>}
 */
export function showConfirm(message) {
    return showDialog({
        message,
        buttons: [
            { text: t('cancel'), action: 'cancel' },
            { text: t('confirm'), action: 'ok' }
        ],
        onShow: (dialog) => {
            dialog.querySelector('.glass-dialog-btn.primary').focus();
        },
        handleAction: (action) => {
            return action === 'ok' || action === 'enter';
        }
    });
}

/**
 * 显示输入框
 * @param {string} message - 提示消息
 * @param {string} defaultValue - 默认值
 * @returns {Promise<string|null>}
 */
export function showPrompt(message, defaultValue = '') {
    return showDialog({
        message,
        input: { defaultValue, placeholder: '' },
        buttons: [
            { text: t('cancel'), action: 'cancel' },
            { text: t('confirm'), action: 'ok' }
        ],
        onShow: (dialog, input) => {
            input.focus();
            input.select();
        },
        handleAction: (action, inputValue) => {
            return (action === 'ok' || action === 'enter') ? inputValue : null;
        }
    });
}
