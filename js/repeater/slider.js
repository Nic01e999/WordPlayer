/**
 * 复读模式 - Apple 风格滑块
 */

import { currentRepeaterState, preloadCache } from '../state.js';
import { escapeHtml, getTargetLang } from '../utils.js';
import { currentSliderPosition, setCurrentSliderPosition } from './state.js';

/**
 * 获取当前语言模式的最大索引
 * @returns {number} 最大索引（中文2，英文2）
 */
function getMaxIndex() {
    const targetLang = getTargetLang();
    return 2;  // 中文和英文都是3页（索引0,1,2）
}

// 延迟绑定
let _pauseIfPlaying = null;
let _renderViewContent = null;
let _setupContentClickHandlers = null;
let _onViewChanged = null;

export function setSliderDeps(deps) {
    _pauseIfPlaying = deps.pauseIfPlaying;
    _renderViewContent = deps.renderViewContent;
    _setupContentClickHandlers = deps.setupContentClickHandlers;
    _onViewChanged = deps.onViewChanged;
}

export function sliderLeft() {
    if (currentSliderPosition > 0) {
        const newPos = currentSliderPosition - 1;
        updateSliderUI(newPos);
        animateContentSwitch(newPos);
    }
}

export function sliderRight() {
    const maxIndex = getMaxIndex();
    if (currentSliderPosition < maxIndex) {
        const newPos = currentSliderPosition + 1;
        updateSliderUI(newPos);
        animateContentSwitch(newPos);
    }
}

export function updateSliderUI(position) {
    const slider = document.getElementById('appleSlider');
    if (!slider) return;

    const maxIndex = getMaxIndex();
    const thumb = slider.querySelector('.apple-slider-thumb');
    const fill = slider.querySelector('.apple-slider-fill');
    const labels = slider.querySelectorAll('.apple-slider-label');

    if (thumb) thumb.style.left = `${(position / maxIndex) * 100}%`;
    if (fill) fill.style.width = `${(position / maxIndex) * 100}%`;
    labels?.forEach((l, i) => l.classList.toggle('active', i === position));
}

export function setupSliderListeners() {
    const slider = document.getElementById('appleSlider');
    const track = slider?.querySelector('.apple-slider-track');
    const thumb = slider?.querySelector('.apple-slider-thumb');
    const fill = slider?.querySelector('.apple-slider-fill');
    const labels = slider?.querySelectorAll('.apple-slider-label');

    if (!slider || !track || !thumb) return;
    // 检查是否已绑定
    if (slider.dataset.listenersInitialized) return;
    slider.dataset.listenersInitialized = 'true';

    const maxIndex = getMaxIndex();
    let isDragging = false;
    let dragStartX = 0;

    const getPositionFromX = (clientX) => {
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return ratio;
    };

    const getNearestNode = (ratio) => {
        return Math.round(ratio * maxIndex);
    };

    const updateThumbPosition = (ratio) => {
        const percent = ratio * 100;
        thumb.style.left = `${percent}%`;
        fill.style.width = `${percent}%`;
    };

    const snapToNode = (nodeIndex) => {
        thumb.classList.remove('dragging');
        fill.classList.remove('no-transition');
        const percent = (nodeIndex / maxIndex) * 100;
        thumb.style.left = `${percent}%`;
        fill.style.width = `${percent}%`;

        if (nodeIndex === currentSliderPosition) return;

        labels.forEach((l, i) => l.classList.toggle('active', i === nodeIndex));
        animateContentSwitch(nodeIndex);
    };

    const onDragMove = (e) => {
        if (!isDragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const ratio = getPositionFromX(clientX);
        updateThumbPosition(ratio);
    };

    const onDragEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        thumb.style.transition = '';
        thumb.classList.remove('dragging');
        fill.classList.remove('no-transition');
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchend', onDragEnd);
        const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const movedDistance = Math.abs(clientX - dragStartX);
        if (movedDistance >= 5) {
            _pauseIfPlaying?.();
            const ratio = getPositionFromX(clientX);
            const node = getNearestNode(ratio);
            snapToNode(node);
        }
    };

    const onDragStart = (e) => {
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        dragStartX = clientX;
        isDragging = true;
        thumb.classList.add('dragging');
        fill.classList.add('no-transition');
        thumb.style.transition = 'box-shadow 0.2s, transform 0.1s';
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('touchmove', onDragMove, { passive: true });
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchend', onDragEnd);
    };

    thumb.addEventListener('mousedown', onDragStart);
    thumb.addEventListener('touchstart', onDragStart, { passive: false });

    track.addEventListener('click', (e) => {
        if (isDragging) return;
        const ratio = getPositionFromX(e.clientX);
        const node = getNearestNode(ratio);
        snapToNode(node);
    });

    labels.forEach(label => {
        label.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            snapToNode(index);
        });
    });

    slider.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = Math.min(maxIndex, currentSliderPosition + 1);
            snapToNode(next);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = Math.max(0, currentSliderPosition - 1);
            snapToNode(prev);
        }
    });

    // 内容区域左右滑动手势
    const content = document.getElementById('sliderContent');
    if (content && !content.dataset.swipeInitialized) {
        content.dataset.swipeInitialized = 'true';
        let touchStartX = 0;
        let touchStartY = 0;

        content.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        content.addEventListener('touchend', (e) => {
            const deltaX = e.changedTouches[0].clientX - touchStartX;
            const deltaY = e.changedTouches[0].clientY - touchStartY;

            // 水平滑动距离大于50px且大于垂直距离
            if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
                _pauseIfPlaying?.();
                if (deltaX < 0) {
                    sliderRight(); // 左滑 → 下一个
                } else {
                    sliderLeft();  // 右滑 → 上一个
                }
            }
        }, { passive: true });
    }
}

export function animateContentSwitch(newPosition) {
    const content = document.getElementById('sliderContent');
    if (!content) return;

    content.classList.add('fading');

    setTimeout(() => {
        setCurrentSliderPosition(newPosition);
        const state = currentRepeaterState;
        if (!state) return;

        const word = state.words[state.currentIndex];
        const wordInfo = preloadCache.wordInfo[word];
        const translation = preloadCache.translations[word] ?? state.translations[state.currentIndex];

        content.innerHTML = _renderViewContent?.(newPosition, wordInfo, translation) || '';
        _setupContentClickHandlers?.(content);
        content.classList.remove('fading');

        // 触发视图切换回调
        _onViewChanged?.(newPosition, wordInfo);
    }, 150);
}
