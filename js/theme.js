/**
 * 主题管理模块
 * 处理主题选择、持久化和应用
 * 支持颜色（pink/green/blue/purple）和模式（light/dark）双维度选择
 */

const COLOR_STORAGE_KEY = 'english-dictation-theme-color';
const MODE_STORAGE_KEY = 'english-dictation-theme-mode';
const VALID_COLORS = ['pink', 'green', 'blue', 'purple'];
const VALID_MODES = ['light', 'dark'];

// 主题变更回调
let _onThemeChange = null;

/**
 * 设置主题变更回调
 */
export function setThemeChangeCallback(callback) {
    _onThemeChange = callback;
}

/**
 * 从 localStorage 获取当前主题设置
 * @returns {{color: string, mode: string}} 主题设置
 */
export function getStoredTheme() {
    const color = localStorage.getItem(COLOR_STORAGE_KEY);
    const mode = localStorage.getItem(MODE_STORAGE_KEY);
    return {
        color: VALID_COLORS.includes(color) ? color : 'pink',
        mode: VALID_MODES.includes(mode) ? mode : 'light'
    };
}

/**
 * 应用主题到文档
 * @param {{color: string, mode: string}} theme - 主题设置
 */
export function applyTheme({ color, mode }) {
    if (!VALID_COLORS.includes(color)) color = 'pink';
    if (!VALID_MODES.includes(mode)) mode = 'light';

    const html = document.documentElement;

    // ✅ 永远显式设置主题（包括默认）
    html.dataset.themeColor = color;
    html.dataset.themeMode = mode;

    // 更新 UI 中的单选按钮选择状态
    const colorRadio = document.querySelector(
        `input[name="theme-color"][value="${color}"]`
    );
    const modeRadio = document.querySelector(
        `input[name="theme-mode"][value="${mode}"]`
    );

    if (colorRadio) colorRadio.checked = true;
    if (modeRadio) modeRadio.checked = true;
}


/**
 * 保存主题偏好到 localStorage
 * @param {{color: string, mode: string}} theme - 主题设置
 */
export function saveTheme({ color, mode }) {
    if (VALID_COLORS.includes(color)) {
        localStorage.setItem(COLOR_STORAGE_KEY, color);
    }
    if (VALID_MODES.includes(mode)) {
        localStorage.setItem(MODE_STORAGE_KEY, mode);
    }
}

/**
 * 初始化主题系统
 * - 页面加载时应用存储的主题
 * - 设置选择器的事件监听器
 */
export function initTheme() {
    // 应用存储的主题
    const theme = getStoredTheme();
    applyTheme(theme);

    // 为颜色单选按钮设置变化监听器
    document.querySelectorAll('input[name="theme-color"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const theme = getStoredTheme();
            theme.color = e.target.value;
            applyTheme(theme);
            saveTheme(theme);
            if (_onThemeChange) _onThemeChange();
        });
    });

    // 为模式单选按钮设置变化监听器
    document.querySelectorAll('input[name="theme-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const theme = getStoredTheme();
            theme.mode = e.target.value;
            applyTheme(theme);
            saveTheme(theme);
            if (_onThemeChange) _onThemeChange();
        });
    });
}
