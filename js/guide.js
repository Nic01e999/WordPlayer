/**
 * 用户指引模块
 * 提供图片播放器功能，用于显示用户指引
 */

import { t } from './i18n/index.js';

// 指引图片配置（使用CSS渐变作为占位图片）
const guideImages = {
    home: [
        { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', title: '欢迎使用' },
        { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', title: '输入单词' },
        { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', title: '选择模式' },
        { gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', title: '开始学习' }
    ],
    dictation: [
        { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', title: '听写模式' },
        { gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', title: '听音频' },
        { gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', title: '输入答案' }
    ],
    repeater: [
        { gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', title: '复读模式' },
        { gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', title: '自动播放' },
        { gradient: 'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)', title: '循环复习' }
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

    // 如果已存在，先移除
    if (overlayElement) {
        closeGuide();
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
    image.style.width = '600px';
    image.style.height = '400px';
    image.style.borderRadius = '12px';
    image.style.display = 'flex';
    image.style.alignItems = 'center';
    image.style.justifyContent = 'center';
    image.style.fontSize = '32px';
    image.style.fontWeight = 'bold';
    image.style.color = 'white';
    image.style.textShadow = '0 2px 10px rgba(0,0,0,0.3)';

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
    imageElement.style.background = imageData.gradient;
    imageElement.textContent = imageData.title;

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
