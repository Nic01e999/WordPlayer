/**
 * 音效管理模块
 * 使用 Web Audio API 生成简单的音效
 */

let audioContext = null;
let isEnabled = true;

/**
 * 初始化 AudioContext（懒加载）
 */
function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

/**
 * 设置音效开关状态
 * @param {boolean} enabled - 是否启用音效
 */
export function setSoundEffectsEnabled(enabled) {
    isEnabled = enabled;
    console.log(`[SoundEffects] 音效已${enabled ? '启用' : '禁用'}`);
}

/**
 * 获取音效开关状态
 * @returns {boolean}
 */
export function isSoundEffectsEnabled() {
    return isEnabled;
}

/**
 * 播放正确答案音效
 * 使用愉悦的上升音调 (C5 -> E5 -> G5)
 */
export function playCorrectSound() {
    if (!isEnabled) return;

    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // 创建振荡器（生成音调）
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // 设置音色为正弦波（柔和的声音）
        oscillator.type = 'sine';

        // 三个音符：C5(523Hz) -> E5(659Hz) -> G5(784Hz)
        oscillator.frequency.setValueAtTime(523, now);
        oscillator.frequency.setValueAtTime(659, now + 0.08);
        oscillator.frequency.setValueAtTime(784, now + 0.16);

        // 音量渐变：快速淡入 -> 保持 -> 淡出
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02);
        gainNode.gain.setValueAtTime(0.15, now + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        // 播放音效
        oscillator.start(now);
        oscillator.stop(now + 0.35);

        console.log('[SoundEffects] 播放正确音效');
    } catch (error) {
        console.error('[SoundEffects] 播放正确音效失败:', error);
    }
}

/**
 * 播放错误答案音效
 * 使用低沉的下降音调 (E4 -> C4)
 */
export function playIncorrectSound() {
    if (!isEnabled) return;

    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // 创建振荡器
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // 设置音色为三角波（稍微严肃的声音）
        oscillator.type = 'triangle';

        // 两个音符：E4(330Hz) -> C4(262Hz)，下降音调表示错误
        oscillator.frequency.setValueAtTime(330, now);
        oscillator.frequency.linearRampToValueAtTime(262, now + 0.15);

        // 音量渐变
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.12, now + 0.02);
        gainNode.gain.setValueAtTime(0.12, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        // 播放音效
        oscillator.start(now);
        oscillator.stop(now + 0.25);

        console.log('[SoundEffects] 播放错误音效');
    } catch (error) {
        console.error('[SoundEffects] 播放错误音效失败:', error);
    }
}

/**
 * 释放 AudioContext 资源（可选，用于清理）
 */
export function cleanup() {
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}
