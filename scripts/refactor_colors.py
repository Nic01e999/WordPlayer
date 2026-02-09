#!/usr/bin/env python3
"""
CSS colors.css 重构脚本
自动提取全局变量、模式特定变量，并重新组织文件结构
"""

import re

# 定义全局变量（所有主题都相同的变量）
GLOBAL_VARS = [
    '--icon-border-light',
    '--icon-border-medium',
    '--icon-border-strong',
    '--icon-highlight-start',
    '--icon-highlight-end',
    '--icon-shadow-light',
    '--icon-shadow-medium-light',
    '--icon-shadow-medium',
    '--icon-shadow-strong',
    '--icon-inner-shadow-top',
    '--icon-inner-shadow-bottom',
    '--icon-text-shadow',
    '--icon-mini-shadow',
    '--folder-icon-bg',
    '--folder-icon-border',
    '--folder-empty-bg',
    '--folder-overlay',
    '--folder-title-bg',
    '--folder-title-input-bg',
    '--folder-title-shadow',
    '--folder-title-input-shadow',
    '--drag-shadow-primary',
    '--drag-shadow-secondary',
    '--drag-folder-bg',
    '--delete-btn-bg',
    '--delete-btn-shadow',
    '--toast-error-bg',
    '--toast-shadow',
    '--picker-marker-shadow',
    '--picker-original-shadow',
    '--loading-border',
    '--loading-text',
    '--segmented-bg',
    '--divider-line',
]

# 定义浅色模式特定变量
LIGHT_MODE_VARS = [
    '--glass-bg-light-start',
    '--glass-bg-light-end',
    '--glass-overlay-bg',
    '--input-bg-light',
    '--input-shadow-outer',
    '--input-shadow-inner',
    '--button-secondary-bg',
    '--button-secondary-hover',
    '--card-user-bg',
    '--card-user-hover',
    '--folder-view-bg-start',
    '--folder-view-bg-end',
    '--dropdown-bg-start',
    '--dropdown-bg-end',
    '--dropdown-item-hover',
    '--loading-popup-bg-start',
    '--loading-popup-bg-end',
    '--dialog-text-title',
    '--dialog-text-message',
    '--border-white',
    '--border-white-strong',
    '--white-subtle',
    '--white-medium',
    '--white-strong',
]

# 定义深色模式特定变量
DARK_MODE_VARS = [
    '--glass-bg-light-start',
    '--glass-bg-light-end',
    '--glass-overlay-bg',
    '--input-bg-light',
    '--input-shadow-outer',
    '--input-shadow-inner',
    '--button-secondary-bg',
    '--button-secondary-hover',
    '--card-user-bg',
    '--card-user-hover',
    '--folder-view-bg-start',
    '--folder-view-bg-end',
    '--dropdown-bg-start',
    '--dropdown-bg-end',
    '--dropdown-item-hover',
    '--loading-popup-bg-start',
    '--loading-popup-bg-end',
    '--dialog-text-title',
    '--dialog-text-message',
    '--dark-folder-border-bottom',
    '--dark-folder-close-bg',
    '--dark-folder-close-hover',
    '--dark-button-load-start',
    '--dark-button-load-end',
    '--dark-button-load-hover-start',
    '--dark-button-load-hover-end',
    '--dark-button-load-border',
    '--dark-button-load-text',
    '--dark-button-load-text-hover',
    '--dark-button-load-shadow',
    '--dark-loading-text',
]


def parse_css_block(lines, start_idx, end_idx):
    """解析CSS块，提取变量定义"""
    variables = {}
    current_comment = ""

    i = start_idx
    while i < end_idx:
        line = lines[i].strip()

        # 捕获注释
        if line.startswith('/*') and not line.startswith('/* {{{'):
            current_comment = line
        # 捕获变量定义
        elif line.startswith('--') and ':' in line:
            match = re.match(r'(--[\w-]+):\s*(.+?);', line)
            if match:
                var_name = match.group(1)
                var_value = match.group(2)
                variables[var_name] = {
                    'value': var_value,
                    'comment': current_comment,
                    'line': line
                }
                current_comment = ""

        i += 1

    return variables


