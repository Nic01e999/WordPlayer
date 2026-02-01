/**
 * 复读模式 - UI 渲染
 */

import { currentRepeaterState, preloadCache } from '../state.js';
import { $, showView, escapeHtml, getTargetLang } from '../utils.js';
import { currentSliderPosition, setCurrentSliderPosition } from './state.js';
import { t } from '../i18n/index.js';

/**
 * 处理文本中的转义字符
 * @param {string} text - 原始文本
 * @returns {string} - 处理后的 HTML
 */
function escapeAndFormat(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')   // 先转义 HTML 特殊字符
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\\n/g, '<br>')  // 将 \n 转换为 <br>
        .replace(/\\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')  // 将 \t 转换为空格
        .replace(/\\\\/g, '\\');  // 将 \\ 转换为 \
}

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

    // 计算学习进度
    const totalWords = words.length;
    const currentWordNum = currentIndex + 1;
    const percentage = Math.round((currentWordNum / totalWords) * 100);

    info.innerHTML = `
        ${contentHTML}
        <div class="progress-info">
            <span class="word-progress">${t('wordProgress', { current: currentWordNum, total: totalWords, percentage })}</span>
            <span class="play-count">${t('playCount', { current: currentRepeat + 1, total: settings.repeat })}</span>
        </div>
    `;

    if (!isCustomWord && !isPhrase) {
        _setupSliderListeners?.();
        const sliderContent = document.getElementById('sliderContent');
        setupContentClickHandlers(sliderContent);
    }
}

/**
 * 获取当前语言模式的页面数量
 * @returns {number} 页面数量（中文3页，英文4页）
 */
function getPageCount() {
    const targetLang = getTargetLang();
    return targetLang === 'zh' ? 3 : 4;
}

export function renderSliderContent(wordInfo, translation) {
    const pageCount = getPageCount();
    const maxIndex = pageCount - 1;

    // 检查当前位置是否超出新的最大索引，如果超出则调整
    let position = currentSliderPosition;
    if (position > maxIndex) {
        position = maxIndex;
        setCurrentSliderPosition(maxIndex);
    }

    const labels = Array(pageCount).fill('');

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
                <div class="apple-slider-fill" style="width:${(position / maxIndex) * 100}%"></div>
                ${Array.from({ length: pageCount }, (_, i) => `
                    <div class="apple-slider-node" style="left:${(i / maxIndex) * 100}%"></div>
                `).join('')}
                <div class="apple-slider-thumb" style="left:${(position / maxIndex) * 100}%"></div>
            </div>
        </div>
    `;
}

export function renderViewContent(position, wordInfo, translation) {
    const word = currentRepeaterState?.words[currentRepeaterState.currentIndex] || '';
    const targetLang = getTargetLang();
    const isChinese = targetLang === 'zh';

    // 中文模式：[基础信息, 详细释义, 难度等级]（跳过词形变化）
    // 英文模式：[基础信息, 详细释义, 词形变化, 难度等级]
    if (isChinese) {
        switch (position) {
            case 0:
                return renderNativePosView(wordInfo, translation);
            case 1:
                return renderPosView(wordInfo);
            case 2:
                return renderDifficultyView(wordInfo);
            default:
                return '';
        }
    } else {
        switch (position) {
            case 0:
                return renderNativePosView(wordInfo, translation);
            case 1:
                return renderPosView(wordInfo);
            case 2:
                return renderWordFormsView(wordInfo);
            case 3:
                return renderDifficultyView(wordInfo);
            default:
                return '';
        }
    }
}

/**
 * Mode 0: 渲染音标 + 词性标签 + 母语翻译
 */
function renderNativePosView(wordInfo, fallbackTranslation) {
    const targetLang = getTargetLang();
    const isChinese = targetLang === 'zh';

    // 中文模式：显示拼音、繁体字、英文翻译
    if (isChinese) {
        const pinyin = wordInfo?.pinyin || '';
        const traditional = wordInfo?.traditional || '';
        const translation = wordInfo?.translation || fallbackTranslation || '...';
        const pos = wordInfo?.pos || '';

        return `
            <div class="view-phonetic-pos">
                ${pinyin ? `<div class="phonetic">${pinyin}</div>` : ''}
                ${traditional ? `<div class="traditional-text">繁体: ${traditional}</div>` : ''}
                ${pos ? `<div class="pos-tags"><span class="pos-tag">${pos}</span></div>` : ''}
                <div class="main-translation">${escapeAndFormat(translation)}</div>
            </div>
        `;
    }

    // 英文模式：显示音标、词性标签、中文翻译
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
            <div class="main-translation">${escapeAndFormat(translation)}</div>
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
            ${defs.map(def => {
                const meanings = Array.isArray(def.meanings)
                    ? def.meanings.slice(0, 2).map(m => escapeAndFormat(m)).join('; ')
                    : escapeAndFormat(def.meanings);
                return `
                    <div class="pos-item">
                        <span class="pos-tag">${def.pos}</span>
                        <span class="pos-meaning">${meanings}</span>
                    </div>
                `;
            }).join('')}
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

/**
 * 渲染词形变化页面（英文模式专用）
 */
function renderWordFormsView(wordInfo) {
    const wordForms = wordInfo?.wordForms || {};

    const forms = [
        { key: 'past', label: t('wordFormPast') },
        { key: 'pastParticiple', label: t('wordFormPastParticiple') },
        { key: 'doing', label: t('wordFormDoing') },
        { key: 'third', label: t('wordFormThird') },
        { key: 'comparative', label: t('wordFormComparative') },
        { key: 'superlative', label: t('wordFormSuperlative') },
        { key: 'plural', label: t('wordFormPlural') },
        { key: 'lemma', label: t('wordFormLemma') },
        { key: 'root', label: t('wordFormRoot') }
    ];

    return `
        <div class="view-word-forms">
            <div class="word-forms-grid">
                ${forms.map(form => {
                    const value = wordForms[form.key] || '-';
                    return `
                        <div class="word-form-item">
                            <span class="word-form-label">${form.label}:</span>
                            <span class="word-form-value">${escapeAndFormat(value)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * 渲染难度等级页面
 */
function renderDifficultyView(wordInfo) {
    const meta = wordInfo?.meta || {};
    const collins = meta.collins || 0;
    const oxford = meta.oxford || false;
    const frequency = meta.frequency || 0;

    // 如果没有任何难度信息
    if (!collins && !oxford && !frequency) {
        return `<div class="view-empty">${t('noDifficultyInfo')}</div>`;
    }

    return `
        <div class="view-difficulty">
            ${collins > 0 ? `
                <div class="difficulty-item">
                    <div class="difficulty-icon">⭐</div>
                    <div class="difficulty-content">
                        <div class="difficulty-label">${t('collinsStars')}</div>
                        <div class="difficulty-value">
                            ${'★'.repeat(collins)}${'☆'.repeat(5 - collins)} (${collins}/5)
                        </div>
                    </div>
                </div>
            ` : ''}
            ${oxford ? `
                <div class="difficulty-item">
                    <div class="difficulty-icon">🎓</div>
                    <div class="difficulty-content">
                        <div class="difficulty-label">${t('oxford3000')}</div>
                        <div class="difficulty-value">✓ ${t('coreVocabulary')}</div>
                    </div>
                </div>
            ` : ''}
            ${frequency > 0 ? `
                <div class="difficulty-item">
                    <div class="difficulty-icon">📊</div>
                    <div class="difficulty-content">
                        <div class="difficulty-label">${t('frequencyRank')}</div>
                        <div class="difficulty-value">#${frequency}</div>
                    </div>
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
