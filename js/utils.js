/**
 * 工具函数模块
 */

/**
 * 简化版的 document.getElementById
 */
export const $ = id => document.getElementById(id);

/**
 * 从设置面板读取用户配置
 */
export function getSettings() {
    return {
        repeat: parseInt($("repeat").value) || 1,
        retry: parseInt($("retry").value) || 1,
        interval: parseInt($("interval").value) || 300,
        slow: $("slow").checked,
        shuffle: $("shuffle").checked,
        dictateMode: $("dictateMode")?.checked ? "listenB_writeA" : "listenA_writeB"
    };
}

/**
 * 从文本框读取单词列表
 * 支持 a:b 格式，其中 a 是单词，b 是定义
 */
export function loadWordsFromTextarea() {
    return $("wordInput").value
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line)
        .map(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                return {
                    word: line.substring(0, colonIndex).trim(),
                    definition: line.substring(colonIndex + 1).trim() || null
                };
            }
            return { word: line, definition: null };
        });
}

/**
 * 从单词条目数组中提取单词列表
 */
export function getWordsFromEntries(entries) {
    return entries.map(e => e.word);
}

/**
 * 打乱数组顺序（Fisher-Yates 洗牌算法）
 */
export function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * 清空工作区
 */
export function clearWorkplace() {
    $("workplace").innerHTML = "";
}

/**
 * 向工作区追加 HTML 内容
 */
export function logToWorkplace(html) {
    $("workplace").insertAdjacentHTML("beforeend", html);
}

/**
 * 防抖函数
 */
export function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 测量文字实际宽度（使用 Canvas API）
 */
export function measureTextWidth(text, font) {
    const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    ctx.font = font;
    return ctx.measureText(text).width;
}

/**
 * 根据最长行自动调整侧边栏宽度
 */
export function adjustSidebarWidth() {
    const wordInput = $("wordInput");
    const sidebar = document.querySelector(".settings-trigger .sidebar");
    if (!wordInput || !sidebar) return;

    const style = getComputedStyle(wordInput);
    const font = `${style.fontSize} ${style.fontFamily}`;

    const lines = wordInput.value.split(/\n/).filter(l => l.trim());
    const maxTextWidth = lines.reduce((max, l) => Math.max(max, measureTextWidth(l, font)), 0);

    const baseWidth = 240;
    const extraSpace = 85;
    const neededWidth = maxTextWidth + extraSpace;

    sidebar.style.minWidth = Math.max(baseWidth, neededWidth) + "px";
}
