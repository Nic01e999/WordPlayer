/**
 * 右键菜单模块
 * 提供通用的右键菜单功能
 */

let currentMenu = null;

/**
 * 显示右键菜单
 * @param {Array} items - 菜单项数组 [{label, action, icon?}]
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 */
export function showContextMenu(items, x, y) {
    // 移除已存在的菜单
    hideContextMenu();

    // 创建菜单容器
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // 添加菜单项
    items.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';

        if (item.icon) {
            menuItem.innerHTML = `<span class="context-menu-icon">${item.icon}</span><span>${item.label}</span>`;
        } else {
            menuItem.textContent = item.label;
        }

        menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            item.action();
            hideContextMenu();
        });

        menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);
    currentMenu = menu;

    // 调整位置，防止超出屏幕
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - rect.height - 10}px`;
    }

    // 点击其他地方关闭菜单
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu);
        document.addEventListener('contextmenu', hideContextMenu);
    }, 0);

    console.log('[右键菜单] 显示菜单');
}

/**
 * 隐藏右键菜单
 */
export function hideContextMenu() {
    if (currentMenu) {
        currentMenu.remove();
        currentMenu = null;
        document.removeEventListener('click', hideContextMenu);
        document.removeEventListener('contextmenu', hideContextMenu);
    }
}
