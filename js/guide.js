/**
 * 用户指引模块
 * 提供纯文本指引，用于显示用户说明
 */

import { t } from './i18n/index.js';

// 指引文本配置
const guideTexts = {
    home: {
        title: 'guideHomeTitle',
        content: [
            'guideHomeStep1',
            'guideHomeStep2',
            'guideHomeStep3',
            'guideHomeStep4'
        ]
    },
    dictation: {
        title: 'guideDictationTitle',
        content: [
            'guideDictationStep1',
            'guideDictationStep2',
            'guideDictationStep3'
        ]
    },
    repeater: {
        title: 'guideRepeaterTitle',
        content: [
            'guideRepeaterStep1',
            'guideRepeaterStep2',
            'guideRepeaterStep3'
        ]
    }
};

// 当前状态
let overlayElement = null;

/**
 * 显示指引
 * @param {string} mode - 模式名称 (home/dictation/repeater)
 */
export function showGuide(mode = 'home') {
    console.log(`[Guide] 显示指引: ${mode}`);

    // 同步移除旧 overlay，避免异步竞态
    if (overlayElement) {
        if (overlayElement._keyHandler) {
            document.removeEventListener('keydown', overlayElement._keyHandler);
        }
        if (overlayElement.parentNode) {
            overlayElement.parentNode.removeChild(overlayElement);
        }
        overlayElement = null;
    }

    const guideData = guideTexts[mode];
    if (!guideData) {
        console.error(`[Guide] 未找到模式: ${mode}`);
        return;
    }

    // 创建遮罩层
    overlayElement = document.createElement('div');
    overlayElement.className = 'guide-overlay';

    // 创建查看器
    const viewer = document.createElement('div');
    viewer.className = 'guide-viewer';

    // 创建标题
    const title = document.createElement('h2');
    title.className = 'guide-title';
    title.textContent = t(guideData.title);

    // 创建内容容器
    const contentContainer = document.createElement('div');
    contentContainer.className = 'guide-content';

    // 添加所有步骤
    guideData.content.forEach((stepKey, index) => {
        const step = document.createElement('p');
        step.className = 'guide-step';
        step.textContent = `${index + 1}. ${t(stepKey)}`;
        contentContainer.appendChild(step);
    });

    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'guide-btn guide-btn-close';
    closeBtn.textContent = t('guideClose');
    closeBtn.onclick = () => closeGuide();

    viewer.appendChild(title);
    viewer.appendChild(contentContainer);
    viewer.appendChild(closeBtn);
    overlayElement.appendChild(viewer);
    document.body.appendChild(overlayElement);

    // 点击遮罩层关闭
    overlayElement.addEventListener('click', (e) => {
        if (e.target === overlayElement) {
            closeGuide();
        }
    });

    // 键盘导航 (ESC 关闭)
    const keyHandler = (e) => {
        if (e.key === 'Escape') {
            closeGuide();
        }
    };
    document.addEventListener('keydown', keyHandler);
    overlayElement._keyHandler = keyHandler;
}

/**
 * 关闭指引
 */
export function closeGuide() {
    if (overlayElement) {
        // 移除键盘监听
        if (overlayElement._keyHandler) {
            document.removeEventListener('keydown', overlayElement._keyHandler);
        }

        // 添加淡出动画
        overlayElement.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (overlayElement && overlayElement.parentNode) {
                overlayElement.parentNode.removeChild(overlayElement);
            }
            overlayElement = null;
        }, 300);

        console.log('[Guide] 关闭指引');
    }
}

/**
 * 检查是否首次进入该模式
 * @param {string} mode - 模式名称
 */
export function checkFirstTime(mode) {
    const key = `guide-viewed-${mode}`;
    const viewed = localStorage.getItem(key);

    if (!viewed) {
        console.log(`[Guide] 首次进入 ${mode} 模式，显示指引`);
        // 延迟显示，确保页面已渲染
        setTimeout(() => {
            showGuide(mode);
        }, 500);
        localStorage.setItem(key, 'true');
    } else {
        console.log(`[Guide] 已查看过 ${mode} 模式指引`);
    }
}

// 添加淡出动画
const style = document.createElement('style');
style.textContent = `
@keyframes fadeOut {
    from {
        opacity: 1;
    }
    to {
        opacity: 0;
    }
}
`;
document.head.appendChild(style);

// 暴露到全局（用于 onclick）
window.showGuide = showGuide;

console.log('[Guide] 用户指引模块已加载');
