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
 * 显示警告框
 * @param {string} message - 消息内容
 * @returns {Promise<void>}
 */
export function showAlert(message) {
    return new Promise((resolve) => {
        const overlay = createDialog({
            message,
            buttons: [{ text: t('confirm'), action: 'ok' }]
        });

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));

        const dialog = overlay.querySelector('.glass-dialog');
        dialog.querySelector('.glass-dialog-btn').focus();

        const close = () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 200);
            resolve();
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.dataset.action === 'ok') {
                close();
            }
        });

        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                close();
            }
        });
    });
}

/**
 * 显示确认框
 * @param {string} message - 消息内容
 * @returns {Promise<boolean>}
 */
export function showConfirm(message) {
    return new Promise((resolve) => {
        const overlay = createDialog({
            message,
            buttons: [
                { text: t('cancel'), action: 'cancel' },
                { text: t('confirm'), action: 'ok' }
            ]
        });

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));

        const dialog = overlay.querySelector('.glass-dialog');
        dialog.querySelector('.glass-dialog-btn.primary').focus();

        const close = (result) => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                close(false);
            } else if (e.target.dataset.action === 'ok') {
                close(true);
            } else if (e.target.dataset.action === 'cancel') {
                close(false);
            }
        });

        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                close(true);
            } else if (e.key === 'Escape') {
                close(false);
            }
        });
    });
}

/**
 * 显示输入框
 * @param {string} message - 提示消息
 * @param {string} defaultValue - 默认值
 * @returns {Promise<string|null>}
 */
export function showPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = createDialog({
            message,
            input: { defaultValue, placeholder: '' },
            buttons: [
                { text: t('cancel'), action: 'cancel' },
                { text: t('confirm'), action: 'ok' }
            ]
        });

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));

        const dialog = overlay.querySelector('.glass-dialog');
        const input = dialog.querySelector('.glass-dialog-input');
        input.focus();
        input.select();

        const close = (result) => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.dataset.action === 'cancel') {
                close(null);
            } else if (e.target.dataset.action === 'ok') {
                close(input.value);
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                close(input.value);
            } else if (e.key === 'Escape') {
                close(null);
            }
        });
    });
}
