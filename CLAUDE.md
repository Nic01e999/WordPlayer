# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Communication Language

**IMPORTANT**: Always communicate with the user in Chinese (中文) when reporting progress, explaining changes, or discussing implementation details, and also use white background. 当和用户探讨计划的时候，不懂的多次询问一起确定方案细节，写log的时候服务器和网页控制台都发一份

## 用户种类
**未登录**
用户无法建立单词卡或文件夹，他们可以临时访问到公共文件夹，但是并不会保存到他们的桌面

**已登陆**
可以在桌面上保存单词卡和文件夹，或者在桌面建立访问到公共文件夹的文件夹接口


## Design Style

**液态玻璃清新风 (Liquid Glass Fresh Style)**

在进行 UI 修改时，务必保持这种设计风格：
- 半透明玻璃效果 + 背景模糊
- 流畅的动画和过渡效果
- 轻盈明快的色彩搭配
- 现代简约的界面元素
- 柔和阴影和圆角

## Project Overview

多语言学习工具 - 支持英语、日语、韩语、中文五种语言的学习。

**两种核心模式**:
- **Dictation Mode（听写模式）**: 听音频输入单词，练习拼写
- **Repeater Mode（复读模式）**: 自动循环播放单词和翻译，用于词汇复习

## Running the Application

```bash
python3 run.py
```

访问地址：`http://127.0.0.1:5001` 或控制台显示的局域网 IP

**依赖**: macOS, Flask, flask-cors, requests

## Detailed Documentation

完整的技术文档请参考 `.claude/` 目录：

- **[architecture.md](.claude/architecture.md)** - 项目架构概览（后端、前端、CSS、数据流）
- **[frontend-modules.md](.claude/frontend-modules.md)** - 前端模块详细文档（14个核心模块）
- **[backend-api.md](.claude/backend-api.md)** - 后端 API 详细文档（10个模块）
- **[css-system.md](.claude/css-system.md)** - CSS 样式系统详细文档（主题系统、液态玻璃风格）
- **[data-flow.md](.claude/data-flow.md)** - 数据流和状态管理详细文档（缓存、预加载、播放、同步）

**使用建议**: 在修改代码前，先查阅相关文档了解模块的详细实现和依赖关系，避免破坏现有功能。

## Quick Reference

### 单词输入格式
```
apple:苹果
happy:快乐的
```
支持 `word:definition` 格式。不提供定义时会自动调用翻译 API。

### 关键技术
- **四级缓存**: 内存 → localStorage → 服务端 → API
- **playId 机制**: 防止异步竞态
- **延迟绑定**: 解决循环依赖
- **并发控制**: 限制 6 个并发请求

### Plan Mode 规则

当用户在 Plan mode 报告 bug 时，计划的结尾必须包含：
1. **Bug Summary** - 用你自己的话重述 bug
2. **Fix Approach** - 解释你计划如何修改
