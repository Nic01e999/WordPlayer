/**
 * 公开文件夹搜索模块
 * 提供搜索、添加公开文件夹的功能
 */

import { authToken } from './auth/state.js';
import { pullFromCloud } from './auth/index.js';
import { showToast } from './utils.js';
import { t } from './i18n/index.js';
import { getLayout, saveLayout } from './wordcard/layout.js';
import { renderWordcardCards } from './wordcard/render.js';
import { setPublicFoldersCache, getPublicFolders } from './wordcard/storage.js';

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

    // 步骤1：检查本地缓存是否已引用
    const publicFolders = getPublicFolders();
    const existingRef = publicFolders.find(ref => ref.folder_id === folderId);

    if (existingRef) {
      console.log('[公开搜索] 检测到已引用该文件夹（本地缓存）:', existingRef.display_name);
      console.log('[网页控制台] 检测到已引用该文件夹（本地缓存）:', existingRef.display_name);

      closePublicSearch();
      showToast(`你已经引用过这个文件夹了："${existingRef.display_name}"`, 'info', 3000);

      setTimeout(() => {
        openExistingPublicFolder(existingRef.display_name);
      }, 500);

      return;
    }

    // 步骤2：尝试添加（后端也会检查）
    const displayName = folderName;  // 不再添加序号

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
      const data = await response.json();

      if (data.layout) {
        saveLayout(data.layout);
        console.log('[公开搜索] 使用返回的 layout 更新本地存储');
      }

      console.log('[公开搜索] 调用 pullFromCloud() 更新公开文件夹缓存');
      console.log('[Server] 调用 pullFromCloud() 更新公开文件夹缓存');
      const syncResult = await pullFromCloud();
      if (syncResult.publicFolders) {
        setPublicFoldersCache(syncResult.publicFolders);
        console.log('[公开搜索] 公开文件夹缓存已更新');
        console.log('[Server] 公开文件夹缓存已更新');
      } else if (syncResult.error) {
        console.warn('[公开搜索] 更新缓存失败:', syncResult.error);
        console.warn('[Server] 更新缓存失败:', syncResult.error);
      }

      renderWordcardCards();
      closePublicSearch();
      showToast(t('publicFolderAdded') || '已添加公开文件夹', 'success');
      console.log(`[公开搜索] 添加公开文件夹成功: ${displayName}`);

      // 添加成功后，自动打开新添加的文件夹
      setTimeout(() => {
        openExistingPublicFolder(displayName);
      }, 500);

    } else {
      // 处理错误响应
      const error = await response.json();

      if (response.status === 409 && error.error === 'DUPLICATE_REFERENCE') {
        console.log('[公开搜索] 检测到已引用该文件夹（后端返回）');
        console.log('[网页控制台] 检测到已引用该文件夹（后端返回）');

        closePublicSearch();

        const existingDisplayName = error.existingRef?.display_name || folderName;
        showToast(`你已经引用过这个文件夹了："${existingDisplayName}"`, 'info', 3000);

        setTimeout(() => {
          openExistingPublicFolder(existingDisplayName);
        }, 500);
      } else {
        throw new Error(error.error || error.message || '添加失败');
      }
    }

  } catch (error) {
    console.error('[公开搜索] 添加失败:', error);
    showToast(error.message || t('addFailed') || '添加失败', 'error');
  }
}

/**
 * 打开已存在的公开文件夹
 */
function openExistingPublicFolder(displayName) {
  const publicFolders = getPublicFolders();
  const folderRef = publicFolders.find(ref => ref.display_name === displayName);

  if (!folderRef) {
    console.warn('[公开搜索] 未找到公开文件夹引用:', displayName);
    return;
  }

  import('./wordcard/folder.js').then(module => {
    module.openPublicFolderRef(
      folderRef.folder_id,
      folderRef.display_name,
      folderRef.owner_name
    );
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
