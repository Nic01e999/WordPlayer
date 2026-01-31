/**
 * 复读模式 - UI 渲染
 */

import { currentRepeaterState, preloadCache } from '../state.js';
import { $, showView, escapeHtml } from '../utils.js';
import { currentSliderPosition } from './state.js';
import { t } from '../i18n/index.js';

// 延迟绑定
let _setupScrollListener = null;
let _setupSliderListeners = null;

export function setRenderDeps(deps) {
    _setupScrollListener = deps.setupScrollListener;
    _setupSliderListeners = deps.setupSliderListeners;
}

export function renderUI() {
    showView('repeaterView');
    renderContent();
    _setupScrollListener?.();
}

export function renderContent() {
    const content = $("repeaterContent");
    const state = currentRepeaterState;
    if (!content || !state) return;

    content.innerHTML = state.words.map((word, i) => {
        return `
        <div id="word-${i}" class="word-item ${i === state.currentIndex ? 'active' : ''}">
            <strong>${i + 1}. ${word}</strong>
        </div>
    `;
    }).join('');

    updateInfo();
}

export function updateInfo() {
    const info = $("currentWordInfo");
    const state = currentRepeaterState;
    if (!info || !state) return;

    const { words, currentIndex, currentRepeat, settings, entries } = state;
    const word = words[currentIndex];
    const entry = entries[currentIndex];
    const isCustomWord = entry.definition !== null;
    const isPhrase = word.includes(' ');
    const wordInfo = preloadCache.wordInfo[word];
    const simpleTranslation = preloadCache.translations[word] ?? state.translations[currentIndex];

    let contentHTML;

    if (isCustomWord || isPhrase) {
        contentHTML = `<div class="current-translation">${simpleTranslation ?? '...'}</div>`;
    } else {
        contentHTML = renderSliderContent(wordInfo, simpleTranslation);
    }

    info.innerHTML = `
        ${contentHTML}
        <div class="play-count">${t('playCount', { current: currentRepeat + 1, total: settings.repeat })}</div>
    `;

    if (!isCustomWord && !isPhrase) {
        _setupSliderListeners?.();
        const sliderContent = document.getElementById('sliderContent');
        setupContentClickHandlers(sliderContent);
    }
}

export function renderSliderContent(wordInfo, translation) {
    const position = currentSliderPosition;
    const labels = ['', '', '', ''];

    return `
        <div class="slider-content" id="sliderContent">
            ${renderViewContent(position, wordInfo, translation)}
        </div>
        <div class="apple-slider" id="appleSlider" tabindex="0">
            <div class="apple-slider-labels">
                ${labels.map((l, i) => `
                    <span class="apple-slider-label ${i === position ? 'active' : ''}"
                          data-index="${i}">${l}</span>
                `).join('')}
            </div>
            <div class="apple-slider-track">
                <div class="apple-slider-fill" style="width:${(position / 3) * 100}%"></div>
                ${[0, 1, 2, 3].map(i => `
                    <div class="apple-slider-node" style="left:${(i / 3) * 100}%"></div>
                `).join('')}
                <div class="apple-slider-thumb" style="left:${(position / 3) * 100}%"></div>
            </div>
        </div>
    `;
}

export function renderViewContent(position, wordInfo, translation) {
    const word = currentRepeaterState?.words[currentRepeaterState.currentIndex] || '';
    switch (position) {
        case 0:
            return renderNativePosView(wordInfo, translation);
        case 1:
            return renderPosView(wordInfo);
        case 2:
            return renderExamplesView(wordInfo, word);
        case 3:
            return renderSynonymsView(wordInfo);
        default:
            return '';
    }
}

/**
 * Mode 0: 渲染音标 + 词性标签 + 母语翻译
 */
function renderNativePosView(wordInfo, fallbackTranslation) {
    const phonetic = wordInfo?.phonetic || '';
    const translation = wordInfo?.translation || fallbackTranslation || '...';
    // 兼容新旧字段: nativeDefinitions (新) / definitions (旧)
    let nativeDefs = wordInfo?.nativeDefinitions || [];
    // 确保 nativeDefs 是数组
    if (!Array.isArray(nativeDefs)) {
        nativeDefs = [];
    }

    // 提取所有词性标签
    const posTags = [...new Set(nativeDefs.map(d => d.pos).filter(Boolean))];

    return `
        <div class="view-phonetic-pos">
            ${phonetic ? `<div class="phonetic">${phonetic}</div>` : ''}
            ${posTags.length > 0 ? `<div class="pos-tags">${posTags.map(p => `<span class="pos-tag">${p}</span>`).join(' ')}</div>` : ''}
            <div class="main-translation">${translation}</div>
        </div>
    `;
}

