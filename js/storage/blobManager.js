/**
 * Blob URL 生命周期管理器
 * 限制内存中的 Blob URL 数量，自动清理最旧的
 */

class BlobManager {
    constructor(maxUrls = 200) {
        this.urls = new Map(); // key -> { url, createdAt }
        this.maxUrls = maxUrls;
    }

    /**
     * 创建 Blob URL 并缓存
     * @param {Blob} blob - Blob 对象
     * @param {string} key - 缓存键
     * @returns {string} Blob URL
     */
    create(blob, key) {
        // 如果已存在，先释放旧的
        if (this.urls.has(key)) {
            URL.revokeObjectURL(this.urls.get(key).url);
        }

        // 超出限制时清理最旧的
        if (this.urls.size >= this.maxUrls) {
            this.evictOldest();
        }

        const url = URL.createObjectURL(blob);
        this.urls.set(key, { url, createdAt: Date.now() });
        return url;
    }

    /**
     * 获取缓存的 Blob URL
     * @param {string} key - 缓存键
     * @returns {string|undefined} Blob URL
     */
    get(key) {
        return this.urls.get(key)?.url;
    }

    /**
     * 检查是否存在
     * @param {string} key - 缓存键
     * @returns {boolean}
     */
    has(key) {
        return this.urls.has(key);
    }

    /**
     * 释放单个 Blob URL
     * @param {string} key - 缓存键
     */
    release(key) {
        const entry = this.urls.get(key);
        if (entry) {
            URL.revokeObjectURL(entry.url);
            this.urls.delete(key);
        }
    }

    /**
     * 释放所有 Blob URL
     */
    releaseAll() {
        for (const [, entry] of this.urls) {
            URL.revokeObjectURL(entry.url);
        }
        this.urls.clear();
    }

    /**
     * 淘汰最旧的条目
     */
    evictOldest() {
        let oldest = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.urls) {
            if (entry.createdAt < oldestTime) {
                oldestTime = entry.createdAt;
                oldest = key;
            }
        }

        if (oldest) {
            this.release(oldest);
        }
    }

    /**
     * 获取当前缓存数量
     * @returns {number}
     */
    get size() {
        return this.urls.size;
    }
}

// 音频 Blob 管理器实例（最多 200 个）
export const audioBlobManager = new BlobManager(200);

// 慢速音频 Blob 管理器实例
export const slowAudioBlobManager = new BlobManager(200);

// 例句音频 Blob 管理器实例
export const sentenceAudioBlobManager = new BlobManager(100);
