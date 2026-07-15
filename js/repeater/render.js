/**
 * 复读模式 - UI 渲染
 */

import { currentRepeaterState, preloadCache } from '../state.js';
import { $, showView, escapeHtml, getTargetLang, getAccent } from '../utils.js';
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
        .replace(/\n/g, '<br>')   // 先处理实际换行符
        .replace(/\\n/g, '<br>')  // 再处理字面 \n
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

        // 修复例句加载bug：如果当前在例句页，切换单词后立即加载例句
        const targetLang = getTargetLang();
        const examplePagePosition = 2; // 中文和英文都是第3页（position=2）

        if (currentSliderPosition === examplePagePosition && word) {
            loadExamples(word, targetLang);
        }

        // 修复词根加载bug：如果当前在词根页，切换单词后立即加载词根
        const lemmaPagePosition = 1; // 英文模式第2页（position=1）

        if (currentSliderPosition === lemmaPagePosition && wordInfo?.lemma && wordInfo.lemma !== '-') {
            loadLemmaWords(wordInfo.lemma);
        }
    }
}

/**
 * 获取当前语言模式的页面数量
 * @returns {number} 页面数量（中文3页，英文3页）
 */
function getPageCount() {
    const targetLang = getTargetLang();
    return 3;  // 中文和英文都是3页
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

    // 中文模式：[基础信息+CL+难度, 英文翻译, 例句]
    // 英文模式：[核心信息, 同词根词汇, 例句]
    if (isChinese) {
        switch (position) {
            case 0:
                return renderNativePosView(wordInfo, translation);  // 第1页：拼音+翻译+CL+难度
            case 1:
                return renderPosView(wordInfo);                     // 第2页：英文翻译
            case 2:
                return renderExamplesView(wordInfo, word);          // 第3页：例句
            default:
                return '';
        }
    } else {
        switch (position) {
            case 0:
                return renderCoreInfoView(wordInfo, translation);  // 第1页：音标+翻译+难度
            case 1:
                return renderWordFormsAndLemmaView(wordInfo);      // 第2页：同词根词汇
            case 2:
                return renderExamplesView(wordInfo, word);         // 第3页：例句
            default:
                return '';
        }
    }
}

/**
 * 解析中文翻译,分离主要翻译和CL信息
 */