/**
 * 高亮例句中的单词（支持Unicode/非英语）
 */
function highlightWord(sentence, word) {
    if (!sentence || !word) return sentence;
    // 转义正则特殊字符
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
        // Unicode-aware: \p{L}=字母, \p{N}=数字
        // 负向前瞻/后瞻确保单词边界
        const regex = new RegExp(
            `(?<![\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`,
            'giu'
        );
        return sentence.replace(regex, '<span class="word-highlight">$1</span>');
    } catch {
        // 旧浏览器回退：简单匹配
        const regex = new RegExp(`(${escaped})`, 'gi');
        return sentence.replace(regex, '<span class="word-highlight">$1</span>');
    }
}

/**
 * Mode 1: 渲染目标语言词性释义
 */
function renderPosView(wordInfo) {
    // 兼容新旧字段: targetDefinitions (新) / definitions (旧)
    const defs = wordInfo?.targetDefinitions || [];
    if (defs.length === 0) {
        return `<div class="view-empty">${t('noDefinitions')}</div>`;
    }
    return `
        <div class="view-pos">
            ${defs.map(def => `
                <div class="pos-item">
                    <span class="pos-tag">${def.pos}</span>
                    <span class="pos-meaning">${Array.isArray(def.meanings) ? def.meanings.slice(0, 2).join('; ') : def.meanings}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderExamplesView(wordInfo, word) {
    const examples = wordInfo?.examples || {};
    const commonExamples = examples.common || [];
    const funExamples = examples.fun || [];

    if (Array.isArray(wordInfo?.examples)) {
        const oldExamples = wordInfo.examples;
        if (oldExamples.length === 0) {
            return `<div class="view-empty">${t('noExamples')}</div>`;
        }
        return `
            <div class="view-examples">
                ${oldExamples.slice(0, 2).map(ex => `<p class="example-sentence clickable-text" data-text="${escapeHtml(ex)}">${highlightWord(ex, word)}</p>`).join('')}
            </div>
        `;
    }

    if (commonExamples.length === 0 && funExamples.length === 0) {
        return `<div class="view-empty">${t('noExamples')}</div>`;
    }

    return `
        <div class="examples-grid">
            <div class="example-column">
                <span class="example-label"></span>
                ${commonExamples.slice(0, 2).map(ex => `<p class="example-sentence clickable-text" data-text="${escapeHtml(ex)}">${highlightWord(ex, word)}</p>`).join('')}
            </div>
            <div class="example-column">
                <span class="example-label"></span>
                ${funExamples.slice(0, 2).map(ex => `<p class="example-sentence clickable-text" data-text="${escapeHtml(ex)}">${highlightWord(ex, word)}</p>`).join('')}
            </div>
        </div>
    `;
}

function renderSynonymsView(wordInfo) {
    const synonyms = wordInfo?.synonyms || [];
    const antonyms = wordInfo?.antonyms || [];

    if (synonyms.length === 0 && antonyms.length === 0) {
        return `<div class="view-empty">${t('noSynonyms')}</div>`;
    }

    const renderClickableWords = (words) => words.map(w =>
        `<span class="clickable-word" data-word="${escapeHtml(w)}">${w}</span>`
    ).join(', ');

    return `
        <div class="view-synonyms">
            ${synonyms.length > 0 ? `
                <div class="syn-group">
                    <span class="syn-label">${t('syn')}:</span>
                    <span class="syn-words">${renderClickableWords(synonyms.slice(0, 5))}</span>
                </div>
            ` : ''}
            ${antonyms.length > 0 ? `
                <div class="ant-group">
                    <span class="ant-label">${t('ant')}:</span>
                    <span class="ant-words">${renderClickableWords(antonyms.slice(0, 3))}</span>
                </div>
            ` : ''}
        </div>
    `;
}

export function setupContentClickHandlers(container) {
    if (!container) return;

    container.querySelectorAll('.clickable-text').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = el.dataset.text;
            if (text) {
                playTextWithFeedback(el, text);
            }
        });
    });

    container.querySelectorAll('.clickable-word').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const word = el.dataset.word;
            if (word) {
                playTextWithFeedback(el, word);
            }
        });
    });
}

async function playTextWithFeedback(element, text) {
    document.querySelectorAll('.playing').forEach(el => el.classList.remove('playing'));
    element.classList.add('playing');

    const { speakText } = await import('../audio.js');
    await speakText(text, false);

    element.classList.remove('playing');
}
