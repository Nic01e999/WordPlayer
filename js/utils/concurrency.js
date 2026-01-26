/**
 * 并发控制工具
 * 限制同时执行的 Promise 数量
 */

/**
 * 创建一个并发池，限制同时执行的任务数量
 * @param {number} limit - 最大并发数
 * @returns {function} 执行函数
 */
export function createConcurrencyPool(limit) {
    let running = 0;
    const queue = [];

    async function run(fn) {
        while (running >= limit) {
            await new Promise(resolve => queue.push(resolve));
        }
        running++;
        try {
            return await fn();
        } finally {
            running--;
            const resolve = queue.shift();
            if (resolve) resolve();
        }
    }

    return run;
}

/**
 * 批量执行 Promise，限制并发数
 * @param {Array<Function>} tasks - 返回 Promise 的函数数组
 * @param {number} limit - 最大并发数（默认 6）
 * @returns {Promise<Array>} 所有结果
 */
export async function promiseAllWithLimit(tasks, limit = 6) {
    const pool = createConcurrencyPool(limit);
    return Promise.all(tasks.map(task => pool(task)));
}