function parseChineseTranslation(translation) {
    if (!translation) return { mainTranslation: '', clInfo: null };

    // 分离主要翻译和CL部分
    const clMatch = translation.match(/;\s*CL:(.+)$/);
    let mainTranslation = translation;
    let clInfo = null;

    if (clMatch) {
        mainTranslation = translation.substring(0, clMatch.index).trim();
        const clRaw = clMatch[1];

        // 处理 張|张[zhang1],包[bao1] 格式
        const clItems = clRaw.split(',').map(item => {
            item = item.trim();
            const match = item.match(/([^[|]+)\|?([^[]*)\[([^\]]+)\]/);
            if (match) {
                const simplified = match[2] || match[1]; // 取简体
                const pinyin = match[3]
                return `${simplified}（${pinyin}）`;
            }
            return item;
        });
        clInfo = 'CL: ' + clItems.join('  ');
    }

    return { mainTranslation, clInfo };
}

/**
 * Mode 0: 渲染音标 + 词性标签 + 母语翻译
 */
function renderNativePosView(wordInfo, fallbackTranslation) {
    const targetLang = getTargetLang();
    const isChinese = targetLang === 'zh';

    // 中文模式：显示拼音、汉字本身、CL信息、难度
    if (isChinese) {
        console.log('[renderNativePosView] 中文模式 - wordInfo:', wordInfo);
        const pinyin = wordInfo?.pinyin || '';
        console.log('[renderNativePosView] pinyin:', pinyin, 'type:', typeof pinyin);
        const translation = wordInfo?.translation || '';

        // 获取当前汉字（不是英文翻译！）
        const word = currentRepeaterState?.words[currentRepeaterState.currentIndex] || '';
        console.log('[renderNativePosView] 当前汉字:', word);

        // 解析CL信息（不需要mainTranslation）
        const { clInfo } = parseChineseTranslation(translation);

        // 获取难度信息
        const meta = wordInfo?.meta || {};
        const frequency = meta.frequency || 0;

        // 生成难度徽章
        let difficultyBadge = '';
        if (frequency > 0) {
            difficultyBadge = `<div class="difficulty-badge">词频: ${frequency}</div>`;
        }

        return `
            <div class="view-phonetic-pos">
                ${pinyin ? `<div class="phonetic">${pinyin}</div>` : ''}
                <div class="chinese-word">${escapeHtml(word)}</div>
                ${clInfo ? `<div class="cl-info">${clInfo}</div>` : ''}
                ${difficultyBadge}
            </div>
        `;
    }

    // 英文模式：显示音标、词性标签、中文翻译
    // 处理音标显示：根据口音选择显示美式或英式音标
    let phoneticDisplay = '';
    if (wordInfo?.phonetic) {
        if (typeof wordInfo.phonetic === 'object') {
            // 对象格式：{us: "...", uk: "..."}
            const accent = getAccent(); // 获取当前选择的口音
            phoneticDisplay = wordInfo.phonetic[accent] || wordInfo.phonetic.us || wordInfo.phonetic.uk || '';
        } else {
            // 字符串格式（向后兼容）
            phoneticDisplay = wordInfo.phonetic;
        }
    }

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
            ${phoneticDisplay ? `<div class="phonetic">${phoneticDisplay}</div>` : ''}
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
 * Mode 1: 渲染目标语言词性释义（中文模式显示英文翻译）
 */
function renderPosView(wordInfo) {
    const targetLang = getTargetLang();
    const isChinese = targetLang === 'zh';

    if (isChinese) {
        // 中文模式：显示英文翻译
        const translation = wordInfo?.translation || '';

        // 移除CL部分
        const cleanTranslation = translation.replace(/;\s*CL:.+$/, '').trim();

        // 按分号分割并换行
        const translations = cleanTranslation.split(';').map(t => t.trim()).filter(t => t);

        if (translations.length === 0) {
            return '<div class="view-pos"><div class="no-data">无英文翻译</div></div>';
        }

        return `
            <div class="view-pos">
                <div class="english-translations">
                    ${translations.map(t => `<div class="translation-line">${escapeHtml(t)}</div>`).join('')}
                </div>
            </div>
        `;
    }

    // 英文模式：显示目标语言词性释义
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
    // 直接在view层渲染，不需要额外的examples-container
    return `
        <div class="view-examples" data-word="${escapeAndFormat(word)}">
            <div class="loading">加载中...</div>
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

/**
 * 第1页：核心信息（音标 + 翻译 + 难度等级）
 */
function renderCoreInfoView(wordInfo, fallbackTranslation) {
    // 处理音标显示
    let phoneticText = '';
    if (wordInfo?.phonetic) {
        if (typeof wordInfo.phonetic === 'object') {
            const accent = getAccent();
            phoneticText = wordInfo.phonetic[accent] || wordInfo.phonetic.us || wordInfo.phonetic.uk || wordInfo.phonetic.ipa || '';
        } else {
            phoneticText = wordInfo.phonetic;
        }
    }

    const translation = wordInfo?.translation || fallbackTranslation || '...';

    // 难度信息
    const meta = wordInfo?.meta || {};
    const collins = meta.collins || 0;
    const oxford = meta.oxford || false;
    const frequency = meta.frequency || 0;

    return `
        <div class="view-core-info">
            ${phoneticText ? `<div class="phonetic-large">[${escapeAndFormat(phoneticText)}]</div>` : ''}
            <div class="translation-main">${escapeAndFormat(translation)}</div>
            <div class="difficulty-badges">
                ${collins > 0 ? `<span class="badge collins">柯林斯 ${'★'.repeat(collins)}</span>` : ''}
                ${oxford ? `<span class="badge oxford">牛津3000</span>` : ''}
                ${frequency > 0 ? `<span class="badge frequency">词频: ${frequency}</span>` : ''}
            </div>
        </div>
    `;
}

/**
 * 第2页：同词根词汇（删除词形变化，删除标题，使用Flex布局）
 */
function renderWordFormsAndLemmaView(wordInfo) {
    const lemma = wordInfo?.lemma || '';

    if (!lemma || lemma === '-') {
        return '<div class="view-word-forms-lemma"><div class="no-data">无词根信息</div></div>';
    }

    // 直接在view层使用Flex，不需要额外的lemma-words-container
    return `
        <div class="view-word-forms-lemma" data-lemma="${escapeAndFormat(lemma)}">
            <div class="loading">加载中...</div>
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

/**
 * 异步加载同词根词汇（修改为Flex布局，优先从缓存读取）
 */
async function loadLemmaWords(lemma) {
    const container = document.querySelector(`[data-lemma="${lemma}"]`);
    if (!container) return;

    // ✅ 优先从缓存读取
    if (preloadCache.lemmaWords[lemma]) {
        console.log(`[Load Lemma] ✓ 从缓存加载: ${lemma}`);
        console.log(`[Server] ✓ 从缓存加载词根: ${lemma}`);

        const words = preloadCache.lemmaWords[lemma];
        if (words.length > 0) {
            // 获取当前单词，用于排除自身
            const currentWord = currentRepeaterState?.words[currentRepeaterState.currentIndex] || '';
            const filteredWords = words.filter(w => w.word !== currentWord);

            if (filteredWords.length > 0) {
                container.innerHTML = filteredWords.map(w => `
                    <div class="lemma-word-item">
                        <div class="lemma-word">${escapeAndFormat(w.word)}</div>
                        <div class="lemma-translation">${escapeAndFormat(w.translation || '')}</div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<div class="no-data">' + t('noLemmaWords') + '</div>';
            }
        } else {
            container.innerHTML = '<div class="no-data">' + t('noLemmaWords') + '</div>';
        }
        return;
    }

    // ⚠️ 缓存未命中，回退到懒加载
    console.log(`[Load Lemma] ⚠ 缓存未命中，懒加载: ${lemma}`);
    console.log(`[Server] ⚠ 缓存未命中，懒加载词根: ${lemma}`);

    try {
        // 获取当前单词，用于排除自身
        const currentWord = currentRepeaterState?.words[currentRepeaterState.currentIndex] || '';
        const response = await fetch(
            `/api/dict/lemma/${encodeURIComponent(lemma)}?limit=30&exclude_word=${encodeURIComponent(currentWord)}`
        );
        const data = await response.json();

        if (data.words && data.words.length > 0) {
            // 更新缓存
            preloadCache.lemmaWords[lemma] = data.words;

            container.innerHTML = data.words.map(w => `
                <div class="lemma-word-item">
                    <div class="lemma-word">${escapeAndFormat(w.word)}</div>
                    <div class="lemma-translation">${escapeAndFormat(w.translation || '')}</div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="no-data">' + t('noLemmaWords') + '</div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="error">' + t('loadFailed') + '</div>';
        console.error('加载同词根词汇失败:', err);
    }
}

/**
 * 异步加载例句（限制2句，优先从缓存读取）
 */
async function loadExamples(word, lang) {
    // 直接查找view层
    const container = document.querySelector(`.view-examples[data-word="${word}"]`);
    if (!container) return;

    // ✅ 优先从缓存读取
    if (preloadCache.examples[word]) {
        console.log(`[Load Examples] ✓ 从缓存加载: ${word}`);
        console.log(`[Server] ✓ 从缓存加载例句: ${word}`);

        const examples = preloadCache.examples[word];
        if (examples.length > 0) {
            container.innerHTML = examples.map(ex => `
                <div class="example-item">
                    <div class="example-en clickable-text" data-text="${escapeAndFormat(ex.en)}">
                        ${highlightWord(escapeAndFormat(ex.en), word)}
                    </div>
                    <div class="example-zh">${escapeAndFormat(ex.zh)}</div>
                </div>
            `).join('');
            // 重新绑定点击事件
            setupContentClickHandlers(container);
        } else {
            container.innerHTML = '<div class="no-data">暂无例句</div>';
        }
        return;
    }

    // ⚠️ 缓存未命中，回退到懒加载
    console.log(`[Load Examples] ⚠ 缓存未命中，懒加载: ${word}`);
    console.log(`[Server] ⚠ 缓存未命中，懒加载例句: ${word}`);

    try {
        const response = await fetch(`/api/dict/examples/${encodeURIComponent(word)}?lang=${lang}&limit=2`);
        const data = await response.json();

        if (data.examples && data.examples.length > 0) {
            // 更新缓存
            preloadCache.examples[word] = data.examples;

            // 直接渲染到view层，不需要额外的examples-list容器
            container.innerHTML = data.examples.map(ex => `
                <div class="example-item">
                    <div class="example-en clickable-text" data-text="${escapeAndFormat(ex.en)}">
                        ${highlightWord(escapeAndFormat(ex.en), word)}
                    </div>
                    <div class="example-zh">${escapeAndFormat(ex.zh)}</div>
                </div>
            `).join('');
            // 重新绑定点击事件
            setupContentClickHandlers(container);
        } else {
            container.innerHTML = '<div class="no-data">暂无例句</div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="error">' + t('loadFailed') + '</div>';
        console.error('加载例句失败:', err);
    }
}

/**
 * 视图切换后的回调（由 slider.js 调用）
 */
export function onViewChanged(position, wordInfo) {
    const targetLang = getTargetLang();
    const isChinese = targetLang === 'zh';
    const word = currentRepeaterState?.words[currentRepeaterState.currentIndex] || '';

    if (isChinese) {
        // 中文模式：第3页加载例句
        if (position === 2 && word) {
            loadExamples(word, targetLang);
        }
    } else {
        // 英文模式
        switch (position) {
            case 1:  // 第2页：同词根词汇
                const lemma = wordInfo?.lemma || '';
                if (lemma && lemma !== '-') {
                    loadLemmaWords(lemma);
                }
                break;
            case 2:  // 第3页：例句
                if (word) {
                    loadExamples(word, targetLang);
                }
                break;
        }
    }
}
