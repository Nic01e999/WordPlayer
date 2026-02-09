/**
 * 全局状态管理模块
 */

import { audioBlobManager, sentenceAudioBlobManager } from './storage/blobManager.js';

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
 * 用于后台预加载翻译和音频（仅内存缓存，不再持久化到 localStorage）
 */
/**
 * 正在加载中的音频追踪（防止重复请求）
 */
export const loadingAudio = new Set();

export const preloadCache = {
    entries: [],            // 已缓存的单词条目列表 { word, definition }
    translations: {},       // { word: translation } - 如果有 definition 则直接使用
    wordInfo: {},           // 词典 API 完整信息（中文本地数据库 + 英文有道 API）
    audioUrls: {},          // { `${text}:${accent}:${lang}`: Blob URL } (正常速度) - 支持双口音
    sentenceAudioUrls: {},  // { `${sentence}:${accent}:${lang}`: Blob URL } - 例句音频缓存
    loading: false,         // 是否正在加载
    loadId: 0,              // 加载 ID，用于取消旧的加载
    abortController: null,  // AbortController 用于取消 fetch 请求
    // 分开计数
    translationLoaded: 0,   // 翻译已加载数
    translationTotal: 0,    // 翻译总数
    audioLoaded: 0,         // 音频已加载数（单词数，每个单词1个音频）
    audioTotal: 0,          // 音频总数（单词数）
    audioPartial: {}        // { text: count } 追踪每个单词已加载的音频数
};

/**
 * 清理 Blob URL 缓存（释放内存）
 */
export function clearAudioCache() {
    // 使用 BlobManager 释放所有 Blob URL
    audioBlobManager.releaseAll();
    sentenceAudioBlobManager.releaseAll();

    // 清空缓存对象
    preloadCache.audioUrls = {};
    preloadCache.sentenceAudioUrls = {};
    preloadCache.audioLoaded = 0;
    preloadCache.audioPartial = {};
}

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

/**
 * 当前加载的单词卡信息
 * 用于追踪编辑状态和支持 Update 功能
 */
export let loadedWordcard = {
    name: null,
    originalContent: null,
    isPublic: false
};

/**
 * 设置当前加载的单词卡信息
 */
export function setLoadedWordcard(name, content, isPublic = false) {
    loadedWordcard.name = name;
    loadedWordcard.originalContent = content;
    loadedWordcard.isPublic = isPublic;
}

/**
 * 清除当前加载的单词卡信息
 */
export function clearLoadedWordcard() {
    loadedWordcard.name = null;
    loadedWordcard.originalContent = null;
    loadedWordcard.isPublic = false;
}
