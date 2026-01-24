/**
 * 单词表存储模块
 * 使用 localStorage 保存和加载单词表
 */

import { $, clearWorkplace } from './utils.js';
import { setActiveMode, setRepeaterState, preloadCache } from './state.js';
import { startPreload, updatePreloadProgress } from './preload.js';
import { stopAudio } from './audio.js';

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
 * 保存单词表（同时保存翻译数据）
 */
export function saveWordList(name) {
    const words = $("wordInput").value.trim();
    if (!words) return false;

    // 收集当前已加载的翻译和词典数据
    const translations = {};
    const dictionaries = {};

    preloadCache.entries.forEach(entry => {
        const word = entry.word;
        if (preloadCache.translations[word]) {
            translations[word] = preloadCache.translations[word];
        }
        if (preloadCache.dictionaries[word]) {
            dictionaries[word] = preloadCache.dictionaries[word];
        }
    });

    const lists = getWordLists();
    lists[name] = {
        name,
        created: lists[name]?.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        words,
        translations,
        dictionaries
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
        return true;
    } catch (e) {
        console.error('Failed to save word list:', e);
        return false;
    }
}

/**
 * 删除单词表
 */
export function deleteWordList(name) {
    const lists = getWordLists();
    delete lists[name];

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
        return true;
    } catch (e) {
        console.error('Failed to delete word list:', e);
        return false;
    }
}

/**
 * 加载单词表到 textarea（恢复翻译数据）
 */
export function loadWordList(name) {
    const lists = getWordLists();
    const list = lists[name];
    if (!list) return false;

    // 取消正在进行的预加载
    preloadCache.loadId++;

    // 清空当前缓存
    preloadCache.translations = {};
    preloadCache.dictionaries = {};
    preloadCache.audioUrls = {};
    preloadCache.slowAudioUrls = {};
    preloadCache.entries = [];

    // 恢复保存的翻译数据
    if (list.translations) {
        Object.assign(preloadCache.translations, list.translations);
    }
    if (list.dictionaries) {
        Object.assign(preloadCache.dictionaries, list.dictionaries);
    }

    // 设置 textarea
    $("wordInput").value = list.words;

    // 启动预加载（会跳过已缓存的翻译，只下载音频）
    startPreload();
    return true;
}

/**
 * 统计单词数量
 */
function countWords(words) {
    return words.split(/\r?\n/).filter(line => line.trim()).length;
}

/**
 * 格式化日期
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric'
    });
}

/**
 * 渲染主页单词表卡片
 */
export function renderWordListCards() {
    const workplace = $("workplace");
    if (!workplace) return;

    // 只在没有激活模式时渲染
    if (window.currentActiveMode) return;

    const lists = getWordLists();
    const entries = Object.values(lists).sort((a, b) =>
        new Date(b.updated || b.created) - new Date(a.updated || a.created)
    );

    if (entries.length === 0) {
        workplace.innerHTML = `
            <div class="wordlist-empty">
                <p>No saved word lists</p>
                <p class="hint">Enter words in the sidebar and click Save</p>
            </div>
        `;
        return;
    }

    workplace.innerHTML = `
        <div class="wordlist-grid">
            ${entries.map(list => `
                <div class="wordlist-card" data-name="${escapeHtml(list.name)}">
                    <div class="wordlist-card-header">
                        <span class="wordlist-name">${escapeHtml(list.name)}</span>
                        <button class="wordlist-delete" data-name="${escapeHtml(list.name)}" title="Delete">×</button>
                    </div>
                    <div class="wordlist-info">
                        <span>${countWords(list.words)} words</span>
                        <span>${formatDate(list.updated || list.created)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // 绑定卡片点击事件
    workplace.querySelectorAll('.wordlist-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('wordlist-delete')) return;
            const name = card.dataset.name;
            loadWordList(name);
        });
    });

    // 绑定删除按钮事件
    workplace.querySelectorAll('.wordlist-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.name;
            if (confirm(`Delete "${name}"?`)) {
                deleteWordList(name);
                renderWordListCards();
            }
        });
    });
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 回到主页
 */
export function goHome() {
    // 停止音频
    stopAudio();

    // 终止预加载（真正取消 HTTP 请求）
    if (preloadCache.abortController) {
        preloadCache.abortController.abort();
        preloadCache.abortController = null;
    }
    preloadCache.loadId++;
    preloadCache.loading = false;
    updatePreloadProgress();

    // 关闭 Dictation 弹窗
    $("dictationPopup")?.remove();

    // 清除当前模式状态
    setActiveMode(null);
    setRepeaterState(null);
    document.body.classList.remove('dictation-mode', 'repeater-mode');

    // 清空并重新渲染卡片
    clearWorkplace();
    renderWordListCards();
}

/**
 * 初始化 UI 事件
 */
export function initWordListUI() {
    // 保存按钮
    const saveBtn = $("saveListBtn");
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const defaultName = `wordlist-${new Date().toISOString().slice(0, 10)}`;
            const name = prompt("Enter list name:", defaultName);
            if (!name || !name.trim()) return;

            if (saveWordList(name.trim())) {
                renderWordListCards();
            }
        });
    }

    // 页面加载时渲染卡片
    renderWordListCards();
}
