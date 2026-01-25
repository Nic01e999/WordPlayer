/**
 * 听写模式 - 弹窗拖拽
 */

// 拖拽监听器清理函数
let dragCleanupFns = [];

export function getDragCleanupFns() {
    return dragCleanupFns;
}

export function clearDragCleanupFns() {
    dragCleanupFns.forEach(fn => fn());
    dragCleanupFns = [];
}

export function initDrag(popup) {
    const handle = popup.querySelector('.popup-drag-handle');
    if (!handle) return;

    let isDragging = false;
    let startX, startY;
    let initialX, initialY;

    const rect = popup.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;

    popup.style.left = initialX + 'px';
    popup.style.top = initialY + 'px';
    popup.style.transform = 'rotate(-1deg)';

    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = popup.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        popup.classList.add('dragging');
        e.preventDefault();
    });

    const onMouseMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        popup.style.left = (initialX + deltaX) + 'px';
        popup.style.top = (initialY + deltaY) + 'px';
    };

    const onMouseUp = () => {
        if (isDragging) {
            isDragging = false;
            popup.classList.remove('dragging');
        }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    handle.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        const rect = popup.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        popup.classList.add('dragging');
    }, { passive: true });

    const onTouchMove = (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        popup.style.left = (initialX + deltaX) + 'px';
        popup.style.top = (initialY + deltaY) + 'px';
    };

    const onTouchEnd = () => {
        if (isDragging) {
            isDragging = false;
            popup.classList.remove('dragging');
        }
    };

    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);

    // 存储清理函数
    dragCleanupFns = [
        () => document.removeEventListener('mousemove', onMouseMove),
        () => document.removeEventListener('mouseup', onMouseUp),
        () => document.removeEventListener('touchmove', onTouchMove),
        () => document.removeEventListener('touchend', onTouchEnd)
    ];
}
