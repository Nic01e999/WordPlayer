/**
 * 英语听写/复读工具 - 应用入口
 */

import { currentActiveMode } from './state.js';
import { initPreloadListeners } from './preload.js';
import { Repeater, setDictationRef } from './repeater.js';
import { Dictation, setRepeaterRef } from './dictation.js';

// 设置循环引用
setDictationRef(Dictation);
setRepeaterRef(Repeater);

// 暴露到全局（供 HTML onclick 使用）
window.Repeater = Repeater;
window.Dictation = Dictation;

// 暴露当前模式到全局（供模块内部检测使用）
Object.defineProperty(window, 'currentActiveMode', {
    get: () => currentActiveMode
});

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", initPreloadListeners);