def read_file(filepath):
    """读取CSS文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.readlines()


def find_theme_blocks(lines):
    """找到所有主题块的起始和结束位置"""
    blocks = {}
    current_block = None
    start_idx = 0

    for i, line in enumerate(lines):
        stripped = line.strip()

        # :root 块 (粉色浅色默认主题)
        if stripped == ':root {' and i < 10:
            current_block = 'pink-light'
            start_idx = i
        # 粉色深色主题
        elif '[data-theme-color="pink"][data-theme-mode="dark"]' in stripped:
            if current_block:
                blocks[current_block] = (start_idx, i)
            current_block = 'pink-dark'
            start_idx = i
        # 绿色浅色主题
        elif '[data-theme-color="green"][data-theme-mode="light"]' in stripped:
            if current_block:
                blocks[current_block] = (start_idx, i)
            current_block = 'green-light'
            start_idx = i
        # 绿色深色主题
        elif '[data-theme-color="green"][data-theme-mode="dark"]' in stripped:
            if current_block:
                blocks[current_block] = (start_idx, i)
            current_block = 'green-dark'
            start_idx = i
        # 蓝色浅色主题
        elif '[data-theme-color="blue"][data-theme-mode="light"]' in stripped:
            if current_block:
                blocks[current_block] = (start_idx, i)
            current_block = 'blue-light'
            start_idx = i
        # 蓝色深色主题
        elif '[data-theme-color="blue"][data-theme-mode="dark"]' in stripped:
            if current_block:
                blocks[current_block] = (start_idx, i)
            current_block = 'blue-dark'
            start_idx = i
        # 紫色浅色主题
        elif '[data-theme-color="purple"][data-theme-mode="light"]' in stripped:
            if current_block:
                blocks[current_block] = (start_idx, i)
            current_block = 'purple-light'
            start_idx = i
        # 紫色深色主题
        elif '[data-theme-color="purple"][data-theme-mode="dark"]' in stripped:
            if current_block:
                blocks[current_block] = (start_idx, i)
            current_block = 'purple-dark'
            start_idx = i
        # 通用工具变量块
        elif '通用工具变量' in stripped and ':root {' in lines[i+1]:
            if current_block:
                blocks[current_block] = (start_idx, i)
            blocks['utilities'] = (i, i + 15)
            break

    return blocks


def write_output(output_file, global_vars, light_vars, dark_vars, themes, lines, blocks):
    """生成重构后的CSS文件"""
    with open(output_file, 'w', encoding='utf-8') as f:
        # 写入文件头
        f.write("""/**
 * 颜色配置文件 - 集中管理所有颜色变量
 * 使用语义化命名，方便理解和维护
 *
 * 文件结构：
 * 1. 全局通用变量（所有主题共享）
 * 2. 浅色模式通用变量
 * 3. 深色模式通用变量
 * 4. 粉色浅色主题（默认）
 * 5. 各颜色主题特定变量
 * 6. 通用工具变量
 *
 * 注释格式：命名原因 | 使用位置
 */

