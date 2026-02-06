/**
 * 统一交互管理模块 - iOS SpringBoard 风格
 * 处理长按、点击、拖拽的检测和协调
 * 避免事件冲突，统一所有卡片和文件夹的交互逻辑
 */

const LONG_PRESS_DURATION = 300;  // 长按时长（毫秒）
const MOVE_THRESHOLD = 5;         // 移动阈值（像素）

/**
 * 统一的指针交互处理器
 * 自动区分长按、拖拽和点击行为
 *
 * @param {Element} element - 目标元素（卡片或文件夹）
 * @param {Object} callbacks - 回调函数
 *   - onLongPress: (element) => void  长按触发
 *   - onDrag: (element, startEvent) => void  拖拽触发
 *   - onClick: (element) => void  点击触发（可选）
 */
export function bindPointerInteraction(element, callbacks) {
    element.addEventListener('pointerdown', (e) => {
        // 忽略删除按钮的点击
        if (e.target.classList.contains('wordcard-delete')) return;

        // 只处理左键
        if (e.button !== 0) return;

        const startX = e.clientX;
        const startY = e.clientY;
        let longPressTriggered = false;
        let dragTriggered = false;

        // 长按计时器
        const longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            console.log(`[Interactions] 长按触发: ${element.dataset.type || 'unknown'}, 名称: ${element.dataset.name || element.dataset.folderName}`);

            if (callbacks.onLongPress) {
                callbacks.onLongPress(element);
            }
        }, LONG_PRESS_DURATION);

        const cleanup = () => {
            clearTimeout(longPressTimer);
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        };

        const onMove = (me) => {
            const dx = Math.abs(me.clientX - startX);
            const dy = Math.abs(me.clientY - startY);

            if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
                if (longPressTriggered && !dragTriggered) {
                    // 长按后移动 → 触发拖拽
                    dragTriggered = true;
                    console.log(`[Interactions] 拖拽开始: ${element.dataset.type || 'unknown'}, 名称: ${element.dataset.name || element.dataset.folderName}`);

                    if (callbacks.onDrag) {
                        callbacks.onDrag(element, me);
                    }
                    cleanup();
                } else if (!longPressTriggered) {
                    // 长按前移动 → 取消长按
                    cleanup();
                }
            }
        };

        const onUp = () => {
            cleanup();

            // 长按后松开 → 设置标记防止误触发点击
            if (longPressTriggered && !dragTriggered) {
                element.dataset.justInteracted = 'true';
                console.log(`[Interactions] 长按松开，设置防误触标记: ${element.dataset.folderName || element.dataset.name}`);

                setTimeout(() => {
                    delete element.dataset.justInteracted;
                }, 100);
            }

            // 未长按未拖拽 → 触发点击
            if (!longPressTriggered && !dragTriggered && callbacks.onClick) {
                console.log(`[Interactions] 点击触发: ${element.dataset.type || 'unknown'}, 名称: ${element.dataset.name || element.dataset.folderName}`);
                callbacks.onClick(element);
            }
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp, { once: true });
    });
}

/**
 * 检查元素是否刚刚交互过（防止长按后误触发点击）
 * @param {Element} element - 要检查的元素
 * @returns {boolean}
 */
export function isJustInteracted(element) {
    return element.dataset.justInteracted === 'true';
}
