/**
 * 全局状态管理模块
 */

/**
 * 复读模式的状态对象
 * 为 null 表示复读模式未启动
 */
export let currentRepeaterState = null;

/**
 * 当前激活的模式
 * "repeater" | "dictation" | null
 */
export let currentActiveMode = null;

/**
 * 预加载缓存对象
 * 用于后台预加载翻译和音频
 */
export const preloadCache = {
    entries: [],            // 已缓存的单词条目列表 { word, definition }
    translations: {},       // { word: translation } - 如果有 definition 则直接使用
    audioUrls: {},          // { text: Blob URL } (正常速度) - 支持单词和定义
    slowAudioUrls: {},      // { text: Blob URL } (慢速) - 支持单词和定义
    loading: false,         // 是否正在加载
    loadId: 0,              // 加载 ID，用于取消旧的加载
    loaded: 0,              // 已加载数量
    total: 0                // 总数量
};

/**
 * 设置复读模式状态
 */
export function setRepeaterState(state) {
    currentRepeaterState = state;
}

/**
 * 设置当前激活模式
 */
export function setActiveMode(mode) {
    currentActiveMode = mode;
}
