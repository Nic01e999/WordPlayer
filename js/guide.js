/**
 * 用户指引模块
 * 提供图片播放器功能，用于显示用户指引
 */

import { t } from './i18n/index.js';

// 指引图片配置
const guideImages = {
    home: [
        { src: 'assets/images/guide/home-1.gif' },
        { src: 'assets/images/guide/home-2.gif' }
    ],
    dictation: [
        { src: 'assets/images/guide/dic-1.gif' },
        { src: 'assets/images/guide/dic-2.gif' }
    ],
    repeater: [
        { src: 'assets/images/guide/rep-1.gif' }
    ]
};

// 当前状态
let currentMode = 'home';
let currentIndex = 0;
let overlayElement = null;

/**
 * 显示指引
 * @param {string} mode - 模式名称 (home/dictation/repeater)
 */
export function showGuide(mode = 'home') {
    console.log(`[Guide] 显示指引: ${mode}`);

    currentMode = mode;
    currentIndex = 0;

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

    // 创建遮罩层
    overlayElement = document.createElement('div');
    overlayElement.className = 'guide-overlay';

    // 创建查看器
    const viewer = document.createElement('div');
    viewer.className = 'guide-viewer';

    // 创建图片容器
    const imageContainer = document.createElement('div');
    imageContainer.className = 'guide-image-container';

    const image = document.createElement('div');
    image.className = 'guide-image';

    imageContainer.appendChild(image);

    // 创建导航栏
    const nav = document.createElement('div');
    nav.className = 'guide-nav';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'guide-btn guide-btn-prev';
    prevBtn.textContent = t('guidePrevious');
    prevBtn.onclick = () => prevImage();

    const progress = document.createElement('span');
    progress.className = 'guide-progress';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'guide-btn guide-btn-close';
    closeBtn.textContent = t('guideClose');
    closeBtn.onclick = () => closeGuide();

    const nextBtn = document.createElement('button');
    nextBtn.className = 'guide-btn guide-btn-next';
    nextBtn.textContent = t('guideNext');
    nextBtn.onclick = () => nextImage();

    nav.appendChild(prevBtn);
    nav.appendChild(progress);
    nav.appendChild(closeBtn);
    nav.appendChild(nextBtn);

    viewer.appendChild(imageContainer);
    viewer.appendChild(nav);
    overlayElement.appendChild(viewer);
    document.body.appendChild(overlayElement);

    // 显示第一张图片
    updateImage();

    // 点击遮罩层关闭
    overlayElement.addEventListener('click', (e) => {
        if (e.target === overlayElement) {
            closeGuide();
        }
    });

    // 键盘导航
    const keyHandler = (e) => {
        if (e.key === 'ArrowLeft') {
            prevImage();
        } else if (e.key === 'ArrowRight') {
            nextImage();
        } else if (e.key === 'Escape') {
            closeGuide();
        }
    };
    document.addEventListener('keydown', keyHandler);
    overlayElement._keyHandler = keyHandler;
}

/**
 * 更新图片显示
 */
function updateImage() {
    if (!overlayElement) return;

    const images = guideImages[currentMode];
    const imageData = images[currentIndex];

    const imageElement = overlayElement.querySelector('.guide-image');
    const progressElement = overlayElement.querySelector('.guide-progress');
    const prevBtn = overlayElement.querySelector('.guide-btn-prev');
    const nextBtn = overlayElement.querySelector('.guide-btn-next');

    // 更新图片
    imageElement.innerHTML = '';
    const img = document.createElement('img');
    img.src = imageData.src;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '60vh';
    img.style.borderRadius = '12px';
    img.style.display = 'block';
    imageElement.appendChild(img);

    // 更新进度
    progressElement.textContent = `${currentIndex + 1} / ${images.length}`;

    // 更新按钮状态
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === images.length - 1;

    console.log(`[Guide] 显示第 ${currentIndex + 1}/${images.length} 张图片`);
}

/**
 * 下一张图片
 */
function nextImage() {
    const images = guideImages[currentMode];
    if (currentIndex < images.length - 1) {
        currentIndex++;
        updateImage();
    }
}

/**
 * 上一张图片
 */
function prevImage() {
    if (currentIndex > 0) {
        currentIndex--;
        updateImage();
    }
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
