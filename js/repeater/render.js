/**
 * 复读模式 - UI 渲染
 */

import { currentRepeaterState, preloadCache } from '../state.js';
import { $, showView, escapeHtml } from '../utils.js';
import { currentSliderPosition } from './state.js';

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
        <div class="play-count">Play ${currentRepeat + 1}/${settings.repeat}</div>
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
            return renderChinesePosView(wordInfo, translation);
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

function renderChinesePosView(wordInfo, fallbackTranslation) {
    const chineseDefs = wordInfo?.chineseDefinitions || [];
    if (chineseDefs.length === 0) {
        return `<div class="view-translation">${fallbackTranslation ?? '...'}</div>`;
    }
    return `
        <div class="view-chinese-pos">
            ${chineseDefs.map(def => `
                <div class="pos-item">
                    <span class="pos-tag">${def.pos}</span>
                    <span class="pos-meaning">${def.meanings.join('')}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function highlightWord(sentence, word) {
    if (!sentence || !word) return sentence;
    const regex = new RegExp(`\\b(${word})\\b`, 'gi');
    return sentence.replace(regex, '<span class="word-highlight">$1</span>');
}

function renderPosView(wordInfo) {
    if (!wordInfo?.definitions?.length) {
        return '<div class="view-empty">No definitions available</div>';
    }
    return `
        <div class="view-pos">
            ${wordInfo.definitions.map(def => `
                <div class="pos-item">
                    <span class="pos-tag">${def.pos}</span>
                    <span class="pos-meaning">${def.meanings.slice(0, 2).join('; ')}</span>
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
            return '<div class="view-empty">No examples available</div>';
        }
        return `
            <div class="view-examples">
                ${oldExamples.slice(0, 2).map(ex => `<p class="example-sentence clickable-text" data-text="${escapeHtml(ex)}">${highlightWord(ex, word)}</p>`).join('')}
            </div>
        `;
    }

    if (commonExamples.length === 0 && funExamples.length === 0) {
        return '<div class="view-empty">No examples available</div>';
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
        return '<div class="view-empty">No synonyms/antonyms available</div>';
    }

    const renderClickableWords = (words) => words.map(w =>
        `<span class="clickable-word" data-word="${escapeHtml(w)}">${w}</span>`
    ).join(', ');

    return `
        <div class="view-synonyms">
            ${synonyms.length > 0 ? `
                <div class="syn-group">
                    <span class="syn-label">Syn:</span>
                    <span class="syn-words">${renderClickableWords(synonyms.slice(0, 5))}</span>
                </div>
            ` : ''}
            ${antonyms.length > 0 ? `
                <div class="ant-group">
                    <span class="ant-label">Ant:</span>
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