""")

        # 第1部分：全局通用变量
        f.write("/* " + "=" * 50 + "\n")
        f.write(" * 1. 全局通用变量（所有主题共享）\n")
        f.write(" * " + "=" * 50 + " */\n")
        f.write(":root {\n")
        f.write("    /* {{{ 图标组 (icon-) */\n\n")
        for var_name in GLOBAL_VARS:
            if var_name.startswith('--icon-') and var_name in global_vars:
                var_data = global_vars[var_name]
                if var_data['comment']:
                    f.write(f"    {var_data['comment']}\n")
                f.write(f"    {var_data['line']}\n\n")
        f.write("    /* }}} */\n\n")

        f.write("    /* {{{ 文件夹组 (folder-) */\n\n")
        for var_name in GLOBAL_VARS:
            if var_name.startswith('--folder-') and var_name in global_vars:
                var_data = global_vars[var_name]
                if var_data['comment']:
                    f.write(f"    {var_data['comment']}\n")
                f.write(f"    {var_data['line']}\n\n")
        f.write("    /* }}} */\n\n")

        f.write("    /* {{{ 拖拽组 (drag-) */\n\n")
        for var_name in GLOBAL_VARS:
            if var_name.startswith('--drag-') and var_name in global_vars:
                var_data = global_vars[var_name]
                if var_data['comment']:
                    f.write(f"    {var_data['comment']}\n")
                f.write(f"    {var_data['line']}\n\n")
        f.write("    /* }}} */\n\n")

        f.write("    /* {{{ 删除按钮组 (delete-) */\n\n")
        for var_name in GLOBAL_VARS:
            if var_name.startswith('--delete-') and var_name in global_vars:
                var_data = global_vars[var_name]
                if var_data['comment']:
                    f.write(f"    {var_data['comment']}\n")
                f.write(f"    {var_data['line']}\n\n")
        f.write("    /* }}} */\n\n")

        f.write("    /* {{{ Toast 提示组 (toast-) */\n\n")
        for var_name in GLOBAL_VARS:
            if var_name.startswith('--toast-') and var_name in global_vars:
                var_data = global_vars[var_name]
                if var_data['comment']:
                    f.write(f"    {var_data['comment']}\n")
                f.write(f"    {var_data['line']}\n\n")
        f.write("    /* }}} */\n\n")

        f.write("    /* {{{ 颜色选择器组 (picker-) */\n\n")
        for var_name in GLOBAL_VARS:
            if var_name.startswith('--picker-') and var_name in global_vars:
                var_data = global_vars[var_name]
                if var_data['comment']:
                    f.write(f"    {var_data['comment']}\n")
                f.write(f"    {var_data['line']}\n\n")
        f.write("    /* }}} */\n\n")

        f.write("    /* {{{ 其他全局变量 */\n\n")
        for var_name in GLOBAL_VARS:
            if not any(var_name.startswith(prefix) for prefix in ['--icon-', '--folder-', '--drag-', '--delete-', '--toast-', '--picker-']):
                if var_name in global_vars:
                    var_data = global_vars[var_name]
                    if var_data['comment']:
                        f.write(f"    {var_data['comment']}\n")
                    f.write(f"    {var_data['line']}\n\n")
        f.write("    /* }}} */\n")
        f.write("}\n\n")

        # 第2部分：浅色模式通用变量
        f.write("/* " + "=" * 50 + "\n")
        f.write(" * 2. 浅色模式通用变量\n")
        f.write(" * " + "=" * 50 + " */\n")
        f.write('[data-theme-mode="light"] {\n')
        write_vars_block(f, light_vars, LIGHT_MODE_VARS)
        f.write("}\n\n")

        # 第3部分：深色模式通用变量
        f.write("/* " + "=" * 50 + "\n")
        f.write(" * 3. 深色模式通用变量\n")
        f.write(" * " + "=" * 50 + " */\n")
        f.write('[data-theme-mode="dark"] {\n')
        write_vars_block(f, dark_vars, DARK_MODE_VARS)
        f.write("}\n\n")

        # 第4部分：粉色浅色主题（默认）
        f.write("/* " + "=" * 50 + "\n")
        f.write(" * 4. 粉色浅色主题（默认）\n")
        f.write(" * " + "=" * 50 + " */\n")
        f.write(":root {\n")
        write_theme_specific_vars(f, themes['pink-light'], GLOBAL_VARS + LIGHT_MODE_VARS)
        f.write("}\n\n")

        # 第5部分：其他主题
        f.write("/* " + "=" * 50 + "\n")
        f.write(" * 5. 各颜色主题特定变量\n")
        f.write(" * " + "=" * 50 + " */\n\n")

        # 粉色深色
        f.write("/* ===================================\n")
        f.write(" * 粉色深色主题 (Pink Dark Theme)\n")
        f.write(" * =================================== */\n")
        f.write('[data-theme-color="pink"][data-theme-mode="dark"] {\n')
        write_theme_specific_vars(f, themes['pink-dark'], GLOBAL_VARS + DARK_MODE_VARS)
        f.write("}\n\n")

        # 绿色浅色
        f.write("/* ===================================\n")
        f.write(" * 绿色浅色主题 (Green Light Theme)\n")
        f.write(" * =================================== */\n")
        f.write('[data-theme-color="green"][data-theme-mode="light"] {\n')
        write_theme_specific_vars(f, themes['green-light'], GLOBAL_VARS + LIGHT_MODE_VARS)
        f.write("}\n\n")

        # 绿色深色
        f.write("/* ===================================\n")
        f.write(" * 绿色深色主题 (Green Dark Theme)\n")
        f.write(" * =================================== */\n")
        f.write('[data-theme-color="green"][data-theme-mode="dark"] {\n')
        write_theme_specific_vars(f, themes['green-dark'], GLOBAL_VARS + DARK_MODE_VARS)
        f.write("}\n\n")

        # 蓝色浅色
        f.write("/* ===================================\n")
        f.write(" * 蓝色浅色主题 (Blue Light Theme)\n")
        f.write(" * =================================== */\n")
        f.write('[data-theme-color="blue"][data-theme-mode="light"] {\n')
        write_theme_specific_vars(f, themes['blue-light'], GLOBAL_VARS + LIGHT_MODE_VARS)
        f.write("}\n\n")

        # 蓝色深色
        f.write("/* ===================================\n")
        f.write(" * 蓝色深色主题 (Blue Dark Theme)\n")
        f.write(" * =================================== */\n")
        f.write('[data-theme-color="blue"][data-theme-mode="dark"] {\n')
        write_theme_specific_vars(f, themes['blue-dark'], GLOBAL_VARS + DARK_MODE_VARS)
        f.write("}\n\n")

        # 紫色浅色
        f.write("/* ===================================\n")
        f.write(" * 紫色浅色主题 (Purple Light Theme)\n")
        f.write(" * =================================== */\n")
        f.write('[data-theme-color="purple"][data-theme-mode="light"] {\n')
        write_theme_specific_vars(f, themes['purple-light'], GLOBAL_VARS + LIGHT_MODE_VARS)
        f.write("}\n\n")

        # 紫色深色（需要从原文件读取，因为在blocks中可能没有完整解析）
        if 'purple-dark' in themes:
            f.write("/* ===================================\n")
            f.write(" * 紫色深色主题 (Purple Dark Theme)\n")
            f.write(" * =================================== */\n")
            f.write('[data-theme-color="purple"][data-theme-mode="dark"] {\n')
            write_theme_specific_vars(f, themes['purple-dark'], GLOBAL_VARS + DARK_MODE_VARS)
            f.write("}\n\n")

        # 第6部分：通用工具变量
        f.write("/* " + "=" * 50 + "\n")
        f.write(" * 6. 通用工具变量 (Utility Variables)\n")
        f.write(" * " + "=" * 50 + " */\n")
        if 'utilities' in blocks:
            start, end = blocks['utilities']
            for line in lines[start:end]:
                f.write(line)
        else:
            # 如果没找到，使用默认的
            f.write(""":root {
    /* 过渡时间 */
    --transition-fast: 0.2s ease;
    --transition-smooth: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 0.5s ease;

    /* 常用阴影 */
    --shadow-sm: 0 2px 8px var(--shadow-pink-medium);
    --shadow-md: 0 4px 15px var(--shadow-pink-strong);
    --shadow-lg: 0 8px 24px var(--shadow-large);
}
""")

        # 保留原文档部分（从2314行开始）
        f.write("\n")
        doc_start = 2313
        if doc_start < len(lines):
            for line in lines[doc_start:]:
                f.write(line)


def write_vars_block(f, vars_dict, var_list):
    """写入变量块（按分组）"""
    # 按前缀分组
    groups = {}
    for var_name in var_list:
        if var_name in vars_dict:
            prefix = var_name.split('-')[1] if '--' in var_name else 'other'
            if prefix not in groups:
                groups[prefix] = []
            groups[prefix].append(var_name)

    # 写入各组
    for prefix, var_names in groups.items():
        f.write(f"    /* {{{{ {prefix.capitalize()}组 */\n")
        for var_name in var_names:
            var_data = vars_dict[var_name]
            if var_data['comment']:
                f.write(f"    {var_data['comment']}\n")
            f.write(f"    {var_data['line']}\n")
        f.write("    /* }}} */\n\n")


def write_theme_specific_vars(f, theme_vars, exclude_vars):
    """写入主题特定变量（排除全局和模式变量）"""
    # 按前缀分组
    groups = {}
    for var_name, var_data in theme_vars.items():
        if var_name not in exclude_vars:
            prefix = var_name.split('-')[1] if '--' in var_name and len(var_name.split('-')) > 1 else 'other'
            if prefix not in groups:
                groups[prefix] = []
            groups[prefix].append((var_name, var_data))

    # 写入各组
    for prefix in sorted(groups.keys()):
        f.write(f"    /* {{{{{{ {prefix.capitalize()}组 */\n")
        for var_name, var_data in groups[prefix]:
            if var_data['comment'] and '/* {{{' not in var_data['comment']:
                f.write(f"    {var_data['comment']}\n")
            f.write(f"    {var_data['line']}\n")
        f.write("    /* }}} */\n\n")


def main():
    """主函数"""
    input_file = '/Users/a9/Desktop/tool/repeat_speaker/code/css/colors.css'
    output_file = '/Users/a9/Desktop/tool/repeat_speaker/code/css/colors_new.css'

    print("正在读取原文件...")
    lines = read_file(input_file)

    print("正在查找主题块...")
    blocks = find_theme_blocks(lines)

    print(f"找到 {len(blocks)} 个主题块")
    for name, (start, end) in blocks.items():
        print(f"  {name}: 行 {start+1} - {end}")

    print("\n正在解析各主题块...")
    themes = {}
    for name, (start, end) in blocks.items():
        if name != 'utilities':
            themes[name] = parse_css_block(lines, start, end)
            print(f"  {name}: {len(themes[name])} 个变量")

    # 添加紫色深色主题（如果遗漏）
    if 'purple-dark' not in themes and 'purple-light' in blocks:
        # 找到紫色深色的范围
        purple_light_end = blocks['purple-light'][1]
        utilities_start = blocks.get('utilities', (len(lines), len(lines)))[0]
        themes['purple-dark'] = parse_css_block(lines, purple_light_end, utilities_start)
        print(f"  purple-dark: {len(themes['purple-dark'])} 个变量")

    print("\n正在提取全局变量...")
    global_vars = {}
    for var_name in GLOBAL_VARS:
        if var_name in themes.get('pink-light', {}):
            global_vars[var_name] = themes['pink-light'][var_name]
    print(f"  提取了 {len(global_vars)} 个全局变量")

    print("\n正在提取浅色模式变量...")
    light_vars = {}
    for var_name in LIGHT_MODE_VARS:
        if var_name in themes.get('pink-light', {}):
            light_vars[var_name] = themes['pink-light'][var_name]
    print(f"  提取了 {len(light_vars)} 个浅色模式变量")

    print("\n正在提取深色模式变量...")
    dark_vars = {}
    for var_name in DARK_MODE_VARS:
        if var_name in themes.get('pink-dark', {}):
            dark_vars[var_name] = themes['pink-dark'][var_name]
    print(f"  提取了 {len(dark_vars)} 个深色模式变量")

    print("\n正在生成新文件...")
    write_output(output_file, global_vars, light_vars, dark_vars, themes, lines, blocks)

    print("\n重构完成！")
    print(f"原文件: {len(lines)} 行")
    print(f"新文件: {output_file}")
    print(f"  - 全局变量: {len(global_vars)} 个")
    print(f"  - 浅色模式变量: {len(light_vars)} 个")
    print(f"  - 深色模式变量: {len(dark_vars)} 个")
    print(f"  - 8个主题块（只保留特定变量）")


if __name__ == '__main__':
    main()
