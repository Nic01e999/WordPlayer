/**
 * 全屏功能模块
 * 使用浏览器原生 Fullscreen API 让整个页面进入/退出全屏
 * 兼容 WebKit（Safari）前缀
 */

/**
 * 获取当前处于全屏的元素（兼容前缀）
 * @returns {Element|null}
 */
function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

/**
 * 请求进入全屏（兼容前缀）
 * @param {Element} el 目标元素
 * @returns {Promise<void>}
 */
function requestFullscreen(el) {
    if (el.requestFullscreen) {
        return el.requestFullscreen();
    }
    if (el.webkitRequestFullscreen) {
        return el.webkitRequestFullscreen();
    }
    return Promise.reject(new Error('浏览器不支持全屏 API'));
}

/**
 * 退出全屏（兼容前缀）
 * @returns {Promise<void>}
 */
function exitFullscreen() {
    if (document.exitFullscreen) {
        return document.exitFullscreen();
    }
    if (document.webkitExitFullscreen) {
        return document.webkitExitFullscreen();
    }
    return Promise.reject(new Error('浏览器不支持全屏 API'));
}

/**
 * 切换全屏状态
 */
export async function toggleFullscreen() {
    try {
        if (getFullscreenElement()) {
            await exitFullscreen();
            console.log('[全屏] 已退出全屏');
        } else {
            await requestFullscreen(document.documentElement);
            console.log('[全屏] 已进入全屏');
        }
    } catch (err) {
        console.warn('[全屏] 切换失败:', err.message);
    }
}

/**
 * 根据当前全屏状态更新按钮图标样式
 */
function updateFullscreenButton() {
    const isFullscreen = !!getFullscreenElement();
    document.body.classList.toggle('is-fullscreen', isFullscreen);
}

/**
 * 初始化全屏功能
 * 监听全屏状态变化（含用户按 ESC 或 F11 退出的情况），同步按钮图标
 */
export function initFullscreen() {
    const btn = document.getElementById('fullscreen-btn');

    // 不支持全屏 API 的环境（如部分 iOS Safari）隐藏按钮
    const supported = document.documentElement.requestFullscreen
        || document.documentElement.webkitRequestFullscreen;
    if (!supported) {
        if (btn) btn.style.display = 'none';
        console.log('[全屏] 当前环境不支持全屏 API，已隐藏按钮');
        return;
    }

    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);

    updateFullscreenButton();
    console.log('[全屏] 全屏功能已初始化');
}
