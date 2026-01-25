/**
 * 甜甜圈颜色选择器模块
 * 编辑模式下点击卡片弹出，鼠标移出后关闭
 */

import { CARD_COLORS, getCurrentThemeColors } from './render.js';
import { setCardColor, getCardColor } from './storage.js';

let currentPicker = null;
let currentCardName = null;
let _renderWordListCards = null;

/**
 * 设置延迟绑定的函数
 */
export function setColorPickerDeps(deps) {
    _renderWordListCards = deps.renderWordListCards;
}

/**
 * hex 转 rgba
 */
function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 生成扇形 clip-path
 * @param {number} index - 扇形索引
 * @param {number} total - 总扇形数
 * @param {number} innerRadius - 内半径百分比
 * @param {number} outerRadius - 外半径百分比
 */
function generateSegmentPath(index, total, innerRadius = 35, outerRadius = 50) {
    const anglePerSegment = 360 / total;
    const startAngle = index * anglePerSegment - 90; // 从顶部开始
    const endAngle = startAngle + anglePerSegment;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // 外弧点
    const outerStart = {
        x: 50 + outerRadius * Math.cos(startRad),
        y: 50 + outerRadius * Math.sin(startRad)
    };
    const outerEnd = {
        x: 50 + outerRadius * Math.cos(endRad),
        y: 50 + outerRadius * Math.sin(endRad)
    };

    // 内弧点
    const innerStart = {
        x: 50 + innerRadius * Math.cos(startRad),
        y: 50 + innerRadius * Math.sin(startRad)
    };
    const innerEnd = {
        x: 50 + innerRadius * Math.cos(endRad),
        y: 50 + innerRadius * Math.sin(endRad)
    };

    // 使用 polygon 近似扇形
    const points = [];
    points.push(`${innerStart.x}% ${innerStart.y}%`);
    points.push(`${outerStart.x}% ${outerStart.y}%`);

    // 添加外弧中间点
    const midAngle = (startAngle + endAngle) / 2;
    const midRad = (midAngle * Math.PI) / 180;
    points.push(`${50 + outerRadius * Math.cos(midRad)}% ${50 + outerRadius * Math.sin(midRad)}%`);

    points.push(`${outerEnd.x}% ${outerEnd.y}%`);
    points.push(`${innerEnd.x}% ${innerEnd.y}%`);

    // 添加内弧中间点
    points.push(`${50 + innerRadius * Math.cos(midRad)}% ${50 + innerRadius * Math.sin(midRad)}%`);

    return `polygon(${points.join(', ')})`;
}

/**
 * 显示颜色选择器
 */
export function showColorPicker(cardElement) {
    hideColorPicker();

    const cardName = cardElement.dataset.name;
    if (!cardName) return;

    currentCardName = cardName;
    const currentColor = getCardColor(cardName);

    // 创建选择器容器
    const picker = document.createElement('div');
    picker.className = 'color-picker-donut';

    // 获取卡片位置
    const iconElement = cardElement.querySelector('.wordlist-icon');
    if (!iconElement) {
        console.warn('Color picker: icon element not found');
        return;
    }
    const rect = iconElement.getBoundingClientRect();

    // 计算选择器位置（居中于卡片图标）
    const pickerSize = 150;
    picker.style.width = `${pickerSize}px`;
    picker.style.height = `${pickerSize}px`;
    picker.style.left = `${rect.left + rect.width / 2 - pickerSize / 2}px`;
    picker.style.top = `${rect.top + rect.height / 2 - pickerSize / 2}px`;

    // 生成扇形选项
    const total = CARD_COLORS.length;
    CARD_COLORS.forEach((colorConfig, index) => {
        const segment = document.createElement('div');
        segment.className = 'color-picker-segment';
        segment.dataset.colorId = colorConfig.id;

        // 设置扇形裁剪路径
        segment.style.clipPath = generateSegmentPath(index, total);

        // 设置背景色
        if (colorConfig.colors) {
            segment.style.background = `linear-gradient(135deg, ${colorConfig.colors[0]} 0%, ${colorConfig.colors[1]} 100%)`;
        } else {
            // 原色 = 当前主题色
            const themeColors = getCurrentThemeColors();
            segment.style.background = `linear-gradient(135deg, ${themeColors[0]} 0%, ${themeColors[1]} 100%)`;
            // 添加原色标记类
            segment.classList.add('original');
        }

        // 当前选中的颜色添加标记
        if ((currentColor === colorConfig.id) || (!currentColor && colorConfig.id === 'original')) {
            segment.classList.add('selected');
        }

        // 点击选择颜色
        segment.addEventListener('click', (e) => {
            e.stopPropagation();
            selectColor(cardName, colorConfig.id, cardElement);
        });

        picker.appendChild(segment);
    });

    // 为原色添加独立的标记（不受 clip-path 影响）
    const originalMarker = document.createElement('div');
    originalMarker.className = 'color-picker-original-marker';
    // 计算原色扇形的中心位置（第一个扇形，索引为0）
    const anglePerSegment = 360 / total;
    const midAngle = (0 * anglePerSegment + anglePerSegment / 2 - 90) * Math.PI / 180;
    const markerRadius = 42.5; // (35 + 50) / 2 内外半径的中点
    originalMarker.style.left = `${50 + markerRadius * Math.cos(midAngle)}%`;
    originalMarker.style.top = `${50 + markerRadius * Math.sin(midAngle)}%`;
    picker.appendChild(originalMarker);

    // 中心圆（透明，显示卡片）
    const center = document.createElement('div');
    center.className = 'color-picker-center';
    picker.appendChild(center);

    // 鼠标离开时关闭
    picker.addEventListener('mouseleave', () => {
        hideColorPicker();
    });

    document.body.appendChild(picker);
    currentPicker = picker;

    // 添加显示动画
    requestAnimationFrame(() => {
        picker.classList.add('visible');
    });
}

/**
 * 隐藏颜色选择器
 */
export function hideColorPicker() {
    if (currentPicker) {
        currentPicker.classList.remove('visible');
        setTimeout(() => {
            if (currentPicker) {
                currentPicker.remove();
                currentPicker = null;
            }
        }, 150);
    }
    currentCardName = null;
}

/**
 * 选择颜色
 */
function selectColor(cardName, colorId, cardElement) {
    setCardColor(cardName, colorId);

    // 更新当前卡片的背景色
    updateCardColor(cardElement, cardName, colorId);

    // 隐藏选择器
    hideColorPicker();

    // 重新渲染以更新文件夹预览
    if (_renderWordListCards) {
        _renderWordListCards();
    }
}

/**
 * 更新卡片颜色（不重新渲染整个列表）
 */
function updateCardColor(cardElement, cardName, colorId) {
    const iconElement = cardElement.querySelector('.wordlist-icon');
    if (!iconElement) return;

    let colors;
    if (colorId === 'original' || !colorId) {
        // 原色 = 当前主题色
        colors = getCurrentThemeColors();
    } else {
        const colorConfig = CARD_COLORS.find(c => c.id === colorId);
        if (colorConfig && colorConfig.colors) {
            colors = colorConfig.colors;
        } else {
            // 找不到配置，回退到主题色
            colors = getCurrentThemeColors();
        }
    }

    const [color1, color2] = colors.map(c => hexToRgba(c, 0.75));
    iconElement.style.background = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
}

/**
 * 检查是否有打开的颜色选择器
 */
export function hasOpenColorPicker() {
    return currentPicker !== null;
}
