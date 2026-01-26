/**
 * 拖拽工具类
 * 统一处理鼠标和触摸事件的拖拽行为
 */

/**
 * 从事件中提取坐标（兼容鼠标和触摸事件）
 * @param {MouseEvent|TouchEvent} e - 事件对象
 * @returns {{x: number, y: number}} 坐标对象
 */
function getEventCoordinates(e) {
    if (e.touches && e.touches.length > 0) {
        return {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    }
    return {
        x: e.clientX,
        y: e.clientY
    };
}

/**
 * 创建拖拽处理器
 *
 * @param {HTMLElement} element - 要拖拽的元素
 * @param {Object} options - 配置选项
 * @param {Function} options.onDragStart - 拖拽开始回调 (startX, startY, event)
 * @param {Function} options.onDragMove - 拖拽移动回调 (deltaX, deltaY, currentX, currentY, event)
 * @param {Function} options.onDragEnd - 拖拽结束回调 (deltaX, deltaY, event)
 * @param {boolean} [options.preventDefault=true] - 是否阻止默认行为
 * @param {boolean} [options.stopPropagation=false] - 是否阻止事件冒泡
 * @returns {Object} 包含 destroy 方法的对象
 */
export function createDragHandler(element, options = {}) {
    const {
        onDragStart = null,
        onDragMove = null,
        onDragEnd = null,
        preventDefault = true,
        stopPropagation = false
    } = options;

    let isDragging = false;
    let startX = 0;
    let startY = 0;

    /**
     * 拖拽开始处理
     */
    const handleDragStart = (e) => {
        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();

        isDragging = true;
        const coords = getEventCoordinates(e);
        startX = coords.x;
        startY = coords.y;

        if (onDragStart) {
            onDragStart(startX, startY, e);
        }
    };

    /**
     * 拖拽移动处理
     */
    const handleDragMove = (e) => {
        if (!isDragging) return;

        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();

        const coords = getEventCoordinates(e);
        const deltaX = coords.x - startX;
        const deltaY = coords.y - startY;

        if (onDragMove) {
            onDragMove(deltaX, deltaY, coords.x, coords.y, e);
        }
    };

    /**
     * 拖拽结束处理
     */
    const handleDragEnd = (e) => {
        if (!isDragging) return;

        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();

        const coords = getEventCoordinates(e);
        const deltaX = coords.x - startX;
        const deltaY = coords.y - startY;

        isDragging = false;

        if (onDragEnd) {
            onDragEnd(deltaX, deltaY, e);
        }
    };

    // 绑定事件
    element.addEventListener('mousedown', handleDragStart);
    element.addEventListener('touchstart', handleDragStart, { passive: false });
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchend', handleDragEnd);

    // 返回销毁方法
    return {
        /**
         * 销毁拖拽处理器，移除所有事件监听
         */
        destroy() {
            element.removeEventListener('mousedown', handleDragStart);
            element.removeEventListener('touchstart', handleDragStart);
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('touchmove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
            document.removeEventListener('touchend', handleDragEnd);
        },

        /**
         * 检查是否正在拖拽
         */
        isDragging() {
            return isDragging;
        }
    };
}

/**
 * 创建元素位置拖拽处理器（用于移动元素位置）
 *
 * @param {HTMLElement} element - 要拖拽的元素
 * @param {HTMLElement} [handle] - 拖拽手柄元素（如果不指定则使用 element）
 * @param {Object} options - 配置选项
 * @param {Function} [options.onStart] - 拖拽开始回调
 * @param {Function} [options.onEnd] - 拖拽结束回调
 * @param {Object} [options.bounds] - 边界限制 {minX, maxX, minY, maxY}
 * @returns {Object} 包含 destroy 方法的对象
 */
export function createPositionDragger(element, handle = null, options = {}) {
    const dragHandle = handle || element;
    const { onStart, onEnd, bounds } = options;

    let initialLeft = 0;
    let initialTop = 0;

    const dragHandler = createDragHandler(dragHandle, {
        onDragStart: (startX, startY, e) => {
            // 记录初始位置
            const rect = element.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // 确保元素是绝对定位
            if (getComputedStyle(element).position !== 'absolute' &&
                getComputedStyle(element).position !== 'fixed') {
                element.style.position = 'absolute';
            }

            if (onStart) onStart(e);
        },

        onDragMove: (deltaX, deltaY) => {
            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

            // 应用边界限制
            if (bounds) {
                if (bounds.minX !== undefined) newLeft = Math.max(bounds.minX, newLeft);
                if (bounds.maxX !== undefined) newLeft = Math.min(bounds.maxX, newLeft);
                if (bounds.minY !== undefined) newTop = Math.max(bounds.minY, newTop);
                if (bounds.maxY !== undefined) newTop = Math.min(bounds.maxY, newTop);
            }

            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
        },

        onDragEnd: (deltaX, deltaY, e) => {
            if (onEnd) onEnd(deltaX, deltaY, e);
        }
    });

    return dragHandler;
}
