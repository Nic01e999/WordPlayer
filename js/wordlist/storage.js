/**
 * 单词表存储模块
 * 使用 localStorage 保存和加载单词表
 */

import { $ } from '../utils.js';
import { preloadCache, loadCacheFromStorage } from '../state.js';
import { startPreload } from '../preload.js';

const STORAGE_KEY = 'wordlists';

/**
 * 获取所有保存的单词表
 */
export function getWordLists() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error('Failed to load word lists:', e);
        return {};
    }
}

/**
 * 保存单词表列表到 localStorage
 */
export function saveWordListsToStorage(lists) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
        return true;
    } catch (e) {
        console.error('Failed to save word lists:', e);
        return false;
    }
}

/**
 * 保存单词表（同时保存翻译数据）
 */
export function saveWordList(name) {
    const words = $("wordInput").value.trim();
    if (!words) return false;

    const translations = {};
    const wordInfo = {};

    preloadCache.entries.forEach(entry => {
        const word = entry.word;
        if (preloadCache.translations[word]) {
            translations[word] = preloadCache.translations[word];
        }
        if (preloadCache.wordInfo[word]) {
            wordInfo[word] = preloadCache.wordInfo[word];
        }
    });

    const lists = getWordLists();
    lists[name] = {
        name,
        created: lists[name]?.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        words,
        translations,
        wordInfo
    };

    return saveWordListsToStorage(lists);
}

/**
 * 删除单词表（仅从 wordlists 中删除，不处理 layout）
 */
export function removeWordListFromStorage(name) {
    const lists = getWordLists();
    delete lists[name];
    return saveWordListsToStorage(lists);
}

/**
 * 批量删除多个单词表
 */
export function removeWordListsFromStorage(names) {
    const lists = getWordLists();
    names.forEach(name => delete lists[name]);
    return saveWordListsToStorage(lists);
}

/**
 * 加载单词表到 textarea（恢复翻译数据）
 */
export function loadWordList(name) {
    const lists = getWordLists();
    const list = lists[name];
    if (!list) return false;

    preloadCache.loadId++;
    preloadCache.translations = {};
    preloadCache.wordInfo = {};
    preloadCache.entries = [];

    loadCacheFromStorage();

    if (list.translations) {
        Object.assign(preloadCache.translations, list.translations);
    }
    if (list.wordInfo) {
        Object.assign(preloadCache.wordInfo, list.wordInfo);
    }
    $("wordInput").value = list.words;
    startPreload();
    return true;
}
