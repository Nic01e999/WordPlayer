/**
 * 复读模式 - 状态管理
 */

// 静态属性
export const ITEM_HEIGHT = 60;
export let scrollTimeout = null;
export let playId = 0;
export let currentSliderPosition = 0; // 0=翻译, 1=释义, 2=例句, 3=同反
export let keydownHandler = null;

// 监听器初始化标记（防止重复绑定）
export let sliderListenersInitialized = false;
export let scrollListenersInitialized = false;

// 状态更新函数
export function setScrollTimeout(val) { scrollTimeout = val; }
export function incrementPlayId() { return ++playId; }
export function getPlayId() { return playId; }
export function setCurrentSliderPosition(val) { currentSliderPosition = val; }
export function setKeydownHandler(val) { keydownHandler = val; }
export function setScrollListenersInitialized(val) { scrollListenersInitialized = val; }

// Dictation 引用（解决循环依赖）
let Dictation = null;

export function setDictationRef(ref) {
    Dictation = ref;
}

export function getDictation() {
    return Dictation;
}
