/**
 * 公开文件夹搜索模块
 * 提供搜索、添加公开文件夹的功能
 */

import { authToken } from './auth/state.js';
import { pullFromCloud } from './auth/index.js';
import { showToast } from './utils.js';
import { t } from './i18n/index.js';
import { getLayout, saveLayout } from './wordlist/layout.js';
import { renderWordListCards } from './wordlist/render.js';
import { setPublicFoldersCache } from './wordlist/storage.js';

let searchTimeout = null;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * 初始化搜索框
 */
export function initPublicSearch() {
  const overlay = document.getElementById('publicSearchOverlay');
  const closeBtn = document.getElementById('closePublicSearch');
  const searchInput = document.getElementById('publicSearchInput');

  if (!overlay || !closeBtn || !searchInput) {
    console.warn('[公开搜索] 搜索框元素未找到');
    return;
  }

  // 关闭按钮
  closeBtn.addEventListener('click', closePublicSearch);

  // 点击遮罩层关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closePublicSearch();
    }
  });

  // ESC 键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('show')) {
      closePublicSearch();
    }
  });

  // 搜索输入（防抖）
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    clearTimeout(searchTimeout);

    if (!query) {
      renderSearchResults([]);
      return;
    }

    // 显示加载状态
    const resultsContainer = document.getElementById('publicSearchResults');
    resultsContainer.innerHTML = `<div class="search-loading">${t('searching')}</div>`;

    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, SEARCH_DEBOUNCE_MS);
  });

  console.log('[公开搜索] 搜索框初始化完成');
}

/**
 * 打开搜索框
 */
export function openPublicSearch() {
  const overlay = document.getElementById('publicSearchOverlay');
  const searchInput = document.getElementById('publicSearchInput');

  if (!overlay || !searchInput) {
    console.error('[公开搜索] 搜索框元素未找到');
    return;
  }

  overlay.classList.add('show');
  searchInput.value = '';
  searchInput.focus();
  renderSearchResults([]);

  console.log('[公开搜索] 打开搜索框');
}

/**
 * 关闭搜索框
 */
export function closePublicSearch() {
  const overlay = document.getElementById('publicSearchOverlay');
  if (overlay) {
    overlay.classList.remove('show');
  }

  console.log('[公开搜索] 关闭搜索框');
}

/**
 * 执行搜索
 */
async function performSearch(query) {
  try {
    const token = authToken;
    if (!token) {
      showToast(t('pleaseLogin'), 'error');
      return;
    }

    const response = await fetch(`/api/public/folder/search?q=${encodeURIComponent(query)}&limit=20`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`搜索失败: ${response.status}`);
    }

    const data = await response.json();
    renderSearchResults(data.results || []);

    console.log(`[公开搜索] 搜索 "${query}" 返回 ${data.results?.length || 0} 个结果`);
  } catch (error) {
    console.error('[公开搜索] 搜索失败:', error);
    showToast(t('searchFailed') || '搜索失败', 'error');
    renderSearchResults([]);
  }
}

/**
 * 渲染搜索结果
 */
function renderSearchResults(results) {
  const resultsContainer = document.getElementById('publicSearchResults');

  if (!resultsContainer) {
    console.error('[公开搜索] 结果容器未找到');
    return;
  }

  if (results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <div class="no-results-text">${t('noResults')}</div>
        <div class="no-results-hint">${t('tryDifferentKeywords')}</div>
      </div>
    `;
    return;
  }

  resultsContainer.innerHTML = results.map(folder => `
    <div class="public-search-result-item" data-folder-id="${folder.id}">
      <div class="result-header">
        <h4>📁 ${escapeHtml(folder.folderName)}</h4>
        <span class="word-count">${folder.wordCount} ${t('words') || '词'}</span>
      </div>
      <div class="result-owner">
        👤 ${escapeHtml(folder.ownerEmail)}
      </div>
      ${folder.description ? `<div class="result-description">${escapeHtml(folder.description)}</div>` : ''}
    </div>
  `).join('');

  // 绑定点击事件
  resultsContainer.querySelectorAll('.public-search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const folderId = parseInt(item.dataset.folderId);
      const folderName = item.querySelector('h4').textContent.replace('📁 ', '');
      const ownerEmail = item.querySelector('.result-owner').textContent.replace('👤 ', '');
      handleAddPublicFolder(folderId, folderName, ownerEmail);
    });
  });
}

/**
 * 添加公开文件夹
 */
async function handleAddPublicFolder(folderId, folderName, ownerEmail) {
  try {
    const token = authToken;
    if (!token) {
      showToast(t('pleaseLogin'), 'error');
      return;
    }

    // 生成显示名称（只使用文件夹名称）
    let displayName = folderName;
    let attempt = 0;
    const maxAttempts = 10;
    let data = null;

    // 尝试添加，如果重名则自动添加序号
    while (attempt < maxAttempts) {
      const suffix = attempt === 0 ? '' : ` (${attempt})`;
      displayName = `${folderName}${suffix}`;

      const response = await fetch('/api/public/folder/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          folderId: folderId,
          displayName: displayName
        })
      });

      if (response.ok) {
        data = await response.json();
        break;
      } else {
        const error = await response.json();
        if (error.error && error.error.includes('已存在同名文件夹')) {
          attempt++;
          console.log(`[公开搜索] 文件夹重名，尝试新名称: ${displayName}`);
          console.log(`[Server] 文件夹重名，尝试新名称: ${displayName}`);
        } else {
          throw new Error(error.error || '添加失败');
        }
      }
    }

    if (attempt >= maxAttempts) {
      throw new Error('文件夹名称冲突次数过多，请手动重命名');
    }

    if (!data) {
      throw new Error('添加失败');
    }

    // 优先使用返回的 layout 更新本地存储
    if (data.layout) {
      saveLayout(data.layout);
      console.log('[公开搜索] 使用返回的 layout 更新本地存储');
    }

    // 调用 pullFromCloud() 更新 publicFolders 缓存
    console.log('[公开搜索] 调用 pullFromCloud() 更新公开文件夹缓存');
    console.log('[Server] 调用 pullFromCloud() 更新公开文件夹缓存');
    const syncResult = await pullFromCloud();
    if (syncResult.publicFolders) {
      setPublicFoldersCache(syncResult.publicFolders);  // 关键：更新缓存
      console.log('[公开搜索] 公开文件夹缓存已更新');
      console.log('[Server] 公开文件夹缓存已更新');
    } else if (syncResult.error) {
      console.warn('[公开搜索] 更新缓存失败:', syncResult.error);
      console.warn('[Server] 更新缓存失败:', syncResult.error);
    }

    // 重新渲染主页
    renderWordListCards();

    // 关闭搜索框
    closePublicSearch();

    // 显示成功提示
    showToast(t('publicFolderAdded') || '已添加公开文件夹', 'success');

    console.log(`[公开搜索] 添加公开文件夹成功: ${displayName}`);
  } catch (error) {
    console.error('[公开搜索] 添加失败:', error);
    showToast(error.message || t('addFailed') || '添加失败', 'error');
  }
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
